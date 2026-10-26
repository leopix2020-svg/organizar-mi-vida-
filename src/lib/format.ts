import { CURRENCIES } from './constants';
import type { AppState } from './types';

export function fmt(s: AppState, amount: number) {
  const cur = s.currency;
  if (CURRENCIES[cur]) { try { return new Intl.NumberFormat(CURRENCIES[cur].locale, { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(amount); } catch (e) { /* símbolo personalizado */ } }
  return s.customSymbol + ' ' + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtCur(s: AppState, amount: number, currencyCode?: string | null) {
  if (!currencyCode || currencyCode === s.currency) return fmt(s, amount);
  if (CURRENCIES[currencyCode]) { try { return new Intl.NumberFormat(CURRENCIES[currencyCode].locale, { style: 'currency', currency: currencyCode, maximumFractionDigits: 2 }).format(amount); } catch (e) { /* código desconocido */ } }
  return currencyCode + ' ' + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtPct(n: number) { return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'; }

/* ---- Fechas (siempre en hora local) ---- */
export function padNum(n: number) { return String(n).padStart(2, '0'); }
export function dateToStr(d: Date) { return d.getFullYear() + '-' + padNum(d.getMonth() + 1) + '-' + padNum(d.getDate()); }
export function todayStr() { return dateToStr(new Date()); }
export function monthDate(offset: number) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset); return d; }
export function monthLabel(offset: number) { const s = monthDate(offset).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); }
export function monthShortLabel(offset: number) { const s = monthDate(offset).toLocaleDateString('es-MX', { month: 'short' }).replace('.', ''); return s.charAt(0).toUpperCase() + s.slice(1); }
export function monthKey(offset: number) { const d = monthDate(offset); return d.getFullYear() + '-' + padNum(d.getMonth() + 1); }
export function isInMonth(dateStr: string, offset: number) { const d = new Date(dateStr + 'T00:00:00'); const ref = monthDate(offset); return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth(); }
export function daysInMonth(offset: number) { const d = monthDate(offset); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
export function monthBoundsStr(offset: number) {
  const d = monthDate(offset);
  const y = d.getFullYear(), m = d.getMonth();
  return { min: y + '-' + padNum(m + 1) + '-01', max: y + '-' + padNum(m + 1) + '-' + padNum(daysInMonth(offset)) };
}
export function monthDefaultDateStr(offset: number) { return offset === 0 ? todayStr() : monthBoundsStr(offset).max; }
export function greetingText() { const h = new Date().getHours(); if (h < 12) return 'Buenos días'; if (h < 19) return 'Buenas tardes'; return 'Buenas noches'; }
export function shortDate(dateStr: string) { return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }); }
