/* Sección Bolsa del riel: acciones reales con precios de verdad. */
import { useEffect } from 'react';
import { refreshQuotesIfNeeded } from '../api/client';
import { bolsaGrowthSeries, bolsaPositionCurrentValue } from '../lib/stocks';
import type { AppState } from '../lib/types';
import { commit, openModal, showToast, type Ui } from '../store';
import { MiniMoneyLineChart } from './charts';

async function deletePosition(id: string) {
  await commit(s => { s.bolsaPositions = s.bolsaPositions.filter(p => p.id !== id); });
  showToast('Acción eliminada.');
}

export function BolsaSection({ s, ui }: { s: AppState; ui: Ui }) {
  /* Precios: al entrar a la sección o al cambiar las acciones, no en cada redibujo. */
  const tickersKey = s.bolsaPositions.map(p => p.ticker).join(',');
  useEffect(() => { void refreshQuotesIfNeeded(); }, [tickersKey]);
  const quotes = ui.quotesCache;
  const positions = s.bolsaPositions || [];
  const totalInvested = positions.reduce((a, p) => a + p.amountInvested, 0);
  let totalCurrent = 0, allLoaded = true;
  positions.forEach(p => { const v = bolsaPositionCurrentValue(p, quotes); if (v === null) allLoaded = false; else totalCurrent += v; });

  let totalLine = null;
  if (positions.length > 0 && allLoaded) {
    const totalGain = totalCurrent - totalInvested;
    const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
    const gc2 = totalGain >= 0 ? 'var(--growth)' : 'var(--spend)';
    totalLine = (
      <div className="card balance-card" style={{ marginBottom: 12 }}><div className="balance-sub" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0, flexWrap: 'wrap' }}>
        <div>Invertido<strong>${totalInvested.toFixed(2)}</strong></div>
        <div>Valor actual<strong>${totalCurrent.toFixed(2)}</strong></div>
        <div>Ganancia/pérdida<strong style={{ color: gc2 }}>{(totalGain >= 0 ? '+' : '') + '$' + totalGain.toFixed(2) + ' (' + (totalGainPct >= 0 ? '+' : '') + totalGainPct.toFixed(1) + '%)'}</strong></div>
      </div></div>
    );
  }

  const rows = positions.length === 0 ? <div className="empty-state" style={{ padding: '10px 0' }}>Aún no agregaste ninguna acción.</div> :
    positions.map(p => {
      const currentValue = bolsaPositionCurrentValue(p, quotes);
      const q = quotes[p.ticker];
      const loading = !q;
      const errored = !!q && 'error' in q;
      let right;
      if (loading) right = <div className="item-sub">Cargando…</div>;
      else if (errored || currentValue === null) right = <div className="item-sub" style={{ color: 'var(--spend)' }}>Sin precio</div>;
      else {
        const gain = currentValue - p.amountInvested;
        const gainPct = p.amountInvested > 0 ? (gain / p.amountInvested) * 100 : 0;
        const gc = gain >= 0 ? 'var(--growth)' : 'var(--spend)';
        right = <><div className="item-pct" style={{ color: gc }}>{(gain >= 0 ? '+' : '') + '$' + gain.toFixed(2)}</div><div className="item-sub" style={{ color: gc }}>{(gainPct >= 0 ? '+' : '') + gainPct.toFixed(1) + '%'}</div></>;
      }
      return (
        <div className="item-card" style={{ marginBottom: 10 }} key={p.id}>
          <div className="item-top">
            <div><div className="item-name">{p.ticker}</div><div className="item-sub">{(loading || errored || currentValue === null) ? ('$' + p.amountInvested.toFixed(2) + ' invertidos') : ('$' + currentValue.toFixed(2) + ' · invertiste $' + p.amountInvested.toFixed(2))}</div></div>
            <div style={{ textAlign: 'right' }}>{right}</div>
          </div>
          <div className="item-bottom"><div className="item-sub">Compraste a ${p.purchasePrice.toFixed(2)}/acción</div>
            <div className="item-actions"><button className="btn-small danger" onClick={() => deletePosition(p.id)}>Quitar</button></div>
          </div>
        </div>
      );
    });

  const growth = bolsaGrowthSeries(s, quotes);
  let charts = null;
  if (growth) {
    const lastGain = growth.gainSeries[growth.gainSeries.length - 1].v;
    charts = <>
      <div className="section-title" style={{ marginTop: 18 }}>Crecimiento</div>
      <div className="bolsa-charts-grid">
        <div className="card"><div className="item-sub" style={{ marginBottom: 6 }}>Valor total</div><MiniMoneyLineChart points={growth.valueSeries} color="var(--growth)" /></div>
        <div className="card"><div className="item-sub" style={{ marginBottom: 6 }}>Ganancia o pérdida (sin contar lo invertido)</div><MiniMoneyLineChart points={growth.gainSeries} color={lastGain >= 0 ? 'var(--growth)' : 'var(--spend)'} /></div>
      </div>
      <div className="chart-desc" style={{ marginTop: 8 }}>Como no guardamos el precio de cada día, la línea entre la fecha en que compraste y hoy es un estimado — se va afinando con el tiempo.</div>
    </>;
  }

  return <>
    <div className="section-title">Bolsa</div>
    <div className="chart-desc" style={{ marginBottom: 14 }}>Aquí registras en qué acciones invertiste de verdad — la app busca el precio actual y calcula cuánto llevas ganado o perdido. Esto no tiene nada que ver con la Bolsa de Finanzas.</div>
    <div className="section-title">Tus acciones <button className="btn-small" onClick={() => openModal({ type: 'bolsaPosition' })}>+ Agregar</button></div>
    {totalLine}{rows}{charts}
  </>;
}
