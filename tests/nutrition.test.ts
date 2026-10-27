/* Lógica de Comidas: restante con quemadas, metas copiadas, un registro por día y compatibilidad. */
import oldState from './fixtures/old-state.json';
import { defaultState, normalizeState } from '../src/lib/state';
import type { NutritionDay } from '../src/lib/types';
import * as N from '../src/lib/nutrition';

function day(id: string, date: string, eaten: number, goal = 2344, burned = 0): NutritionDay {
  return { id, date, eaten: { kcal: eaten, carbs: 150, protein: 120, fat: 80 }, goal: { kcal: goal, carbs: 320, protein: 128, fat: 85 }, burned, meals: { breakfast: 0, lunch: eaten, dinner: 0, snacks: 0 }, createdAt: 1 };
}

describe('comidas', () => {
  it('restante como Yazio: meta + quemadas − comido (negativo = te pasaste)', () => {
    expect(N.remaining(day('a', '2026-10-22', 2374, 2344, 285))).toBe(255);
    expect(N.remaining(day('b', '2026-10-24', 3166, 2343, 326))).toBe(-497);
    expect(N.mealsTotal({ breakfast: 120, lunch: 716, dinner: 1538, snacks: 0 })).toBe(2374);
  });
  it('las metas de un día nuevo son las del último día anotado', () => {
    const s = defaultState();
    expect(N.lastGoal(s)).toBeNull();
    s.nutritionDays = [day('b', '2026-10-20', 2000, 2400), day('a', '2026-10-21', 2000, 2300), day('c', '2026-10-19', 2000, 2500)];
    expect(N.lastGoal(s)!.kcal).toBe(2300);
  });
  it('un solo registro por día: guardar en una fecha ocupada la reemplaza', () => {
    const s = defaultState();
    s.nutritionDays = [day('a', '2026-10-20', 2000), day('b', '2026-10-21', 2100)];
    N.upsertDay(s, day('a', '2026-10-21', 2500), 'a');
    expect(s.nutritionDays.map(d => [d.id, d.date, d.eaten.kcal])).toEqual([['a', '2026-10-21', 2500]]);
    N.upsertDay(s, day('n', '2026-10-22', 1800), null);
    expect(N.sortedDays(s).map(d => d.date)).toEqual(['2026-10-21', '2026-10-22']);
  });
  it('un estado viejo arranca sin días y normalizar conserva los registros', () => {
    const s = normalizeState(JSON.parse(JSON.stringify(oldState)));
    expect(s.nutritionDays).toEqual([]);
    const st = defaultState();
    st.nutritionDays = [day('a', '2026-10-22', 2374, 2344, 285)];
    expect(normalizeState(JSON.parse(JSON.stringify(st))).nutritionDays).toEqual(st.nutritionDays);
  });
});
