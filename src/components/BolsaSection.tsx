/* Sección Bolsa del riel: acciones reales con precios de verdad. */
import { useEffect } from 'react';
import { refreshQuotesIfNeeded } from '../api/client';
import { bolsaDistribution, bolsaHistorySeries, bolsaPositionCurrentValue } from '../lib/stocks';
import type { AppState } from '../lib/types';
import { commit, openModal, showToast, type Ui } from '../store';
import { Donut, MiniMoneyLineChart } from './charts';

const DIST_COLORS = ['#4C7A5D', '#5B7B92', '#C08A28', '#A8452C', '#7C5295', '#8A6D3B', '#B0424F', '#6B7280'];

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

  /* Distribución: cuánto de tu dinero está en cada acción, según su valor actual. */
  let distribution = null;
  if (positions.length > 0) {
    const dist = bolsaDistribution(s, quotes);
    distribution = <>
      <div className="section-title" style={{ marginTop: 18 }}>Distribución</div>
      <div className="card">{!dist ? <div className="empty-state" style={{ padding: '10px 0' }}>Esperando precios…</div> :
        <div className="donut-wrap">
          <Donut s={s} currency="USD" segments={dist.map((d, i) => ({ value: d.value, color: DIST_COLORS[i % DIST_COLORS.length], label: d.ticker }))} />
          <div className="donut-legend">{dist.map((d, i) => (
            <div className="donut-legend-row" key={d.ticker}>
              <span className="dot" style={{ background: DIST_COLORS[i % DIST_COLORS.length] }}></span><span className="lbl">{d.ticker}</span>
              <span className="amt">${d.value.toFixed(2)}</span><span className="pct">{Math.round(d.pct * 100)}%</span>
            </div>))}</div>
        </div>}</div>
    </>;
  }

  /* Gráficas con las fotos diarias reales: valor total y ganancia (valor − invertido) de cada día guardado. */
  let charts = null;
  if (positions.length > 0) {
    const growth = bolsaHistorySeries(s);
    const n = growth.valueSeries.length;
    const lastGain = n ? growth.gainSeries[n - 1].v : 0;
    charts = <>
      <div className="section-title" style={{ marginTop: 18 }}>Crecimiento</div>
      {n < 2 ? <div className="card"><div className="empty-state" style={{ padding: '10px 0' }}>Tu historial empieza {n === 1 ? 'hoy' : 'cuando carguen los precios'}: vuelve mañana para ver tu progreso.</div></div> : <>
        <div className="bolsa-charts-grid">
          <div className="card"><div className="item-sub" style={{ marginBottom: 6 }}>Valor total</div><MiniMoneyLineChart points={growth.valueSeries} color="var(--growth)" /></div>
          <div className="card"><div className="item-sub" style={{ marginBottom: 6 }}>Ganancia o pérdida (sin contar lo invertido)</div><MiniMoneyLineChart points={growth.gainSeries} color={lastGain >= 0 ? 'var(--growth)' : 'var(--spend)'} /></div>
        </div>
        <div className="chart-desc" style={{ marginTop: 8 }}>Cada punto es un día que abriste la app: se guarda el valor real de ese día.</div>
      </>}
    </>;
  }

  return <>
    <div className="section-title">Bolsa</div>
    <div className="chart-desc" style={{ marginBottom: 14 }}>Aquí registras en qué acciones invertiste de verdad — la app busca el precio actual y calcula cuánto llevas ganado o perdido. Esto no tiene nada que ver con la Bolsa de Finanzas.</div>
    <div className="section-title">Tus acciones <button className="btn-small" onClick={() => openModal({ type: 'bolsaPosition' })}>+ Agregar</button></div>
    {totalLine}{rows}{distribution}{charts}
  </>;
}
