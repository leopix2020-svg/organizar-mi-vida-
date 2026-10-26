/* ---- Persistencia real vía /api/state (MongoDB detrás) y precios vía /api/quote ---- */
import { QUOTE_TTL_MS, USERS } from '../lib/constants';
import { defaultState, normalizeState } from '../lib/state';
import type { AppState } from '../lib/types';
import type { QuotesCache } from '../lib/stocks';
import { closeModal, getStore, setSaveHook, setStore, setUi, showToastHold } from '../store';

/* ---- Sesión (en localStorage: mvo-secret-<usuario> y mvo-last-user) ---- */
export function getSecret(userId: string) { return localStorage.getItem('mvo-secret-' + userId) || ''; }
export function setSecret(userId: string, v: string) { localStorage.setItem('mvo-secret-' + userId, v); }
export function clearSecret(userId: string) { localStorage.removeItem('mvo-secret-' + userId); }
export function hasSecret(userId: string) { return !!getSecret(userId); }
export function getLastUser() { return localStorage.getItem('mvo-last-user') || ''; }
export function setLastUser(userId: string) { localStorage.setItem('mvo-last-user', userId); }
export function clearLastUser() { localStorage.removeItem('mvo-last-user'); }

function authHeaders(): Record<string, string> {
  const user = getStore().currentUser || '';
  return { 'x-app-user': user, 'x-app-secret': getSecret(user) };
}
function handleUnauthorized() {
  const user = getStore().currentUser || '';
  clearSecret(user);
  setStore({ state: null, screen: { kind: 'lock', userId: user, error: 'Clave incorrecta. Intenta de nuevo.' } });
  throw new Error('unauthorized');
}

async function apiRequest(method: string, body?: unknown) {
  const opts: RequestInit = { method: method, headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()) };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch('/api/state', opts);
  if (res.status === 401) handleUnauthorized();
  return res;
}

/* stateVersion: versión del documento en el servidor que tenemos cargada. Viaja en cada guardado;
   si otro dispositivo guardó antes, el servidor responde 409 y no se pisa nada. */
let stateVersion = 0;
let saveQueue: Promise<void> = Promise.resolve();

type LoadResult = { ok: true; state: AppState; version: number } | { ok: false; unauthorized?: boolean };

/* Si falla, NUNCA devuelve un estado vacío: así no se puede guardar encima de los datos reales. */
export async function loadState(): Promise<LoadResult> {
  try {
    const res = await apiRequest('GET');
    if (!res.ok) return { ok: false };
    const data = await res.json();
    const loaded = (data && data.value) ? normalizeState(JSON.parse(data.value)) : defaultState();
    return { ok: true, state: loaded, version: (data && typeof data.version === 'number') ? data.version : 0 };
  } catch (e) {
    if (e instanceof Error && e.message === 'unauthorized') return { ok: false, unauthorized: true };
    console.error('Load error', e);
    return { ok: false };
  }
}

/* Los guardados van en fila, uno detrás de otro, para que cada uno lleve la versión más reciente. */
export function saveState() {
  saveQueue = saveQueue.then(doSaveState, doSaveState);
  return saveQueue;
}
setSaveHook(saveState);

async function doSaveState() {
  const state = getStore().state;
  if (!state) return;
  try {
    const res = await apiRequest('PUT', { value: JSON.stringify(state), baseVersion: stateVersion });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.version === 'number') stateVersion = data.version;
      return;
    }
    if (res.status === 409) { await reloadAfterConflict(); return; }
    showToastHold('No se pudo guardar. Intenta de nuevo.');
  } catch (e) {
    if (e instanceof Error && e.message === 'unauthorized') return;
    console.error('Storage error', e); showToastHold('No se pudo guardar. Revisa tu conexión.');
  }
}

async function reloadAfterConflict() {
  const r = await loadState();
  if (!r.ok) { if (!r.unauthorized) setStore({ state: null, screen: { kind: 'loadError' } }); return; }
  stateVersion = r.version;
  setStore({ state: r.state });
  closeModal();
  showToastHold('Hubo cambios desde otro dispositivo. Cargué lo más nuevo: repite tu última acción.');
}

export async function boot() {
  setStore({ state: null, screen: { kind: 'loading' } });
  const r = await loadState();
  if (!r.ok) { if (!r.unauthorized) setStore({ screen: { kind: 'loadError' } }); return; }
  stateVersion = r.version;
  setStore({ state: r.state, screen: { kind: 'app' } });
}

export async function selectUser(userId: string) {
  if (hasSecret(userId)) {
    setStore({ currentUser: userId });
    setLastUser(userId);
    await boot();
  } else {
    setStore({ currentUser: userId, screen: { kind: 'lock', userId: userId } });
  }
}
export async function submitLock(userId: string, secret: string) {
  setSecret(userId, secret);
  setStore({ currentUser: userId });
  setLastUser(userId);
  await boot();
}
export function showUserPicker() {
  setStore({ currentUser: null, state: null, screen: { kind: 'picker' } });
}
export function logout() {
  const user = getStore().currentUser;
  if (user) clearSecret(user);
  clearLastUser();
  closeModal();
  showUserPicker();
}

/* ---- Precios reales de acciones ---- */
export async function apiRequestQuotes(tickers: string[]) {
  const res = await fetch('/api/quote?symbols=' + encodeURIComponent(tickers.join(',')), { headers: authHeaders() });
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) throw new Error('quote fetch failed');
  return await res.json();
}
export async function refreshQuotesIfNeeded() {
  const { state, ui } = getStore();
  if (!state) return;
  const tickers = (state.bolsaPositions || []).map(p => p.ticker);
  if (tickers.length === 0) return;
  const uniq = tickers.filter((t, i) => tickers.indexOf(t) === i);
  const now = Date.now();
  const stale = uniq.filter(t => { const c = ui.quotesCache[t]; return !c || (now - c.fetchedAt) > QUOTE_TTL_MS; });
  if (stale.length === 0 || ui.quotesLoading) return;
  setUi({ quotesLoading: true });
  try {
    const res = await apiRequestQuotes(uniq);
    if (res && res.quotes) {
      const cache: QuotesCache = Object.assign({}, getStore().ui.quotesCache);
      uniq.forEach(t => {
        const q = res.quotes[t];
        if (q && typeof q.price === 'number') cache[t] = { price: q.price, change: q.change, changePct: q.changePct, fetchedAt: Date.now() };
        else cache[t] = { error: true, fetchedAt: Date.now() };
      });
      setUi({ quotesCache: cache, quotesLoading: false });
      return;
    }
  } catch (e) { console.error('Quotes error', e); }
  setUi({ quotesLoading: false });
}

/* Arranque: si ya hay usuario y clave guardados, entra directo. */
export function init() {
  const last = getLastUser();
  if (last && USERS.some(u => u.id === last) && hasSecret(last)) {
    setStore({ currentUser: last });
    void boot();
  } else {
    showUserPicker();
  }
}
