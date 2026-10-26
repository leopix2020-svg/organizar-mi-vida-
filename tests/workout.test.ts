/* Lógica de Ejercicio: catálogo/búsqueda, rutinas, sesiones, récords, sugerencia y semanas. */
import oldState from './fixtures/old-state.json';
import { dateToStr } from '../src/lib/format';
import { defaultState, normalizeState } from '../src/lib/state';
import type { AppState, Workout } from '../src/lib/types';
import * as W from '../src/lib/workout';

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return dateToStr(d); }
function session(id: string, date: string, routineId: string | null, entries: Workout['entries'], createdAt = 1): Workout {
  return { id, date, routineId, routineName: routineId || '', entries, createdAt };
}

describe('catálogo y búsqueda', () => {
  const s = defaultState();
  it('encuentra en español o inglés y sin acentos', () => {
    expect(W.searchExercises(s, 'push')[0].name).toBe('Flexiones');
    expect(W.searchExercises(s, 'flex')[0].name).toBe('Flexiones');
    expect(W.searchExercises(s, 'dominada')[0].name).toBe('Dominadas');
    expect(W.searchExercises(s, 'gluteo').some(o => o.name === 'Puente de glúteo')).toBe(true);
    expect(W.searchExercises(s, 'dips')[0].name).toBe('Fondos en paralelas');
    expect(W.searchExercises(s, 'x')).toEqual([]);
  });
  it('tus ejercicios salen primero y no se repiten con el catálogo', () => {
    const st = defaultState();
    W.ensureExercise(st, 'flexiones', false);
    const res = W.searchExercises(st, 'flex');
    expect(res[0].id).toBe(st.exercises[0].id);
    expect(res.filter(o => W.normalizeSearchText(o.name) === 'flexiones').length).toBe(1);
  });
  it('el catálogo trae unos 70 ejercicios con pesa y sin pesa', () => {
    expect(W.EXERCISE_CATALOG.length).toBeGreaterThanOrEqual(65);
    expect(W.EXERCISE_CATALOG.find(c => c.name === 'Flexiones')!.weighted).toBe(false);
    expect(W.EXERCISE_CATALOG.find(c => c.name === 'Curl martillo')!.weighted).toBe(true);
  });
  it('ensureExercise no duplica (ignora acentos y mayúsculas)', () => {
    const st = defaultState();
    const a = W.ensureExercise(st, 'Puente de glúteo', false);
    const b = W.ensureExercise(st, 'puente de gluteo', true);
    expect(a).toBe(b);
    expect(st.exercises.length).toBe(1);
  });
});

describe('sesiones, récords y semanas', () => {
  function base(): AppState {
    const st = defaultState();
    st.exercises = [{ id: 'flex', name: 'Flexiones', weighted: false }, { id: 'curl', name: 'Curl martillo', weighted: true }];
    st.routines = [{ id: 'A', name: 'Rutina A', exerciseIds: ['flex', 'curl'], createdAt: 1 }, { id: 'B', name: 'Rutina B', exerciseIds: ['flex'], createdAt: 2 }];
    return st;
  }
  it('la vez anterior y récords (la primera vez no cuenta)', () => {
    const st = base();
    const w1 = session('w1', daysAgo(10), 'A', [{ exerciseId: 'flex', sets: [{ reps: 12, kg: null }, { reps: 10, kg: null }] }, { exerciseId: 'curl', sets: [{ reps: 10, kg: 8 }] }]);
    const w2 = session('w2', daysAgo(3), 'A', [{ exerciseId: 'flex', sets: [{ reps: 15, kg: null }] }, { exerciseId: 'curl', sets: [{ reps: 8, kg: 8 }] }]);
    const w3 = session('w3', daysAgo(1), 'A', [{ exerciseId: 'curl', sets: [{ reps: 6, kg: 10 }] }]);
    st.workouts = [w3, w1, w2];
    expect(W.previousEntry(st, 'flex', w2)!.workout.id).toBe('w1');
    expect(W.previousEntry(st, 'flex', w1)).toBeNull();
    expect(W.workoutRecordNames(st, w1)).toEqual([]);
    expect(W.entryRecords(st, w2, w2.entries[0])).toEqual({ reps: true, kg: false });
    expect(W.entryRecords(st, w2, w2.entries[1])).toEqual({ reps: false, kg: false });
    expect(W.entryRecords(st, w3, w3.entries[0])).toEqual({ reps: false, kg: true });
    expect(W.workoutRecordNames(st, w2)).toEqual(['Flexiones']);
  });
  it('el lastre en un ejercicio sin pesa cuenta como récord de kg', () => {
    const st = base();
    const w1 = session('w1', daysAgo(5), 'B', [{ exerciseId: 'flex', sets: [{ reps: 15, kg: null }] }]);
    const w2 = session('w2', daysAgo(2), 'B', [{ exerciseId: 'flex', sets: [{ reps: 10, kg: 5 }] }]);
    st.workouts = [w1, w2];
    expect(W.entryRecords(st, w2, w2.entries[0])).toEqual({ reps: false, kg: true });
  });
  it('sugiere la rutina que hace más tiempo no haces', () => {
    const st = base();
    expect(W.suggestedRoutineId(st)).toBe('A');
    st.workouts = [session('w1', daysAgo(2), 'A', [])];
    expect(W.suggestedRoutineId(st)).toBe('B');
    st.workouts.push(session('w2', daysAgo(1), 'B', []));
    expect(W.suggestedRoutineId(st)).toBe('A');
  });
  it('totales de la semana y de la semana pasada', () => {
    const st = base();
    const thisMonday = W.mondayOf(new Date());
    const lastWeek = new Date(thisMonday); lastWeek.setDate(lastWeek.getDate() - 3);
    st.workouts = [
      session('w1', dateToStr(lastWeek), 'A', [{ exerciseId: 'flex', sets: [{ reps: 10, kg: null }, { reps: 10, kg: null }] }]),
      session('w2', dateToStr(thisMonday), 'A', [{ exerciseId: 'flex', sets: [{ reps: 15, kg: null }, { reps: 13, kg: null }] }])
    ];
    expect(W.exerciseWeekTotals(st, 'flex', 0)).toEqual({ reps: 28, kg: 0, done: true });
    expect(W.exerciseWeekTotals(st, 'flex', 1)).toEqual({ reps: 20, kg: 0, done: true });
    expect(W.routineWeekTotals(st, 'A', 0).reps).toBe(28);
    expect(W.workoutsInWeek(st, 0).length).toBe(1);
  });
  it('no se borra un ejercicio ya registrado; si no, sale también de las rutinas', () => {
    const st = base();
    st.workouts = [session('w1', daysAgo(1), 'A', [{ exerciseId: 'flex', sets: [{ reps: 10, kg: null }] }])];
    expect(W.deleteExercise(st, 'flex')).toBe(false);
    expect(W.deleteExercise(st, 'curl')).toBe(true);
    expect(st.routines[0].exerciseIds).toEqual(['flex']);
  });
});

describe('compatibilidad', () => {
  it('un estado viejo arranca con ejercicio vacío y no pierde nada', () => {
    const s = normalizeState(JSON.parse(JSON.stringify(oldState)));
    expect([s.exercises, s.routines, s.workouts, s.bodyWeights]).toEqual([[], [], [], []]);
    expect(s.transactions.length).toBeGreaterThan(0);
  });
  it('normalizar conserva rutinas, sesiones y peso', () => {
    const st = defaultState();
    st.exercises = [{ id: 'e', name: 'Flexiones', weighted: false }];
    st.routines = [{ id: 'r', name: 'A', exerciseIds: ['e'], createdAt: 1 }];
    st.workouts = [session('w', '2026-10-01', 'r', [{ exerciseId: 'e', sets: [{ reps: 10, kg: 2.5 }] }])];
    st.bodyWeights = [{ id: 'b', date: '2026-10-01', kg: 72.5, createdAt: 1 }];
    expect(normalizeState(JSON.parse(JSON.stringify(st)))).toEqual(st);
  });
});
