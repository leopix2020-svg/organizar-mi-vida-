/* Comidas: un registro por día con lo comido, las metas, las quemadas y las calorías de cada comida. */
import { dateToStr, todayStr } from './format';
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
function inPeriod(date: string, period: BalancePeriod) {
  if (period === 'all') return true;
  if (period === 'month') return date.slice(0, 7) === todayStr().slice(0, 7);
  const w = weekBounds(0);
  return date >= w.start && date <= w.end;
}
export const KCAL_PER_KG = 7700;
export function balance(s: AppState, period: BalancePeriod) {
  const days = s.nutritionDays.filter(d => inPeriod(d.date, period));
  const saved = days.reduce((a, d) => a + remaining(d), 0);
  return {
    days: days.length,
    eaten: days.reduce((a, d) => a + d.eaten.kcal, 0),
    target: days.reduce((a, d) => a + dayTarget(d), 0),
    saved: saved,
    /* Kilos aproximados: positivo = perdidos (ahorraste calorías). */
    kg: saved / KCAL_PER_KG
  };
}
/* Cambio real de peso (anotado en Ejercicio) dentro del período; null si hay menos de dos pesos. */
export function weightChange(s: AppState, period: BalancePeriod) {
  const ws = s.bodyWeights.filter(b => inPeriod(b.date, period)).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  if (ws.length < 2) return null;
  const from = ws[0].kg, to = ws[ws.length - 1].kg;
  return { from, to, diff: to - from };
}

/* Peso estimado por calorías: cada pesaje real es el punto de partida y se le resta lo ahorrado (restante / 7.700)
   en los días anotados desde ese pesaje (incluido ese día) hasta el día dado, sin incluirlo. */
function sortedWeights(s: AppState) { return s.bodyWeights.slice().sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt); }
function savedBetween(s: AppState, from: string, toExclusive: string) {
  const days = s.nutritionDays.filter(d => d.date >= from && d.date < toExclusive);
  return { days: days.length, saved: days.reduce((a, d) => a + remaining(d), 0) };
}
/* Estimado de hoy desde el último pesaje (cuenta también lo anotado hoy). null si no hay pesos o días anotados desde entonces. */
export function estimatedWeightToday(s: AppState, today = todayStr()) {
  const ws = sortedWeights(s);
  if (!ws.length) return null;
  const last = ws[ws.length - 1];
  const tomorrow = new Date(today + 'T00:00:00'); tomorrow.setDate(tomorrow.getDate() + 1);
  const b = savedBetween(s, last.date, dateToStr(tomorrow));
  if (b.days === 0) return null;
  return { kg: last.kg - b.saved / KCAL_PER_KG, from: last, days: b.days };
}
/* Para cada pesaje (menos el primero): lo que se esperaba según las calorías desde el pesaje anterior y la diferencia con el real. */
export function weighInEstimates(s: AppState) {
  const ws = sortedWeights(s);
  const out: Record<string, { estimate: number; diff: number }> = {};
  for (let i = 1; i < ws.length; i++) {
    const b = savedBetween(s, ws[i - 1].date, ws[i].date);
    if (b.days === 0) continue;
    const estimate = ws[i - 1].kg - b.saved / KCAL_PER_KG;
    out[ws[i].id] = { estimate: estimate, diff: ws[i].kg - estimate };
  }
  return out;
}

/* Rachas: días seguidos anotando (hasta hoy, o hasta ayer si hoy aún no anotas) y días seguidos sin pasarte
   (hacia atrás desde el último día anotado; un día sin anotar corta la racha). */
export function streaks(s: AppState, today = todayStr()) {
  const byDate: Record<string, NutritionDay> = {};
  s.nutritionDays.forEach(d => { byDate[d.date] = d; });
  const prev = (date: string) => { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() - 1); return dateToStr(d); };
  let logging = 0;
  let cur = byDate[today] ? today : prev(today);
  while (byDate[cur]) { logging++; cur = prev(cur); }
  const days = sortedDays(s);
  let underGoal = 0;
  if (days.length) {
    cur = days[days.length - 1].date;
    while (byDate[cur] && remaining(byDate[cur]) >= 0) { underGoal++; cur = prev(cur); }
  }
  return { logging, underGoal };
}

/* Promedio del restante por día de la semana (lunes a domingo) en todo el historial. avg null = ese día nunca se anotó. */
export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const WEEKDAY_PLURALS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados', 'Domingos'];
export function weekdayAverages(s: AppState) {
  const sum = [0, 0, 0, 0, 0, 0, 0], count = [0, 0, 0, 0, 0, 0, 0];
  s.nutritionDays.forEach(d => {
    const i = (new Date(d.date + 'T00:00:00').getDay() + 6) % 7;
    sum[i] += remaining(d); count[i]++;
  });
  return WEEKDAYS.map((label, i) => ({ label, name: WEEKDAY_NAMES[i], plural: WEEKDAY_PLURALS[i], count: count[i], avg: count[i] ? sum[i] / count[i] : null }));
}
