/* Reglas de dominio de Finanzas. Los saldos SIEMPRE se derivan de los movimientos: nunca se guardan.
   Las funciones que modifican reciben un borrador del estado (ver commit() en store.ts). */
import { isInMonth, monthKey, todayStr } from './format';
import { uid } from './state';
import type { Account, AppState, Category, Debt, Period, Txn, TxnType } from './types';

/* ---- Wallets ---- */
export function findAccount(s: AppState, id: string | null | undefined): Account | null {
  return s.accounts.find(a => a.id === id) || null;
}
export function resolvedCurrency(s: AppState, acc: Account | null) { return (acc && acc.currency) ? acc.currency : s.currency; }
export function accountBalance(s: AppState, id: string) {
  const acc = findAccount(s, id); if (!acc) return 0;
  let bal = acc.startingBalance || 0;
  s.transactions.forEach(t => { if (t.accountId === id) { bal += (t.type === 'income' ? t.amount : -t.amount); } });
  s.transfers.forEach(tr => { if (tr.fromId === id) bal -= tr.amount; if (tr.toId === id) bal += tr.amount; });
  s.fundMovements.forEach(f => { if (f.accountId === id) { bal += (f.direction === 'in' ? -f.amount : f.amount); } });
  return bal;
}
export function accountsTotal(s: AppState) {
  return s.accounts.filter(a => resolvedCurrency(s, a) === s.currency).reduce((a, acc) => a + accountBalance(s, acc.id), 0);
}
export interface CurrencyGroup { currency: string; accounts: Account[]; total: number; }
export function walletCurrencyGroups(s: AppState): CurrencyGroup[] {
  const map: Record<string, CurrencyGroup> = {};
  s.accounts.forEach(a => {
    const cur = resolvedCurrency(s, a);
    if (!map[cur]) map[cur] = { currency: cur, accounts: [], total: 0 };
    map[cur].accounts.push(a);
    map[cur].total += accountBalance(s, a.id);
  });
  return Object.keys(map).map(k => map[k]).sort((a, b) => a.currency === s.currency ? -1 : (b.currency === s.currency ? 1 : a.currency.localeCompare(b.currency)));
}
export function hasMultipleCurrencies(s: AppState) { return walletCurrencyGroups(s).length > 1; }
export function addAccount(s: AppState, name: string, startingBalance: number, currency: string | null) {
  s.accounts.push({ id: uid(), name: name, startingBalance: startingBalance || 0, currency: currency || null });
}
export function accountHasActivity(s: AppState, id: string) {
  return s.transactions.some(t => t.accountId === id) ||
    s.transfers.some(tr => tr.fromId === id || tr.toId === id) ||
    s.fundMovements.some(f => f.accountId === id);
}
/* Un wallet con movimientos no se borra: dejaría movimientos y aportes a metas sin wallet. */
export function deleteAccount(s: AppState, id: string): 'ok' | 'last' | 'activity' {
  if (s.accounts.length <= 1) return 'last';
  if (accountHasActivity(s, id)) return 'activity';
  s.accounts = s.accounts.filter(a => a.id !== id);
  return 'ok';
}

/* ---- Movimientos por período y moneda ---- */
export function isPrimaryCurrencyTxn(s: AppState, t: Txn) { const acc = findAccount(s, t.accountId); return !acc || resolvedCurrency(s, acc) === s.currency; }
export function periodTxns(s: AppState, p: Period, currencyFilter?: string | null) {
  const base = p.viewMode === 'mensual' ? s.transactions.filter(t => isInMonth(t.date, p.monthOffset)) : s.transactions.slice();
  if (currencyFilter) return base.filter(t => resolvedCurrency(s, findAccount(s, t.accountId)) === currencyFilter);
  return hasMultipleCurrencies(s) ? base.filter(t => isPrimaryCurrencyTxn(s, t)) : base;
}
export function periodIncome(s: AppState, p: Period, currencyFilter?: string | null) { return periodTxns(s, p, currencyFilter).filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0); }
export function periodExpense(s: AppState, p: Period, currencyFilter?: string | null) { return periodTxns(s, p, currencyFilter).filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0); }
function monthTotal(s: AppState, type: TxnType, offset: number, currencyFilter?: string | null) {
  let txns = s.transactions.filter(t => t.type === type && isInMonth(t.date, offset));
  if (currencyFilter) txns = txns.filter(t => resolvedCurrency(s, findAccount(s, t.accountId)) === currencyFilter);
  else if (hasMultipleCurrencies(s)) txns = txns.filter(t => isPrimaryCurrencyTxn(s, t));
  return txns.reduce((a, t) => a + t.amount, 0);
}
export function monthIncome(s: AppState, offset: number, currencyFilter?: string | null) { return monthTotal(s, 'income', offset, currencyFilter); }
export function monthExpense(s: AppState, offset: number, currencyFilter?: string | null) { return monthTotal(s, 'expense', offset, currencyFilter); }

/* ---- Categorías ---- */
export function catList(s: AppState, type: TxnType) { return type === 'income' ? s.incomeCats : s.expenseCats; }
export function catInfo(s: AppState, type: TxnType, id: string): Category {
  const list = catList(s, type);
  return list.find(c => c.id === id) || list[0] || { id: '', label: 'Otros', color: '#6B7280' };
}
export function addCategory(s: AppState, type: TxnType, label: string, color: string) { const c = { id: uid(), label: label, color: color }; catList(s, type).push(c); return c.id; }
export function updateCategory(s: AppState, type: TxnType, id: string, label: string, color: string) { const c = catList(s, type).find(x => x.id === id); if (c) { c.label = label; c.color = color; } }
export function deleteCategory(s: AppState, type: TxnType, id: string) {
  const list = catList(s, type); if (list.length <= 1) return false;
  const idx = list.findIndex(c => c.id === id);
  if (idx > -1) { list.splice(idx, 1); return true; }
  return false;
}
export function currencyHasMultipleAccounts(s: AppState, currencyFilter?: string | null) {
  const cur = currencyFilter || s.currency;
  const grp = walletCurrencyGroups(s).find(g => g.currency === cur);
  return grp ? grp.accounts.length > 1 : false;
}
export function categoryAccountsLabel(s: AppState, p: Period, type: TxnType, catId: string, currencyFilter?: string | null) {
  const ids: Record<string, boolean> = {};
  periodTxns(s, p, currencyFilter).filter(t => t.type === type && t.category === catId).forEach(t => { if (t.accountId) ids[t.accountId] = true; });
  return Object.keys(ids).map(id => { const a = findAccount(s, id); return a ? a.name : null; }).filter(Boolean).join(' + ');
}

/* ---- Metas (lo ahorrado = legacy + aportes − retiros) ---- */
export function findGoal(s: AppState, id: string) { return s.goals.find(g => g.id === id) || null; }
export function goalCurrent(s: AppState, goalId: string) {
  const g = findGoal(s, goalId); if (!g) return 0;
  let c = g.legacyCurrent || 0;
  s.transactions.forEach(t => { if (t.goalId === goalId) { c += (t.type === 'expense' ? t.amount : -t.amount); } });
  return c;
}
export function goalsTotal(s: AppState) { return s.goals.reduce((a, g) => a + goalCurrent(s, g.id), 0); }
export function goalAccountBreakdown(s: AppState, goalId: string) {
  const perAccount: Record<string, number> = {};
  s.transactions.forEach(t => {
    if (t.goalId === goalId && t.accountId) perAccount[t.accountId] = (perAccount[t.accountId] || 0) + (t.type === 'expense' ? t.amount : -t.amount);
  });
  return perAccount;
}
/* Cancelar devuelve cada aporte a su wallet de origen, sin preguntar. */
export function cancelGoal(s: AppState, goalId: string) {
  const perAccount = goalAccountBreakdown(s, goalId);
  Object.keys(perAccount).forEach(accId => {
    const amt = perAccount[accId];
    if (amt > 0.004) {
      s.transactions.push({ id: uid(), type: 'income', amount: amt, category: 'retiro_meta', date: todayStr(), note: 'Meta cancelada', createdAt: Date.now(), accountId: accId, goalId: goalId });
    }
  });
  s.goals = s.goals.filter(g => g.id !== goalId);
}
/* Canjear cierra la meta sin devolver fondos. */
export function redeemGoal(s: AppState, goalId: string) { s.goals = s.goals.filter(g => g.id !== goalId); }

/* ---- Deudas (abonos y cobros son transacciones reales) ---- */
export function findDebt(s: AppState, id: string) { return s.debts.find(d => d.id === id) || null; }
export function debtPayments(s: AppState, d: Debt) { return s.transactions.filter(t => t.debtId === d.id).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); }
export function debtPaid(s: AppState, d: Debt) { return debtPayments(s, d).reduce((a, t) => a + t.amount, 0); }
export function debtRemaining(s: AppState, d: Debt) { return Math.max(0, d.amount - debtPaid(s, d)); }

/* ---- Reparto interno de cada wallet (libre / bolsa / metas) ---- */
export function accountAllocationBreakdown(s: AppState, accountId: string) {
  let bolsaNet = 0; const goalNets: Record<string, number> = {};
  s.transactions.forEach(t => {
    if (t.accountId !== accountId) return;
    if (t.category === 'inversion_bolsa' && t.type === 'expense') { bolsaNet += t.amount; }
    else if (t.category === 'retiro_bolsa' && t.type === 'income') { bolsaNet -= t.amount; }
    else if (t.goalId) { goalNets[t.goalId] = (goalNets[t.goalId] || 0) + (t.type === 'expense' ? t.amount : -t.amount); }
  });
  return { bolsa: bolsaNet, goals: goalNets };
}

export function patrimonio(s: AppState) {
  const cuentas = accountsTotal(s);
  const invertido = s.bolsa.currentValue;
  const ahorrado = goalsTotal(s);
  return { cuentas: cuentas, invertido: invertido, ahorrado: ahorrado, total: cuentas + invertido + ahorrado };
}
export function patrimonioColors(s: AppState) { return s.theme === 'dark' ? { cuentas: '#1F5C38', invertido: '#39FF6A', ahorrado: '#22C55E' } : { cuentas: '#5B7B92', invertido: '#8A6D3B', ahorrado: '#4C7A5D' }; }
export function chartColors(s: AppState) { return s.theme === 'dark' ? { income: '#39FF6A', expense: '#1F5C38', ahorro: '#22C55E' } : { income: '#4C7A5D', expense: '#A8452C', ahorro: '#C08A28' }; }

/* ---- Estimación de ingresos mensual ---- */
export function monthEstimate(s: AppState, offset: number) { const k = monthKey(offset); return (s.incomeEstimates && typeof s.incomeEstimates[k] === 'number') ? s.incomeEstimates[k] : null; }
export function setMonthEstimate(s: AppState, offset: number, amount: number) { s.incomeEstimates = s.incomeEstimates || {}; s.incomeEstimates[monthKey(offset)] = amount; }
export function monthFulfillmentPct(s: AppState, offset: number) { const est = monthEstimate(s, offset); if (!est || est <= 0) return null; return Math.round((monthIncome(s, offset) / est) * 100); }
export function globalFulfillmentTotals(s: AppState) {
  if (!s.incomeEstimates) return null;
  let totalEst = 0, totalActual = 0, count = 0;
  Object.keys(s.incomeEstimates).forEach(k => {
    const est = s.incomeEstimates[k];
    if (!est || est <= 0) return;
    const actual = s.transactions.filter(t => t.type === 'income' && t.date.slice(0, 7) === k).reduce((a, t) => a + t.amount, 0);
    totalEst += est; totalActual += actual; count++;
  });
  if (totalEst <= 0) return null;
  return { est: totalEst, actual: totalActual, pct: Math.round((totalActual / totalEst) * 100), count: count };
}

/* ---- Bolsa ---- */
export function bolsaFeeTotal(s: AppState) { return s.transactions.filter(t => t.type === 'expense' && t.category === 'comisiones').reduce((a, t) => a + t.amount, 0); }
