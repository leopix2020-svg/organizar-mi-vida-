/* Comidas: un registro por día con lo comido, las metas, las quemadas y las calorías de cada comida. */
import { todayStr } from './format';
import { weekBounds } from './workout';
import type { AppState, Macros, MealKey, NutritionDay } from './types';

export const MEALS: { key: MealKey; label: string }[] = [
  { key: 'breakfast', label: 'Desayuno' },
  { key: 'lunch', label: 'Almuerzo' },
  { key: 'dinner', label: 'Cena' },
  { key: 'snacks', label: 'Snacks' }
];
export const MACROS: { key: Exclude<keyof Macros, 'kcal'>; label: string }[] = [
  { key: 'carbs', label: 'Carbohidratos' },
  { key: 'protein', label: 'Proteína' },
  { key: 'fat', label: 'Grasa' }
];

export function findDay(s: AppState, date: string) { return s.nutritionDays.find(d => d.date === date) || null; }
export function sortedDays(s: AppState) { return s.nutritionDays.slice().sort((a, b) => a.date.localeCompare(b.date)); }

/* Las quemadas con ejercicio se suman a la meta, como en Yazio. Negativo = te pasaste. */
export function dayTarget(d: NutritionDay) { return d.goal.kcal + d.burned; }
export function remaining(d: NutritionDay) { return dayTarget(d) - d.eaten.kcal; }
export function mealsTotal(meals: Record<MealKey, number>) { return MEALS.reduce((a, m) => a + (meals[m.key] || 0), 0); }

/* Metas para un día nuevo: las del último día anotado. */
export function lastGoal(s: AppState): Macros | null {
  const days = sortedDays(s);
  return days.length ? Object.assign({}, days[days.length - 1].goal) : null;
}

/* Guarda el día; si ya había otro registro en esa fecha (o el editado cambió de fecha), lo reemplaza. */
export function upsertDay(s: AppState, day: NutritionDay, replacingId: string | null) {
  s.nutritionDays = s.nutritionDays.filter(d => d.id !== replacingId && d.date !== day.date).concat([day]);
}

/* Últimos n días anotados, para la gráfica. */
export function recentDays(s: AppState, n: number) { return sortedDays(s).slice(-n); }

/* Balance de un período (esta semana, este mes o todo): suma del restante de los días anotados. Positivo = ahorradas. */
export type BalancePeriod = 'week' | 'month' | 'all';
export function balance(s: AppState, period: BalancePeriod) {
  const w = weekBounds(0), month = todayStr().slice(0, 7);
  const days = s.nutritionDays.filter(d => period === 'all' || (period === 'week' ? d.date >= w.start && d.date <= w.end : d.date.slice(0, 7) === month));
  return {
    days: days.length,
    eaten: days.reduce((a, d) => a + d.eaten.kcal, 0),
    target: days.reduce((a, d) => a + dayTarget(d), 0),
    saved: days.reduce((a, d) => a + remaining(d), 0)
  };
}
