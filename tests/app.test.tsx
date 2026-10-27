/* La app completa en jsdom, conectada a api/state.js real sobre MongoDB falso. */
import { act, fireEvent, render, screen } from '@testing-library/react';
import oldState from './fixtures/old-state.json';
import { App } from '../src/App';
import { init, saveState } from '../src/api/client';
import { FINANZAS_TABS } from '../src/lib/constants';
import { monthExpense, monthIncome } from '../src/lib/finance';
import { fmt, monthShortLabel } from '../src/lib/format';
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
  it('carga sin guardar y muestra Finanzas, Bolsa, Ejercicio y Comidas', async () => {
    const { container } = await startApp();
    expect(getStore().screen.kind).toBe('app');
    expect(server.puts).toBe(0);
    expect([...container.querySelectorAll('.rail button')].map(b => b.textContent)).toEqual(['Finanzas', 'Bolsa', 'Ejercicio', 'Comidas']);
  });

  it('comidas: anotar el día (las comidas suman las calorías), ver restante y copiar metas', async () => {
    const { container } = await startApp();
    fireEvent.click(screen.getByText('Comidas'));
    fireEvent.click(screen.getByText('Anotar día'));
    const inputs = () => [...container.ownerDocument.querySelectorAll('.macro-grid input')] as HTMLInputElement[];
    /* comidas (4), comido: kcal, quemadas, carbos, proteína, grasa (5), metas (4) */
    [['0', '120'], ['1', '716'], ['2', '1538']].forEach(([i, v]) => fireEvent.change(inputs()[+i], { target: { value: v } }));
    expect(inputs()[4].value).toBe('2374');
    [['5', '285'], ['6', '158'], ['7', '155'], ['8', '160'], ['9', '2344'], ['10', '321'], ['11', '128'], ['12', '85']].forEach(([i, v]) => fireEvent.change(inputs()[+i], { target: { value: v } }));
    await act(async () => { fireEvent.click(screen.getByText('Guardar día')); });
    await flush();
    const d = dbState().nutritionDays[0];
    expect([d.eaten, d.goal, d.burned, d.meals]).toEqual([{ kcal: 2374, carbs: 158, protein: 155, fat: 160 }, { kcal: 2344, carbs: 321, protein: 128, fat: 85 }, 285, { breakfast: 120, lunch: 716, dinner: 1538, snacks: 0 }]);
    expect(container.textContent).toContain('Restante');
    expect(container.textContent).toContain('255 kcal');
    expect(container.textContent).toContain('155 / 128 g');
    /* El día anterior: las metas vienen copiadas. */
    fireEvent.click(container.querySelector('.month-nav .arrow')!);
    fireEvent.click(screen.getByText('Anotar día'));
    expect(inputs()[9].value).toBe('2344');
    expect(inputs()[11].value).toBe('128');
  });

  it('peso corporal: anotar y ver', async () => {
    const { container } = await startApp();
    fireEvent.click(screen.getByText('Ejercicio'));
    fireEvent.click(screen.getByText('+ Anotar'));
    fireEvent.change(screen.getByPlaceholderText('Ej. 72.5'), { target: { value: '72.5' } });
    await act(async () => { fireEvent.click(screen.getByText('Guardar')); });
    await flush();
    expect(dbState().bodyWeights[0].kg).toBe(72.5);
    expect(container.textContent).toContain('72.5 kg');
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

  it('ingresos vs. gastos: dos líneas de 6 meses con los montos correctos', async () => {
    const { container } = await startApp();
    const lines = container.querySelectorAll('#main-content polyline');
    expect(lines.length).toBe(2);
    lines.forEach(l => expect(l.getAttribute('points')!.split(' ').length).toBe(6));
    expect(container.querySelectorAll('#main-content rect').length).toBe(0);
    const st = getStore().state!;
    const tips = [...container.querySelectorAll('#main-content circle[data-tooltip]')].map(c => c.getAttribute('data-tooltip'));
    for (let o = -5; o <= 0; o++) {
      expect(tips).toContain('Ingresos · ' + monthShortLabel(o) + ': ' + fmt(st, monthIncome(st, o, 'USD')));
      expect(tips).toContain('Gastos · ' + monthShortLabel(o) + ': ' + fmt(st, monthExpense(st, o, 'USD')));
    }
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
  /* Estas dos van al final: sus avisos importantes bloquean otros avisos por 3,5 s. */
  it('ejercicio: crear rutina desde el catálogo, registrar sesiones y ver récord', async () => {
    const { container } = await startApp();
    const doc = container.ownerDocument;
    fireEvent.click(screen.getByText('Ejercicio'));
    fireEvent.click(screen.getByText('+ Nueva'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Rutina A'), { target: { value: 'Rutina A' } });
    const search = screen.getByPlaceholderText('Ej. flex, push, dominadas…');
    fireEvent.change(search, { target: { value: 'push' } });
    fireEvent.click(doc.querySelector('.suggestion-item')!);
    fireEvent.change(search, { target: { value: 'curl mart' } });
    fireEvent.click(doc.querySelector('.suggestion-item')!);
    fireEvent.change(search, { target: { value: 'Mi ejercicio raro' } });
    fireEvent.click(screen.getByText('+ Crear «Mi ejercicio raro»'));
    fireEvent.click(doc.querySelectorAll('.workout-block .segmented button')[1]);
    fireEvent.click(screen.getByText('Agregar a la rutina'));
    await act(async () => { fireEvent.click(screen.getByText('Crear rutina')); });
    await flush();
    let st = dbState();
    expect(st.routines[0].name).toBe('Rutina A');
    expect(st.exercises.map((e: any) => [e.name, e.weighted])).toEqual([['Flexiones', false], ['Curl martillo', true], ['Mi ejercicio raro', false]]);

    async function logSession(flexReps: string[], curlKg: string) {
      fireEvent.click(screen.getByText('Hoy hice…'));
      const blocks = [...doc.querySelectorAll('.workout-block')];
      flexReps.forEach((r, i) => {
        if (i > 0 && blocks[0].querySelectorAll('.set-row').length <= i) fireEvent.click(blocks[0].querySelector('.btn-small:not(.danger)')!);
        fireEvent.change([...doc.querySelectorAll('.workout-block')][0].querySelectorAll('.set-row')[i].querySelector('input')!, { target: { value: r } });
      });
      const curlRow = [...doc.querySelectorAll('.workout-block')][1].querySelector('.set-row')!;
      fireEvent.change(curlRow.querySelectorAll('input')[0], { target: { value: '10' } });
      fireEvent.change(curlRow.querySelectorAll('input')[1], { target: { value: curlKg } });
      await act(async () => { fireEvent.click(screen.getByText('Guardar sesión')); });
      await flush();
    }
    await logSession(['12', '10'], '8');
    st = dbState();
    expect(st.workouts.length).toBe(1);
    expect(st.workouts[0].entries[0].sets).toEqual([{ reps: 12, kg: null }, { reps: 10, kg: null }]);
    expect(st.workouts[0].entries.length).toBe(2);

    await logSession(['15', '10'], '10');
    expect(getStore().toast!.msg).toContain('récord en Flexiones');
    expect(dbState().workouts.length).toBe(2);
    expect(container.textContent).toContain('🏆');
    expect(container.querySelectorAll('#main-content polyline').length).toBeGreaterThan(0);
  });

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
