/* Modales de metas, wallets, transferencias, bolsa, deudas, historiales y estimado de ingresos. */
import { useState } from 'react';
import { dateOutOfMonthMsg } from '../../actions';
import { apiRequestQuotes } from '../../api/client';
import { CURRENCIES, GOAL_COLORS } from '../../lib/constants';
import {
  accountBalance, addAccount, debtPaid, debtPayments, debtRemaining, findAccount, findDebt, findGoal, goalCurrent,
  monthEstimate, resolvedCurrency, setMonthEstimate
} from '../../lib/finance';
import { fmt, monthLabel, todayStr } from '../../lib/format';
import { uid } from '../../lib/state';
import type { AppState } from '../../lib/types';
import { closeModal, commit, getStore, setUi, showToast, type Ui } from '../../store';
import { AccountOptions, DateField, Sheet, dateInMonthOk, defaultPeriodDate } from './common';

function walletShortMsg(s: AppState, accId: string, bal: number) { const a = findAccount(s, accId); return 'Tu wallet ' + (a ? a.name : '') + ' solo tiene ' + fmt(s, bal) + ' disponibles.'; }

/* ---- Metas ---- */
export function GoalModal() {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  async function save() {
    const n = name.trim(); const t = parseFloat(target);
    if (!n) { showToast('Dale un nombre a tu meta.'); return; }
    if (!t || t <= 0) { showToast('Ingresa una cantidad objetivo válida.'); return; }
    closeModal();
    await commit(s => { s.goals.push({ id: uid(), name: n, target: t, legacyCurrent: 0, color: GOAL_COLORS[s.goals.length % GOAL_COLORS.length], createdAt: Date.now(), monthlyContribution: null, lastContribMonthKey: null }); });
    showToast('Meta creada.');
  }
  return (
    <Sheet title="Nueva meta de ahorro">
      <div className="field"><label>Nombre de la meta</label><input type="text" placeholder="Ej. Armar mi PC" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
      <div className="field"><label>Cantidad objetivo</label><input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={target} onChange={e => setTarget(e.target.value)} /></div>
      <button className="btn-primary" onClick={save}>Crear meta</button>
    </Sheet>
  );
}

export function GoalFundModal({ s, goalId, direction }: { s: AppState; goalId: string; direction: 'in' | 'out' }) {
  const g = findGoal(s, goalId);
  const [amount, setAmount] = useState('');
  const [accId, setAccId] = useState(s.accounts[0].id);
  const [date, setDate] = useState(defaultPeriodDate());
  if (!g) return null;
  const cur = goalCurrent(s, goalId);
  async function save() {
    const amt = parseFloat(amount); const d = date || todayStr();
    if (!amt || amt <= 0) { showToast('Ingresa un monto válido.'); return; }
    if (!dateInMonthOk(d)) { showToast(dateOutOfMonthMsg()); return; }
    if (direction === 'in') {
      const b1 = accountBalance(s, accId);
      if (b1 < amt) { showToast(walletShortMsg(s, accId, b1)); return; }
    } else if (cur < amt) { showToast('Solo tienes ' + fmt(s, cur) + ' ahorrado en esta meta.'); return; }
    closeModal();
    await commit(st => { st.transactions.push({ id: uid(), type: direction === 'in' ? 'expense' : 'income', amount: amt, category: direction === 'in' ? 'ahorro_meta' : 'retiro_meta', date: d, note: '', createdAt: Date.now(), accountId: accId, goalId: goalId }); });
    showToast(direction === 'in' ? '¡Meta actualizada!' : 'Retiro realizado.');
  }
  return (
    <Sheet title={direction === 'in' ? ('Agregar a "' + g.name + '"') : ('Retirar de "' + g.name + '"')}>
      {direction === 'out' && <div className="field-hint" style={{ marginBottom: 14 }}>Tienes {fmt(s, cur)} ahorrado en esta meta.</div>}
      <div className="field"><label>Monto</label><input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} autoFocus /></div>
      <div className="field"><label>{direction === 'in' ? '¿De qué wallet sale?' : '¿A qué wallet regresa?'}</label><select value={accId} onChange={e => setAccId(e.target.value)}><AccountOptions s={s} /></select></div>
      <DateField value={date} onChange={setDate} />
      <button className="btn-primary" onClick={save}>Guardar</button>
    </Sheet>
  );
}

function HistoryRows({ s, events }: { s: AppState; events: { date: Date | null; label: string; sub: string; amount: number | null }[] }) {
  if (events.length === 0) return <div className="empty-state" style={{ padding: '14px 0' }}>Sin actividad.</div>;
  return <>{events.map((e, i) => (
    <div className="txn-row" key={i}><div className="txn-info"><div className="txn-cat">{e.label}</div><div className="txn-note">{e.sub}</div></div>
      <div className="txn-right"><div className="txn-amt">{e.amount != null ? fmt(s, e.amount) : ''}</div><div className="txn-date">{e.date ? e.date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Fecha no disponible'}</div></div></div>
  ))}</>;
}

export function GoalHistoryModal({ s, goalId }: { s: AppState; goalId: string }) {
  const g = findGoal(s, goalId); if (!g) return null;
  const events = [{ date: g.createdAt ? new Date(g.createdAt) : null, label: 'Meta creada', sub: 'Objetivo: ' + fmt(s, g.target), amount: null as number | null, sortTs: g.createdAt || 0 }];
  s.transactions.filter(t => t.goalId === goalId).forEach(t => {
    const acc = findAccount(s, t.accountId);
    const label = t.type === 'expense' ? 'Aporte' : (t.note === 'Meta cancelada' ? 'Devuelto (meta cancelada)' : 'Retiro');
    events.push({ date: new Date(t.date + 'T00:00:00'), label: label, sub: acc ? acc.name : '?', amount: t.amount, sortTs: t.createdAt || 0 });
  });
  events.sort((a, b) => a.sortTs - b.sortTs);
  return <Sheet title={'Historial de "' + g.name + '"'}><HistoryRows s={s} events={events} /></Sheet>;
}

/* ---- Wallets ---- */
export function AccountModal({ s, accountId }: { s: AppState; accountId: string | null }) {
  const existing = accountId ? findAccount(s, accountId) : null;
  const [name, setName] = useState(existing ? existing.name : '');
  const [currency, setCurrency] = useState(existing && existing.currency ? existing.currency : '');
  const [balance, setBalance] = useState('');
  async function save() {
    const n = name.trim();
    if (!n) { showToast('Dale un nombre al wallet.'); return; }
    closeModal();
    await commit(st => {
      if (accountId) { const a = findAccount(st, accountId); if (a) { a.name = n; a.currency = currency || null; } }
      else addAccount(st, n, parseFloat(balance) || 0, currency || null);
    });
    showToast('Wallet guardado.');
  }
  return (
    <Sheet centered title={existing ? 'Editar wallet' : 'Nuevo wallet'}>
      <div className="field"><label>Nombre</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Wallet de Efectivo, Wallet de Facebank" autoFocus /></div>
      <div className="field"><label>Moneda</label><select value={currency} onChange={e => setCurrency(e.target.value)}>
        <option value="">Igual que la app ({s.currency})</option>
        {Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c}</option>)}
      </select><div className="field-hint">Si este wallet maneja otra moneda (ej. dólares o bolívares), elígela aquí — se muestra por separado del resto.</div></div>
      {!existing && <div className="field"><label>Saldo inicial (opcional)</label><input type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={balance} onChange={e => setBalance(e.target.value)} /></div>}
      <button className="btn-primary" onClick={save}>{existing ? 'Guardar cambios' : 'Crear wallet'}</button>
    </Sheet>
  );
}

export function TransferModal({ s }: { s: AppState }) {
  const [fromId, setFromId] = useState(s.accounts[0].id);
  const [toId, setToId] = useState(s.accounts.length > 1 ? s.accounts[1].id : s.accounts[0].id);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  async function save() {
    const amt = parseFloat(amount);
    if (fromId === toId) { showToast('Elige dos wallets distintos.'); return; }
    if (!amt || amt <= 0) { showToast('Ingresa un monto válido.'); return; }
    const accFrom = findAccount(s, fromId), accTo = findAccount(s, toId);
    if (accFrom && accTo && resolvedCurrency(s, accFrom) !== resolvedCurrency(s, accTo)) { showToast('Esos wallets están en monedas distintas — todavía no se puede transferir directo entre monedas.'); return; }
    const bal = accountBalance(s, fromId);
    if (bal < amt) { showToast(walletShortMsg(s, fromId, bal)); return; }
    closeModal();
    await commit(st => { st.transfers.push({ id: uid(), fromId: fromId, toId: toId, amount: amt, date: date || todayStr(), note: note.trim(), createdAt: Date.now() }); });
    showToast('Transferencia realizada.');
  }
  return (
    <Sheet title="Transferir entre wallets">
      <div className="field"><label>Desde</label><select value={fromId} onChange={e => setFromId(e.target.value)}><AccountOptions s={s} /></select></div>
      <div className="field"><label>Hacia</label><select value={toId} onChange={e => setToId(e.target.value)}><AccountOptions s={s} /></select></div>
      <div className="field"><label>Monto</label><input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} autoFocus /></div>
      <div className="field"><label>Fecha</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="field"><label>Nota (opcional)</label><input type="text" placeholder="Ej. Moví mi ahorro al banco" value={note} onChange={e => setNote(e.target.value)} /></div>
      <button className="btn-primary" onClick={save}>Transferir</button>
    </Sheet>
  );
}

/* ---- Bolsa de Finanzas ---- */
export function BolsaFundModal({ s, direction }: { s: AppState; direction: 'in' | 'out' }) {
  const [amount, setAmount] = useState('');
  const [accId, setAccId] = useState(s.accounts[0].id);
  const [fee, setFee] = useState('');
  const [date, setDate] = useState(defaultPeriodDate());
  async function save() {
    const amt = parseFloat(amount); const d = date || todayStr();
    if (!amt || amt <= 0) { showToast('Ingresa un monto válido.'); return; }
    if (!dateInMonthOk(d)) { showToast(dateOutOfMonthMsg()); return; }
    if (direction === 'in') {
      const feeAmt = parseFloat(fee);
      if (!feeAmt || feeAmt <= 0) { showToast('Ingresa cuánto te cobraron de comisión — siempre te la cobran.'); return; }
      const totalDeduct = amt + feeAmt;
      const bal = accountBalance(s, accId);
      if (bal < totalDeduct) { const a = findAccount(s, accId); showToast('Tu wallet ' + (a ? a.name : '') + ' solo tiene ' + fmt(s, bal) + ' disponibles (necesitas ' + fmt(s, totalDeduct) + ' con la comisión incluida).'); return; }
      closeModal();
      await commit(st => {
        st.bolsa.amountInvested += amt; st.bolsa.currentValue += amt;
        const txnId = uid();
        st.transactions.push({ id: txnId, type: 'expense', amount: amt, category: 'inversion_bolsa', date: d, note: '', createdAt: Date.now(), accountId: accId });
        st.transactions.push({ id: uid(), type: 'expense', amount: feeAmt, category: 'comisiones', date: d, note: 'Comisión al invertir en la bolsa', createdAt: Date.now(), accountId: accId, bolsaFeeForMovement: txnId });
      });
    } else {
      if (s.bolsa.currentValue < amt) { showToast('Tu bolsa solo vale ' + fmt(s, s.bolsa.currentValue) + '.'); return; }
      closeModal();
      await commit(st => {
        st.bolsa.currentValue -= amt;
        st.bolsa.amountInvested = Math.max(0, st.bolsa.amountInvested - amt);
        st.transactions.push({ id: uid(), type: 'income', amount: amt, category: 'retiro_bolsa', date: d, note: '', createdAt: Date.now(), accountId: accId });
      });
    }
    showToast('Bolsa actualizada.');
  }
  return (
    <Sheet title={direction === 'in' ? 'Meter a la bolsa' : 'Retirar de la bolsa'}>
      {direction === 'out' && <div className="field-hint" style={{ marginBottom: 14 }}>Tu bolsa vale actualmente {fmt(s, s.bolsa.currentValue)}.</div>}
      <div className="field"><label>Monto</label><input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} autoFocus /></div>
      <div className="field"><label>{direction === 'in' ? '¿De qué wallet sale?' : '¿A qué wallet regresa?'}</label><select value={accId} onChange={e => setAccId(e.target.value)}><AccountOptions s={s} /></select></div>
      {direction === 'in' && <div className="field"><label>¿Cuánto te cobraron de comisión?</label><input type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="0.00" value={fee} onChange={e => setFee(e.target.value)} /><div className="field-hint">Siempre te la cobran — se descuenta del mismo wallet y queda registrada como gasto de "Comisiones".</div></div>}
      <DateField value={date} onChange={setDate} />
      <button className="btn-primary" onClick={save}>Guardar</button>
    </Sheet>
  );
}

export function BolsaUpdateModal({ s }: { s: AppState }) {
  const [value, setValue] = useState(String(s.bolsa.currentValue));
  async function save() {
    const v = parseFloat(value);
    if (isNaN(v) || v < 0) { showToast('Ingresa un valor válido.'); return; }
    closeModal();
    await commit(st => { st.bolsa.currentValue = v; st.bolsa.lastUpdated = todayStr(); });
    showToast('Valor actualizado.');
  }
  return (
    <Sheet title="Actualizar valor de la bolsa">
      <div className="field"><label>Nuevo valor actual</label><input type="number" inputMode="decimal" step="0.01" min="0" value={value} onChange={e => setValue(e.target.value)} autoFocus /></div>
      <button className="btn-primary" onClick={save}>Guardar</button>
    </Sheet>
  );
}

export function BolsaFixAccountModal({ s, txnId }: { s: AppState; txnId: string }) {
  const t = s.transactions.find(x => x.id === txnId);
  const [newAcc, setNewAcc] = useState(t ? (t.accountId || s.accounts[0].id) : '');
  if (!t) return null;
  const feeTxn = s.transactions.find(ft => ft.bolsaFeeForMovement === txnId);
  const totalAmt = t.amount + (feeTxn ? feeTxn.amount : 0);
  const accCur = findAccount(s, t.accountId);
  async function save() {
    if (!t) return;
    if (newAcc === t.accountId) { showToast('Elige un wallet distinto.'); return; }
    const bal = accountBalance(s, newAcc);
    if (bal < totalAmt) { showToast(walletShortMsg(s, newAcc, bal)); return; }
    closeModal();
    await commit(st => {
      st.transactions.forEach(x => { if (x.id === txnId || x.bolsaFeeForMovement === txnId) x.accountId = newAcc; });
    });
    showToast('Wallet corregido.');
  }
  return (
    <Sheet centered title="Corregir wallet del aporte">
      <div className="field-hint" style={{ marginBottom: 14 }}>Este aporte de {fmt(s, totalAmt)} está registrado desde "{accCur ? accCur.name : '?'}". Elige el wallet correcto — el dinero regresa libre al anterior y se descuenta del nuevo. No cambia lo que vale la bolsa ni lo invertido.</div>
      <div className="field"><label>Wallet correcto</label><select value={newAcc} onChange={e => setNewAcc(e.target.value)}><AccountOptions s={s} /></select></div>
      <button className="btn-primary" onClick={save}>Guardar</button>
    </Sheet>
  );
}

/* ---- Sección Bolsa del riel: agregar acción ---- */
export function BolsaPositionModal() {
  const [mode, setMode] = useState<'price' | 'pct'>('price');
  const [ticker, setTicker] = useState('');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [pct, setPct] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    const tk = ticker.trim().toUpperCase();
    const amt = parseFloat(amount);
    const purchaseDate = todayStr();
    setError('');
    if (!tk) { setError('Escribe un símbolo, como AAPL.'); return; }
    if (!amt || amt <= 0) { setError('Escribe cuánto invertiste.'); return; }
    if (mode === 'price') {
      const pp = parseFloat(price);
      if (!pp || pp <= 0) { setError('Escribe a cuánto compraste cada acción.'); return; }
      closeModal();
      await commit(st => { st.bolsaPositions.push({ id: uid(), ticker: tk, amountInvested: amt, purchasePrice: pp, shares: amt / pp, purchaseDate: purchaseDate }); });
      showToast('Acción agregada.');
      return;
    }
    const pc = parseFloat(pct);
    if (isNaN(pc)) { setError('Escribe en qué % estás ahorita.'); return; }
    if (pc <= -100) { setError('Ese % no puede ser -100 o menos.'); return; }
    setBusy(true);
    try {
      const res = await apiRequestQuotes([tk]);
      const q = res && res.quotes && res.quotes[tk];
      if (!q || typeof q.price !== 'number') {
        setError('No encontré ese símbolo. Revisa que esté bien escrito, o usa "Compra nueva" y escribe el precio directamente.');
        setBusy(false);
        return;
      }
      const impliedPurchasePrice = q.price / (1 + pc / 100);
      setUi({ quotesCache: Object.assign({}, getStore().ui.quotesCache, { [tk]: { price: q.price, change: q.change, changePct: q.changePct, fetchedAt: Date.now() } }) });
      closeModal();
      await commit(st => { st.bolsaPositions.push({ id: uid(), ticker: tk, amountInvested: amt, purchasePrice: impliedPurchasePrice, shares: amt / impliedPurchasePrice, purchaseDate: purchaseDate }); });
      showToast('Acción agregada.');
    } catch (e) {
      setError('No pude consultar el precio ahora. Intenta de nuevo.');
      setBusy(false);
    }
  }
  return (
    <Sheet title="Agregar acción">
      <div className="field"><label>&nbsp;</label>
        <div className="view-toggle">
          <button type="button" className={mode === 'price' ? 'active' : ''} onClick={() => setMode('price')}>Compra nueva</button>
          <button type="button" className={mode === 'pct' ? 'active' : ''} onClick={() => setMode('pct')}>Ya tenía esto</button>
        </div>
      </div>
      <div className="field-hint" style={{ marginBottom: 10 }}>{mode === 'price' ? 'Para una compra que hiciste hoy: pon cuánto invertiste y a cuánto pagaste cada acción.' : 'Para algo que ya tenías desde antes: pon cuánto tienes invertido y en qué % estás ahorita — buscamos el precio de hoy y calculamos el resto.'}</div>
      <div className="field"><label>Símbolo (ticker)</label><input type="text" placeholder="Ej. AAPL (Apple), TSLA (Tesla)" value={ticker} onChange={e => setTicker(e.target.value)} autoFocus /></div>
      <div className="field"><label>¿Cuánto invertiste en total? (en USD)</label><input type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></div>
      {mode === 'price' ?
        <div className="field"><label>¿A cuánto compraste cada acción? (USD)</label><input type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} /></div> :
        <div className="field"><label>¿En qué % estás ahorita? (usa negativo si vas perdiendo)</label><input type="number" inputMode="decimal" step="0.1" placeholder="Ej. 12 o -5" value={pct} onChange={e => setPct(e.target.value)} /></div>}
      {error && <div className="lock-error">{error}</div>}
      <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Buscando precio de hoy…' : 'Guardar'}</button>
    </Sheet>
  );
}

/* ---- Deudas ---- */
let lastDebtKind: 'debo' | 'me_deben' = 'debo';
export function DebtModal() {
  const [kind, setKind] = useState(lastDebtKind);
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [note, setNote] = useState('');
  const changeKind = (k: 'debo' | 'me_deben') => { setKind(k); lastDebtKind = k; };
  async function save() {
    const p = person.trim(); const amt = parseFloat(amount);
    if (!p) { showToast('Dale un nombre o descripción.'); return; }
    if (!amt || amt <= 0) { showToast('Ingresa un monto válido.'); return; }
    closeModal();
    await commit(st => { st.debts.push({ id: uid(), kind: kind, person: p, amount: amt, dueDate: due || null, note: note.trim(), settled: false, createdAt: Date.now(), originAccountId: null, payments: [] }); });
    showToast('Deuda guardada.');
  }
  return (
    <Sheet title="Nueva deuda">
      <div className="segmented"><button className={kind === 'debo' ? 'active expense' : ''} onClick={() => changeKind('debo')}>Debo</button><button className={kind === 'me_deben' ? 'active income' : ''} onClick={() => changeKind('me_deben')}>Me deben</button></div>
      <div className="field"><label>Persona o descripción</label><input type="text" placeholder="Ej. Mi hermana" value={person} onChange={e => setPerson(e.target.value)} autoFocus /></div>
      <div className="field"><label>Monto</label><input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></div>
      <div className="field"><label>Fecha límite (opcional)</label><input type="date" value={due} onChange={e => setDue(e.target.value)} /></div>
      <div className="field"><label>Nota (opcional)</label><input type="text" placeholder="Ej. Préstamo para el súper" value={note} onChange={e => setNote(e.target.value)} /></div>
      <button className="btn-primary" onClick={save}>Guardar</button>
    </Sheet>
  );
}

export function DebtPaymentModal({ s, debtId }: { s: AppState; debtId: string }) {
  const d = findDebt(s, debtId);
  const remaining = d ? debtRemaining(s, d) : 0;
  const [amount, setAmount] = useState(String(remaining));
  const [accId, setAccId] = useState(s.accounts[0].id);
  const [date, setDate] = useState(todayStr());
  if (!d) return null;
  const isDebo = d.kind === 'debo';
  async function save() {
    if (!d) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { showToast('Ingresa un monto válido.'); return; }
    if (amt > remaining + 0.004) { showToast('Ese monto es mayor a lo que falta (' + fmt(s, remaining) + ').'); return; }
    if (isDebo) { const bal = accountBalance(s, accId); if (bal < amt) { showToast(walletShortMsg(s, accId, bal)); return; } }
    closeModal();
    await commit(st => {
      st.transactions.push({ id: uid(), type: isDebo ? 'expense' : 'income', amount: amt, category: isDebo ? 'pago_deuda' : 'cobro_deuda', date: date || todayStr(), note: isDebo ? ('Abono a deuda de ' + d.person) : ('Cobro de deuda de ' + d.person), createdAt: Date.now(), accountId: accId, debtId: d.id });
      const dd = findDebt(st, d.id);
      if (dd && debtRemaining(st, dd) <= 0.004) dd.settled = true;
    });
    showToast(isDebo ? 'Abono registrado.' : 'Cobro registrado.');
  }
  return (
    <Sheet title={isDebo ? ('Abonar a "' + d.person + '"') : ('Registrar cobro de "' + d.person + '"')}>
      <div className="field-hint" style={{ marginBottom: 14 }}>{(isDebo ? 'Debes' : 'Te deben') + ' ' + fmt(s, remaining) + ' restantes' + (debtPaid(s, d) > 0.004 ? (' (de ' + fmt(s, d.amount) + ' en total)') : '') + '.'}</div>
      <div className="field"><label>Monto</label><input type="number" inputMode="decimal" step="0.01" min="0" max={remaining} placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} autoFocus /></div>
      <div className="field"><label>{isDebo ? '¿De qué wallet sale?' : '¿A qué wallet entra?'}</label><select value={accId} onChange={e => setAccId(e.target.value)}><AccountOptions s={s} /></select></div>
      <div className="field"><label>Fecha</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      <button className="btn-primary" onClick={save}>Guardar</button>
    </Sheet>
  );
}

export function DebtHistoryModal({ s, debtId }: { s: AppState; debtId: string }) {
  const d = findDebt(s, debtId); if (!d) return null;
  const events = [{ date: d.createdAt ? new Date(d.createdAt) : null, label: 'Deuda creada', sub: fmt(s, d.amount), amount: null as number | null, sortTs: d.createdAt || 0 }];
  debtPayments(s, d).forEach(t => {
    const acc = findAccount(s, t.accountId);
    events.push({ date: new Date(t.date + 'T00:00:00'), label: d.kind === 'debo' ? 'Abono' : 'Cobro', sub: acc ? acc.name : '?', amount: t.amount, sortTs: t.createdAt || 0 });
  });
  events.sort((a, b) => a.sortTs - b.sortTs);
  return <Sheet title={'Historial de "' + d.person + '"'}><HistoryRows s={s} events={events} /></Sheet>;
}

/* ---- Estimado de ingresos ---- */
export function IncomeEstimateModal({ s, ui }: { s: AppState; ui: Ui }) {
  const offset = ui.monthOffset;
  const est = monthEstimate(s, offset);
  const [value, setValue] = useState(est != null ? String(est) : '');
  async function save() {
    const v = parseFloat(value);
    if (!v || v <= 0) { showToast('Ingresa un monto válido.'); return; }
    closeModal();
    await commit(st => setMonthEstimate(st, offset, v));
    showToast('Estimado guardado.');
  }
  return (
    <Sheet centered title={'Estimado de ingresos · ' + monthLabel(offset)}>
      <div className="field"><label>¿Cuánto crees que vas a ganar en {monthLabel(offset).toLowerCase()}?</label><input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={value} onChange={e => setValue(e.target.value)} autoFocus /></div>
      <button className="btn-primary" onClick={save}>Guardar</button>
    </Sheet>
  );
}
