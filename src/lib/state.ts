import { DEFAULT_EXPENSE_CATS, DEFAULT_INCOME_CATS } from './constants';
import type { AppState, Category, Debt, Goal, Txn } from './types';

export function uid() { return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9); }

export function defaultState(): AppState {
  return {
    currency: 'USD', customSymbol: '$', theme: 'warm',
    transactions: [], transfers: [], fundMovements: [],
    goals: [], debts: [], incomeEstimates: {},
    accounts: [{ id: uid(), name: 'Efectivo', startingBalance: 0, currency: null }],
    bolsa: { amountInvested: 0, currentValue: 0, feeAmount: 0, lastUpdated: null },
    bolsaPositions: [],
    exercises: [], routines: [], workouts: [], bodyWeights: [],
    books: [],
    exerciseLogs: [],
    exerciseGoal: null,
    meals: [],
    calorieGoal: null,
    customCalendars: [{ id: 'cal1', name: 'Calendario 1', marks: {} }, { id: 'cal2', name: 'Calendario 2', marks: {} }],
    expenseCats: DEFAULT_EXPENSE_CATS.map(c => Object.assign({}, c)),
    incomeCats: DEFAULT_INCOME_CATS.map(c => Object.assign({}, c))
  };
}

/* Convierte cualquier estado guardado (incluidos formatos viejos) al formato actual.
   Contiene migraciones de datos reales: no romperlas. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeState(s: any): AppState {
  const d = defaultState();
  if (!s || typeof s !== 'object') return d;

  let accounts;
  if (Array.isArray(s.accounts) && s.accounts.length) {
    accounts = s.accounts.map(function (a: any) {
      const startingBalance = (typeof a.startingBalance === 'number') ? a.startingBalance : (typeof a.balance === 'number' ? a.balance : 0);
      return { id: a.id, name: a.name, startingBalance: startingBalance, currency: a.currency || null };
    });
  } else if (typeof s.cash === 'number') {
    accounts = [{ id: uid(), name: 'Efectivo', startingBalance: s.cash, currency: null }];
  } else {
    accounts = d.accounts;
  }

  const goals: Goal[] = Array.isArray(s.goals) ? s.goals.map(function (g: any) {
    const legacyCurrent = (typeof g.legacyCurrent === 'number') ? g.legacyCurrent : (typeof g.current === 'number' ? g.current : 0);
    return { id: g.id, name: g.name, target: g.target, color: g.color, monthlyContribution: g.monthlyContribution || null, lastContribMonthKey: g.lastContribMonthKey || null, legacyCurrent: legacyCurrent, createdAt: g.createdAt || null };
  }) : [];

  const debts: Debt[] = Array.isArray(s.debts) ? s.debts.map(function (d: any) {
    return { id: d.id, kind: d.kind, person: d.person, amount: d.amount, dueDate: d.dueDate || null, note: d.note || '', settled: !!d.settled, createdAt: d.createdAt || Date.now(), originAccountId: d.originAccountId || null, payments: Array.isArray(d.payments) ? d.payments : [] };
  }) : [];

  let bolsa;
  if (s.bolsa && typeof s.bolsa === 'object') {
    const feeAmt = (typeof s.bolsa.feeAmount === 'number') ? s.bolsa.feeAmount : ((s.bolsa.feePercent || 0) * (s.bolsa.amountInvested || 0) / 100);
    bolsa = { amountInvested: s.bolsa.amountInvested || 0, currentValue: s.bolsa.currentValue || 0, feeAmount: feeAmt, lastUpdated: s.bolsa.lastUpdated || null };
  } else if (Array.isArray(s.investments) && s.investments.length) {
    const invested = s.investments.reduce(function (a: number, i: any) { return a + (i.amountInvested || 0); }, 0);
    const current = s.investments.reduce(function (a: number, i: any) { return a + (i.currentValue || 0); }, 0);
    const feeSum = s.investments.reduce(function (a: number, i: any) { return a + ((i.amountInvested || 0) * (i.feePercent || 0) / 100); }, 0);
    const lastUpd = s.investments.reduce(function (a: any, i: any) { return (i.lastUpdated && (!a || i.lastUpdated > a)) ? i.lastUpdated : a; }, null);
    bolsa = { amountInvested: invested, currentValue: current, feeAmount: feeSum, lastUpdated: lastUpd };
  } else {
    bolsa = d.bolsa;
  }

  const expenseCats: Category[] = Array.isArray(s.expenseCats) && s.expenseCats.length ? s.expenseCats.slice() : d.expenseCats.map(c => Object.assign({}, c));
  if (!expenseCats.some(c => c.id === 'comisiones')) { expenseCats.push({ id: 'comisiones', label: 'Comisiones', color: '#B0424F' }); }
  if (!expenseCats.some(c => c.id === 'pago_deuda')) { expenseCats.push({ id: 'pago_deuda', label: 'Pago de deuda', color: '#6B4A8A' }); }
  if (!expenseCats.some(c => c.id === 'ahorro_meta')) { expenseCats.push({ id: 'ahorro_meta', label: 'Ahorro en meta', color: '#4C7A5D' }); }
  if (!expenseCats.some(c => c.id === 'inversion_bolsa')) { expenseCats.push({ id: 'inversion_bolsa', label: 'Inversión en bolsa', color: '#8A6D3B' }); }

  const incomeCats: Category[] = Array.isArray(s.incomeCats) && s.incomeCats.length ? s.incomeCats.slice() : d.incomeCats.map(c => Object.assign({}, c));
  if (!incomeCats.some(c => c.id === 'cobro_deuda')) { incomeCats.push({ id: 'cobro_deuda', label: 'Cobro de deuda', color: '#2F8F6F' }); }
  if (!incomeCats.some(c => c.id === 'retiro_meta')) { incomeCats.push({ id: 'retiro_meta', label: 'Retiro de meta', color: '#5B7B92' }); }
  if (!incomeCats.some(c => c.id === 'retiro_bolsa')) { incomeCats.push({ id: 'retiro_bolsa', label: 'Retiro de bolsa', color: '#C08A28' }); }

  const transactions: Txn[] = Array.isArray(s.transactions) ? s.transactions.slice() : [];
  const fundMovements: any[] = Array.isArray(s.fundMovements) ? s.fundMovements.slice() : [];

  /* Libros, ejercicio, comidas y calendarios ya no se muestran (se quitaron Salud y Avances),
     pero se siguen normalizando y guardando para no borrar esos datos de MongoDB. */
  const books = Array.isArray(s.books) ? s.books.map(function (b: any) {
    return { id: b.id, name: b.name, totalPages: b.totalPages, currentPage: b.currentPage || 0, done: !!b.done, createdAt: b.createdAt || Date.now(), finishedAt: b.finishedAt || null, cover: b.cover || null };
  }) : [];

  const meals = Array.isArray(s.meals) ? s.meals.map(function (m: any) {
    return { id: m.id, date: m.date, text: m.text, calories: (typeof m.calories === 'number' ? m.calories : 0), createdAt: m.createdAt || Date.now() };
  }) : [];

  let customCalendars;
  if (Array.isArray(s.customCalendars) && s.customCalendars.length === 2) {
    customCalendars = s.customCalendars.map(function (c: any, idx: number) {
      const marks: Record<string, string> = {};
      if (c && c.marks && typeof c.marks === 'object') {
        Object.keys(c.marks).forEach(function (k) { if (c.marks[k] === 'yes' || c.marks[k] === 'no') { marks[k] = c.marks[k]; } });
      }
      return { id: (c && c.id) || ('cal' + (idx + 1)), name: (c && c.name) || ('Calendario ' + (idx + 1)), marks: marks };
    });
  } else {
    customCalendars = (d.customCalendars as any[]).map(function (c) { return { id: c.id, name: c.name, marks: {} }; });
  }

  /* Migración: los abonos/cobros de deudas ya no viven en fundMovements ni en debt.payments —
     ahora son transacciones reales de ingreso/gasto para que aparezcan en entradas y salidas. */
  debts.forEach(function (dbt) {
    (dbt.payments || []).forEach(function (p: any) {
      const alreadyMigrated = transactions.some(function (t) { return t.debtId === dbt.id && Math.abs(t.amount - p.amount) < 0.005 && t.date === p.date && t.accountId === p.accountId; });
      if (alreadyMigrated) return;
      let fmIdx = -1;
      for (let i = 0; i < fundMovements.length; i++) {
        const f = fundMovements[i];
        if (f.targetType === 'debt' && f.targetId === dbt.id && f.accountId === p.accountId && Math.abs(f.amount - p.amount) < 0.005 && f.date === p.date && f.note && f.note.indexOf('Préstamo') === -1) { fmIdx = i; break; }
      }
      if (fmIdx > -1) fundMovements.splice(fmIdx, 1);
      transactions.push({ id: uid(), type: dbt.kind === 'debo' ? 'expense' : 'income', amount: p.amount, category: dbt.kind === 'debo' ? 'pago_deuda' : 'cobro_deuda', date: p.date, note: dbt.kind === 'debo' ? ('Abono a deuda de ' + dbt.person) : ('Cobro de deuda de ' + dbt.person), createdAt: p.createdAt || Date.now(), accountId: p.accountId, debtId: dbt.id });
    });
    dbt.payments = [];
  });

  /* Migración: los aportes/retiros de metas y de la bolsa ya no viven en fundMovements —
     ahora son transacciones reales de ingreso/gasto para que también aparezcan en entradas y salidas. */
  (function migrateGoalsAndBolsa() {
    const toRemove: number[] = [];
    fundMovements.forEach(function (f, idx) {
      if (f.targetType === 'goal') {
        const alreadyG = transactions.some(function (t) { return t.goalId === f.targetId && Math.abs(t.amount - f.amount) < 0.005 && t.date === f.date && t.accountId === f.accountId; });
        if (!alreadyG) {
          transactions.push({ id: uid(), type: f.direction === 'in' ? 'expense' : 'income', amount: f.amount, category: f.direction === 'in' ? 'ahorro_meta' : 'retiro_meta', date: f.date, note: f.note || '', createdAt: f.createdAt || Date.now(), accountId: f.accountId, goalId: f.targetId });
        }
        toRemove.push(idx);
      } else if (f.targetType === 'invest') {
        const alreadyB = transactions.some(function (t) { return (t.category === 'inversion_bolsa' || t.category === 'retiro_bolsa') && Math.abs(t.amount - f.amount) < 0.005 && t.date === f.date && t.accountId === f.accountId; });
        if (!alreadyB) {
          transactions.push({ id: uid(), type: f.direction === 'in' ? 'expense' : 'income', amount: f.amount, category: f.direction === 'in' ? 'inversion_bolsa' : 'retiro_bolsa', date: f.date, note: f.note || '', createdAt: f.createdAt || Date.now(), accountId: f.accountId });
        }
        toRemove.push(idx);
      }
    });
    for (let i = toRemove.length - 1; i >= 0; i--) { fundMovements.splice(toRemove[i], 1); }
  })();

  return {
    currency: s.currency || d.currency,
    customSymbol: s.customSymbol || d.customSymbol,
    theme: s.theme === 'dark' ? 'dark' : 'warm',
    transactions: transactions,
    transfers: Array.isArray(s.transfers) ? s.transfers : [],
    fundMovements: fundMovements,
    goals: goals,
    debts: debts,
    incomeEstimates: (s.incomeEstimates && typeof s.incomeEstimates === 'object') ? s.incomeEstimates : {},
    accounts: accounts,
    bolsa: bolsa,
    bolsaPositions: Array.isArray(s.bolsaPositions) ? s.bolsaPositions.map(function (p: any) {
      return { id: p.id || uid(), ticker: p.ticker, amountInvested: p.amountInvested || 0, purchasePrice: p.purchasePrice || 0, shares: p.shares || 0, purchaseDate: p.purchaseDate || null };
    }) : [],
    expenseCats: expenseCats,
    incomeCats: incomeCats,
    exercises: Array.isArray(s.exercises) ? s.exercises.filter((e: any) => e && e.id && e.name).map((e: any) => ({ id: e.id, name: e.name, weighted: !!e.weighted })) : [],
    routines: Array.isArray(s.routines) ? s.routines.filter((r: any) => r && r.id).map((r: any) => ({ id: r.id, name: r.name || 'Rutina', exerciseIds: Array.isArray(r.exerciseIds) ? r.exerciseIds.filter((x: unknown) => typeof x === 'string') : [], createdAt: r.createdAt || Date.now() })) : [],
    workouts: Array.isArray(s.workouts) ? s.workouts.filter((w: any) => w && w.id && w.date).map((w: any) => ({
      id: w.id, date: w.date, routineId: w.routineId || null, routineName: w.routineName || '', createdAt: w.createdAt || Date.now(),
      entries: Array.isArray(w.entries) ? w.entries.map((en: any) => ({ exerciseId: en.exerciseId, sets: Array.isArray(en.sets) ? en.sets.map((st: any) => ({ reps: Number(st.reps) || 0, kg: typeof st.kg === 'number' ? st.kg : null })) : [] })) : []
    })) : [],
    bodyWeights: Array.isArray(s.bodyWeights) ? s.bodyWeights.filter((b: any) => b && b.id && typeof b.kg === 'number').map((b: any) => ({ id: b.id, date: b.date, kg: b.kg, createdAt: b.createdAt || Date.now() })) : [],
    books: books,
    exerciseLogs: Array.isArray(s.exerciseLogs) ? s.exerciseLogs.filter(function (d: unknown) { return typeof d === 'string'; }) : [],
    exerciseGoal: (s.exerciseGoal && typeof s.exerciseGoal === 'object' && s.exerciseGoal.targetDate) ? { targetDate: s.exerciseGoal.targetDate, createdAt: s.exerciseGoal.createdAt || Date.now() } : null,
    meals: meals,
    calorieGoal: (typeof s.calorieGoal === 'number' && s.calorieGoal > 0) ? s.calorieGoal : null,
    customCalendars: customCalendars
  };
}
