/* Estado global de la app: los datos (state), lo que se está viendo (ui) y la sesión.
   Es un store pequeño fuera de React para que el guardado siempre lea los datos más recientes. */
import { useSyncExternalStore } from 'react';
import type { AppState } from './lib/types';
import type { QuotesCache } from './lib/stocks';

export type Screen =
  | { kind: 'picker' }
  | { kind: 'lock'; userId: string; error?: string }
  | { kind: 'loading' }
  | { kind: 'loadError' }
  | { kind: 'app' };

export type Modal = { type: string; [key: string]: any };

export interface Ui {
  section: 'finanzas' | 'bolsa' | 'ejercicio';
  tab: string;
  monthOffset: number;
  viewMode: 'total' | 'mensual';
  currencyTab: string | null;
  expandedCards: Record<string, boolean>;
  /* Botones de "¿Seguro?" que se desarman solos a los 3 segundos. */
  confirm: Record<string, string | null>;
  modal: Modal | null;
  quotesCache: QuotesCache;
  quotesLoading: boolean;
  /* Ejercicio: qué muestra la gráfica de avance ('ex:<id>' o 'rt:<id>') y qué mes el calendario. */
  exChart: string | null;
  exCalOffset: number;
}

export interface Store {
  state: AppState | null;
  ui: Ui;
  screen: Screen;
  currentUser: string | null;
  toast: { msg: string; id: number } | null;
}

function initialUi(): Ui {
  return {
    section: 'finanzas', tab: 'resumen', monthOffset: 0, viewMode: 'total', currencyTab: null,
    expandedCards: {}, confirm: {}, modal: null, quotesCache: {}, quotesLoading: false,
    exChart: null, exCalOffset: 0
  };
}

let store: Store = { state: null, ui: initialUi(), screen: { kind: 'picker' }, currentUser: null, toast: null };
const listeners = new Set<() => void>();

export function getStore() { return store; }
export function setStore(patch: Partial<Store>) {
  store = Object.assign({}, store, patch);
  listeners.forEach(l => l());
}
export function setUi(patch: Partial<Ui>) { setStore({ ui: Object.assign({}, store.ui, patch) }); }
export function resetUi() { setStore({ ui: initialUi() }); }
export function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function useStore() { return useSyncExternalStore(subscribe, getStore); }

/* Aplica un cambio sobre una copia de los datos y lo guarda. */
export function commit(mutator: (draft: AppState) => void) {
  if (!store.state) return Promise.resolve();
  const draft: AppState = JSON.parse(JSON.stringify(store.state));
  mutator(draft);
  setStore({ state: draft });
  return saveHook();
}
/* El guardado real vive en api/client.ts; se conecta aquí para evitar importaciones circulares. */
let saveHook: () => Promise<void> = () => Promise.resolve();
export function setSaveHook(fn: () => Promise<void>) { saveHook = fn; }

export function openModal(modal: Modal) { setUi({ modal: modal }); }
export function closeModal() { setUi({ modal: null }); }

export function askConfirm(key: string, id: string) {
  setUi({ confirm: Object.assign({}, store.ui.confirm, { [key]: id }) });
  setTimeout(() => {
    if (store.ui.confirm[key] === id) setUi({ confirm: Object.assign({}, store.ui.confirm, { [key]: null }) });
  }, 3000);
}
export function clearConfirm(key: string) { setUi({ confirm: Object.assign({}, store.ui.confirm, { [key]: null }) }); }

/* ---- Avisos ---- */
let toastSeq = 0;
let toastHoldUntil = 0;
export function showToast(msg: string) {
  if (Date.now() < toastHoldUntil) return;
  setStore({ toast: { msg: msg, id: ++toastSeq } });
}
/* Muestra un aviso importante y evita que el siguiente aviso normal lo tape. */
export function showToastHold(msg: string) { toastHoldUntil = 0; showToast(msg); toastHoldUntil = Date.now() + 3500; }
