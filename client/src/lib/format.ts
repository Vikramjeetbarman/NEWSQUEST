export function timeAgo(ts: number | null | undefined, now = Date.now()): string {
  if (!ts) return '-';
  const diff = Math.round((now - ts) / 1000);
  if (diff < -60) return `in ${timeAgo(now, ts).replace(' ago', '')}`;
  if (diff < 45) return 'just now';
  const m = Math.round(diff / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const numFmt = new Intl.NumberFormat('en-IN');
export const fmtNum = (n: number) => numFmt.format(n);

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}