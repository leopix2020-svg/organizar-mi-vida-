/* Lógica de la sección Ejercicio: catálogo, búsqueda, rutinas, sesiones, récords y avance. */
import { dateToStr } from './format';
import { uid } from './state';
import type { AppState, Exercise, Workout, WorkoutEntry } from './types';

/* ---- Catálogo precargado (equipo de casa: peso corporal, barra, paralelas y mancuernas, sin banco) ---- */
interface CatalogItem { name: string; weighted: boolean; aliases: string[]; }
const bw = (name: string, ...aliases: string[]): CatalogItem => ({ name, weighted: false, aliases });
const db = (name: string, ...aliases: string[]): CatalogItem => ({ name, weighted: true, aliases });

export const EXERCISE_CATALOG: CatalogItem[] = [
  bw('Flexiones', 'push ups', 'pushups', 'lagartijas'),
  bw('Flexiones diamante', 'diamond push ups'),
  bw('Flexiones abiertas', 'wide push ups'),
  bw('Flexiones con pies elevados', 'decline push ups'),
  bw('Flexiones pike', 'pike push ups'),
  bw('Flexiones arqueras', 'archer push ups'),
  bw('Dominadas', 'pull ups', 'pullups', 'barras'),
  bw('Dominadas supinas (chin-ups)', 'chin ups', 'chinups'),
  bw('Dominadas agarre neutro', 'neutral grip pull ups'),
  bw('Dominadas negativas', 'negative pull ups'),
  bw('Dominadas australianas', 'australian pull ups', 'inverted row', 'remo invertido'),
  bw('Fondos en paralelas', 'dips', 'paralelas'),
  bw('Fondos negativos', 'negative dips'),
  bw('Elevaciones de piernas colgado', 'hanging leg raises'),
  bw('Elevaciones de rodillas colgado', 'hanging knee raises'),
  bw('Toes to bar', 'pies a la barra'),
  bw('L-sit', 'l sit'),
  bw('Colgarse de la barra', 'dead hang'),
  bw('Retracción escapular en barra', 'scapular pull ups'),
  bw('Sentadillas', 'squats', 'air squats'),
  bw('Sentadilla búlgara', 'bulgarian split squat'),
  bw('Zancadas', 'lunges', 'estocadas'),
  bw('Sentadilla con salto', 'jump squats'),
  bw('Sentadilla pistol', 'pistol squat'),
  bw('Puente de glúteo', 'glute bridge'),
  bw('Puente de glúteo a una pierna', 'single leg glute bridge'),
  bw('Curl femoral con toalla', 'slider leg curl', 'hamstring curl', 'isquiotibiales'),
  bw('Elevación de talones', 'calf raises', 'pantorrillas'),
  bw('Plancha', 'plank'),
  bw('Plancha lateral', 'side plank'),
  bw('Abdominales crunch', 'crunches', 'abs'),
  bw('Bicicleta abdominal', 'bicycle crunch'),
  bw('Rueda abdominal', 'ab wheel', 'ab roller'),
  bw('Mountain climbers', 'escaladores'),
  bw('Burpees'),
  bw('Superman', 'extension lumbar'),
  bw('Hollow hold', 'hollow body'),
  db('Sentadilla goblet', 'goblet squat'),
  db('Sentadilla con mancuernas', 'dumbbell squat'),
  db('Sentadilla búlgara con mancuernas', 'bulgarian split squat dumbbell'),
  db('Zancadas con mancuernas', 'dumbbell lunges'),
  db('Zancadas caminando con mancuernas', 'walking lunges'),
  db('Step-up con mancuernas', 'step ups', 'subida al cajon'),
  db('Hip thrust con mancuerna', 'hip thrust'),
  db('Puente de glúteo con mancuerna', 'weighted glute bridge'),
  db('Peso muerto rumano con mancuernas', 'romanian deadlift', 'rdl'),
  db('Elevación de talones con mancuernas', 'weighted calf raises'),
  db('Remo a una mano con mancuerna', 'one arm row', 'dumbbell row'),
  db('Remo inclinado con mancuernas', 'bent over row'),
  db('Floor press con mancuernas', 'press en el piso', 'press de pecho'),
  db('Aperturas en el piso', 'floor fly', 'aperturas'),
  db('Pullover con mancuerna', 'pullover'),
  db('Press militar con mancuernas', 'shoulder press', 'overhead press', 'press de hombro'),
  db('Press Arnold', 'arnold press'),
  db('Elevaciones laterales', 'lateral raises'),
  db('Elevaciones frontales', 'front raises'),
  db('Pájaros (hombro posterior)', 'rear delt fly', 'reverse fly'),
  db('Encogimientos de hombros', 'shrugs', 'trapecio'),
  db('Remo al mentón', 'upright row'),
  db('Curl de bíceps', 'bicep curl', 'biceps'),
  db('Curl martillo', 'hammer curl'),
  db('Curl concentrado', 'concentration curl'),
  db('Curl alterno', 'alternating curl'),
  db('Extensión de tríceps sobre la cabeza', 'overhead triceps extension', 'triceps'),
  db('Patada de tríceps', 'triceps kickback'),
  db('Press francés en el piso', 'skull crusher'),
  db('Swing con mancuerna', 'dumbbell swing', 'kettlebell swing'),
  db('Thruster con mancuernas', 'thruster'),
  db('Paseo del granjero', 'farmer walk', 'farmers carry'),
  db('Crunch con mancuerna', 'weighted crunch'),
  db('Giro ruso con mancuerna', 'russian twist')
];

export function normalizeSearchText(s: string) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-()]/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface ExerciseOption { id: string | null; name: string; weighted: boolean; }

/* Busca primero en tus ejercicios y luego en el catálogo (sin repetir nombres), en español o inglés y sin acentos:
   primero lo que empieza igual, luego lo que tiene una palabra que empieza así, luego cualquier coincidencia. */
export function searchExercises(s: AppState, query: string, excludeIds: string[] = []): ExerciseOption[] {
  const q = normalizeSearchText(query);
  if (q.length < 2) return [];
  const mineNames = new Set(s.exercises.map(e => normalizeSearchText(e.name)));
  const pool: (ExerciseOption & { terms: string[]; mine: boolean })[] = [];
  s.exercises.forEach(e => { if (excludeIds.indexOf(e.id) === -1) pool.push({ id: e.id, name: e.name, weighted: e.weighted, terms: [e.name], mine: true }); });
  EXERCISE_CATALOG.forEach(c => { if (!mineNames.has(normalizeSearchText(c.name))) pool.push({ id: null, name: c.name, weighted: c.weighted, terms: [c.name].concat(c.aliases), mine: false }); });
  const scored: { o: ExerciseOption; score: number; len: number }[] = [];
  pool.forEach(item => {
    let best = -1;
    item.terms.forEach(term => {
      const n = normalizeSearchText(term);
      const idx = n.indexOf(q);
      if (idx === -1) return;
      const sc = idx === 0 ? 0 : (n.charAt(idx - 1) === ' ' ? 1 : 2);
      if (best === -1 || sc < best) best = sc;
    });
    if (best > -1) scored.push({ o: { id: item.id, name: item.name, weighted: item.weighted }, score: best * 2 + (item.mine ? 0 : 1), len: item.name.length });
  });
  scored.sort((a, b) => a.score - b.score || a.len - b.len);
  return scored.slice(0, 8).map(x => x.o);
}

export function findExercise(s: AppState, id: string): Exercise | null { return s.exercises.find(e => e.id === id) || null; }
/* Devuelve el id del ejercicio con ese nombre (sin importar acentos/mayúsculas), creándolo si no existe. */
export function ensureExercise(s: AppState, name: string, weighted: boolean) {
  const n = normalizeSearchText(name);
  const found = s.exercises.find(e => normalizeSearchText(e.name) === n);
  if (found) return found.id;
  const ex = { id: uid(), name: name.trim(), weighted: weighted };
  s.exercises.push(ex);
  return ex.id;
}
export function exerciseIsUsed(s: AppState, id: string) { return s.workouts.some(w => w.entries.some(e => e.exerciseId === id)); }
export function deleteExercise(s: AppState, id: string) {
  if (exerciseIsUsed(s, id)) return false;
  s.exercises = s.exercises.filter(e => e.id !== id);
  s.routines.forEach(r => { r.exerciseIds = r.exerciseIds.filter(x => x !== id); });
  return true;
}

/* ---- Sesiones ---- */
export function sortedWorkouts(s: AppState) { return s.workouts.slice().sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt); }
function isBefore(a: Workout, b: Workout) { return a.date < b.date || (a.date === b.date && a.createdAt < b.createdAt); }

export function entryTotalReps(e: WorkoutEntry) { return e.sets.reduce((a, st) => a + (st.reps || 0), 0); }
export function entryMaxKg(e: WorkoutEntry) { return e.sets.reduce((a, st) => Math.max(a, st.kg || 0), 0); }
export function entryMaxReps(e: WorkoutEntry) { return e.sets.reduce((a, st) => Math.max(a, st.reps || 0), 0); }

/* Lo que hiciste en ese ejercicio la última vez antes de la sesión dada (o antes de hoy si no hay sesión). */
export function previousEntry(s: AppState, exerciseId: string, current?: Workout | null) {
  let last: { workout: Workout; entry: WorkoutEntry } | null = null;
  sortedWorkouts(s).forEach(w => {
    if (current && (w.id === current.id || !isBefore(w, current))) return;
    const e = w.entries.find(x => x.exerciseId === exerciseId);
    if (e && e.sets.length) last = { workout: w, entry: e };
  });
  return last as { workout: Workout; entry: WorkoutEntry } | null;
}

/* Récord: una sesión supera tu mejor serie anterior en repeticiones o en kg. La primera vez no cuenta. */
export function entryRecords(s: AppState, w: Workout, e: WorkoutEntry) {
  let prevReps = -1, prevKg = -1;
  s.workouts.forEach(o => {
    if (o.id === w.id || !isBefore(o, w)) return;
    o.entries.forEach(x => { if (x.exerciseId === e.exerciseId && x.sets.length) { prevReps = Math.max(prevReps, entryMaxReps(x)); prevKg = Math.max(prevKg, entryMaxKg(x)); } });
  });
  if (prevReps < 0) return { reps: false, kg: false };
  return { reps: entryMaxReps(e) > prevReps, kg: entryMaxKg(e) > prevKg };
}
export function workoutRecordNames(s: AppState, w: Workout) {
  return w.entries.filter(e => { const r = entryRecords(s, w, e); return r.reps || r.kg; }).map(e => { const ex = findExercise(s, e.exerciseId); return ex ? ex.name : '?'; });
}

/* Rutina sugerida: la que hace más tiempo no haces (o nunca). */
export function suggestedRoutineId(s: AppState) {
  if (s.routines.length === 0) return null;
  const lastIdx: Record<string, number> = {};
  sortedWorkouts(s).forEach((w, i) => { if (w.routineId) lastIdx[w.routineId] = i; });
  let best = s.routines[0].id, bestIdx = Infinity;
  s.routines.forEach(r => { const i = r.id in lastIdx ? lastIdx[r.id] : -1; if (i < bestIdx) { bestIdx = i; best = r.id; } });
  return best;
}

/* ---- Semanas (lunes a domingo) ---- */
export function mondayOf(d: Date) { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; }
export function weekBounds(weeksAgo: number) {
  const start = mondayOf(new Date()); start.setDate(start.getDate() - 7 * weeksAgo);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  return { start: dateToStr(start), end: dateToStr(end) };
}
export function workoutsInWeek(s: AppState, weeksAgo: number) { const b = weekBounds(weeksAgo); return s.workouts.filter(w => w.date >= b.start && w.date <= b.end); }

export function exerciseWeekTotals(s: AppState, exerciseId: string, weeksAgo: number) {
  let reps = 0, kg = 0, done = false;
  workoutsInWeek(s, weeksAgo).forEach(w => w.entries.forEach(e => {
    if (e.exerciseId !== exerciseId) return;
    done = true; reps += entryTotalReps(e); kg = Math.max(kg, entryMaxKg(e));
  }));
  return { reps, kg, done };
}
export function routineWeekTotals(s: AppState, routineId: string, weeksAgo: number) {
  let reps = 0, done = false;
  workoutsInWeek(s, weeksAgo).forEach(w => { if (w.routineId === routineId) { done = true; reps += w.entries.reduce((a, e) => a + entryTotalReps(e), 0); } });
  return { reps, done };
}

/* ---- Series para las gráficas (últimas N sesiones) ---- */
export function exerciseSeries(s: AppState, exerciseId: string, last = 10) {
  const out: { date: string; reps: number; kg: number }[] = [];
  sortedWorkouts(s).forEach(w => {
    const es = w.entries.filter(e => e.exerciseId === exerciseId && e.sets.length);
    if (!es.length) return;
    out.push({ date: w.date, reps: es.reduce((a, e) => a + entryTotalReps(e), 0), kg: es.reduce((a, e) => Math.max(a, entryMaxKg(e)), 0) });
  });
  return out.slice(-last);
}
export function routineSeries(s: AppState, routineId: string, last = 10) {
  return sortedWorkouts(s).filter(w => w.routineId === routineId).map(w => ({ date: w.date, reps: w.entries.reduce((a, e) => a + entryTotalReps(e), 0) })).slice(-last);
}
export function bodyWeightSeries(s: AppState, last = 10) {
  return s.bodyWeights.slice().sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt).slice(-last);
}
export function shortDayMonth(dateStr: string) { return dateStr.slice(8, 10) + '/' + dateStr.slice(5, 7); }
