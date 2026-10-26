/* Modales de Ejercicio: rutina, "Hoy hice…" (o editar sesión), editar ejercicio y peso corporal. */
import { useState } from 'react';
import { todayStr } from '../../lib/format';
import { uid } from '../../lib/state';
import type { AppState, Workout, WorkoutSet } from '../../lib/types';
import {
  deleteExercise, ensureExercise, exerciseIsUsed, findExercise, normalizeSearchText, previousEntry, searchExercises,
  shortDayMonth, suggestedRoutineId, workoutRecordNames
} from '../../lib/workout';
import { closeModal, commit, getStore, showToast, showToastHold } from '../../store';
import { Sheet } from './common';

function WeightedToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="segmented" style={{ marginBottom: 0 }}>
      <button type="button" className={value ? 'active income' : ''} onClick={() => onChange(true)}>Con pesa</button>
      <button type="button" className={!value ? 'active income' : ''} onClick={() => onChange(false)}>Sin pesa</button>
    </div>
  );
}

/* ---- Rutina: nombre + ejercicios (las repeticiones se anotan el día que entrenas) ---- */
interface Item { key: string; id: string | null; name: string; weighted: boolean; }

export function RoutineModal({ s, routineId }: { s: AppState; routineId: string | null }) {
  const existing = routineId ? s.routines.find(r => r.id === routineId) || null : null;
  const [name, setName] = useState(existing ? existing.name : '');
  const [items, setItems] = useState<Item[]>(existing ? existing.exerciseIds.map(id => { const e = findExercise(s, id); return { key: id, id: id, name: e ? e.name : '?', weighted: e ? e.weighted : false }; }) : []);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<{ name: string; weighted: boolean } | null>(null);

  const taken = new Set(items.map(i => normalizeSearchText(i.name)));
  const matches = searchExercises(s, query, items.map(i => i.id || '')).filter(o => !taken.has(normalizeSearchText(o.name)));
  const exact = matches.some(o => normalizeSearchText(o.name) === normalizeSearchText(query)) || taken.has(normalizeSearchText(query));
  const showCreate = normalizeSearchText(query).length >= 2 && !exact;

  function add(it: { id: string | null; name: string; weighted: boolean }) {
    setItems(items.concat([{ key: uid(), id: it.id, name: it.name, weighted: it.weighted }]));
    setQuery(''); setPending(null);
  }
  function move(i: number, dir: number) {
    const j = i + dir; if (j < 0 || j >= items.length) return;
    const next = items.slice(); const t = next[i]; next[i] = next[j]; next[j] = t; setItems(next);
  }
  async function save() {
    const n = name.trim();
    if (!n) { showToast('Dale un nombre a la rutina.'); return; }
    closeModal();
    await commit(st => {
      const ids = items.map(it => (it.id && findExercise(st, it.id)) ? it.id : ensureExercise(st, it.name, it.weighted));
      if (routineId) { const r = st.routines.find(x => x.id === routineId); if (r) { r.name = n; r.exerciseIds = ids; } }
      else st.routines.push({ id: uid(), name: n, exerciseIds: ids, createdAt: Date.now() });
    });
    showToast('Rutina guardada.');
  }

  return (
    <Sheet title={existing ? 'Editar rutina' : 'Nueva rutina'}>
      <div className="field"><label>Nombre de la rutina</label><input type="text" placeholder="Ej. Rutina A" value={name} onChange={e => setName(e.target.value)} autoFocus={!existing} /></div>
      <div className="field"><label>Ejercicios</label>
        {items.length === 0 && <div className="field-hint" style={{ marginTop: 0, marginBottom: 8 }}>Agrega los ejercicios de esta rutina.</div>}
        {items.map((it, i) => (
          <div className="debt-row" style={{ padding: '8px 10px', marginBottom: 6 }} key={it.key}>
            <div><div className="debt-person">{it.name}</div><div className="debt-note">{it.weighted ? 'Con pesa' : 'Sin pesa'}</div></div>
            <div className="debt-actions">
              <button className="btn-small" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button className="btn-small" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
              <button className="btn-small danger" onClick={() => setItems(items.filter(x => x.key !== it.key))}>×</button>
            </div>
          </div>
        ))}
      </div>
      <div className="field" style={{ position: 'relative' }}><label>Agregar ejercicio</label>
        <input type="text" placeholder="Ej. flex, push, dominadas…" autoComplete="off" value={query} onChange={e => { setQuery(e.target.value); setPending(null); }} />
        {!pending && (matches.length > 0 || showCreate) && <div className="suggestions">
          {matches.map(o => (
            <div className="suggestion-item" key={(o.id || 'c') + o.name} onClick={() => add(o)}>
              <span>{o.name}</span><span className="suggestion-sub">{(o.id ? 'Tuyo' : 'Catálogo') + ' · ' + (o.weighted ? 'con pesa' : 'sin pesa')}</span>
            </div>
          ))}
          {showCreate && <div className="suggestion-item" onClick={() => setPending({ name: query.trim(), weighted: true })}>
            <span>+ Crear «{query.trim()}»</span><span className="suggestion-sub">Ejercicio nuevo</span>
          </div>}
        </div>}
      </div>
      {pending && <div className="workout-block">
        <div className="item-name" style={{ fontSize: 14, marginBottom: 8 }}>{pending.name}</div>
        <div className="field-hint" style={{ marginTop: 0, marginBottom: 8 }}>¿Este ejercicio usa pesa?</div>
        <WeightedToggle value={pending.weighted} onChange={v => setPending({ name: pending.name, weighted: v })} />
        <button className="btn-small" style={{ marginTop: 10, width: '100%' }} onClick={() => add({ id: null, name: pending.name, weighted: pending.weighted })}>Agregar a la rutina</button>
      </div>}
      <button className="btn-primary" onClick={save}>{existing ? 'Guardar cambios' : 'Crear rutina'}</button>
    </Sheet>
  );
}

/* ---- "Hoy hice…" / editar sesión: series con repeticiones y kg ---- */
type SetDraft = { reps: string; kg: string };

function initialSets(s: AppState, exerciseIds: string[], date: string, existing: Workout | null) {
  const map: Record<string, SetDraft[]> = {};
  exerciseIds.forEach(id => {
    const e = existing ? existing.entries.find(x => x.exerciseId === id) : null;
    if (e && e.sets.length) { map[id] = e.sets.map(st => ({ reps: String(st.reps), kg: st.kg != null ? String(st.kg) : '' })); return; }
    const prev = previousEntry(s, id, existing || { id: '', date: date, routineId: null, routineName: '', entries: [], createdAt: Number.MAX_SAFE_INTEGER });
    const count = prev ? prev.entry.sets.length : 1;
    map[id] = Array.from({ length: Math.max(1, count) }, () => ({ reps: '', kg: '' }));
  });
  return map;
}
function setsText(sets: WorkoutSet[]) { return sets.map(st => st.reps + (st.kg ? '×' + st.kg + 'kg' : '')).join(' · '); }

export function WorkoutModal({ s, workoutId }: { s: AppState; workoutId: string | null }) {
  const existing = workoutId ? s.workouts.find(w => w.id === workoutId) || null : null;
  const [routineId, setRoutineId] = useState<string | null>(existing ? existing.routineId : suggestedRoutineId(s));
  const [date, setDate] = useState(existing ? existing.date : todayStr());
  const routine = s.routines.find(r => r.id === routineId) || null;
  const exerciseIds = existing ?
    existing.entries.map(e => e.exerciseId).concat(routine ? routine.exerciseIds.filter(id => !existing.entries.some(e => e.exerciseId === id)) : []) :
    (routine ? routine.exerciseIds : []);
  const [sets, setSets] = useState<Record<string, SetDraft[]>>(() => initialSets(s, exerciseIds, date, existing));

  function changeRoutine(id: string) { const r = s.routines.find(x => x.id === id); setRoutineId(id); setSets(initialSets(s, r ? r.exerciseIds : [], date, null)); }
  function update(exId: string, i: number, field: keyof SetDraft, v: string) {
    const list = (sets[exId] || []).slice(); list[i] = Object.assign({}, list[i], { [field]: v }); setSets(Object.assign({}, sets, { [exId]: list }));
  }
  function addSet(exId: string) { setSets(Object.assign({}, sets, { [exId]: (sets[exId] || []).concat([{ reps: '', kg: '' }]) })); }
  function removeSet(exId: string, i: number) { setSets(Object.assign({}, sets, { [exId]: (sets[exId] || []).filter((_, j) => j !== i) })); }

  async function save() {
    if (!date || date > todayStr()) { showToast('Elige una fecha de hoy o anterior.'); return; }
    const entries = exerciseIds.map(id => ({
      exerciseId: id,
      sets: (sets[id] || []).map(d => ({ reps: parseInt(d.reps, 10), kg: d.kg.trim() === '' ? null : parseFloat(d.kg) }))
        .filter(st => st.reps > 0).map(st => ({ reps: st.reps, kg: (st.kg != null && !isNaN(st.kg) && st.kg > 0) ? st.kg : null }))
    })).filter(e => e.sets.length > 0);
    if (entries.length === 0) { showToast('Anota al menos una serie con repeticiones.'); return; }
    const id = existing ? existing.id : uid();
    closeModal();
    await commit(st => {
      const w: Workout = { id: id, date: date, routineId: existing ? existing.routineId : routineId, routineName: existing ? existing.routineName : (routine ? routine.name : ''), entries: entries, createdAt: existing ? existing.createdAt : Date.now() };
      if (existing) st.workouts = st.workouts.map(x => x.id === id ? w : x); else st.workouts.push(w);
    });
    const after = getStore().state;
    const saved = after ? after.workouts.find(w => w.id === id) : null;
    const records = (after && saved) ? workoutRecordNames(after, saved) : [];
    if (records.length) showToastHold('🏆 ¡Nuevo récord en ' + records.join(', ') + '!');
    else showToast(existing ? 'Sesión actualizada.' : 'Sesión guardada.');
  }

  const current: Workout = existing || { id: '', date: date, routineId: null, routineName: '', entries: [], createdAt: Number.MAX_SAFE_INTEGER };
  return (
    <Sheet title={existing ? (existing.routineName || 'Sesión') : 'Hoy hice…'}>
      {!existing && <div className="field"><label>Rutina</label><select value={routineId || ''} onChange={e => changeRoutine(e.target.value)}>
        {s.routines.map(r => <option key={r.id} value={r.id}>{r.name + (r.id === suggestedRoutineId(s) ? ' (te toca)' : '')}</option>)}
      </select></div>}
      <div className="field"><label>Fecha</label><input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} /></div>
      {exerciseIds.length === 0 && <div className="field-hint" style={{ marginBottom: 14 }}>Esta rutina no tiene ejercicios. Edítala para agregarle.</div>}
      {exerciseIds.map(exId => {
        const ex = findExercise(s, exId);
        const prev = previousEntry(s, exId, current);
        return (
          <div className="workout-block" key={exId}>
            <div className="item-name" style={{ fontSize: 14 }}>{ex ? ex.name : '?'}</div>
            <div className="item-sub" style={{ marginBottom: 8 }}>{prev ? ('La vez anterior (' + shortDayMonth(prev.workout.date) + '): ' + setsText(prev.entry.sets)) : 'Primera vez'}</div>
            {(sets[exId] || []).map((d, i) => (
              <div className="set-row" key={i}>
                <span className="set-num">{i + 1}</span>
                <input type="number" inputMode="numeric" min="0" step="1" placeholder="reps" value={d.reps} onChange={e => update(exId, i, 'reps', e.target.value)} />
                <input type="number" inputMode="decimal" min="0" step="0.5" placeholder={ex && ex.weighted ? 'kg' : 'kg extra'} value={d.kg} onChange={e => update(exId, i, 'kg', e.target.value)} />
                <button className="btn-small danger" onClick={() => removeSet(exId, i)}>×</button>
              </div>
            ))}
            <button className="btn-small" onClick={() => addSet(exId)}>+ Serie</button>
          </div>
        );
      })}
      <button className="btn-primary" onClick={save}>{existing ? 'Guardar cambios' : 'Guardar sesión'}</button>
    </Sheet>
  );
}

/* ---- Editar un ejercicio ---- */
export function ExerciseModal({ s, exerciseId }: { s: AppState; exerciseId: string }) {
  const ex = findExercise(s, exerciseId);
  const [name, setName] = useState(ex ? ex.name : '');
  const [weighted, setWeighted] = useState(ex ? ex.weighted : false);
  if (!ex) return null;
  const used = exerciseIsUsed(s, exerciseId);
  async function save() {
    const n = name.trim();
    if (!n) { showToast('Dale un nombre al ejercicio.'); return; }
    if (s.exercises.some(e => e.id !== exerciseId && normalizeSearchText(e.name) === normalizeSearchText(n))) { showToast('Ya tienes un ejercicio con ese nombre.'); return; }
    closeModal();
    await commit(st => { const e = findExercise(st, exerciseId); if (e) { e.name = n; e.weighted = weighted; } });
    showToast('Ejercicio actualizado.');
  }
  async function remove() {
    closeModal();
    await commit(st => { deleteExercise(st, exerciseId); });
    showToast('Ejercicio eliminado.');
  }
  return (
    <Sheet centered title="Editar ejercicio">
      <div className="field"><label>Nombre</label><input type="text" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
      <div className="field"><label>¿Usa pesa?</label><WeightedToggle value={weighted} onChange={setWeighted} />
        <div className="field-hint">Sin pesa igual puedes anotar kg extra (lastre).</div></div>
      <button className="btn-primary" onClick={save}>Guardar cambios</button>
      {used ? <div className="field-hint" style={{ textAlign: 'center', marginTop: 8 }}>No se puede eliminar: ya lo registraste en tus sesiones.</div> :
        <button className="btn-text" style={{ color: 'var(--spend)' }} onClick={remove}>Eliminar ejercicio</button>}
    </Sheet>
  );
}

/* ---- Peso corporal ---- */
export function BodyWeightModal({ s, id }: { s: AppState; id: string | null }) {
  const existing = id ? s.bodyWeights.find(b => b.id === id) || null : null;
  const [date, setDate] = useState(existing ? existing.date : todayStr());
  const [kg, setKg] = useState(existing ? String(existing.kg) : '');
  async function save() {
    const v = parseFloat(kg);
    if (!v || v <= 0) { showToast('Ingresa tu peso en kg.'); return; }
    if (!date || date > todayStr()) { showToast('Elige una fecha de hoy o anterior.'); return; }
    closeModal();
    await commit(st => {
      if (existing) { const b = st.bodyWeights.find(x => x.id === existing.id); if (b) { b.kg = v; b.date = date; } }
      else st.bodyWeights.push({ id: uid(), date: date, kg: v, createdAt: Date.now() });
    });
    showToast('Peso guardado.');
  }
  return (
    <Sheet centered title={existing ? 'Editar peso' : 'Anotar peso'}>
      <div className="field"><label>Fecha</label><input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} /></div>
      <div className="field"><label>Peso (kg)</label><input type="number" inputMode="decimal" min="0" step="0.1" placeholder="Ej. 72.5" value={kg} onChange={e => setKg(e.target.value)} autoFocus /></div>
      <button className="btn-primary" onClick={save}>Guardar</button>
    </Sheet>
  );
}
