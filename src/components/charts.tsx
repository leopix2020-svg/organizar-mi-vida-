/* Gráficas en SVG. El texto de data-tooltip lo muestra el tooltip global (ver Tooltip.tsx). */
import { fmt, fmtCur } from '../lib/format';
import type { AppState } from '../lib/types';

export interface DonutSegment { value: number; color: string; label?: string; }

export function Donut(props: { s: AppState; segments: DonutSegment[]; r?: number; cx?: number; cy?: number; sw?: number; currency?: string | null }) {
  const { s, segments } = props;
  let total = 0; segments.forEach(seg => { total += seg.value; });
  const r = props.r || 50, cx = props.cx || 60, cy = props.cy || 60, sw = props.sw || 16;
  const vb = cx * 2;
  const circ = 2 * Math.PI * r;
  const svgProps = { viewBox: '0 0 ' + vb + ' ' + vb, width: vb, height: vb, style: { maxWidth: '100%', height: 'auto' } };
  if (total <= 0) {
    return <svg {...svgProps}><circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth={sw}></circle></svg>;
  }
  let cum = 0;
  const arcs: JSX.Element[] = [], labels: JSX.Element[] = [];
  segments.forEach((seg, i) => {
    if (seg.value <= 0) return;
    const len = (seg.value / total) * circ;
    const pctS = Math.round((seg.value / total) * 100);
    const tip = (seg.label ? seg.label + ': ' : '') + fmtCur(s, seg.value, props.currency) + ' (' + pctS + '%)';
    arcs.push(<circle key={'a' + i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={sw}
      strokeDasharray={len.toFixed(2) + ' ' + (circ - len).toFixed(2)} strokeDashoffset={(-cum).toFixed(2)}
      transform={'rotate(-90 ' + cx + ' ' + cy + ')'} pointerEvents="stroke" data-tooltip={tip}></circle>);
    if (pctS >= 6) {
      const startDeg = (cum / circ) * 360;
      const sweepDeg = (len / circ) * 360;
      const midRad = (startDeg + sweepDeg / 2) * Math.PI / 180;
      const lx = cx + r * Math.sin(midRad);
      const ly = cy - r * Math.cos(midRad);
      labels.push(<text key={'l' + i} x={lx.toFixed(1)} y={ly.toFixed(1)} fontSize={Math.max(9, Math.round(sw * 0.62))} fontWeight="700" fill="#fff"
        textAnchor="middle" dominantBaseline="central" fontFamily="Inter, sans-serif" pointerEvents="none"
        style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.4)', strokeWidth: '2.5px', strokeLinejoin: 'round' }}>{pctS}%</text>);
    }
    cum += len;
  });
  return <svg {...svgProps}>{arcs}{labels}</svg>;
}

export interface MonthGroup { label: string; values: { v: number; color: string; name?: string }[]; }

/* Varias líneas (una por serie) con picos rectos y sin relleno; un punto por grupo con su tooltip.
   format: cómo se muestra cada valor (por defecto, dinero). fitRange: el eje se ajusta a los datos en vez de arrancar en 0. */
export function MiniLinesChart(props: { s: AppState; data: MonthGroup[]; format?: (v: number) => string; fitRange?: boolean }) {
  const W = 300, H = 104, padBottom = 20, padTop = 8, dotR = 3.5;
  const format = props.format || ((v: number) => fmt(props.s, v));
  const all: number[] = [];
  props.data.forEach(d => { d.values.forEach(v => all.push(v.v)); });
  let minV = 0, maxV = 1;
  all.forEach(v => { if (v > maxV) maxV = v; });
  if (props.fitRange && all.length) {
    const lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    const pad = Math.max(1, (hi - lo) * 0.15);
    minV = lo - pad; maxV = hi + pad;
  }
  const groupW = W / props.data.length;
  const xAt = (i: number) => i * groupW + groupW / 2;
  const yAt = (v: number) => H - padBottom - ((v - minV) / (maxV - minV)) * (H - padBottom - padTop);
  const seriesCount = props.data.length ? props.data[0].values.length : 0;
  const lines: JSX.Element[] = [], dots: JSX.Element[] = [];
  for (let j = 0; j < seriesCount; j++) {
    const color = props.data[0].values[j].color;
    lines.push(<polyline key={'l' + j} points={props.data.map((d, i) => xAt(i).toFixed(1) + ',' + yAt(d.values[j].v).toFixed(1)).join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"></polyline>);
    props.data.forEach((d, i) => {
      const v = d.values[j];
      const tip = (v.name ? v.name + ' · ' : '') + d.label + ': ' + format(v.v);
      dots.push(<circle key={'d' + j + '-' + i} cx={xAt(i).toFixed(1)} cy={yAt(v.v).toFixed(1)} r={dotR} fill={v.color} stroke="var(--surface)" strokeWidth="1.2" data-tooltip={tip}></circle>);
    });
  }
  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {lines}{dots}
      {props.data.map((d, i) => <text key={'t' + i} x={xAt(i).toFixed(1)} y={H - 6} fontSize="9.5" fill="var(--text-faint)" textAnchor="middle" fontFamily="Inter, sans-serif">{d.label}</text>)}
    </svg>
  );
}

export function MiniMoneyLineChart(props: { points: { v: number; label: string; tooltip?: string }[]; color?: string }) {
  const points = props.points;
  const W = 300, H = 112, padBottom = 20, padTop = 16, padX = 10, dotR = 3.5;
  const color = props.color || 'var(--growth)';
  const values = points.map(p => p.v);
  let minV = Math.min.apply(null, values.concat([0]));
  let maxV = Math.max.apply(null, values.concat([0]));
  if (maxV === minV) { maxV = minV + 1; minV = minV - 1; }
  const n = points.length;
  const stepX = n > 1 ? (W - padX * 2) / (n - 1) : 0;
  const xAt = (i: number) => padX + i * stepX;
  const yAt = (v: number) => H - padBottom - ((v - minV) / (maxV - minV)) * (H - padBottom - padTop);
  const hasZeroLine = minV < 0 && maxV > 0;
  const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.v) }));
  const linePts = coords.map(c => c.x.toFixed(1) + ',' + c.y.toFixed(1)).join(' ');
  const baseline = hasZeroLine ? yAt(0) : (H - padBottom);
  const areaPath = 'M' + coords[0].x.toFixed(1) + ',' + baseline.toFixed(1) + ' L' + coords.map(c => c.x.toFixed(1) + ',' + c.y.toFixed(1)).join(' L') + ' L' + coords[coords.length - 1].x.toFixed(1) + ',' + baseline.toFixed(1) + ' Z';
  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {hasZeroLine && <line x1={padX} y1={yAt(0).toFixed(1)} x2={W - padX} y2={yAt(0).toFixed(1)} stroke="var(--text-faint)" strokeWidth="1" strokeDasharray="3 3"></line>}
      <path d={areaPath} fill={color} fillOpacity="0.12" stroke="none"></path>
      <polyline points={linePts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"></polyline>
      {points.map((p, i) => (
        <circle key={i} cx={coords[i].x.toFixed(1)} cy={coords[i].y.toFixed(1)} r={dotR} fill={color} stroke="var(--surface)" strokeWidth="1.2" data-tooltip={p.tooltip || (p.label + ': $' + p.v.toFixed(2))}></circle>
      ))}
      {coords.length > 0 && <>
        <text x={coords[0].x.toFixed(1)} y={H - 6} fontSize="9" fill="var(--text-faint)" textAnchor="start" fontFamily="Inter, sans-serif">{points[0].label}</text>
        <text x={coords[coords.length - 1].x.toFixed(1)} y={H - 6} fontSize="9" fill="var(--text-faint)" textAnchor="end" fontFamily="Inter, sans-serif">{points[points.length - 1].label}</text>
      </>}
    </svg>
  );
}
