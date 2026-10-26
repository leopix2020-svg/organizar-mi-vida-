import type { Category } from './types';

export const DEFAULT_EXPENSE_CATS: Category[] = [
  { id: 'comida', label: 'Comida', color: '#A8452C' }, { id: 'transporte', label: 'Transporte', color: '#8A6D3B' },
  { id: 'casa', label: 'Casa', color: '#5B7B92' }, { id: 'salud', label: 'Salud', color: '#7C5295' },
  { id: 'entretenimiento', label: 'Entretenimiento', color: '#C08A28' },
  { id: 'comisiones', label: 'Comisiones', color: '#B0424F' },
  { id: 'pago_deuda', label: 'Pago de deuda', color: '#6B4A8A' },
  { id: 'ahorro_meta', label: 'Ahorro en meta', color: '#4C7A5D' },
  { id: 'inversion_bolsa', label: 'Inversión en bolsa', color: '#8A6D3B' },
  { id: 'otros_gasto', label: 'Otros', color: '#6B7280' }
];
export const DEFAULT_INCOME_CATS: Category[] = [
  { id: 'salario', label: 'Salario', color: '#4C7A5D' }, { id: 'extra', label: 'Ingreso extra', color: '#3E8E7E' },
  { id: 'cobro_deuda', label: 'Cobro de deuda', color: '#2F8F6F' },
  { id: 'retiro_meta', label: 'Retiro de meta', color: '#5B7B92' },
  { id: 'retiro_bolsa', label: 'Retiro de bolsa', color: '#C08A28' },
  { id: 'otros_ingreso', label: 'Otros', color: '#7A9A82' }
];
export const GOAL_COLORS = ['#4C7A5D', '#C08A28', '#5B7B92', '#7C5295', '#A8452C', '#3E8E7E'];
export const CATEGORY_COLOR_PALETTE = ['#A8452C', '#8A6D3B', '#5B7B92', '#7C5295', '#C08A28', '#2F6B52', '#4C7A5D', '#3E8E7E', '#6B7280', '#B0424F'];
export const WALLET_DONUT_COLORS = ['#5B7B92', '#C08A28', '#8A6D3B', '#7C5295', '#2F8F6F', '#A8452C', '#4C7A5D'];
export const CURRENCIES: Record<string, { locale: string }> = {
  MXN: { locale: 'es-MX' }, USD: { locale: 'en-US' }, EUR: { locale: 'es-ES' }, COP: { locale: 'es-CO' },
  ARS: { locale: 'es-AR' }, GTQ: { locale: 'es-GT' }, PEN: { locale: 'es-PE' }, VES: { locale: 'es-VE' }
};
export const FINANZAS_TABS = [
  { id: 'resumen', label: 'Resumen' }, { id: 'movimientos', label: 'Movimientos' }, { id: 'metas', label: 'Metas' },
  { id: 'cuentas', label: 'Wallets' }, { id: 'inversiones', label: 'Bolsa' }, { id: 'deudas', label: 'Deudas' }
];

/* Cada persona de la familia tiene su propio usuario, su propia clave y sus propios datos.
   Para agregar una persona: añadirla aquí y en USERS de api/state.js y api/quote.js. */
export const USERS = [
  { id: 'leo', name: 'Leo Jr' },
  { id: 'tizi', name: 'Tizi' }
];
export function findUser(userId: string | null) { return USERS.find(u => u.id === userId) || null; }

export const BACKUP_APP_ID = 'mi-vida-organizada';
export const QUOTE_TTL_MS = 60000;
