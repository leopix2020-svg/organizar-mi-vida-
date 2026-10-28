/* Balance de Comidas (semana, mes, total), Avance general de Ejercicio y punto visible con un solo dato. */
import { render } from '@testing-library/react';
import { ComidasSection } from '../src/components/ComidasSection';
import { EjercicioSection } from '../src/components/EjercicioSection';
import { MiniLinesChart } from '../src/components/charts';
import { dateToStr, todayStr } from '../src/lib/format';
import { defaultState } from '../src/lib/state';
import type { NutritionDay, Workout } from '../src/lib/types';
import * as N from '../src/lib/nutrition';
import * as W from '../src/lib/workout';
import { getStore, resetUi } from '../src/store';

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return dateToStr(d); }
function day(id: string, date: string, eaten: number, goal: number, burned = 0): NutritionDay {
  return { id, date, eaten: { kcal: eaten, carbs: 0, protein: 0, fat: 0 }, goal: { kcal: goal, carbs: 0, protein: 0, fat: 0 }, burned, meals: { breakfast: 0, lunch: eaten, dinner: 0, snacks: 0 }, createdAt: 1 };
}
function session(id: string, date: string, routineId: string | null, reps: number[], createdAt = 1): Workout {
  return { id, date, routineId, routineName: routineId || '', entries: [{ exerciseId: 'flex', sets: reps.map(r => ({ reps: r, kg: null })) }], createdAt };
}

describe('balance de comidas', () => {
  const s = defaultState();
  const today = todayStr();
  const lastWeek = daysAgo(7);
  s.nutritionDays = [
    day('a', today, 2035, 2727, 300),       /* +992 */
    day('b', lastWeek, 3000, 2500),          /* −500 */
    day('c', '2020-01-15', 2000, 2400)       /* +400 */
  ];
  it('semana: solo los días de esta semana', () => {
    expect(N.balance(s, 'week')).toEqual({ days: 1, eaten: 2035, target: 3027, saved: 992 });
  });
  it('mes: los días de este mes (positivos y negativos se compensan)', () => {
    const b = N.balance(s, 'month');
    const sameMonth = lastWeek.slice(0, 7) === today.slice(0, 7);
    expect(b.saved).toBe(sameMonth ? 492 : 992);
    expect(b.days).toBe(sameMonth ? 2 : 1);
  });
  it('total: todos los días anotados', () => {
    expect(N.balance(s, 'all')).toEqual({ days: 3, eaten: 7035, target: 7927, saved: 892 });
  });
  it('la tarjeta muestra ahorro, exceso en rojo y vacío', () => {
    resetUi();
    let ui = getStore().ui;
    let r = render(<ComidasSection s={s} ui={ui} />);
    expect(r.container.textContent).toContain('Te ahorraste 992 kcal');
    expect(r.container.textContent).toContain('1 día anotado · comido 2,035 kcal · meta + quemadas 3,027 kcal');
    r.unmount();
    const neg = defaultState(); neg.nutritionDays = [day('x', today, 3000, 2500)];
    r = render(<ComidasSection s={neg} ui={ui} />);
    expect(r.container.textContent).toContain('Te pasaste 500 kcal');
    r.unmount();
    ui = Object.assign({}, ui, { nutBalance: 'week' as const });
    const old = defaultState(); old.nutritionDays = [day('y', '2020-01-15', 2000, 2400)];
    r = render(<ComidasSection s={old} ui={ui} />);
    expect(r.container.textContent).toContain('No hay días anotados en este período.');
    r.unmount();
  });
});

describe('avance general de ejercicio', () => {
  function base() {
    const st = defaultState();
    st.exercises = [{ id: 'flex', name: 'Flexiones', weighted: false }];
    st.routines = [{ id: 'A', name: 'Rutina A', exerciseIds: ['flex'], createdAt: 1 }, { id: 'B', name: 'Rutina B', exerciseIds: ['flex'], createdAt: 2 }];
    return st;
  }
  it('suma por día todas las sesiones, sin importar la rutina, y entra la de ayer', () => {
    const st = base();
    st.workouts = [session('w3', today(), 'B', [5], 3), session('w1', daysAgo(1), 'A', [10, 8], 1), session('w2', today(), 'A', [12], 2), session('w0', daysAgo(1), null, [4], 0)];
    expect(W.generalSeries(st)).toEqual([{ date: daysAgo(1), reps: 22 }, { date: today(), reps: 17 }]);
    expect(W.generalSeries(st, 1)).toEqual([{ date: today(), reps: 17 }]);
  });
  it('la opción General va primera y por defecto; con una sola sesión se ve el punto', () => {
    resetUi();
    const st = base();
    st.workouts = [session('w1', daysAgo(1), 'A', [10, 8])];
    const r = render(<EjercicioSection s={st} ui={getStore().ui} />);
    const select = r.container.querySelector('select.chart-select') as HTMLSelectElement;
    expect(select.options[0].textContent).toBe('General · todas las sesiones');
    expect(select.value).toBe('gn:all');
    expect(r.container.textContent).toContain('Repeticiones totales por día');
    const visible = [...r.container.querySelectorAll('circle')].filter(c => c.getAttribute('fill') !== 'transparent');
    expect(visible.length).toBe(1);
    r.unmount();
  });
  it('sin rutinas ni sesiones sigue saliendo el mensaje inicial', () => {
    resetUi();
    const r = render(<EjercicioSection s={defaultState()} ui={getStore().ui} />);
    expect(r.container.textContent).toContain('Cuando registres tu primera sesión, aquí verás tu avance.');
    r.unmount();
  });
});

describe('gráfica de líneas', () => {
  it('con 2 o más datos no hay puntos visibles; con 1 sí', () => {
    const s = defaultState();
    const pt = (v: number) => ({ label: 'x', values: [{ v, color: 'red', name: 'R' }] });
    let r = render(<MiniLinesChart s={s} data={[pt(1), pt(2)]} />);
    expect([...r.container.querySelectorAll('circle')].every(c => c.getAttribute('fill') === 'transparent')).toBe(true);
    r.unmount();
    r = render(<MiniLinesChart s={s} data={[pt(5)]} />);
    expect([...r.container.querySelectorAll('circle')].filter(c => c.getAttribute('fill') === 'red').length).toBe(1);
    r.unmount();
  });
});

function today() { return todayStr(); }
