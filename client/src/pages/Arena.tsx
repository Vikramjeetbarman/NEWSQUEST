import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bookmark,
  CalendarClock,
  CheckCircle2,
  Coins,
  Crosshair,
  Divide,
  Heart,
  Infinity as InfinityIcon,
  Play,
  SkipForward,
  Swords,
  Timer,
  TimerReset,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader, Skeleton, Spinner, sectionLabel } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { cx } from '../lib/format';
import { DIFFICULTY_STYLE, PALETTE, SECTION_ORDER, SECTION_STYLE } from '../lib/sections';
import type { Catalog, Difficulty, ModeKey, SectionKey } from '../lib/types';
import { useStartQuiz } from '../lib/useStartQuiz';

const MODE_UI: Partial<Record<ModeKey, { icon: LucideIcon; tile: string; perks: string[] }>> = {
  classic: { icon: Crosshair, tile: 'bg-bronze text-mauve', perks: ['30s per question', 'Your sections & difficulty', '30 questions'] },
  blitz: { icon: Zap, tile: 'bg-peach text-mauve', perks: ['90 seconds on the clock', 'As many as you can', 'Speed bonus XP'] },
  survival: { icon: Heart, tile: 'bg-wood text-peach', perks: ['3 lives', '20s per question', '1.2x XP'] },
};

function useCountdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const mid = new Date(now);
  mid.setHours(24, 0, 0, 0);
  const s = Math.max(0, Math.floor((mid.getTime() - now) / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function Toggle({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: ReactNode; color?: string }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cx(
        'flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition',
        active ? 'border-mauve bg-mauve text-peach shadow-hard-sm' : 'border-mauve/30 bg-ink-900 text-slate-300 hover:border-mauve hover:text-white',
      )}
    >
      {active ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-bronze" />
      ) : (
        color && <span className="h-2.5 w-2.5 rounded-full border-2 border-mauve" style={{ background: color }} />
      )}
      {children}
    </motion.button>
  );
}

export function ArenaPage() {
  const [sp] = useSearchParams();
  const { user } = useAuth();
  const { start, starting } = useStartQuiz();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [mode, setMode] = useState<'classic' | 'blitz' | 'survival'>('classic');
  const [sections, setSections] = useState<SectionKey[]>(() => {
    const s = sp.get('section');
    return s && (SECTION_ORDER as string[]).includes(s) ? [s as SectionKey] : [];
  });
  const [diffs, setDiffs] = useState<Difficulty[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const countdown = useCountdown();
  const highlightDaily = sp.get('mode') === 'daily';

  useEffect(() => {
    api.catalog().then(setCatalog).catch(() => {});
  }, [user?.id]);

  const toggle = <T,>(list: T[], v: T, set: (l: T[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const pool = useMemo(() => {
    if (!catalog) return 0;
    if (!sections.length) return catalog.total;
    return sections.reduce((s, k) => s + (catalog.bySection[k] ?? 0), 0);
  }, [catalog, sections]);

  const daily = catalog?.daily;

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Game modes" title={<>The <span className="text-accent">Arena</span></>}>
        Every question comes from today's news. Answer fast, build combos, and climb the ranks.
      </PageHeader>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, scale: highlightDaily ? [1, 1.015, 1] : 1 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl border-2 border-mauve bg-mauve p-8 shadow-hard-bronze"
      >
        <motion.div
          className="absolute -right-10 -top-10 h-64 w-64 rounded-full border-[18px] border-dashed border-bronze/25"
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <motion.div
            animate={{ rotate: [0, -6, 6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2 }}
            className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl border-2 border-peach bg-bronze"
          >
            <CalendarClock className="h-10 w-10 text-mauve" />
          </motion.div>
          <div className="flex-1">
            <div className="label !text-bronze">Daily Challenge · {daily?.day ?? '—'}</div>
            <h2 className="mt-1 font-display text-3xl font-black text-peach sm:text-4xl">
              {daily?.done ? `Completed — ${daily.result?.correct}/${daily.result?.total}` : 'Ten questions. One shot. 1.5x XP.'}
            </h2>
            <p className="mt-1 text-sage">
              Everyone gets the same set, ramping from easy to expert. {daily?.done ? 'A new challenge unlocks in' : 'Resets in'} <span className="rounded-md bg-peach px-1.5 font-mono font-bold text-mauve">{countdown}</span>
            </p>
          </div>
          <button
            onClick={() => start({ mode: 'daily' })}
            disabled={starting || daily?.done || !catalog?.total}
            className="btn-cta-invert !px-8 !py-4"
          >
            {starting ? <Spinner /> : <Play className="h-5 w-5 fill-current" />}
            {daily?.done ? 'Done for today' : daily?.inProgress ? 'Resume' : 'Start challenge'}
            {!daily?.done && <ArrowRight className="cta-arrow h-5 w-5" />}
          </button>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <h2 className="mb-4 font-display text-xl font-extrabold text-white">Build your match</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(MODE_UI) as ('classic' | 'blitz' | 'survival')[]).map((k) => {
              const ui = MODE_UI[k]!;
              const info = catalog?.modes[k];
              const active = mode === k;
              return (
                <motion.button
                  key={k}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setMode(k)}
                  className={cx(
                    'relative overflow-hidden rounded-2xl border-2 border-mauve bg-ink-900 p-4 text-left transition-shadow',
                    active ? 'shadow-hard' : 'hover:shadow-hard-sm',
                  )}
                >
                  {active && <motion.div layoutId="mode-glow" className="absolute inset-0 bg-bronze" />}
                  <div className={cx('relative mb-3 grid h-10 w-10 place-items-center rounded-xl border-2 border-mauve', ui.tile)}>
                    <ui.icon className="h-5 w-5" />
                  </div>
                  <div className="relative font-display font-extrabold text-white">{info?.label ?? k}</div>
                  <ul className="relative mt-1 space-y-0.5 text-[11px] font-medium text-slate-200">
                    {ui.perks.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <div className="label mb-2">Sections {sections.length ? `(${sections.length})` : '(all)'}</div>
              <div className="flex flex-wrap gap-2">
                {SECTION_ORDER.map((k) => (
                  <Toggle key={k} active={sections.includes(k)} onClick={() => toggle(sections, k, setSections)} color={SECTION_STYLE[k].color}>
                    {sectionLabel(k)}
                    <span className="font-mono font-normal opacity-75">{catalog?.bySection[k] ?? 0}</span>
                  </Toggle>
                ))}
              </div>
            </div>
            <div>
              <div className="label mb-2">Difficulty {diffs.length ? '' : '(mixed)'}</div>
              <div className="flex flex-wrap gap-2">
                {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map((d) => (
                  <Toggle key={d} active={diffs.includes(d)} onClick={() => toggle(diffs, d, setDiffs)} color={DIFFICULTY_STYLE[d].color}>
                    {DIFFICULTY_STYLE[d].label}
                    <span className="font-mono font-normal opacity-75">{catalog?.byDifficulty[d] ?? 0}</span>
                  </Toggle>
                ))}
              </div>
            </div>
            <div>
              <div className="label mb-2">Question types {types.length ? `(${types.length})` : '(all)'}</div>
              <div className="flex flex-wrap gap-2">
                {catalog ? (
                  Object.entries(catalog.types).map(([k, label]) => (
                    <Toggle key={k} active={types.includes(k)} onClick={() => toggle(types, k, setTypes)} color={PALETTE.bronze}>
                      {label}
                      <span className="font-mono font-normal opacity-75">{catalog.byType[k] ?? 0}</span>
                    </Toggle>
                  ))
                ) : (
                  <Skeleton className="h-8 w-full" />
                )}
              </div>
            </div>
            {mode === 'classic' && (
              <div>
                <div className="label mb-2 flex justify-between">
                  <span>Questions</span>
                  <span className="text-white">{count}</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={30}
                  step={5}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full accent-mauve"
                />
              </div>
            )}
          </div>

          <div className="sticky bottom-0 z-20 -mx-6 -mb-6 mt-6 flex flex-wrap items-center gap-3 border-t-2 border-mauve bg-sage px-6 py-4">
            <span className="text-sm text-slate-400">
              Pool: <b className="font-display text-lg text-white">{pool}</b> questions{diffs.length || types.length ? ' before difficulty/type filters' : ''}
            </span>
            <button
              onClick={() =>
                start({
                  mode,
                  sections: sections.length ? sections : undefined,
                  difficulties: diffs.length ? diffs : undefined,
                  types: types.length ? types : undefined,
                  count: mode === 'classic' ? count : undefined,
                })
              }
              disabled={starting || !pool}
              className="btn-cta ml-auto"
            >
              {starting ? <Spinner className="h-5 w-5" /> : <Swords className="h-5 w-5" />} Start {catalog?.modes[mode]?.label ?? mode}
            </button>
          </div>
        </motion.div>

        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-6">
            <Link to="/vault" className="card-hover group relative flex items-center gap-4 overflow-hidden p-6">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-2 border-mauve bg-bronze transition-transform group-hover:-rotate-6">
                <Bookmark className="h-6 w-6 text-mauve" />
              </div>
              <div>
                <div className="font-display text-lg font-bold text-white">Vault Practice</div>
                <p className="text-sm text-slate-400">Revise saved questions untimed. Get one right 3 times to master it.</p>
              </div>
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
            <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white">
              <Coins className="h-5 w-5 text-amber-300" /> Power-ups
            </h3>
            <div className="space-y-3">
              {[
                { icon: Divide, k: 'fifty' as const, text: 'Remove two wrong options' },
                { icon: TimerReset, k: 'time' as const, text: 'Add 15 seconds to the clock' },
                { icon: SkipForward, k: 'skip' as const, text: 'Skip without losing a life or combo' },
              ].map((p) => (
                <div key={p.k} className="flex items-center gap-3 rounded-xl border-2 border-mauve bg-ink-900 p-3">
                  <p.icon className="h-5 w-5 text-violet-300" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{catalog?.powerups[p.k].label ?? p.k}</div>
                    <div className="text-xs text-slate-500">{p.text}</div>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-semibold text-amber-300">
                    <Coins className="h-3.5 w-3.5" /> {catalog?.powerups[p.k].cost ?? '8'}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card p-6">
            <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-white">
              <Timer className="h-5 w-5 text-sky-300" /> Scoring
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                Base XP: <b className="text-emerald-300">10</b> easy · <b className="text-sky-300">15</b> medium · <b className="text-amber-300">25</b> hard · <b className="text-rose-300">40</b> expert
              </li>
              <li>Combo multiplier: +10% per streak answer (up to 2x)</li>
              <li>Speed bonus: +5 XP under 5s, +2 XP under 10s</li>
              <li>Coins: 🪙2 per correct answer, +5 per quiz, +10 for a perfect run</li>
              <li className="flex items-center gap-1">
                <InfinityIcon className="h-4 w-4" /> Fresh questions arrive with every news cycle
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
}