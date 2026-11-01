import { motion } from 'framer-motion';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '../lib/format';

const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function Heatmap({ data, weeks = 26 }: { data: { day: string; n: number; correct: number }[]; weeks?: number }) {
  const map = new Map(data.map(d => [d.day, d]));
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() - (weeks - 1) * 7);
  const cols: { date: Date; k: string }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      if (date > today) break;
      col.push({ date, k: key(date) });
    }
    if (col.length) cols.push(col);
  }
  const max = Math.max(1, ...data.map(d => d.n));
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const COLORS = ['rgba(17,17,17,0.08)', '#C9C3B6', '#8A857B', '#444043', '#111111'];
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-[3px]">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[3px]">
            {col.map(({ date, k }) => {
              const d = map.get(k);
              const n = d?.n ?? 0;
              return (
                <motion.div
                  key={k}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: ci * 0.012 }}
                  className="h-3 w-3"
                  style={{ background: COLORS[level(n)] }}
                  title={`${date.toDateString()}: ${n} answered${d ? `, ${d.correct} correct` : ''}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-slate-400">
        Less {COLORS.map(c => <span key={c} className="h-2.5 w-2.5" style={{ background: c }} />)} More
      </div>
    </div>
  );
}

export function RadarChart({
  axes,
  size = 300,
}: {
  axes: { label: string; value: number; color?: string; sub?: string }[];
  size?: number;
}) {
  const cx0 = size / 2;
  const cy0 = size / 2;
  const R = size / 2 - 44;
  const n = axes.length;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx0 + Math.cos(a) * r, cy0 + Math.sin(a) * r] as const;
  };
  const poly = axes.map((ax, i) => pt(i, R * Math.max(0.03, Math.min(1, ax.value)))).join(' ');
  const dotsId = `radar-dots-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full max-w-[340px]">
      <defs>
        <pattern id={dotsId} width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="1.25" fill="#111111" />
        </pattern>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={axes.map((_, i) => pt(i, R * f)).join(' ')}
          fill="none"
          stroke="rgba(17,17,17,0.2)"
          strokeDasharray={f < 1 ? '3 3' : undefined}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx0} y1={cy0} x2={x} y2={y} stroke="rgba(17,17,17,0.16)" />;
      })}
      <motion.polygon
        points={poly}
        fill={`url(#${dotsId})`}
        fillOpacity={0.85}
        stroke="#111111"
        strokeWidth={2.5}
        strokeLinejoin="miter"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: `${cx0}px ${cy0}px` }}
      />
      {axes.map((ax, i) => {
        const [x, y] = pt(i, R * Math.max(0.03, Math.min(1, ax.value)));
        const [lx, ly] = pt(i, R + 22);
        return (
          <g key={ax.label}>
            <motion.rect x={x - 4} y={y - 4} width={8} height={8} fill={ax.color || '#F9F7F1'} stroke="#111111" strokeWidth={2} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + i * 0.05 }} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-slate-300 font-condensed text-[12px] font-semibold">
              {ax.label}
            </text>
            {ax.sub && (
              <text x={lx} y={ly + 13} textAnchor="middle" dominantBaseline="middle" className="fill-slate-400 text-[11px]">
                {ax.sub}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const CLOUD_COLORS = ['text-mauve', 'text-slate-400', 'text-wood-700', 'text-slate-500'];

export function WordCloud({ words, linkTo }: { words: { term: string; weight: number }[]; linkTo?: (term: string) => string }) {
  if (!words.length) return null;
  const max = Math.max(...words.map(w => w.weight));
  const min = Math.min(...words.map(w => w.weight));
  const scale = (w: number) => (max === min ? 1 : (w - min) / (max - min));
  const sorted = [...words].sort((a, b) => b.weight - a.weight);
  const arranged: typeof words = [];
  sorted.forEach((w, i) => (i % 2 ? arranged.push(w) : arranged.unshift(w)));
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      {arranged.map((w, i) => {
        const s = scale(w.weight);
        const content = (
          <motion.span
            initial={{ opacity: 0, scale: 0.5, y: 10 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.03, type: 'spring', stiffness: 200, damping: 14 }}
            whileHover={{ scale: 1.12 }}
            className={cx(
              'inline-block font-display leading-tight',
              s > 0.6 ? 'font-black' : 'font-bold',
              i % 3 === 1 && 'italic',
              CLOUD_COLORS[i % CLOUD_COLORS.length],
            )}
            style={{ fontSize: `${0.8 + s * 1.4}rem`, opacity: 0.8 + s * 0.2 }}
          >
            {w.term}
          </motion.span>
        );
        return linkTo ? (
          <Link key={w.term} to={linkTo(w.term)} className="decoration-mauve decoration-2 underline-offset-4 hover:underline">
            {content}
          </Link>
        ) : (
          <span key={w.term}>{content}</span>
        );
      })}
    </div>
  );
}

export function BarList({ rows }: { rows: { label: string; value: number; total: number; color: string }[] }) {
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-condensed font-semibold uppercase tracking-wider text-slate-300">{r.label}</span>
            <span className="font-mono text-slate-500">
              {r.total ? `${Math.round((r.value / r.total) * 100)}%` : '-'} · {r.value}/{r.total}
            </span>
          </div>
          <div className="h-3.5 overflow-hidden border-2 border-mauve bg-ink-900">
            <motion.div
              className="h-full"
              style={{ background: r.color }}
              initial={{ width: 0 }}
              whileInView={{ width: `${r.total ? (r.value / r.total) * 100 : 0}%` }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}