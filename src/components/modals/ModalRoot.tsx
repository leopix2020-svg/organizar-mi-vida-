import type { AppState } from '../../lib/types';
import type { Ui } from '../../store';
import {
  AccountModal, BolsaFixAccountModal, BolsaFundModal, BolsaPositionModal, BolsaUpdateModal, DebtHistoryModal, DebtModal,
  DebtPaymentModal, GoalFundModal, GoalHistoryModal, GoalModal, IncomeEstimateModal, TransferModal
} from './FinanceModals';
import { ResetModal, RestoreModal, SettingsModal } from './SettingsModals';
import { TxnModal } from './TxnModal';
import { BodyWeightModal, ExerciseModal, RoutineModal, WorkoutModal } from './WorkoutModals';

export function ModalRoot({ s, ui }: { s: AppState; ui: Ui }) {
  const m = ui.modal;
  if (!m) return null;
  /* key: cada apertura empieza con el formulario limpio. */
  const key = JSON.stringify(m);
  switch (m.type) {
    case 'txn': return <TxnModal key={key} s={s} ui={ui} />;
    case 'goal': return <GoalModal key={key} />;
    case 'goalFund': return <GoalFundModal key={key} s={s} goalId={m.goalId} direction={m.direction} />;
    case 'goalHistory': return <GoalHistoryModal key={key} s={s} goalId={m.goalId} />;
    case 'account': return <AccountModal key={key} s={s} accountId={m.accountId} />;
    case 'transfer': return <TransferModal key={key} s={s} />;
    case 'bolsaFund': return <BolsaFundModal key={key} s={s} direction={m.direction} />;
    case 'bolsaUpdate': return <BolsaUpdateModal key={key} s={s} />;
    case 'bolsaFixAccount': return <BolsaFixAccountModal key={key} s={s} txnId={m.txnId} />;
    case 'bolsaPosition': return <BolsaPositionModal key={key} />;
    case 'debt': return <DebtModal key={key} />;
    case 'debtPayment': return <DebtPaymentModal key={key} s={s} debtId={m.debtId} />;
    case 'debtHistory': return <DebtHistoryModal key={key} s={s} debtId={m.debtId} />;
    case 'incomeEstimate': return <IncomeEstimateModal key={key} s={s} ui={ui} />;
    case 'settings': return <SettingsModal key={key} s={s} />;
    case 'reset': return <ResetModal key={key} />;
    case 'restore': return <RestoreModal key={key} parsed={m.parsed} />;
    case 'routine': return <RoutineModal key={key} s={s} routineId={m.routineId} />;
    case 'workout': return <WorkoutModal key={key} s={s} workoutId={m.workoutId} />;
    case 'exercise': return <ExerciseModal key={key} s={s} exerciseId={m.exerciseId} />;
    case 'bodyWeight': return <BodyWeightModal key={key} s={s} id={m.id} />;
    default: return null;
  }
}
