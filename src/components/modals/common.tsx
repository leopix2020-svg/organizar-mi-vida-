import type { ReactNode } from 'react';
import { accountBalance, resolvedCurrency } from '../../lib/finance';
import { fmtCur, isInMonth, monthBoundsStr, monthDefaultDateStr, monthLabel, todayStr } from '../../lib/format';
import type { AppState } from '../../lib/types';
import { closeModal, getStore } from '../../store';

/* Hoja modal: tocar fuera (el fondo oscuro) o la × la cierra. */
export function Sheet(props: { title?: ReactNode; centered?: boolean; onClose?: () => void; noClose?: boolean; children: ReactNode }) {
  const close = props.onClose || closeModal;
  return (
    <div className={'overlay' + (props.centered ? ' centered' : '')} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="sheet">
        {!props.noClose && <button className="close-x" onClick={close}>×</button>}
        {props.title !== undefined && <div className="sheet-title">{props.title}</div>}
        {props.children}
      </div>
    </div>
  );
}

export function AccountOptions({ s }: { s: AppState }) {
  return <>{s.accounts.map(a => {
    const cur = resolvedCurrency(s, a);
    const curTag = cur !== s.currency ? (' · ' + cur) : '';
    return <option key={a.id} value={a.id}>{a.name + curTag + ' (' + fmtCur(s, accountBalance(s, a.id), cur) + ')'}</option>;
  })}</>;
}

/* En vista "Por mes", la fecha queda limitada al mes que se está viendo. */
export function defaultPeriodDate() {
  const ui = getStore().ui;
  return ui.viewMode === 'mensual' ? monthDefaultDateStr(ui.monthOffset) : todayStr();
}
export function DateField(props: { value: string; onChange: (v: string) => void }) {
  const ui = getStore().ui;
  const bounds = ui.viewMode === 'mensual' ? monthBoundsStr(ui.monthOffset) : null;
  return (
    <div className="field"><label>Fecha</label>
      <input type="date" value={props.value} onChange={e => props.onChange(e.target.value)} min={bounds ? bounds.min : undefined} max={bounds ? bounds.max : undefined} />
      {bounds && <div className="field-hint">Estás viendo {monthLabel(ui.monthOffset).toLowerCase()} — la fecha debe caer en ese mes.</div>}
    </div>
  );
}
export function dateInMonthOk(dateStr: string) { const ui = getStore().ui; return ui.viewMode !== 'mensual' || isInMonth(dateStr, ui.monthOffset); }
