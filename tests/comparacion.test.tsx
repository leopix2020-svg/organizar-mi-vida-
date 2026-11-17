/* Comparación de Comidas entre personas: api/compare.js, la lógica y la tarjeta. */
import { render, waitFor } from '@testing-library/react';
import { callCompare, seed, stateCol } from './helpers/fakeServer';
import { ComidasSection } from '../src/components/ComidasSection';
import { dateToStr, todayStr } from '../src/lib/format';
import { defaultState } from '../src/lib/state';
import type { NutritionDay } from '../src/lib/types';
import * as N from '../src/lib/nutrition';
import { getStore, resetUi, setStore } from '../src/store';

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return dateToStr(d); }
function day(id: string, date: string, eaten: number, goal: number, burned = 0): NutritionDay {
  return { id, date, eaten: { kcal: eaten, carbs: 10, protein: 20, fat: 30 }, goal: { kcal: goal, carbs: 1, protein: 2, fat: 3 }, burned, meals: { breakfast: 5, lunch: eaten, dinner: 0, snacks: 0 }, createdAt: 1 };
}
const leo = { 'x-app-user': 'leo', 'x-app-secret': 'clave-leo' };
const tizi = { 'x-app-user': 'tizi', 'x-app-secret': 'clave-tizi' };

function seedBoth() {
  const l = defaultState();
  l.nutritionDays = [day('a', '2026-11-10', 2000, 2300, 400)];
  (l as any).meals = [{ id: 'viejo', date: '2026-01-01', text: 'arepa', calories: 999 }];
  l.transactions = [{ id: 't', type: 'income', amount: 5000, category: 'x', date: '2026-11-01', note: 'sueldo', createdAt: 1, accountId: 'a' } as any];
  seed('leo', l);
  const t = defaultState();
  t.nutritionDays = [day('b', '2026-11-10', 1800, 1600), day('c', '2026-11-11', 1500, 1600)];
  stateCol.docs.push({ _id: 'state-tizi', value: JSON.stringify(t), version: 3 });
}

describe('api/compare', () => {
  beforeEach(seedBoth);

  it('pide usuario y clave correctos y solo acepta GET', async () => {
    expect((await callCompare('GET', { 'x-app-user': 'leo', 'x-app-secret': 'mala' })).status).toBe(401);
    expect((await callCompare('GET', { 'x-app-user': 'nadie', 'x-app-secret': 'x' })).status).toBe(400);
    expect((await callCompare('PUT', leo)).status).toBe(405);
  });

  it('con la clave de cualquiera devuelve de ambos solo fecha, comido y meta de Comidas', async () => {
    const expected = { users: [
      { id: 'leo', days: [{ date: '2026-11-10', eaten: 2000, goal: 2300 }] },
      { id: 'tizi', days: [{ date: '2026-11-10', eaten: 1800, goal: 1600 }, { date: '2026-11-11', eaten: 1500, goal: 1600 }] }
    ] };
    const r1 = await callCompare('GET', leo);
    expect(r1.status).toBe(200);
    expect(r1.body).toEqual(expected);
    expect((await callCompare('GET', tizi)).body).toEqual(expected);
    /* Nada de finanzas ni de las comidas viejas de Salud. */
    expect(JSON.stringify(r1.body)).not.toMatch(/sueldo|arepa|5000|999|protein/);
  });

  it('una persona sin documento sale sin días', async () => {
    seed('leo', defaultState());
    expect((await callCompare('GET', leo)).body).toEqual({ users: [{ id: 'leo', days: [] }, { id: 'tizi', days: [] }] });
  });
});

describe('lógica de la comparación', () => {
  it('ahorró = meta − comido sin quemadas, solo días del período', () => {
    const s = defaultState();
    s.nutritionDays = [day('a', todayStr(), 2000, 2300, 500), day('b', '2020-01-15', 3000, 2000)];
    const days = N.compareDays(s);
    expect(N.compareTotals(days, 'week')).toEqual({ days: 1, eaten: 2000, goal: 2300, saved: 300 });
    expect(N.compareTotals(days, 'all')).toEqual({ days: 2, eaten: 5000, goal: 4300, saved: -700 });
  });
  it('la serie junta las fechas de ambos y pone null donde alguien no anotó', () => {
    const a = [{ date: '2026-11-11', eaten: 1, goal: 0 }, { date: '2026-11-09', eaten: 2, goal: 0 }];
    const b = [{ date: '2026-11-10', eaten: 3, goal: 0 }, { date: '2026-11-11', eaten: 4, goal: 0 }];
    expect(N.compareSeries([a, b], 'all')).toEqual([
      { date: '2026-11-09', eaten: [2, null] },
      { date: '2026-11-10', eaten: [null, 3] },
      { date: '2026-11-11', eaten: [1, 4] }
    ]);
  });
});

describe('tarjeta Leo Jr vs Tizi', () => {
  afterEach(() => { vi.unstubAllGlobals(); setStore({ currentUser: null }); });

  it('lo propio sale del estado local y lo del otro del servidor, con gráfica de dos líneas', async () => {
    const today = todayStr(), yesterday = daysAgo(1);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ users: [
      { id: 'leo', days: [{ date: today, eaten: 9999, goal: 1 }] },
      { id: 'tizi', days: [{ date: today, eaten: 1800, goal: 1600 }, { date: yesterday, eaten: 1500, goal: 1600 }] }
    ] }), { status: 200 })));
    setStore({ currentUser: 'leo' });
    resetUi();
    const s = defaultState();
    s.nutritionDays = [day('a', today, 2000, 2300, 400)];
    const r = render(<ComidasSection s={s} ui={Object.assign({}, getStore().ui, { nutCompare: 'all' })} />);
    await waitFor(() => expect(r.container.textContent).toContain('Leo Jr vs Tizi'));
    await waitFor(() => expect(r.container.textContent).toContain('Comido 2,000 kcal · meta 2,300 kcal'));
    const txt = r.container.textContent || '';
    expect(txt).toContain('Ahorró 300 kcal');
    expect(txt).not.toContain('9,999');
    expect(txt).toContain('Comido 3,300 kcal · meta 3,200 kcal');
    expect(txt).toContain('Se pasó 100 kcal');
    expect(txt).toContain('Calorías comidas por día');
    expect(r.container.querySelectorAll('polyline[stroke="var(--gold)"]').length).toBeGreaterThan(0);
    r.unmount();
  });

  it('si falla la carga lo dice y no rompe la sección', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    resetUi();
    const r = render(<ComidasSection s={defaultState()} ui={getStore().ui} />);
    await waitFor(() => expect(r.container.textContent).toContain('No se pudo cargar la comparación.'));
    expect(r.container.textContent).toContain('Balance');
    r.unmount();
  });
});
