/* Los números deben ser idénticos a los de la versión HTML anterior (expected-numbers.json se calculó con ella). */
import oldState from './fixtures/old-state.json';
import expected from './fixtures/expected-numbers.json';
import { parseBackup, backupPayload } from '../src/lib/backup';
import * as F from '../src/lib/finance';
import { todayStr, dateToStr } from '../src/lib/format';
import { normalizeState } from '../src/lib/state';

const r = (n: number) => Math.round(n * 100) / 100;
const total = { viewMode: 'total' as const, monthOffset: 0 };

describe('lógica de finanzas (igual que la versión anterior)', () => {
  const s = normalizeState(JSON.parse(JSON.stringify(oldState)));

  it('saldos, metas, deudas y patrimonio', () => {
    expect(s.accounts.map(a => [a.id, r(F.accountBalance(s, a.id))])).toEqual(expected.balances);
    expect(s.goals.map(g => [g.id, r(F.goalCurrent(s, g.id))])).toEqual(expected.goals);
    expect(s.debts.map(d => [d.id, r(F.debtRemaining(s, d))])).toEqual(expected.debts);
    expect(F.patrimonio(s)).toEqual(expected.patrimonio);
  });

  it('monedas, períodos, reparto por wallet y comisiones', () => {
    expect(F.walletCurrencyGroups(s).map(g => [g.currency, r(g.total)])).toEqual(expected.groups);
    expect(r(F.periodIncome(s, total))).toBe(expected.totalIncome);
    expect(r(F.periodExpense(s, total))).toBe(expected.totalExpense);
    expect(r(F.periodIncome(s, total, 'VES'))).toBe(expected.totalIncomeVES);
    expect(r(F.periodExpense(s, total, 'VES'))).toBe(expected.totalExpenseVES);
    expect(s.accounts.map(a => [a.id, F.accountAllocationBreakdown(s, a.id)])).toEqual(expected.alloc);
    expect(F.bolsaFeeTotal(s)).toBe(expected.fee);
    expect(F.globalFulfillmentTotals(s)).toEqual(expected.globalFulfillment);
  });

  it('migraciones: pagos de deudas y fondos pasan a transacciones', () => {
    expect(s.transactions.length).toBe(expected.txnCount);
    expect(s.fundMovements.length).toBe(expected.fundMovements);
    expect([s.expenseCats.map(c => c.id), s.incomeCats.map(c => c.id)]).toEqual(expected.categories);
    expect(s.debts.every(d => d.payments.length === 0)).toBe(true);
  });

  it('normalizar dos veces no duplica nada', () => {
    const again = normalizeState(JSON.parse(JSON.stringify(s)));
    expect(again).toEqual(s);
  });

  it('conserva los datos ocultos de Salud y Avances', () => {
    expect(s.books.length).toBe(1);
    expect(s.meals.length).toBe(1);
    expect(s.exerciseLogs).toEqual(['2026-10-01', '2026-10-03']);
    expect(s.calorieGoal).toBe(1800);
    expect((s.customCalendars[0] as any).marks['2026-10-01']).toBe('yes');
  });

  it('cancelar meta devuelve cada aporte a su wallet', () => {
    const d = JSON.parse(JSON.stringify(s));
    const before = { a1: F.accountBalance(d, 'a1'), a2: F.accountBalance(d, 'a2') };
    F.cancelGoal(d, 'g1');
    expect(d.goals.length).toBe(0);
    expect(r(F.accountBalance(d, 'a1') - before.a1)).toBe(150);
    expect(r(F.accountBalance(d, 'a2') - before.a2)).toBe(60);
  });

  it('no se borra una wallet con movimientos', () => {
    const d = JSON.parse(JSON.stringify(s));
    expect(F.deleteAccount(d, 'a1')).toBe('activity');
    expect(F.deleteAccount(d, 'a4')).toBe('ok');
    expect(d.accounts.some((a: any) => a.id === 'a4')).toBe(false);
  });

  it('la fecha de hoy es local', () => { expect(todayStr()).toBe(dateToStr(new Date())); });
});

describe('respaldo', () => {
  const s = normalizeState(JSON.parse(JSON.stringify(oldState)));
  it('ida y vuelta deja el estado idéntico', () => {
    const parsed = parseBackup(JSON.stringify(backupPayload('leo', s)), 'leo');
    expect('error' in parsed).toBe(false);
    if (!('error' in parsed)) expect(normalizeState(parsed.state)).toEqual(s);
  });
  it('rechaza respaldos de otra persona o inválidos', () => {
    const other = parseBackup(JSON.stringify(backupPayload('tizi', s)), 'leo');
    expect('error' in other && other.error).toMatch('Tizi');
    expect('error' in parseBackup('hola', 'leo')).toBe(true);
    expect('error' in parseBackup('{"a":1}', 'leo')).toBe(true);
    expect('error' in parseBackup('null', 'leo')).toBe(true);
  });
  it('acepta el estado crudo bajado por consola', () => {
    expect('error' in parseBackup(JSON.stringify(oldState), 'leo')).toBe(false);
  });
});
