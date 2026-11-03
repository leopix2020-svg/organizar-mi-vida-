/* Sección Bolsa del riel: acciones reales con precios de Finnhub (no tiene que ver con la Bolsa de Finanzas). */
import type { AppState, BolsaPosition } from './types';

export type Quote = { price: number; change?: number; changePct?: number; fetchedAt: number } | { error: true; fetchedAt: number };
export type QuotesCache = Record<string, Quote>;

export function quotePrice(q: Quote | undefined): number | null { return q && 'price' in q && typeof q.price === 'number' ? q.price : null; }
export function bolsaPositionCurrentValue(p: BolsaPosition, quotes: QuotesCache) {
  const price = quotePrice(quotes[p.ticker]);
  return price !== null ? p.shares * price : null;
}

/* Foto de hoy: solo si todas las acciones tienen precio, para no guardar un valor incompleto. Redondeada a centavos. */
export function bolsaSnapshot(s: AppState, quotes: QuotesCache) {
  const positions = s.bolsaPositions || [];
  if (positions.length === 0) return null;
  let value = 0, invested = 0;
  for (const p of positions) {
    const v = bolsaPositionCurrentValue(p, quotes);
    if (v === null) return null;
    value += v; invested += p.amountInvested;
  }
  return { value: Math.round(value * 100) / 100, invested: Math.round(invested * 100) / 100 };
}
/* Una sola foto por día: la nueva reemplaza la de esa fecha. */
export function upsertBolsaSnapshot(s: AppState, date: string, snap: { value: number; invested: number }) {
  s.bolsaHistory = s.bolsaHistory.filter(h => h.date !== date).concat([{ date: date, value: snap.value, invested: snap.invested }]);
}

/* Peso de cada acción en el valor actual (la misma acción comprada varias veces se suma). null si falta algún precio. */
export function bolsaDistribution(s: AppState, quotes: QuotesCache) {
  const byTicker: Record<string, number> = {};
  let total = 0;
  for (const p of s.bolsaPositions || []) {
    const v = bolsaPositionCurrentValue(p, quotes);
    if (v === null) return null;
    byTicker[p.ticker] = (byTicker[p.ticker] || 0) + v; total += v;
  }
  return Object.keys(byTicker).map(t => ({ ticker: t, value: byTicker[t], pct: total > 0 ? byTicker[t] / total : 0 })).sort((a, b) => b.value - a.value);
}

export interface SeriesPoint { v: number; label: string; tooltip: string; }
/* Gráficas de Bolsa con las fotos diarias reales (no se inventan los días sin foto). */
export function bolsaHistorySeries(s: AppState) {
  const hist = s.bolsaHistory.slice().sort((a, b) => a.date.localeCompare(b.date));
  const label = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  return {
    valueSeries: hist.map(h => ({ v: h.value, label: label(h.date), tooltip: label(h.date) + ': $' + h.value.toFixed(2) } as SeriesPoint)),
    gainSeries: hist.map(h => { const g = h.value - h.invested; return { v: g, label: label(h.date), tooltip: label(h.date) + ': ' + (g >= 0 ? '+' : '−') + '$' + Math.abs(g).toFixed(2) } as SeriesPoint; })
  };
}
