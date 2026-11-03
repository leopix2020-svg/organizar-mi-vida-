/* Bolsa: foto diaria real del valor y la ganancia, gráficas con altos y bajos, y compatibilidad. */
import { render } from '@testing-library/react';
import oldState from './fixtures/old-state.json';
import { refreshQuotesIfNeeded } from '../src/api/client';
import { BolsaSection } from '../src/components/BolsaSection';
import { todayStr } from '../src/lib/format';
import { defaultState, normalizeState } from '../src/lib/state';
import * as S from '../src/lib/stocks';
import { getStore, resetUi, setStore, setUi } from '../src/store';

function base() {
  const s = defaultState();
  s.bolsaPositions = [
    { id: 'a', ticker: 'AAPL', amountInvested: 100, purchasePrice: 10, shares: 10, purchaseDate: '2026-10-01' },
    { id: 'b', ticker: 'MSFT', amountInvested: 50, purchasePrice: 25, shares: 2, purchaseDate: '2026-10-15' }
  ];
  return s;
}
const q = (price: number) => ({ price, fetchedAt: Date.now() });

describe('foto diaria de la bolsa', () => {
  it('solo hay foto si todas las acciones tienen precio', () => {
    const s = base();
    expect(S.bolsaSnapshot(s, { AAPL: q(12) })).toBeNull();
    expect(S.bolsaSnapshot(s, { AAPL: q(12), MSFT: { error: true, fetchedAt: 1 } })).toBeNull();
    expect(S.bolsaSnapshot(s, { AAPL: q(12.345), MSFT: q(20) })).toEqual({ value: 163.45, invested: 150 });
    expect(S.bolsaSnapshot(defaultState(), {})).toBeNull();
  });
  it('una sola foto por día: la nueva reemplaza la de esa fecha', () => {
    const s = base();
    S.upsertBolsaSnapshot(s, '2026-11-01', { value: 160, invested: 150 });
    S.upsertBolsaSnapshot(s, '2026-11-02', { value: 140, invested: 150 });
    S.upsertBolsaSnapshot(s, '2026-11-01', { value: 165, invested: 150 });
    expect(s.bolsaHistory.slice().sort((a, b) => a.date.localeCompare(b.date))).toEqual([
      { date: '2026-11-01', value: 165, invested: 150 }, { date: '2026-11-02', value: 140, invested: 150 }]);
  });
  it('las series siguen los altos y bajos reales, ordenadas por fecha', () => {
    const s = base();
    s.bolsaHistory = [
      { date: '2026-11-03', value: 170, invested: 150 },
      { date: '2026-11-01', value: 160, invested: 150 },
      { date: '2026-11-02', value: 140, invested: 150 }
    ];
    const g = S.bolsaHistorySeries(s);
    expect(g.valueSeries.map(p => p.v)).toEqual([160, 140, 170]);
    expect(g.gainSeries.map(p => p.v)).toEqual([10, -10, 20]);
    expect(g.gainSeries[1].tooltip).toContain('−$10.00');
  });
  it('al cargar precios guarda la foto de hoy, y no vuelve a guardar si no cambió', async () => {
    resetUi();
    setStore({ state: base() });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ quotes: { AAPL: { price: 12 }, MSFT: { price: 20 } } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await refreshQuotesIfNeeded();
    expect(getStore().state!.bolsaHistory).toEqual([{ date: todayStr(), value: 160, invested: 150 }]);
    const before = getStore().state;
    await refreshQuotesIfNeeded();
    expect(getStore().state).toBe(before);
    /* Si se quita una acción, la foto de hoy se actualiza sin pedir precios de nuevo. */
    setStore({ state: Object.assign({}, before!, { bolsaPositions: before!.bolsaPositions.slice(0, 1) }) });
    await refreshQuotesIfNeeded();
    expect(getStore().state!.bolsaHistory).toEqual([{ date: todayStr(), value: 120, invested: 100 }]);
    expect(fetchMock.mock.calls.filter(c => String((c as unknown[])[0]).startsWith('/api/quote')).length).toBe(1);
    vi.unstubAllGlobals();
  });
});

describe('pantalla de bolsa', () => {
  it('con menos de dos días avisa que el historial empieza; con más dibuja valor y ganancia reales', () => {
    resetUi();
    setUi({ quotesCache: { AAPL: q(12), MSFT: q(20) } });
    const s = base();
    s.bolsaHistory = [{ date: todayStr(), value: 160, invested: 150 }];
    let r = render(<BolsaSection s={s} ui={getStore().ui} />);
    expect(r.container.textContent).toContain('Tu historial empieza hoy: vuelve mañana para ver tu progreso.');
    expect(r.container.textContent).not.toContain('estimado');
    r.unmount();
    s.bolsaHistory = [{ date: '2026-11-01', value: 160, invested: 150 }, { date: '2026-11-02', value: 140, invested: 150 }, { date: '2026-11-03', value: 155, invested: 150 }];
    r = render(<BolsaSection s={s} ui={getStore().ui} />);
    const lines = [...r.container.querySelectorAll('polyline')];
    expect(lines.length).toBe(2);
    const ys = (l: Element) => l.getAttribute('points')!.split(' ').map(p => Number(p.split(',')[1]));
    const [vy, gy] = lines.map(ys);
    expect(vy[1]).toBeGreaterThan(vy[0]); expect(vy[2]).toBeLessThan(vy[1]);  /* baja y sube (y del SVG crece hacia abajo) */
    expect(gy[1]).toBeGreaterThan(gy[0]); expect(gy[2]).toBeLessThan(gy[1]);
    expect(lines[1].getAttribute('stroke')).toBe('var(--growth)');
    r.unmount();
  });
  it('un estado viejo arranca con historial vacío y normalizar lo conserva', () => {
    expect(normalizeState(JSON.parse(JSON.stringify(oldState))).bolsaHistory).toEqual([]);
    const s = base(); s.bolsaHistory = [{ date: '2026-11-01', value: 160, invested: 150 }];
    expect(normalizeState(JSON.parse(JSON.stringify(s))).bolsaHistory).toEqual(s.bolsaHistory);
  });
});
