/* Sección Comidas: el día (comido, restante, quemado, macros y comidas), gráfica e historial. */
import { dateToStr, todayStr } from '../lib/format';
import { MACROS, MEALS, balance, dayTarget, findDay, recentDays, remaining, sortedDays } from '../lib/nutrition';
import type { BalancePeriod } from '../lib/nutrition';
import type { AppState, Macros } from '../lib/types';
import { shortDayMonth } from '../lib/workout';
import { askConfirm, clearConfirm, commit, openModal, setUi, showToast, type Ui } from '../store';
import { MiniLinesChart } from './charts';

const kcal = (n: number) => Math.round(n).toLocaleString('es-MX') + ' kcal';
function niceDate(dateStr: string) { return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }); }
function shiftDate(dateStr: string, days: number) { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + days); return dateToStr(d); }

function DayView({ s, ui }: { s: AppState; ui: Ui }) {
  const today = todayStr();
  const date = ui.nutDate && ui.nutDate <= today ? ui.nutDate : today;
  const day = findDay(s, date);
  const rest = day ? remaining(day) : 0;
  return <>
    <div className="month-switch" style={{ justifyContent: 'center' }}>
      <div className="month-nav">
        <button className="arrow" onClick={() => setUi({ nutDate: shiftDate(date, -1) })}>‹</button>
        <div className="month-label">{date === today ? 'Hoy' : niceDate(date)}</div>
        <button className="arrow" disabled={date >= today} onClick={() => setUi({ nutDate: shiftDate(date, 1) })}>›</button>
      </div>
    </div>
    {!day ? <>
      <div className="card"><div className="empty-state" style={{ padding: '10px 0' }}>{date === today ? 'Aún no anotas lo de hoy.' : 'Este día no tiene registro.'}</div></div>
      <button className="btn-primary" style={{ marginBottom: 16 }} onClick={() => openModal({ type: 'nutritionDay', date: date })}>Anotar día</button>
    </> : <>
      <div className="summary-mini" style={{ marginBottom: 14 }}>
        <div className="card"><div className="label">Comido</div><div className="val">{kcal(day.eaten.kcal)}</div></div>
        <div className="card"><div className="label">{rest >= 0 ? 'Restante' : 'Te pasaste'}</div><div className="val" style={rest < 0 ? { color: 'var(--spend)' } : undefined}>{kcal(Math.abs(rest))}</div></div>
        <div className="card"><div className="label">Quemado</div><div className="val">{kcal(day.burned)}</div></div>
      </div>
      <div className="card">
        <div className="item-sub" style={{ marginBottom: 10 }}>Meta {kcal(day.goal.kcal)}{day.burned > 0 ? ' + ' + kcal(day.burned) + ' quemadas' : ''}</div>
        {MACROS.map(m => {
          const eaten = day.eaten[m.key], goal = day.goal[m.key];
          const pct = goal > 0 ? Math.round(eaten / goal * 100) : 0;
          return <div key={m.key}>
            <div className="item-top" style={{ marginBottom: 6 }}><div className="item-sub">{m.label}</div><div className="item-sub" style={pct > 100 ? { color: 'var(--spend)' } : undefined}>{eaten} / {goal} g</div></div>
            <div className="bar-track-lg"><div className="bar-fill-lg" style={{ width: Math.min(100, pct) + '%', background: pct > 100 ? 'var(--spend)' : 'var(--growth-em)' }}></div></div>
          </div>;
        })}
      </div>
      <div className="card">
        {MEALS.map(m => (
          <div className="item-top" style={{ padding: '6px 0' }} key={m.key}><div className="item-name" style={{ fontSize: 14 }}>{m.label}</div><div className="item-sub">{kcal(day.meals[m.key])}</div></div>
        ))}
      </div>
      <button className="btn-primary" style={{ marginBottom: 16 }} onClick={() => openModal({ type: 'nutritionDay', date: date })}>Editar día</button>
    </>}
  </>;
}

/* Gráfica de comido vs. meta; se elige calorías o un macro. En calorías la meta incluye lo quemado. */
const CHART_OPTIONS: { key: keyof Macros; label: string }[] = [{ key: 'kcal', label: 'Calorías' }].concat(MACROS) as { key: keyof Macros; label: string }[];

function NutritionChart({ s, ui }: { s: AppState; ui: Ui }) {
  const days = recentDays(s, 28);
  const key = ui.nutChart;
  const isKcal = key === 'kcal';
  const format = isKcal ? kcal : (n: number) => Math.round(n) + ' g';
  return <>
    <div className="section-title">Por día</div>
    <div className="card">
      {days.length < 2 ? <div className="empty-state" style={{ padding: '10px 0' }}>Con dos días anotados verás aquí tu gráfica.</div> : <>
        <select className="chart-select" value={key} onChange={e => setUi({ nutChart: e.target.value as keyof Macros })}>
          {CHART_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <MiniLinesChart s={s} format={format} labelStep={Math.ceil(days.length / 7)} data={days.map(d => ({
          label: shortDayMonth(d.date),
          values: [
            { v: d.eaten[key], color: 'var(--growth)', name: 'Comido' },
            { v: isKcal ? dayTarget(d) : d.goal[key], color: 'var(--gold)', name: isKcal ? 'Meta + quemadas' : 'Meta', dashed: true }
          ]
        }))} />
        <div className="chart-desc" style={{ marginTop: 10 }}>Comido (línea) vs. meta{isKcal ? ' con lo quemado' : ''} (punteada) en tus últimos {days.length} días.</div>
      </>}
    </div>
  </>;
}

/* Balance: cuántas calorías te ahorraste (o te pasaste) sumando los días anotados del período. */
const BALANCE_OPTIONS: { key: BalancePeriod; label: string }[] = [
  { key: 'week', label: 'Esta semana' }, { key: 'month', label: 'Este mes' }, { key: 'all', label: 'Total' }
];

function Balance({ s, ui }: { s: AppState; ui: Ui }) {
  const b = balance(s, ui.nutBalance);
  return <>
    <div className="section-title">Balance</div>
    <div className="card">
      <select className="chart-select" value={ui.nutBalance} onChange={e => setUi({ nutBalance: e.target.value as BalancePeriod })}>
        {BALANCE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      {b.days === 0 ? <div className="empty-state" style={{ padding: '10px 0' }}>No hay días anotados en este período.</div> : <>
        <div className="item-name" style={{ textAlign: 'center', color: b.saved < 0 ? 'var(--spend)' : undefined }}>{b.saved >= 0 ? 'Te ahorraste ' + kcal(b.saved) : 'Te pasaste ' + kcal(-b.saved)}</div>
        <div className="chart-desc" style={{ marginTop: 8, textAlign: 'center' }}>{b.days} {b.days === 1 ? 'día anotado' : 'días anotados'} · comido {kcal(b.eaten)} · meta + quemadas {kcal(b.target)}</div>
      </>}
    </div>
  </>;
}

function History({ s, ui }: { s: AppState; ui: Ui }) {
  const list = sortedDays(s).reverse();
  async function remove(id: string) {
    clearConfirm('nutritionDay');
    await commit(st => { st.nutritionDays = st.nutritionDays.filter(d => d.id !== id); });
    showToast('Día eliminado.');
  }
  return <>
    <div className="section-title">Historial <button className="btn-small" onClick={() => openModal({ type: 'nutritionDay', date: null })}>+ Anotar</button></div>
    {list.length === 0 ? <div className="card"><div className="empty-state" style={{ padding: '10px 0' }}>Aún no anotas ningún día.</div></div> :
      <div className="card" style={{ maxHeight: 520, overflowY: 'auto', padding: 8 }}>
        {list.map(d => {
          const rest = remaining(d);
          return (
            <div className="debt-row" style={{ padding: '9px 10px' }} key={d.id}>
              <div><div className="debt-person">{niceDate(d.date)}</div>
                <div className="debt-note">{kcal(d.eaten.kcal)} · <span style={rest < 0 ? { color: 'var(--spend)' } : undefined}>{rest >= 0 ? 'quedaron ' + kcal(rest) : 'te pasaste ' + kcal(-rest)}</span></div></div>
              <div className="debt-actions">
                <button className="btn-small" onClick={() => setUi({ nutDate: d.date })}>Ver</button>
                <button className="btn-small" onClick={() => openModal({ type: 'nutritionDay', date: d.date })}>Editar</button>
                {ui.confirm.nutritionDay === d.id ?
                  <button className="btn-small danger" onClick={() => remove(d.id)}>Sí</button> :
                  <button className="btn-small danger" onClick={() => askConfirm('nutritionDay', d.id)}>×</button>}
              </div>
            </div>
          );
        })}
      </div>}
  </>;
}

export function ComidasSection({ s, ui }: { s: AppState; ui: Ui }) {
  return (
    <div className="dash-grid">
      <div className="dash-col">
        <DayView s={s} ui={ui} />
        <NutritionChart s={s} ui={ui} />
        <Balance s={s} ui={ui} />
      </div>
      <div className="dash-col">
        <History s={s} ui={ui} />
      </div>
    </div>
  );
}
