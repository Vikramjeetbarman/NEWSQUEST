import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DIFFICULTY_STYLE, PALETTE, SECTION_STYLE } from '../lib/sections';
import { cx, fmtNum } from '../lib/format';
import type { Difficulty, SectionKey, SourceKey } from '../lib/types';

const SECTION_LABEL: Record<SectionKey, string> = {
  national: 'National',
  world: 'World',
  business: 'Business',
  scitech: 'Sci & Tech',
  environment: 'Environment',
  health: 'Health',
  sports: 'Sports',
  education: 'Education',
  opinion: 'Opinion',
  entertainment: 'Culture',
};
export const sectionLabel = (k: SectionKey) => SECTION_LABEL[k] ?? k;

export function SectionBadge({ section, className }: { section: SectionKey; className?: string }) {
  const s = SECTION_STYLE[section];
  if (!s) return null;
  const I = s.icon;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 border-2 border-mauve px-2 py-0.5 font-condensed text-[11px] font-semibold uppercase tracking-[0.14em]',
        s.tile,
        className,
      )}
    >
      <I className="h-3 w-3" />
      {sectionLabel(section)}
    </span>
  );
}

export function DifficultyBadge({ d, className }: { d: Difficulty; className?: string }) {
  const s = DIFFICULTY_STYLE[d];
  return (
    <span className={cx('border-2 px-2 py-0.5 font-condensed text-[11px] font-semibold uppercase tracking-[0.14em]', s.className, className)}>{s.label}</span>
  );
}

const SRC: Partial<Record<SourceKey, { label: string; credit: string | null; className: string }>> = {
  pib: { label: 'PIB', credit: 'Press Information Bureau (PIB), Government of India', className: 'font-display text-xs font-bold italic text-mauve bg-sage border-mauve' },
  toi: { label: 'Times of India', credit: 'The Times of India', className: 'font-display text-xs font-bold italic text-mauve bg-bronze border-mauve' },
  hindu: { label: 'The Hindu', credit: 'The Hindu', className: 'font-display text-xs font-bold italic text-peach bg-wood border-mauve' },
  archive: { label: 'Demo Archive', credit: null, className: 'font-mono text-[11px] font-bold uppercase tracking-wider text-mauve bg-bronze border-mauve' },
};
export const sourceCredit = (source: SourceKey) => (SRC[source] ?? SRC.archive!).credit;
export function SourceBadge({ source }: { source: SourceKey }) {
  const s = SRC[source] ?? SRC.archive!;
  return <span className={cx('border-2 px-2 py-px leading-tight', s.className)}>{s.label}</span>;
}

export function AnimatedNumber({ value, className, duration = 1.1 }: { value: number; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => fmtNum(Math.round(v)));
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [inView, value, mv, duration]);
  return <motion.span ref={ref} className={className}>{text}</motion.span>;
}

export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  color = PALETTE.mauve,
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cx('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(17,17,17,0.12)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="butt"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function XPBar({ progress, className }: { progress: number; className?: string }) {
  return (
    <div className={cx('relative h-3 overflow-hidden border-2 border-mauve bg-ink-900', className)}>
      <motion.div
        className="absolute inset-y-0 left-0 bg-mauve"
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(2, progress * 100)}%` }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('animate-spin', className ?? 'h-5 w-5')} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} />;
}

export function Typewriter({ text, className, speed = 38, delay = 0 }: { text: string; className?: string; speed?: number; delay?: number }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? text.length : 0);
  useEffect(() => {
    if (reduced) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    let t = 0;
    const tick = () => {
      i += 1;
      setN(i);
      if (i < text.length) t = window.setTimeout(tick, speed);
    };
    t = window.setTimeout(tick, delay);
    return () => window.clearTimeout(t);
  }, [text, speed, delay, reduced]);
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>{text.slice(0, n)}</span>
      <span aria-hidden className="ml-0.5 inline-block h-[1em] w-[0.5ch] translate-y-[0.12em] animate-blink bg-current" />
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center border-2 border-mauve bg-mauve text-peach shadow-hollow">{icon}</div>
      <h3 className="font-display text-2xl font-black text-white">{title}</h3>
      <div className="max-w-md text-slate-400">{children}</div>
    </motion.div>
  );
}

export function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] grid place-items-center bg-mauve/75 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cx('relative w-full overflow-hidden border-2 border-mauve bg-ink-950 p-6 shadow-hollow-lg', wide ? 'max-w-2xl' : 'max-w-md')}
            initial={{ opacity: 0, scale: 0.85, y: 30, rotate: -3 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20, rotate: 2 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute right-3 top-3 border-2 border-transparent p-1.5 text-slate-400 hover:border-mauve hover:bg-mauve hover:text-peach" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mb-10"
    >
      {eyebrow && (
        <div className="mb-4 flex items-center gap-3">
          <span className="bg-mauve px-2 py-0.5 font-condensed text-[11px] font-semibold uppercase tracking-[0.24em] text-peach">{eyebrow}</span>
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="h-px flex-1 origin-left bg-mauve"
          />
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-black leading-[1.05] text-white sm:text-6xl">{title}</h1>
          {children && <div className="mt-3 max-w-2xl text-lg italic text-slate-400">{children}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mt-6 origin-left"
      >
        <div className="border-t-[3px] border-mauve" />
        <div className="mt-[3px] border-t border-mauve" />
      </motion.div>
    </motion.header>
  );
}