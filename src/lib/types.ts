export type TxnType = 'income' | 'expense';

export interface Txn {
  id: string;
  type: TxnType;
  amount: number;
  category: string;
  date: string;
  note: string;
  createdAt: number;
  accountId: string | null;
  goalId?: string;
  debtId?: string;
  bolsaFeeForMovement?: string;
}

export interface Account { id: string; name: string; startingBalance: number; currency: string | null; }
export interface Transfer { id: string; fromId: string; toId: string; amount: number; date: string; note: string; createdAt: number; }
export interface FundMovement { id?: string; targetType: string; targetId?: string; direction: 'in' | 'out'; amount: number; accountId: string; date: string; note?: string; createdAt?: number; }

export interface Goal {
  id: string; name: string; target: number; color: string;
  monthlyContribution: number | null; lastContribMonthKey: string | null;
  legacyCurrent: number; createdAt: number | null;
}

export interface Debt {
  id: string; kind: 'debo' | 'me_deben'; person: string; amount: number;
  dueDate: string | null; note: string; settled: boolean; createdAt: number;
  originAccountId: string | null; payments: unknown[];
}

export interface Bolsa { amountInvested: number; currentValue: number; feeAmount: number; lastUpdated: string | null; }
export interface BolsaPosition { id: string; ticker: string; amountInvested: number; purchasePrice: number; shares: number; purchaseDate: string | null; }
export interface Category { id: string; label: string; color: string; }

export interface AppState {
  currency: string;
  customSymbol: string;
  theme: 'warm' | 'dark';
  transactions: Txn[];
  transfers: Transfer[];
  fundMovements: FundMovement[];
  goals: Goal[];
  debts: Debt[];
  incomeEstimates: Record<string, number>;
  accounts: Account[];
  bolsa: Bolsa;
  bolsaPositions: BolsaPosition[];
  expenseCats: Category[];
  incomeCats: Category[];
  /* Ejercicio */
  exercises: Exercise[];
  routines: Routine[];
  workouts: Workout[];
  bodyWeights: BodyWeight[];
  /* Comidas */
  nutritionDays: NutritionDay[];
  /* Datos de Salud y Avances (secciones quitadas): no se muestran, pero se conservan. */
  books: unknown[];
  exerciseLogs: string[];
  exerciseGoal: unknown;
  meals: unknown[];
  calorieGoal: number | null;
  customCalendars: unknown[];
}

/* ---- Ejercicio ---- */
/* weighted: el ejercicio usa pesa. En los que no, kg es el lastre opcional (mochila). */
export interface Exercise { id: string; name: string; weighted: boolean; }
export interface Routine { id: string; name: string; exerciseIds: string[]; createdAt: number; }
export interface WorkoutSet { reps: number; kg: number | null; }
export interface WorkoutEntry { exerciseId: string; sets: WorkoutSet[]; }
export interface Workout { id: string; date: string; routineId: string | null; routineName: string; entries: WorkoutEntry[]; createdAt: number; }
export interface BodyWeight { id: string; date: string; kg: number; createdAt: number; }

/* ---- Comidas ---- */
/* Un registro por día, como el resumen de Yazio. goal.kcal es la meta base: las quemadas se suman aparte. */
export interface Macros { kcal: number; carbs: number; protein: number; fat: number; }
export type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export interface NutritionDay {
  id: string; date: string;
  eaten: Macros; goal: Macros; burned: number;
  meals: Record<MealKey, number>;
  createdAt: number;
}

/* Período que se está viendo en Finanzas (afecta resumen, movimientos y gráficas). */
export interface Period { viewMode: 'total' | 'mensual'; monthOffset: number; }
