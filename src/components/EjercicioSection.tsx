/* Sección Ejercicio: semana, "Hoy hice…", avance, calendario, historial, rutinas, ejercicios y peso corporal. */
import { monthDate, monthLabel, padNum, todayStr } from '../lib/format';
import {
  bodyWeightSeries, entryTotalReps, exerciseIsUsed, exerciseSeries, exerciseWeekTotals, findExercise, routineSeries,
  routineWeekTotals, shortDayMonth, sortedWorkouts, workoutRecordNames, workoutsInWeek
} from '../lib/workout';
import type { AppState } from '../lib/types';
import { askConfirm, clearConfirm, commit, openModal, setUi, showToast, type Ui } from '../store';
import { MiniLinesChart } from './charts';

const reps = (n: number) => n + (n === 1 ? ' rep' : ' reps');
const kgTxt = (n: number) => (Math.round(n * 10) / 10) + ' kg';
function diffTxt(cur: number, prev: number, unit: (n: number) => string) {
  const d = cur - prev;
  return d === 0 ? 'igual' : ((d > 0 ? '+' : '−') + unit(Math.abs(d)));
}
function niceDate(dateStr: string) { return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }); }

function WeekSummary({ s }: { s: AppState }) {
  const count = workoutsInWeek(s, 0).length;
  const lastW = bodyWeightSeries(s, 1)[0];
  const sorted = sortedWorkouts(s);
  const last = sorted[sorted.length - 1];
  return <>
    <div className="summary-mini" style={{ marginBottom: 14 }}>
      <div className="card"><div className="label">Esta semana</div><div className="val">{count} {count === 1 ? 'sesión' : 'sesiones'}</div></div>
      <div className="card"><div className="label">Última sesión</div><div className="val" style={{ fontSize: 13 }}>{last ? niceDate(last.date) : '—'}</div></div>
      <div className="card"><div className="label">Peso corporal</div><div className="val">{lastW ? kgTxt(lastW.kg) : '—'}</div></div>
    </div>
    <button className="btn-primary" style={{ marginBottom: 16 }} onClick={() => {
      if (s.routines.length === 0) { showToast('Primero crea una rutina en "Rutinas".'); return; }
      openModal({ type: 'workout', workoutId: null });
    }}>Hoy hice…</button>
  </>;
}

function Progress({ s, ui }: { s: AppState; ui: Ui }) {
  const usedExercises = s.exercises.filter(e => exerciseIsUsed(s, e.id));
  const options = [
    ...s.routines.map(r => ({ key: 'rt:' + r.id, label: 'Rutina · ' + r.name })),
    ...usedExercises.map(e => ({ key: 'ex:' + e.id, label: e.name }))
  ];
  if (options.length === 0) {
    return <><div className="section-title">Avance</div><div className="card"><div className="empty-state" style={{ padding: '10px 0' }}>Cuando registres tu primera sesión, aquí verás tu avance.</div></div></>;
  }
  const selected = options.some(o => o.key === ui.exChart) ? ui.exChart as string : options[0].key;
  const [kind, id] = [selected.slice(0, 2), selected.slice(3)];
  let body;
  if (kind === 'ex') {
    const ex = findExercise(s, id);
    const series = exerciseSeries(s, id);
    const hasKg = series.some(p => p.kg > 0);
    const now = exerciseWeekTotals(s, id, 0), prev = exerciseWeekTotals(s, id, 1);
    body = <>
      {series.length === 0 ? <div className="empty-state" style={{ padding: '10px 0' }}>Aún no hay sesiones con este ejercicio.</div> : <>
        <div className="item-sub" style={{ marginBottom: 6 }}>Repeticiones por sesión</div>
        <MiniLinesChart s={s} format={reps} data={series.map(p => ({ label: shortDayMonth(p.date), values: [{ v: p.reps, color: 'var(--growth)', name: 'Reps' }] }))} />
        {hasKg && <>
          <div className="item-sub" style={{ margin: '10px 0 6px' }}>{ex && ex.weighted ? 'Kg máximos' : 'Lastre máximo (kg)'}</div>
          <MiniLinesChart s={s} format={kgTxt} fitRange data={series.map(p => ({ label: shortDayMonth(p.date), values: [{ v: p.kg, color: 'var(--gold)', name: 'Kg' }] }))} />
        </>}
      </>}
      <div className="chart-desc" style={{ marginTop: 10 }}>
        {now.done ? ('Esta semana: ' + reps(now.reps) + (prev.done ? (' (' + diffTxt(now.reps, prev.reps, reps) + ' vs. semana pasada)') : '')) : 'Esta semana aún no lo haces.'}
        {now.done && hasKg && now.kg > 0 ? (' · máx. ' + kgTxt(now.kg) + (prev.done ? (' (' + diffTxt(now.kg, prev.kg, kgTxt) + ')') : '')) : ''}
      </div>
    </>;
  } else {
    const series = routineSeries(s, id);
    const now = routineWeekTotals(s, id, 0), prev = routineWeekTotals(s, id, 1);
    body = <>
      {series.length === 0 ? <div className="empty-state" style={{ padding: '10px 0' }}>Aún no hay sesiones de esta rutina.</div> : <>
        <div className="item-sub" style={{ marginBottom: 6 }}>Repeticiones totales por sesión</div>
        <MiniLinesChart s={s} format={reps} data={series.map(p => ({ label: shortDayMonth(p.date), values: [{ v: p.reps, color: 'var(--growth)', name: 'Reps' }] }))} />
      </>}
      <div className="chart-desc" style={{ marginTop: 10 }}>{now.done ? ('Esta semana: ' + reps(now.reps) + (prev.done ? (' (' + diffTxt(now.reps, prev.reps, reps) + ' vs. semana pasada)') : '')) : 'Esta semana aún no la haces.'}</div>
    </>;
  }
  return <>
    <div className="section-title">Avance</div>
    <div className="card">
      <select className="chart-select" value={selected} onChange={e => setUi({ exChart: e.target.value })}>
        {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      {body}
    </div>
  </>;
}

function TrainedCalendar({ s, ui }: { s: AppState; ui: Ui }) {
  const offset = ui.exCalOffset;
  const d = monthDate(offset);
  const year = d.getFullYear(), month = d.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const today = todayStr();
  const byDate: Record<string, string[]> = {};
  s.workouts.forEach(w => { (byDate[w.date] = byDate[w.date] || []).push(w.routineName || 'Sesión'); });
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(<div className="exercise-day empty" key={'e' + i}></div>);
  for (let day = 1; day <= totalDays; day++) {
    const ds = year + '-' + padNum(month + 1) + '-' + padNum(day);
    const names = byDate[ds];
    cells.push(<div key={ds} className={'exercise-day' + (names ? ' done' : '') + (ds > today ? ' future' : '')} data-tooltip={names ? names.join(' + ') : undefined}>{day}</div>);
  }
  return <>
    <div className="section-title">Días entrenados</div>
    <div className="card">
      <div className="month-switch" style={{ justifyContent: 'center' }}>
        <div className="month-nav">
          <button className="arrow" onClick={() => setUi({ exCalOffset: offset - 1 })}>‹</button>
          <div className="month-label">{monthLabel(offset)}</div>
          <button className="arrow" disabled={offset >= 0} onClick={() => setUi({ exCalOffset: Math.min(0, offset + 1) })}>›</button>
        </div>
      </div>
      <div className="exercise-calendar">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((w, i) => <div className="exercise-weekday-label" key={i}>{w}</div>)}
        {cells}
      </div>
    </div>
  </>;
}

function History({ s, ui }: { s: AppState; ui: Ui }) {
  const list = sortedWorkouts(s).reverse().slice(0, 20);
  async function remove(id: string) {
    clearConfirm('workout');
    await commit(st => { st.workouts = st.workouts.filter(w => w.id !== id); });
    showToast('Sesión eliminada.');
  }
  return <>
    <div className="section-title">Historial</div>
    {list.length === 0 ? <div className="card"><div className="empty-state" style={{ padding: '10px 0' }}>Aún no registras ninguna sesión.</div></div> :
      list.map(w => {
        const total = w.entries.reduce((a, e) => a + entryTotalReps(e), 0);
        const records = workoutRecordNames(s, w);
        return (
          <div className="debt-row" key={w.id}>
            <div><div className="debt-person">{w.routineName || 'Sesión'}{records.length > 0 ? ' 🏆' : ''}</div>
              <div className="debt-note">{niceDate(w.date)} · {w.entries.length} {w.entries.length === 1 ? 'ejercicio' : 'ejercicios'} · {reps(total)}</div>
              {records.length > 0 && <div className="debt-due">Récord en {records.join(', ')}</div>}</div>
            <div className="debt-actions">
              <button className="btn-small" onClick={() => openModal({ type: 'workout', workoutId: w.id })}>Ver / editar</button>
              {ui.confirm.workout === w.id ?
                <button className="btn-small danger" onClick={() => remove(w.id)}>Sí</button> :
                <button className="btn-small danger" onClick={() => askConfirm('workout', w.id)}>×</button>}
            </div>
          </div>
        );
      })}
  </>;
}

function Routines({ s, ui }: { s: AppState; ui: Ui }) {
  async function remove(id: string) {
    clearConfirm('routine');
    await commit(st => { st.routines = st.routines.filter(r => r.id !== id); });
    showToast('Rutina eliminada. Tus sesiones anteriores se conservan.');
  }
  return <>
    <div className="section-title">Rutinas <button className="btn-small" onClick={() => openModal({ type: 'routine', routineId: null })}>+ Nueva</button></div>
    {s.routines.length === 0 ? <div className="card"><div className="empty-state" style={{ padding: '10px 0' }}>Aún no tienes rutinas. Crea la primera con "+ Nueva".</div></div> :
      s.routines.map(r => (
        <div className="item-card" key={r.id}>
          <div className="item-top"><div><div className="item-name">{r.name}</div>
            <div className="item-sub">{r.exerciseIds.length ? r.exerciseIds.map(id => { const e = findExercise(s, id); return e ? e.name : '?'; }).join(' · ') : 'Sin ejercicios'}</div></div></div>
          <div className="item-bottom"><div></div><div className="item-actions">
            <button className="btn-small" onClick={() => openModal({ type: 'routine', routineId: r.id })}>Editar</button>
            {ui.confirm.routine === r.id ?
              <button className="btn-small danger" onClick={() => remove(r.id)}>¿Seguro?</button> :
              <button className="btn-small danger" onClick={() => askConfirm('routine', r.id)}>Borrar</button>}
          </div></div>
        </div>
      ))}
  </>;
}

function MyExercises({ s }: { s: AppState }) {
  if (s.exercises.length === 0) return null;
  const list = s.exercises.slice().sort((a, b) => a.name.localeCompare(b.name));
  return <>
    <div className="section-title">Mis ejercicios</div>
    <div className="card" style={{ maxHeight: 280, overflowY: 'auto', padding: 8 }}>
      {list.map(e => (
        <div className="debt-row" style={{ padding: '9px 10px' }} key={e.id}>
          <div><div className="debt-person">{e.name}</div><div className="debt-note">{e.weighted ? 'Con pesa' : 'Peso corporal (lastre opcional)'}</div></div>
          <div className="debt-actions"><button className="btn-small" onClick={() => openModal({ type: 'exercise', exerciseId: e.id })}>Editar</button></div>
        </div>
      ))}
    </div>
  </>;
}

function BodyWeightCard({ s, ui }: { s: AppState; ui: Ui }) {
  const series = bodyWeightSeries(s);
  const recent = s.bodyWeights.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 5);
  async function remove(id: string) {
    clearConfirm('bodyWeight');
    await commit(st => { st.bodyWeights = st.bodyWeights.filter(b => b.id !== id); });
    showToast('Registro eliminado.');
  }
  return <>
    <div className="section-title">Peso corporal <button className="btn-small" onClick={() => openModal({ type: 'bodyWeight', id: null })}>+ Anotar</button></div>
    <div className="card">
      {series.length === 0 ? <div className="empty-state" style={{ padding: '10px 0' }}>Anota tu peso para ver cómo va.</div> :
        series.length > 1 ? <MiniLinesChart s={s} format={kgTxt} fitRange data={series.map(b => ({ label: shortDayMonth(b.date), values: [{ v: b.kg, color: 'var(--growth)', name: 'Peso' }] }))} /> :
          <div className="item-name" style={{ textAlign: 'center' }}>{kgTxt(series[0].kg)}</div>}
      {recent.map(b => (
        <div className="debt-row" style={{ padding: '8px 10px', marginTop: 8, marginBottom: 0 }} key={b.id}>
          <div><div className="debt-person">{kgTxt(b.kg)}</div><div className="debt-note">{niceDate(b.date)}</div></div>
          <div className="debt-actions">
            <button className="btn-small" onClick={() => openModal({ type: 'bodyWeight', id: b.id })}>Editar</button>
            {ui.confirm.bodyWeight === b.id ?
              <button className="btn-small danger" onClick={() => remove(b.id)}>Sí</button> :
              <button className="btn-small danger" onClick={() => askConfirm('bodyWeight', b.id)}>×</button>}
          </div>
        </div>
      ))}
    </div>
  </>;
}

export function EjercicioSection({ s, ui }: { s: AppState; ui: Ui }) {
  return (
    <div className="dash-grid">
      <div className="dash-col">
        <WeekSummary s={s} />
        <Progress s={s} ui={ui} />
        <TrainedCalendar s={s} ui={ui} />
        <History s={s} ui={ui} />
      </div>
      <div className="dash-col">
        <Routines s={s} ui={ui} />
        <MyExercises s={s} />
        <BodyWeightCard s={s} ui={ui} />
      </div>
    </div>
  );
}
