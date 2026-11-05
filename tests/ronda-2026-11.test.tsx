/* Precios al abrir, distribución de la Bolsa, rachas y kilos en Comidas, y mis récords en Ejercicio. */
import { render } from '@testing-library/react';
import { BolsaSection } from '../src/components/BolsaSection';
import { ComidasSection } from '../src/components/ComidasSection';
import { EjercicioSection } from '../src/components/EjercicioSection';
import { dateToStr } from '../src/lib/format';
import { defaultState } from '../src/lib/state';
import type { NutritionDay, Workout } from '../src/lib/types';
import * as N from '../src/lib/nutrition';
import * as S from '../src/lib/stocks';
import * as W from '../src/lib/workout';
import { getStore, resetUi, setUi } from '../src/store';

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return dateToStr(d); }
function day(date: string, eaten: number, goal: number): NutritionDay {
  return { id: date, date, eaten: { kcal: eaten, carbs: 0, protein: 0, fat: 0 }, goal: { kcal: goal, carbs: 0, protein: 0, fat: 0 }, burned: 0, meals: { breakfast: 0, lunch: eaten, dinner: 0, snacks: 0 }, createdAt: 1 };
}
const q = (price: number) => ({ price, fetchedAt: Date.now() });

describe('bolsa', () => {
  const s = defaultState();
  s.bolsaPositions = [
    { id: 'a', ticker: 'AAPL', amountInvested: 100, purchasePrice: 10, shares: 10, purchaseDate: '2026-10-01' },
    { id: 'b', ticker: 'MSFT', amountInvested: 50, purchasePrice: 25, shares: 2, purchaseDate: '2026-10-15' },
    { id: 'c', ticker: 'AAPL', amountInvested: 20, purchasePrice: 10, shares: 2, purchaseDate: '2026-10-20' }
  ];
  it('distribución por acción (sumando compras repetidas) y null si falta un precio', () => {
    expect(S.bolsaDistribution(s, { AAPL: q(10), MSFT: q(40) })).toEqual([
      { ticker: 'AAPL', value: 120, pct: 0.6 }, { ticker: 'MSFT', value: 80, pct: 0.4 }]);
    expect(S.bolsaDistribution(s, { AAPL: q(10) })).toBeNull();
  });
  it('la tarjeta muestra dona y lista, o espera precios', () => {
    resetUi();
    let r = render(<BolsaSection s={s} ui={getStore().ui} />);
    expect(r.container.textContent).toContain('Esperando precios…');
    r.unmount();
    setUi({ quotesCache: { AAPL: q(10), MSFT: q(40) } });
    r = render(<BolsaSection s={s} ui={getStore().ui} />);
    const rows = [...r.container.querySelectorAll('.donut-legend-row')].map(x => x.textContent);
    expect(rows).toEqual(['AAPL$120.0060%', 'MSFT$80.0040%']);
    r.unmount();
  });
});

describe('comidas', () => {
  it('racha anotando: hasta hoy, o hasta ayer si hoy no hay registro', () => {
    const s = defaultState();
    s.nutritionDays = [day(daysAgo(1), 2000, 2400), day(daysAgo(2), 2000, 2400), day(daysAgo(4), 2000, 2400)];
    expect(N.streaks(s).logging).toBe(2);
    s.nutritionDays.push(day(daysAgo(0), 2000, 2400));
    expect(N.streaks(s).logging).toBe(3);
  });
  it('racha bajo la meta: desde el último día anotado; pasarse o un hueco la corta', () => {
    const s = defaultState();
    s.nutritionDays = [day(daysAgo(1), 2000, 2400), day(daysAgo(2), 2400, 2400), day(daysAgo(3), 3000, 2400), day(daysAgo(4), 2000, 2400)];
    expect(N.streaks(s).underGoal).toBe(2);
    s.nutritionDays = [day(daysAgo(1), 2000, 2400), day(daysAgo(3), 2000, 2400)];
    expect(N.streaks(s).underGoal).toBe(1);
    expect(N.streaks(defaultState())).toEqual({ logging: 0, underGoal: 0 });
  });
  it('balance en kilos y cambio real de peso del período', () => {
    const s = defaultState();
    s.nutritionDays = [day('2020-01-15', 2000, 2400), day('2020-02-15', 3170, 2400)];
    expect(N.balance(s, 'all').kg).toBeCloseTo(-370 / 7700);
    expect(N.weightChange(s, 'all')).toBeNull();
    s.bodyWeights = [{ id: 'x', date: '2020-02-01', kg: 71.9, createdAt: 2 }, { id: 'y', date: '2020-01-10', kg: 72.5, createdAt: 1 }];
    const w = N.weightChange(s, 'all')!;
    expect([w.from, w.to]).toEqual([72.5, 71.9]);
    expect(w.diff).toBeCloseTo(-0.6);
    expect(N.weightChange(s, 'week')).toBeNull();
  });
  it('la pantalla muestra rachas y kilos', () => {
    resetUi();
    const s = defaultState();
    s.nutritionDays = [day(daysAgo(0), 1630, 2400), day(daysAgo(1), 2400, 2400)];
    s.bodyWeights = [{ id: 'x', date: daysAgo(1), kg: 72.5, createdAt: 1 }, { id: 'y', date: daysAgo(0), kg: 72, createdAt: 2 }];
    setUi({ nutBalance: 'all' });
    const r = render(<ComidasSection s={s} ui={getStore().ui} />);
    const txt = r.container.textContent!;
    expect(txt).toContain('Anotando🔥 2 días');
    expect(txt).toContain('Bajo la meta✅ 2 días');
    expect(txt).toContain('≈ 0.1 kg menos (7.700 kcal ≈ 1 kg) · Tu peso real: −0.5 kg (72.5 → 72)');
    r.unmount();
  });
});

describe('mis récords', () => {
  function session(id: string, date: string, sets: { reps: number; kg: number | null }[], exerciseId = 'flex'): Workout {
    return { id, date, routineId: null, routineName: '', entries: [{ exerciseId, sets }], createdAt: 1 };
  }
  it('mejor serie en reps y en kg, con la primera fecha en que se logró', () => {
    const s = defaultState();
    s.exercises = [{ id: 'flex', name: 'Flexiones', weighted: false }, { id: 'curl', name: 'Curl martillo', weighted: true }, { id: 'nunca', name: 'Burpees', weighted: false }];
    s.workouts = [
      session('w2', '2026-10-10', [{ reps: 15, kg: null }]),
      session('w1', '2026-10-01', [{ reps: 12, kg: null }, { reps: 15, kg: null }]),
      session('w3', '2026-10-05', [{ reps: 8, kg: 10 }], 'curl'),
      session('w4', '2026-10-12', [{ reps: 10, kg: 12 }], 'curl')
    ];
    expect(W.exerciseRecords(s).map(r => [r.exercise.name, r.reps, r.kg])).toEqual([
      ['Curl martillo', { v: 10, date: '2026-10-12', diff: 2 }, { v: 12, date: '2026-10-12', diff: 2 }],
      ['Flexiones', { v: 15, date: '2026-10-01', diff: null }, null]
    ]);
    resetUi();
    const r = render(<EjercicioSection s={s} ui={getStore().ui} />);
    expect(r.container.textContent).toContain('🏆 Flexiones ▾15 reps en una serie (01/10)');
    expect(r.container.textContent).toContain('🏆 Curl martillo · 2 récords ▾10 reps en una serie (12/10) · 12 kg (12/10)');
    r.unmount();
  });
});

describe('historia de récords', () => {
  function session(id: string, date: string, sets: { reps: number; kg: number | null }[], createdAt = 1): Workout {
    return { id, date, routineId: null, routineName: '', entries: [{ exerciseId: 'flex', sets }], createdAt };
  }
  function base() {
    const s = defaultState();
    s.exercises = [{ id: 'flex', name: 'Flexiones', weighted: false }];
    s.workouts = [
      session('w1', '2026-10-01', [{ reps: 12, kg: null }]),
      session('w2', '2026-10-03', [{ reps: 10, kg: 2.5 }]),
      session('w3', '2026-10-05', [{ reps: 15, kg: null }]),
      session('w4', '2026-10-08', [{ reps: 15, kg: 5 }]),
      session('w5', '2026-10-12', [{ reps: 17, kg: null }])
    ];
    return s;
  }
  it('cada vez que subiste la marca, con la diferencia; empatar no cuenta', () => {
    const r = W.exerciseRecords(base())[0];
    expect(r.repsSteps).toEqual([{ v: 12, date: '2026-10-01', diff: null }, { v: 15, date: '2026-10-05', diff: 3 }, { v: 17, date: '2026-10-12', diff: 2 }]);
    expect(r.kgSteps).toEqual([{ v: 2.5, date: '2026-10-03', diff: null }, { v: 5, date: '2026-10-08', diff: 2.5 }]);
    expect(r.count).toBe(3);
  });
  it('si se borra una sesión, la historia se corrige sola', () => {
    const s = base();
    s.workouts = s.workouts.filter(w => w.id !== 'w3');
    /* Sin la sesión del 05/10, el 15 se logra recién el 08/10. */
    expect(W.exerciseRecords(s)[0].repsSteps.map(st => [st.v, st.date])).toEqual([[12, '2026-10-01'], [15, '2026-10-08'], [17, '2026-10-12']]);
  });
  it('al tocar se abre la historia; solo una a la vez y se cierra al volver a tocar', () => {
    resetUi();
    const s = base();
    s.exercises.push({ id: 'curl', name: 'Curl', weighted: true });
    s.workouts.push({ id: 'c1', date: '2026-10-02', routineId: null, routineName: '', entries: [{ exerciseId: 'curl', sets: [{ reps: 8, kg: 10 }] }], createdAt: 1 });
    let r = render(<EjercicioSection s={s} ui={getStore().ui} />);
    const row = (name: string) => [...r.container.querySelectorAll('.debt-row')].find(x => x.textContent!.indexOf('🏆 ' + name) === 0) as HTMLElement;
    expect(r.container.textContent).toContain('🏆 Flexiones · 3 récords');
    row('Flexiones').click();
    r.unmount(); r = render(<EjercicioSection s={s} ui={getStore().ui} />);
    expect(r.container.textContent).toContain('Reps: 12 reps (01/10) → 15 reps (05/10, +3) → 17 reps (12/10, +2)');
    expect(r.container.textContent).toContain('Kg: 2.5 kg (03/10) → 5 kg (08/10, +2.5)');
    row('Curl').click();
    expect(getStore().ui.exRecordOpen).toBe('curl');
    r.unmount(); r = render(<EjercicioSection s={s} ui={getStore().ui} />);
    expect(r.container.textContent).not.toContain('Reps: 12 reps');
    row('Curl').click();
    expect(getStore().ui.exRecordOpen).toBeNull();
    r.unmount();
  });
});
