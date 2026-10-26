/* Pantallas de Finanzas: Resumen, Movimientos, Metas, Wallets, Bolsa, Deudas y el tablero de escritorio. */
import { Fragment, useEffect } from 'react';
import * as A from '../actions';
import { refreshQuotesIfNeeded } from '../api/client';
import { WALLET_DONUT_COLORS } from '../lib/constants';
import {
  accountAllocationBreakdown, accountBalance, accountsTotal, bolsaFeeTotal, catInfo, categoryAccountsLabel, chartColors,
  currencyHasMultipleAccounts, debtPaid, debtRemaining, findAccount, findDebt, globalFulfillmentTotals, goalAccountBreakdown,
  goalCurrent, hasMultipleCurrencies, monthEstimate, monthExpense, monthFulfillmentPct, monthIncome, patrimonio, patrimonioColors,
  periodExpense, periodIncome, periodTxns, resolvedCurrency
} from '../lib/finance';
import { fmt, fmtCur, fmtPct, monthLabel, monthShortLabel, shortDate } from '../lib/format';
import type { AppState, Debt, Period, Txn, TxnType } from '../lib/types';
import { openModal, type Ui } from '../store';
import { Donut, MiniBarChart, type DonutSegment } from './charts';

interface Ctx { s: AppState; ui: Ui; p: Period; }

function ExpandBtn(props: { id: string; expanded: boolean }) {
  return <button className="expand-btn" title={props.expanded ? 'Contraer' : 'Expandir'} onClick={() => A.toggleCardExpand(props.id)}>{props.expanded ? '⤡' : '⤢'}</button>;
}

/* ---- Resumen ---- */
function walletSegments(c: Ctx, accountId: string): DonutSegment[] {
  const { s } = c;
  const pc = patrimonioColors(s);
  const alloc = accountAllocationBreakdown(s, accountId);
  const segments: DonutSegment[] = [{ value: Math.max(0, accountBalance(s, accountId)), color: '#8B93A1', label: 'Libre' }];
  if (alloc.bolsa > 0.01) segments.push({ value: alloc.bolsa, color: pc.invertido, label: 'En la bolsa' });
  s.goals.forEach(g => { const v = alloc.goals[g.id] || 0; if (v > 0.01) segments.push({ value: v, color: g.color, label: g.name }); });
  return segments;
}

function Patrimonio({ c }: { c: Ctx }) {
  const { s } = c;
  const p = patrimonio(s);
  const pc = patrimonioColors(s);
  const side = s.accounts.length <= 1 ? null : s.accounts.map(a => {
    const cur = resolvedCurrency(s, a);
    return (
      <div className="wallet-donut-item" key={a.id}>
        <Donut s={s} segments={walletSegments(c, a.id)} r={36} cx={46} cy={46} sw={12} currency={cur} />
        <div className="wallet-donut-label">{a.name}</div>
        <div className="wallet-donut-sub">{fmtCur(s, accountBalance(s, a.id), cur)}</div>
      </div>
    );
  });
  return <>
    <div className="section-title">Tu dinero en total</div>
    <div className="card patrimonio-flex">
      <div className="patrimonio-main">
        <Donut s={s} segments={[
          { value: p.cuentas, color: pc.cuentas, label: 'En tus wallets' }, { value: p.invertido, color: pc.invertido, label: 'Invertido en la bolsa' }, { value: p.ahorrado, color: pc.ahorrado, label: 'Ahorrado en metas' }
        ]} r={58} cx={70} cy={70} sw={19} />
        <div className="chart-desc" style={{ marginTop: 8, textAlign: 'center' }}>Así se reparte tu dinero entre tus wallets, tu bolsa y tus metas de ahorro. Pasa el mouse sobre cada segmento para ver el detalle.</div>
      </div>
      {side && <div className={'patrimonio-side' + (s.accounts.length >= 3 ? ' patrimonio-side-grid' : '')}>{side}</div>}
    </div>
  </>;
}

function IncomeEstimate({ c }: { c: Ctx }) {
  const { s, ui } = c;
  let body;
  if (ui.viewMode === 'total') {
    const agg = globalFulfillmentTotals(s);
    if (!agg) {
      body = <div className="item-sub">Aún no has definido ningún estimado mensual. Ve a "Por mes" para definir el tuyo.</div>;
    } else {
      body = <>
        <div className="item-top"><div><div className="item-name">Cumplimiento histórico</div><div className="item-sub">{fmt(s, agg.actual)} de {fmt(s, agg.est)} estimados en total ({agg.count} {agg.count === 1 ? 'mes' : 'meses'})</div></div><div className="item-pct">{agg.pct}%</div></div>
        <div className="bar-track-lg"><div className="bar-fill-lg" style={{ width: Math.max(0, Math.min(100, agg.pct)) + '%', background: 'var(--growth-em)' }}></div></div>
      </>;
    }
  } else {
    const offset = ui.monthOffset;
    const est = monthEstimate(s, offset);
    const label = monthLabel(offset).toLowerCase();
    if (est == null) {
      body = <>
        <div className="item-sub" style={{ marginBottom: 10 }}>Aún no defines cuánto esperas ganar en {label}.</div>
        <button className="btn-small" onClick={A.openIncomeEstimate}>Definir estimado de {label}</button>
      </>;
    } else {
      const pct = monthFulfillmentPct(s, offset) as number;
      body = <>
        <div className="item-top"><div><div className="item-name">Estimado de {label}</div><div className="item-sub">{fmt(s, monthIncome(s, offset))} de {fmt(s, est)} estimados</div></div><div className="item-pct">{pct}%</div></div>
        <div className="bar-track-lg"><div className="bar-fill-lg" style={{ width: Math.max(0, Math.min(100, pct)) + '%', background: 'var(--growth-em)' }}></div></div>
        <div className="item-bottom"><div></div><div className="item-actions"><button className="btn-small" onClick={A.openIncomeEstimate}>Editar estimado</button></div></div>
      </>;
    }
  }
  return <><div className="section-title">Estimación de ingresos</div><div className="item-card widget-gold">{body}</div></>;
}

function CategoriesCombo({ c, currencyFilter }: { c: Ctx; currencyFilter: string | null }) {
  const { s, ui, p } = c;
  const cardId = 'cat-combo-' + (currencyFilter || 'main');
  const expanded = !!ui.expandedCards[cardId];
  const showTags = currencyHasMultipleAccounts(s, currencyFilter);
  function rows(type: TxnType) {
    const byCat: Record<string, number> = {};
    periodTxns(s, p, currencyFilter).filter(t => t.type === type).forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
    const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (catRows.length === 0) return <div className="empty-state" style={{ padding: '8px 0 14px', fontSize: 12.5 }}>Sin {type === 'income' ? 'ingresos' : 'gastos'} registrados en este periodo.</div>;
    const maxCat = catRows[0][1];
    return catRows.map(([catId, amt]) => {
      const info = catInfo(s, type, catId); const pct = Math.max(6, Math.round((amt / maxCat) * 100));
      const tag = showTags ? categoryAccountsLabel(s, p, type, catId, currencyFilter) : '';
      return (
        <div className="combo-row" key={catId}><span className="dot" style={{ background: info.color }}></span>
          <div className="combo-main"><div className="combo-name-line"><span className="combo-name">{info.label}{tag && <span className="combo-tag">{tag}</span>}</span><span className="combo-amt">{fmtCur(s, amt, currencyFilter)}</span></div>
            <div className="combo-bar-track"><div className="combo-bar-fill" style={{ width: pct + '%', background: info.color }}></div></div></div></div>
      );
    });
  }
  return <>
    <div className="section-title">{'Categorías' + (currencyFilter ? (' · ' + currencyFilter) : '')} <ExpandBtn id={cardId} expanded={expanded} /></div>
    <div className={'card cat-combo-card' + (expanded ? ' expanded' : '')} id={cardId}>
      <div className="cat-combo-scroll">
        <div className="cat-combo-sub expense">Gastos</div>{rows('expense')}
        <div className="cat-combo-sub income">Ingresos</div>{rows('income')}
      </div></div>
  </>;
}

function ResumenTop({ c }: { c: Ctx }) {
  const { s, ui, p } = c;
  const cc = chartColors(s);
  const cf = hasMultipleCurrencies(s) ? (ui.currencyTab || s.currency) : null;
  const balLabelBase = ui.viewMode === 'mensual' ? ('Saldo de ' + monthLabel(ui.monthOffset).toLowerCase()) : 'Saldo total (histórico)';
  const income = periodIncome(s, p, cf), expense = periodExpense(s, p, cf);
  const anchor = ui.viewMode === 'mensual' ? ui.monthOffset : 0;
  const chartData = [5, 4, 3, 2, 1, 0].map(i => anchor - i).map(o => ({
    label: monthShortLabel(o), values: [{ v: monthIncome(s, o, cf), color: cc.income, name: 'Ingresos' }, { v: monthExpense(s, o, cf), color: cc.expense, name: 'Gastos' }]
  }));
  return <>
    <Patrimonio c={c} />
    <IncomeEstimate c={c} />
    <div className="card balance-card">
      <div className="balance-label">{balLabelBase + (cf ? (' · ' + cf) : '')}</div>
      <div className="balance-amount">{fmtCur(s, income - expense, cf)}</div>
      <div className="balance-sub"><div>Ingresos<strong>{fmtCur(s, income, cf)}</strong></div><div>Gastos<strong>{fmtCur(s, expense, cf)}</strong></div></div>
    </div>
    <div className="section-title">{'Ingresos vs. gastos' + (cf ? (' · ' + cf) : '')}</div>
    <div className="card"><MiniBarChart s={s} data={chartData} /><div className="chart-legend"><span><span className="dot" style={{ background: cc.income }}></span>Ingresos</span><span><span className="dot" style={{ background: cc.expense }}></span>Gastos</span></div></div>
    <CategoriesCombo c={c} currencyFilter={cf} />
  </>;
}

function GoalsPreview({ c }: { c: Ctx }) {
  const { s } = c;
  return <>
    <div className="section-title">Metas de ahorro <a onClick={() => A.gotoTab('metas')}>Ver todas ›</a></div>
    <div className="card">{s.goals.length === 0 ? <div className="empty-state" style={{ padding: '16px 0' }}>Aún no tienes metas de ahorro.</div> :
      s.goals.slice(0, 2).map(g => {
        const pct = Math.min(100, Math.round((goalCurrent(s, g.id) / g.target) * 100));
        return <div className="cat-row" key={g.id}><span className="dot" style={{ background: g.color }}></span><span className="cat-name">{g.name}</span><span className="bar-track"><span className="bar-fill" style={{ width: pct + '%', background: g.color }}></span></span><span className="cat-amt">{pct}%</span></div>;
      })}</div>
  </>;
}

function SummaryMini({ c }: { c: Ctx }) {
  const { s, ui, p } = c;
  const debtsOwed = s.debts.filter(d => d.kind === 'debo' && !d.settled).reduce((a, d) => a + debtRemaining(s, d), 0);
  const debtsToReceive = s.debts.filter(d => d.kind === 'me_deben' && !d.settled).reduce((a, d) => a + debtRemaining(s, d), 0);
  const walletsLabel = ui.viewMode === 'mensual' ? ('Movimiento de ' + monthLabel(ui.monthOffset).toLowerCase()) : 'Total en wallets';
  const walletsValue = ui.viewMode === 'mensual' ? (periodIncome(s, p) - periodExpense(s, p)) : accountsTotal(s);
  return (
    <div className="summary-mini" style={{ marginBottom: 14 }}>
      <div className="card" style={{ cursor: 'pointer' }} onClick={() => A.gotoTab('cuentas')}><div className="label">{walletsLabel}</div><div className="val">{fmt(s, walletsValue)}</div></div>
      <div className="card" style={{ cursor: 'pointer' }} onClick={() => A.gotoTab('inversiones')}><div className="label">En la bolsa</div><div className="val">{fmt(s, s.bolsa.currentValue)}</div></div>
      <div className="card" style={{ cursor: 'pointer' }} onClick={() => A.gotoTab('deudas')}><div className="label">Debo / me deben</div><div className="val" style={{ fontSize: 13 }}>{fmt(s, debtsOwed)} · {fmt(s, debtsToReceive)}</div></div>
    </div>
  );
}

/* ---- Movimientos ---- */
function TxnRow({ c, t }: { c: Ctx; t: Txn }) {
  const { s, ui } = c;
  const info = catInfo(s, t.type, t.category);
  const acc = findAccount(s, t.accountId);
  return (
    <div className="txn-row">
      <div className="txn-icon" style={{ background: info.color }}>{info.label.charAt(0).toUpperCase()}</div>
      <div className="txn-info"><div className="txn-cat">{info.label}</div><div className="txn-note">{acc ? acc.name : 'Sin wallet'}{t.note ? (' · ' + t.note) : ''}</div></div>
      <div className="txn-right"><div className={'txn-amt ' + t.type}>{(t.type === 'income' ? '+' : '−') + ' ' + fmtCur(s, t.amount, resolvedCurrency(s, acc))}</div><div className="txn-date">{shortDate(t.date)}</div></div>
      {ui.confirm.txn === t.id ?
        <button className="txn-del confirm" onClick={() => A.confirmDeleteTxn(t.id)}>¿Eliminar?</button> :
        <button className="txn-del" onClick={() => A.askDeleteTxn(t.id)}>×</button>}
    </div>
  );
}

function Movimientos({ c }: { c: Ctx }) {
  const { s, ui, p } = c;
  const filterCur = hasMultipleCurrencies(s) ? (ui.currencyTab || s.currency) : null;
  const txns = periodTxns(s, p, filterCur).slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  if (txns.length === 0) return <div className="empty-state"><div className="big">＋</div>No hay movimientos{ui.viewMode === 'mensual' ? (' en ' + monthLabel(ui.monthOffset).toLowerCase()) : ''}.<br />{ui.viewMode === 'total' ? 'Cambia a "Por mes" para agregar uno.' : 'Toca + para agregar uno.'}</div>;
  const groups: Record<string, Txn[]> = {};
  txns.forEach(t => { const key = ui.viewMode === 'mensual' ? t.date : t.date.slice(0, 7); (groups[key] = groups[key] || []).push(t); });
  return <>{Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(key => {
    const label = ui.viewMode === 'mensual' ?
      new Date(key + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) :
      new Date(key + '-01T00:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    return <Fragment key={key}>
      <div className="txn-group-label">{label.charAt(0).toUpperCase() + label.slice(1)}</div>
      {groups[key].map(t => <TxnRow key={t.id} c={c} t={t} />)}
    </Fragment>;
  })}</>;
}

/* ---- Metas ---- */
function Metas({ c }: { c: Ctx }) {
  const { s, ui } = c;
  if (s.goals.length === 0) return <div className="empty-state"><div className="big">◎</div>Aún no tienes metas de ahorro.<br />Toca + para crear la primera.</div>;
  return <>
    <div style={{ fontSize: 12.5, color: 'var(--text-soft)', marginBottom: 14 }}>Registra cuánto llevas ahorrado en cada meta desde tus wallets.</div>
    {s.goals.map(g => {
      const cur = goalCurrent(s, g.id);
      const pct = Math.min(100, Math.round((cur / g.target) * 100)); const done = cur >= g.target;
      const perAccount = goalAccountBreakdown(s, g.id);
      const accIds = Object.keys(perAccount).filter(id => perAccount[id] > 0.01);
      const greenBtn = { background: 'var(--growth-em)', color: '#fff', borderColor: 'var(--growth-em)' };
      return (
        <div className="item-card" key={g.id}>
          {done && <div className="done-badge">✓ Meta cumplida</div>}
          <div className="item-top"><div><div className="item-name">{g.name}</div><div className="item-sub">Meta: {fmt(s, g.target)}</div></div><div className="item-pct">{pct}%</div></div>
          <div className="bar-track-lg"><div className="bar-fill-lg" style={{ width: pct + '%', background: g.color }}></div></div>
          {accIds.length > 1 && <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 12px' }}>
            <Donut s={s} segments={accIds.map((id, idx) => { const acc = findAccount(s, id); return { value: perAccount[id], color: WALLET_DONUT_COLORS[idx % WALLET_DONUT_COLORS.length], label: acc ? acc.name : '?' }; })} r={40} cx={52} cy={52} sw={13} />
          </div>}
          <div className="item-bottom"><div className="item-amounts">{fmt(s, cur)} ahorrado</div><div className="item-actions">
            <button className="btn-small" onClick={() => openModal({ type: 'goalHistory', goalId: g.id })}>Historial</button>
            {ui.confirm.goalCancel === g.id ?
              <button className="btn-small danger" onClick={() => A.confirmCancelGoal(g.id)}>¿Seguro?</button> :
              <button className="btn-small danger" onClick={() => A.askCancelGoal(g.id)}>Cancelar</button>}
            <button className="btn-small" onClick={() => A.openGoalFund(g.id, 'out')}>Retirar</button>
            <button className="btn-small" onClick={() => A.openGoalFund(g.id, 'in')}>Agregar</button>
            {done && (ui.confirm.goalRedeem === g.id ?
              <button className="btn-small" style={greenBtn} onClick={() => A.confirmRedeemGoal(g.id)}>¿Confirmar canje?</button> :
              <button className="btn-small" style={greenBtn} onClick={() => A.askRedeemGoal(g.id)}>Canjear</button>)}
          </div></div>
        </div>
      );
    })}
  </>;
}

/* ---- Wallets ---- */
function Cuentas({ c }: { c: Ctx }) {
  const { s, ui } = c;
  const multi = hasMultipleCurrencies(s);
  const activeCurrency = multi ? (ui.currencyTab || s.currency) : null;
  type FeedItem = { key: string; date: string; createdAt: number; label: string; sub: string; amount: number; positive: boolean | null };
  const feed: FeedItem[] = [];
  s.transactions.forEach(t => { if (t.accountId) { const acc = findAccount(s, t.accountId); feed.push({ key: t.id, date: t.date, createdAt: t.createdAt, label: (t.type === 'income' ? 'Ingreso' : 'Gasto') + ' · ' + (acc ? acc.name : '?'), sub: t.note || catInfo(s, t.type, t.category).label, amount: t.amount, positive: t.type === 'income' }); } });
  s.transfers.forEach(tr => { const f = findAccount(s, tr.fromId), to = findAccount(s, tr.toId); feed.push({ key: tr.id, date: tr.date, createdAt: tr.createdAt, label: 'Transferencia', sub: (f ? f.name : '?') + ' → ' + (to ? to.name : '?'), amount: tr.amount, positive: null }); });
  s.fundMovements.forEach((f, i) => {
    const acc = findAccount(s, f.accountId);
    let label;
    if (f.targetType === 'invest') { label = f.direction === 'in' ? 'A la bolsa' : 'Desde la bolsa'; }
    else if (f.targetType === 'debt') { const dbt = findDebt(s, f.targetId || ''); const who = dbt ? dbt.person : 'alguien'; label = f.direction === 'in' ? ('Préstamo/abono a ' + who) : ('Cobro de ' + who); }
    else { const g = s.goals.find(x => x.id === f.targetId); const targetLabel = g ? ('meta "' + g.name + '"') : 'una meta'; label = f.direction === 'in' ? ('A ' + targetLabel) : ('Desde ' + targetLabel); }
    feed.push({ key: 'fm' + i, date: f.date, createdAt: f.createdAt || 0, label: label, sub: (acc ? acc.name : '?') + (f.note ? (' · ' + f.note) : ''), amount: f.amount, positive: f.direction === 'out' });
  });
  feed.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  return <>
    <div className="section-title">Tus wallets <button className="btn-small" onClick={() => openModal({ type: 'transfer' })}>Transferir</button></div>
    {s.accounts.filter(a => !multi || resolvedCurrency(s, a) === activeCurrency).map(a => {
      const segments = walletSegments(c, a.id);
      const cur = resolvedCurrency(s, a);
      return (
        <div className="item-card" key={a.id}>
          <div className="item-top"><div><div className="item-name">{a.name}</div></div><div className="item-pct" style={{ fontSize: 17 }}>{fmtCur(s, accountBalance(s, a.id), cur)}</div></div>
          {segments.length > 1 && <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 12px' }}><Donut s={s} segments={segments} r={44} cx={56} cy={56} sw={14} currency={cur} /></div>}
          <div className="item-bottom"><div className="item-actions">
            <button className="btn-small" onClick={() => openModal({ type: 'account', accountId: a.id })}>Editar</button>
            {ui.confirm.account === a.id ?
              <button className="btn-small danger" onClick={() => A.confirmDeleteAccount(a.id)}>¿Eliminar?</button> :
              <button className="btn-small danger" onClick={() => A.askDeleteAccount(a.id)}>Eliminar</button>}
          </div></div>
        </div>
      );
    })}
    <div className="section-title">Actividad reciente</div>
    <div className="card" style={{ maxHeight: 280, overflowY: 'auto', padding: 8 }}>
      {feed.length === 0 ? <div className="empty-state" style={{ padding: '14px 0' }}>Sin actividad aún.</div> :
        feed.slice(0, 15).map(f => {
          const cls = f.positive === null ? '' : (f.positive ? 'income' : 'expense');
          const sign = f.positive === null ? '' : (f.positive ? '+ ' : '− ');
          return (
            <div className="txn-row" key={f.key}><div className="txn-icon" style={{ background: f.positive === false ? '#A8452C' : '#2F6B52' }}>{f.positive === false ? '−' : '+'}</div>
              <div className="txn-info"><div className="txn-cat">{f.label}</div><div className="txn-note">{f.sub}</div></div>
              <div className="txn-right"><div className={'txn-amt ' + cls}>{sign + fmt(s, f.amount)}</div><div className="txn-date">{shortDate(f.date)}</div></div></div>
          );
        })}
    </div>
  </>;
}

/* ---- Bolsa de Finanzas (valor manual) ---- */
function Inversiones({ c }: { c: Ctx }) {
  const { s } = c;
  const b = s.bolsa;
  const gain = b.currentValue - b.amountInvested; const gainPct = b.amountInvested > 0 ? (gain / b.amountInvested) * 100 : 0;
  const contributions = s.transactions.filter(t => t.category === 'inversion_bolsa' && t.type === 'expense').slice().sort((x, y) => y.createdAt - x.createdAt).slice(0, 10);
  return <>
    <div className="card balance-card"><div className="balance-label">Valor actual en la bolsa</div><div className="balance-amount">{fmt(s, b.currentValue)}</div>
      <div className="balance-sub"><div>Invertido<strong>{fmt(s, b.amountInvested)}</strong></div><div>Ganancia/pérdida<strong style={{ color: gain >= 0 ? '#39FF6A' : '#F87171' }}>{fmt(s, gain)} ({fmtPct(gainPct)})</strong></div></div>
    </div>
    <div className="chart-desc" style={{ marginBottom: 14 }}>Comisión pagada en total: {fmt(s, bolsaFeeTotal(s))} — se registra como gasto de "Comisiones" cada vez que metes dinero.</div>
    {b.lastUpdated && <div className="item-sub" style={{ marginBottom: 14 }}>Último valor actualizado: {new Date(b.lastUpdated + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</div>}
    <div className="item-actions" style={{ marginBottom: 16 }}>
      <button className="btn-small" onClick={() => A.openBolsaFund('in')}>Meter a la bolsa</button>
      <button className="btn-small" onClick={() => A.openBolsaFund('out')}>Retirar de la bolsa</button>
      <button className="btn-small" onClick={() => openModal({ type: 'bolsaUpdate' })}>Actualizar valor</button>
    </div>
    <div className="chart-desc" style={{ marginBottom: 14 }}>Los precios se actualizan a mano — pregúntame en el chat cuánto está la bolsa y aquí metes el valor.</div>
    {contributions.length > 0 && <>
      <div className="section-title" style={{ fontSize: 14 }}>Aportes recientes</div>
      {contributions.map(t => {
        const acc = findAccount(s, t.accountId);
        const feeTxn = s.transactions.find(ft => ft.bolsaFeeForMovement === t.id);
        return (
          <div className="debt-row" key={t.id}>
            <div><div className="debt-person">{fmt(s, t.amount + (feeTxn ? feeTxn.amount : 0))}</div><div className="debt-note">{(acc ? acc.name : '?') + ' · ' + shortDate(t.date) + (feeTxn ? (' · incluye ' + fmt(s, feeTxn.amount) + ' de comisión') : '')}</div></div>
            <div className="debt-actions"><button className="btn-small" onClick={() => openModal({ type: 'bolsaFixAccount', txnId: t.id })}>Corregir wallet</button></div>
          </div>
        );
      })}
    </>}
  </>;
}

/* ---- Deudas ---- */
function Deudas({ c }: { c: Ctx }) {
  const { s, ui } = c;
  const debo = s.debts.filter(d => d.kind === 'debo'); const meDeben = s.debts.filter(d => d.kind === 'me_deben');
  const totalDebo = debo.filter(d => !d.settled).reduce((a, d) => a + debtRemaining(s, d), 0);
  const totalMeDeben = meDeben.filter(d => !d.settled).reduce((a, d) => a + debtRemaining(s, d), 0);
  function rows(list: Debt[]) {
    if (list.length === 0) return <div className="empty-state" style={{ padding: '14px 0' }}>Nada por aquí.</div>;
    const isDebo = list[0].kind === 'debo';
    return list.slice().sort((a, b) => b.createdAt - a.createdAt).map(d => {
      const paid = debtPaid(s, d); const remaining = debtRemaining(s, d);
      return (
        <div className={'debt-row ' + (d.settled ? 'settled' : '')} key={d.id}>
          <div><div className="debt-person">{d.person}</div>{d.note && <div className="debt-note">{d.note}</div>}
            {(paid > 0.004 && !d.settled) && <div className="debt-note">Abonado {fmt(s, paid)} de {fmt(s, d.amount)} · faltan {fmt(s, remaining)}</div>}
            {d.dueDate && <div className="debt-due">Fecha límite: {shortDate(d.dueDate)}</div>}</div>
          <div className="debt-amt">{fmt(s, d.amount)}</div>
          <div className="debt-actions">
            <button className="btn-small" onClick={() => openModal({ type: 'debtHistory', debtId: d.id })}>Historial</button>
            {!d.settled && <button className="btn-small" onClick={() => openModal({ type: 'debtPayment', debtId: d.id })}>{isDebo ? 'Abonar' : 'Cobrar'}</button>}
            {ui.confirm.debt === d.id ?
              <button className="btn-small danger" onClick={() => A.confirmDeleteDebt(d.id)}>Sí</button> :
              <button className="btn-small danger" onClick={() => A.askDeleteDebt(d.id)}>×</button>}
          </div>
        </div>
      );
    });
  }
  return <>
    <div className="summary-mini" style={{ marginBottom: 16 }}><div className="card"><div className="label">Debo</div><div className="val" style={{ color: 'var(--spend)' }}>{fmt(s, totalDebo)}</div></div><div className="card"><div className="label">Me deben</div><div className="val" style={{ color: 'var(--growth)' }}>{fmt(s, totalMeDeben)}</div></div></div>
    <div className="section-title">Debo</div><div style={{ marginBottom: 18 }}>{rows(debo)}</div>
    <div className="section-title">Me deben</div><div>{rows(meDeben)}</div>
  </>;
}

/* ---- Tablero de escritorio (todo en una vista) ---- */
function Dashboard({ c }: { c: Ctx }) {
  return (
    <div className="dash-grid">
      <div className="dash-col">
        <ResumenTop c={c} />
        <div className="section-title">Movimientos {c.ui.viewMode === 'total' ?
          <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--text-faint)' }}>Cambia a "Por mes" para agregar</span> :
          <button className="btn-small" onClick={A.openAddTransaction}>+ Nuevo</button>}</div>
        <div className="card" style={{ maxHeight: 460, overflowY: 'auto' }}><Movimientos c={c} /></div>
      </div>
      <div className="dash-col">
        <div className="section-title">Metas de ahorro <button className="btn-small" onClick={() => openModal({ type: 'goal' })}>+ Nueva</button></div>
        <Metas c={c} />
        <div className="section-title">Wallets <button className="btn-small" onClick={() => openModal({ type: 'account', accountId: null })}>+ Nueva</button></div>
        <Cuentas c={c} />
        <div className="section-title">Bolsa</div>
        <Inversiones c={c} />
        <div className="section-title">Deudas <button className="btn-small" onClick={() => openModal({ type: 'debt' })}>+ Nueva</button></div>
        <Deudas c={c} />
      </div>
    </div>
  );
}

export function FinanzasView(props: { s: AppState; ui: Ui; desktop: boolean }) {
  const { s, ui, desktop } = props;
  const c: Ctx = { s: s, ui: ui, p: { viewMode: ui.viewMode, monthOffset: ui.monthOffset } };
  const needsQuotes = desktop || ui.tab === 'inversiones';
  /* Precios: se piden al entrar a la pantalla o al cambiar las acciones, no en cada redibujo
     (si la consulta falla, así no se repite en bucle). */
  const tickersKey = s.bolsaPositions.map(p => p.ticker).join(',');
  useEffect(() => { if (needsQuotes) void refreshQuotesIfNeeded(); }, [needsQuotes, ui.tab, tickersKey]);
  if (desktop) return <Dashboard c={c} />;
  if (ui.tab === 'resumen') return <><ResumenTop c={c} /><GoalsPreview c={c} /><SummaryMini c={c} /></>;
  if (ui.tab === 'movimientos') return <Movimientos c={c} />;
  if (ui.tab === 'metas') return <Metas c={c} />;
  if (ui.tab === 'cuentas') return <Cuentas c={c} />;
  if (ui.tab === 'inversiones') return <Inversiones c={c} />;
  return <Deudas c={c} />;
}
