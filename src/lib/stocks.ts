/* Sección Bolsa del riel: acciones reales con precios de Finnhub (no tiene que ver con la Bolsa de Finanzas). */
import type { AppState, BolsaPosition } from './types';

export type Quote = { price: number; change?: number; changePct?: number; fetchedAt: number } | { error: true; fetchedAt: number };
export type QuotesCache = Record<string, Quote>;

export function quotePrice(q: Quote | undefined): number | null { return q && 'price' in q && typeof q.price === 'number' ? q.price : null; }
export function bolsaPositionCurrentValue(p: BolsaPosition, quotes: QuotesCache) {
  const price = quotePrice(quotes[p.ticker]);
  return price !== null ? p.shares * price : null;
}

export interface SeriesPoint { v: number; label: string; tooltip: string; }
/* Como no se guarda el precio de cada día, la línea entre la compra y hoy es un estimado lineal. */
export function bolsaGrowthSeries(s: AppState, quotes: QuotesCache) {
  const positions = (s.bolsaPositions || []).filter(p => bolsaPositionCurrentValue(p, quotes) !== null);
  if (positions.length === 0) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let earliest: Date | null = null;
  positions.forEach(p => {
    const d = new Date(p.purchaseDate + 'T00:00:00');
    if (!earliest || d < earliest) earliest = d;
  });
  if (!earliest) return null;
  const start: Date = earliest;
  const totalMs = today.getTime() - start.getTime();
  const totalDays = Math.round(totalMs / 86400000);
  const steps = Math.min(20, Math.max(2, totalDays + 1));
  const valueSeries: SeriesPoint[] = [], gainSeries: SeriesPoint[] = [];
  for (let i = 0; i < steps; i++) {
    const frac = steps > 1 ? i / (steps - 1) : 1;
    const t = new Date(start.getTime() + frac * totalMs);
    let totalValue = 0, totalInvestedSoFar = 0;
    positions.forEach(p => {
      const pd = new Date(p.purchaseDate + 'T00:00:00');
      if (t < pd) return;
      const currentValue = bolsaPositionCurrentValue(p, quotes) as number;
      const span = today.getTime() - pd.getTime();
      const posFrac = span > 0 ? Math.min(1, (t.getTime() - pd.getTime()) / span) : 1;
      totalValue += p.amountInvested + (currentValue - p.amountInvested) * posFrac;
      totalInvestedSoFar += p.amountInvested;
    });
    const label = t.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    valueSeries.push({ v: totalValue, label: label, tooltip: label + ': $' + totalValue.toFixed(2) });
    const g = totalValue - totalInvestedSoFar;
    gainSeries.push({ v: g, label: label, tooltip: label + ': ' + (g >= 0 ? '+' : '') + '$' + g.toFixed(2) });
  }
  return { valueSeries: valueSeries, gainSeries: gainSeries };
}
