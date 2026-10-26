/* La app completa en jsdom, conectada a api/state.js real sobre MongoDB falso. */
import { act, fireEvent, render, screen } from '@testing-library/react';
import oldState from './fixtures/old-state.json';
import { App } from '../src/App';
import { init, saveState } from '../src/api/client';
import { FINANZAS_TABS } from '../src/lib/constants';
import { getStore, resetUi, setStore, setUi } from '../src/store';
import { dbDoc, dbState, fakeFetch, historyCol, seed, server } from './helpers/fakeServer';

const flush = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0)); });

async function startApp(opts: { failGet?: boolean } = {}) {
  server.failGet = !!opts.failGet; server.puts = 0;
  localStorage.setItem('mvo-last-user', 'leo');
  localStorage.setItem('mvo-secret-leo', 'clave-leo');
  resetUi();
  setStore({ state: null, screen: { kind: 'picker' }, currentUser: null, toast: null });
  const view = render(<App />);
  init();
  await flush();
  return view;
}

beforeAll(() => {
  (globalThis as any).fetch = fakeFetch;
  /* jsdom no trae Blob.text(); los navegadores sí. */
  if (!Blob.prototype.text) Blob.prototype.text = function (this: Blob) { return new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsText(this); }); };
  window.matchMedia = ((q: string) => ({ matches: (window as any).__desktop === true && q.indexOf('880') > -1, addListener() { /* nada */ }, removeListener() { /* nada */ } })) as any;
});
beforeEach(() => { seed('leo', oldState); (window as any).__desktop = false; });

describe('app', () => {
  it('carga sin guardar y solo muestra Finanzas y Bolsa', async () => {
    const { container } = await startApp();
    expect(getStore().screen.kind).toBe('app');
    expect(server.puts).toBe(0);
    expect([...container.querySelectorAll('.rail button')].map(b => b.textContent)).toEqual(['Finanzas', 'Bolsa']);
  });

  it('si la carga falla, no abre ni guarda', async () => {
    await startApp({ failGet: true });
    expect(getStore().state).toBeNull();
    expect(screen.getByText('Reintentar')).toBeTruthy();
    await act(() => saveState());
    expect(server.puts).toBe(0);
  });

  it('guardar conserva los datos ocultos y deja historial', async () => {
    await startApp();
    await act(() => saveState());
    const saved = dbState();
    expect(saved.books.length).toBe(1);
    expect(saved.meals.length).toBe(1);
    expect(saved.calorieGoal).toBe(1800);
    expect(dbDoc().version).toBe(1);
    expect(historyCol.docs.length).toBe(1);
  });

  it('guardados seguidos no chocan entre sí', async () => {
    await startApp();
    await act(() => Promise.all([saveState(), saveState(), saveState()]).then(() => undefined));
    expect(dbDoc().version).toBe(3);
  });

  it('nuevo movimiento desde el modal se guarda', async () => {
    const { container } = await startApp();
    act(() => setUi({ viewMode: 'mensual', tab: 'movimientos' }));
    fireEvent.click(container.querySelector('.fab')!);
    fireEvent.change(container.querySelector('.sheet input[type=number]')!, { target: { value: '12.5' } });
    await act(async () => { fireEvent.click(screen.getByText('Guardar movimiento')); });
    await flush();
    expect(dbState().transactions.some((t: any) => t.amount === 12.5 && t.type === 'expense')).toBe(true);
  });

  it('no deja borrar una wallet con movimientos', async () => {
    const { container } = await startApp();
    act(() => setUi({ tab: 'cuentas' }));
    fireEvent.click(screen.getAllByText('Eliminar')[0]);
    await act(async () => { fireEvent.click(screen.getByText('¿Eliminar?')); });
    expect(getStore().toast!.msg).toMatch('tiene movimientos');
    expect(getStore().state!.accounts.length).toBe(4);
    expect(container).toBeTruthy();
  });

  it('Debo / me deben muestra lo que falta', async () => {
    const { container } = await startApp();
    const mini = [...container.querySelectorAll('.summary-mini .card')].find(c => c.textContent!.indexOf('Debo / me deben') > -1)!;
    expect(mini.textContent).toContain('$150.00 · $80.00');
  });

  it('descargar y cargar respaldo', async () => {
    const blobs: Blob[] = []; const names: string[] = [];
    URL.createObjectURL = ((b: Blob) => { blobs.push(b); return 'blob:x'; }) as any;
    URL.revokeObjectURL = () => { /* nada */ };
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { names.push(this.download); };
    const { container } = await startApp();
    const original = JSON.stringify(getStore().state);
    act(() => setUi({ modal: { type: 'settings' } }));
    fireEvent.click(screen.getByText('Descargar respaldo'));
    expect(names[0]).toMatch(/^respaldo-leo-\d{4}-\d{2}-\d{2}\.json$/);
    const text = await blobs[0].text();
    await act(async () => { const st = JSON.parse(original); st.transactions = []; setStore({ state: st }); await saveState(); });
    const input = container.ownerDocument.getElementById('backup-file') as HTMLInputElement;
    const file = new File([text], 'r.json', { type: 'application/json' });
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    await flush();
    expect(screen.getByText('¿Cargar este respaldo?')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByText('Sí, cargar respaldo')); });
    await flush();
    expect(names[1]).toMatch(/antes-de-cargar/);
    expect(JSON.stringify(getStore().state)).toBe(original);
    expect(JSON.stringify(dbState())).toBe(original);
  });

  it('si fallan los precios de la bolsa, no los pide en bucle', async () => {
    server.failQuotes = true; server.quoteCalls = 0;
    await startApp();
    act(() => setUi({ section: 'bolsa' }));
    await flush(); await flush();
    expect(server.quoteCalls).toBe(1);
    expect(screen.getByText('Cargando…')).toBeTruthy();
    server.failQuotes = false;
  });

  it('todas las pantallas se dibujan (celular y escritorio)', async () => {
    const { container } = await startApp();
    for (const t of FINANZAS_TABS) {
      for (const mode of ['total', 'mensual'] as const) {
        act(() => setUi({ section: 'finanzas', tab: t.id, viewMode: mode }));
        expect(container.querySelector('#main-content')!.textContent!.length).toBeGreaterThan(0);
      }
    }
    act(() => setUi({ section: 'bolsa' }));
    expect(container.querySelector('#main-content')!.textContent).toContain('Tus acciones');
    (window as any).__desktop = true;
    const desk = await startApp();
    expect(desk.container.querySelector('.dash-grid')).toBeTruthy();
  });
  /* Va al final: su aviso importante bloquea otros avisos por 3,5 s. */
  it('conflicto con otro dispositivo: no pisa y recarga lo nuevo', async () => {
    await startApp();
    const other = JSON.parse(dbDoc().value);
    other.transactions.push({ id: 'tOtro', type: 'income', amount: 1, category: 'extra', date: '2026-10-10', note: '', createdAt: 99, accountId: 'a1' });
    dbDoc().value = JSON.stringify(other); dbDoc().version = 5;
    await act(async () => {
      const st = JSON.parse(JSON.stringify(getStore().state));
      st.transactions.push({ id: 'tViejo', type: 'income', amount: 5, category: 'extra', date: '2026-10-11', note: '', createdAt: 100, accountId: 'a1' });
      setStore({ state: st });
      await saveState();
    });
    await flush();
    expect(dbDoc().version).toBe(5);
    expect(dbState().transactions.some((t: any) => t.id === 'tViejo')).toBe(false);
    expect(getStore().state!.transactions.some(t => t.id === 'tOtro')).toBe(true);
    expect(getStore().toast!.msg).toMatch('otro dispositivo');
  });

});
