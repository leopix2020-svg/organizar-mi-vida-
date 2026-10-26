/* Acciones que se disparan desde varias pantallas (botones de tarjetas, FAB, tablero). */
import { cancelGoal, deleteAccount, redeemGoal } from './lib/finance';
import { monthLabel } from './lib/format';
import { askConfirm, clearConfirm, commit, getStore, openModal, setUi, showToast } from './store';

function requireMonthly(msg: string) {
  if (getStore().ui.viewMode === 'total') { showToast(msg); return false; }
  return true;
}

export function gotoTab(tab: string) { setUi({ section: 'finanzas', tab: tab }); }
export function toggleCardExpand(id: string) {
  const ui = getStore().ui;
  setUi({ expandedCards: Object.assign({}, ui.expandedCards, { [id]: !ui.expandedCards[id] }) });
}

export function openAddTransaction() {
  if (!requireMonthly('Cambia a la vista "Por mes" para agregar un movimiento.')) return;
  openModal({ type: 'txn' });
}
export function openGoalFund(goalId: string, direction: 'in' | 'out') {
  if (!requireMonthly('Cambia a la vista "Por mes" para agregar o retirar de una meta.')) return;
  openModal({ type: 'goalFund', goalId: goalId, direction: direction });
}
export function openBolsaFund(direction: 'in' | 'out') {
  if (!requireMonthly('Cambia a la vista "Por mes" para meter o retirar de la bolsa.')) return;
  openModal({ type: 'bolsaFund', direction: direction });
}
export function openIncomeEstimate() {
  if (!requireMonthly('Cambia a la vista "Por mes" para definir un estimado.')) return;
  openModal({ type: 'incomeEstimate' });
}

/* El botón + flotante abre lo que corresponde a la pestaña actual. */
export function fab() {
  const tab = getStore().ui.tab;
  if (tab === 'metas') openModal({ type: 'goal' });
  else if (tab === 'cuentas') openModal({ type: 'account', accountId: null });
  else if (tab === 'inversiones') openBolsaFund('in');
  else if (tab === 'deudas') openModal({ type: 'debt' });
  else openAddTransaction();
}

/* ---- Borrados y cierres con "¿Seguro?" ---- */
export const askDeleteTxn = (id: string) => askConfirm('txn', id);
export async function confirmDeleteTxn(id: string) {
  clearConfirm('txn');
  await commit(s => { s.transactions = s.transactions.filter(t => t.id !== id); });
  showToast('Movimiento eliminado.');
}
export const askCancelGoal = (id: string) => askConfirm('goalCancel', id);
export async function confirmCancelGoal(id: string) {
  clearConfirm('goalCancel');
  await commit(s => cancelGoal(s, id));
  showToast('Meta cancelada, tu dinero volvió a tus wallets.');
}
export const askRedeemGoal = (id: string) => askConfirm('goalRedeem', id);
export async function confirmRedeemGoal(id: string) {
  clearConfirm('goalRedeem');
  await commit(s => redeemGoal(s, id));
  showToast('¡Meta canjeada!');
}
export const askDeleteAccount = (id: string) => askConfirm('account', id);
export async function confirmDeleteAccount(id: string) {
  clearConfirm('account');
  const state = getStore().state; if (!state) return;
  const probe = JSON.parse(JSON.stringify(state));
  const res = deleteAccount(probe, id);
  if (res !== 'ok') {
    showToast(res === 'last' ? 'Debes dejar al menos un wallet.' : 'Este wallet tiene movimientos, no se puede eliminar. Puedes cambiarle el nombre con "Editar".');
    return;
  }
  await commit(s => { deleteAccount(s, id); });
  showToast('Wallet eliminado.');
}
export const askDeleteDebt = (id: string) => askConfirm('debt', id);
export async function confirmDeleteDebt(id: string) {
  clearConfirm('debt');
  await commit(s => { s.debts = s.debts.filter(d => d.id !== id); });
  showToast('Eliminado.');
}

export function dateOutOfMonthMsg() { return 'La fecha debe estar dentro de ' + monthLabel(getStore().ui.monthOffset).toLowerCase() + '.'; }
