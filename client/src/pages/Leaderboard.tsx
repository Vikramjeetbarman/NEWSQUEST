import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Flame, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, PageHeader, Skeleton } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { cx, fmtNum } from '../lib/format';
import type { LeaderMe, LeaderRow } from '../lib/types';

const PODIUM = [
  { place: 2, h: 'min-h-[7rem]', fill: 'bg-sage text-mauve', delay: 0.15 },
  { place: 1, h: 'min-h-[10rem]', fill: 'bg-bronze text-mauve', delay: 0 },
  { place: 3, h: 'min-h-[5rem]', fill: 'bg-wood text-peach', delay: 0.3 },
];

export function LeaderboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'week' | 'all'>('week');
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [me, setMe] = useState<LeaderMe | null>(null);
  const [players, setPlayers] = useState(0);

  useEffect(() => {
    let alive = true;
    setRows(null);
    api.leaderboard(period).then(
      (r) => {
        if (!alive) return;
        setRows(r.items);
        setMe(r.me);
        setPlayers(r.players);
      },
      () => alive && setRows([]),
    );
    return () => {
      alive = false;
    };
  }, [period, user?.id]);

  const top = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];
  const unit = period === 'week' ? 'XP this week' : 'XP';

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Hall of fame"
        title={
          <>
            <span className="text-accent">Leaderboard</span>
          </>
        }
        actions={
          <div className="relative grid grid-cols-2 rounded-xl border-2 border-mauve bg-sage p-1 text-sm shadow-hard-sm">
            {(['week', 'all'] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className={cx('relative z-10 rounded-lg px-4 py-1.5 font-bold transition-colors', period === p ? 'text-peach' : 'text-slate-300')}>
                {period === p && <motion.span layoutId="lb-tab" className="absolute inset-0 -z-10 rounded-lg bg-mauve" />}
                {p === 'week' ? 'This week' : 'All time'}
              </button>
            ))}
          </div>
        }
      >
        Ranked by XP earned from quizzes, dailies and achievements. Only registered players appear on the board.
      </PageHeader>

      {me && rows && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card mx-auto flex max-w-3xl flex-wrap items-center gap-4 px-5 py-4">
          <span className="text-4xl">{user?.avatar}</span>
          <div className="min-w-0 flex-1">
            <div className="label">{me.isGuest ? 'Where you would place' : 'Your standing'}</div>
            <div className="font-display text-2xl font-black text-white">
              {me.rank ? (
                <>
                  #{me.rank} <span className="text-base font-semibold text-slate-400">of {me.isGuest ? players + 1 : players}</span>
                </>
              ) : (
                'Not ranked yet'
              )}
            </div>
            <div className="text-xs text-slate-500">
              {me.rank ? `${fmtNum(me.score)} ${unit}` : `Answer a question${period === 'week' ? ' this week' : ''} to get ranked.`}
              {me.isGuest && ' · Guests are not listed: create an account to join the board. Your progress carries over.'}
            </div>
          </div>
          {me.isGuest ? (
            <Link to="/login?mode=register" className="btn-primary shrink-0 !py-2">
              Join the leaderboard
            </Link>
          ) : (
            !me.rank && (
              <Link to="/arena" className="btn-primary shrink-0 !py-2">
                Play a quiz
              </Link>
            )
          )}
        </motion.div>
      )}

      {!rows ? (
        <Skeleton className="h-72 w-full rounded-3xl" />
      ) : !rows.length ? (
        <EmptyState icon={<Trophy className="h-6 w-6" />} title="No scores yet">
          Be the first on the board –{' '}
          <Link to="/arena" className="text-violet-300 hover:underline">
            play a quiz
          </Link>
        </EmptyState>
      ) : (
        <div>
          <div className="mx-auto flex max-w-2xl items-end justify-center gap-4">
            {PODIUM.map((pod) => {
              const r = top[pod.place - 1];
              if (!r) return <div key={pod.place} className="flex-1" />;
              return (
                <motion.div
                  key={`${period}-${pod.place}`}
                  initial={{ opacity: 0, y: 60 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: pod.delay, type: 'spring', stiffness: 120, damping: 14 }}
                  className="flex flex-1 flex-col items-center"
                >
                  {pod.place === 1 && (
                    <motion.div animate={{ y: [0, -6, 0], rotate: [-6, 6, -6] }} transition={{ duration: 3, repeat: Infinity }}>
                      <Crown className="mb-1 h-9 w-9 fill-bronze text-mauve" />
                    </motion.div>
                  )}
                  <div className={cx('rounded-full border-2 border-mauve p-[3px]', pod.fill, r.isYou && 'ring-4 ring-mauve ring-offset-2 ring-offset-ink-950')}>
                    <div className={cx('grid place-items-center rounded-full border-2 border-mauve bg-ink-900', pod.place === 1 ? 'h-20 w-20 text-5xl' : 'h-16 w-16 text-4xl')}>{r.avatar}</div>
                  </div>
                  <div className="mt-2 max-w-full truncate text-center text-sm font-bold text-white">
                    {r.displayName}
                    {r.isYou && <span className="ml-1 text-violet-300">(you)</span>}
                  </div>
                  <div className="text-xs text-slate-400">
                    Lv {r.level} · {r.title}
                  </div>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    transition={{ delay: pod.delay + 0.2, duration: 0.6 }}
                    className={cx('mt-3 flex w-full flex-col items-center justify-start overflow-hidden rounded-t-2xl border-2 border-b-0 border-mauve pt-3', pod.fill, pod.h)}
                  >
                    <span className="font-display text-4xl font-black">{pod.place}</span>
                    <span className="text-xs font-bold">{fmtNum(r.score)}</span>
                    <span className="text-[11px] font-semibold">{unit}</span>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>

          {rest.length > 0 && (
            <div className="card mx-auto max-w-3xl divide-y-2 divide-mauve/15 overflow-hidden">
              <AnimatePresence>
                {rest.map((r, i) => (
                  <motion.div
                    key={`${period}-${r.rank}-${r.displayName}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.03 }}
                    className={cx('flex items-center gap-4 px-5 py-3', r.isYou && 'bg-bronze')}
                  >
                    <span className="w-8 text-center font-display font-black text-slate-500">{r.rank}</span>
                    <span className="text-2xl">{r.avatar}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">
                        {r.displayName}
                        {r.isYou && <span className="ml-1 text-violet-300">(you)</span>}
                      </div>
                      <div className="text-xs text-slate-500">
                        Lv {r.level} · {r.title}
                      </div>
                    </div>
                    {r.streak > 0 && (
                      <span className="flex items-center gap-1 text-xs text-orange-300">
                        <Flame className="h-3.5 w-3.5" />
                        {r.streak}
                      </span>
                    )}
                    <span className="w-24 text-right font-display font-semibold text-white">{fmtNum(r.score)}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  );
}