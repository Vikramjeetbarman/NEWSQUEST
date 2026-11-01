import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  Clock as ClockIcon,
  Coins,
  Divide,
  ExternalLink,
  Flame,
  Heart,
  Home,
  Lightbulb,
  RotateCcw,
  SkipForward,
  Sparkles,
  Star,
  Target,
  TimerReset,
  Trophy,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AchievementCard } from '../components/AchievementBadge';
import { QuestionBody, QuestionOptions as Options } from '../components/QuestionView';
import {
  DifficultyBadge,
  EmptyState,
  Modal,
  ProgressRing,
  SectionBadge,
  Spinner,
  sourceCredit,
  XPBar,
} from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useToast } from '../contexts/ToastContext';
import { api, ApiError } from '../lib/api';
import { burst, celebrate } from '../lib/celebrate';
import { cx, fmtDuration, LETTERS, pct } from '../lib/format';
import { PALETTE } from '../lib/sections';
import { sfx } from '../lib/sound';
import type {
  AnswerResult,
  LevelInfo,
  PowerupKey,
  QuizSummary,
  QuizView,
  RevealedQuestion,
} from '../lib/types';

function useSaver() {
  const { toast, achievements } = useToast();
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const save = useCallback(
    async (qid: string) => {
      if (saved.has(qid)) return;
      setBusy(qid);
      try {
        const r = await api.save(qid);
        setSaved((s) => new Set(s).add(qid));
        toast('Saved to your Vault for revision.', 'success');
        achievements(r.achievements);
      } catch (e) {
        toast((e as Error).message, 'error');
      } finally {
        setBusy(null);
      }
    },
    [saved, toast, achievements],
  );
  return { saved, busy, save };
}

const safeLink = (u: string | null | undefined) => (u && /^https:\/\//i.test(u) ? u : null);

function LevelUpModal({ level, onClose }: { level: LevelInfo | null; onClose: () => void }) {
  useEffect(() => {
    if (level) {
      sfx.levelUp();
      celebrate();
    }
  }, [level]);
  return (
    <Modal open={Boolean(level)} onClose={onClose}>
      {level && (
        <div className="py-4 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            className="relative mx-auto mb-5 grid h-28 w-28 place-items-center"
          >
            <div className="absolute inset-0 animate-spin-slow rounded-full border-4 border-dashed border-mauve" />
            <div className="relative grid h-24 w-24 place-items-center rounded-full border-2 border-mauve bg-bronze">
              <span className="font-display text-4xl font-black text-mauve">{level.level}</span>
            </div>
          </motion.div>
          <div className="label !text-wood-700">Special edition · Level up!</div>
          <h2 className="mt-1 font-display text-3xl font-black text-white">{level.title}</h2>
          <p className="mt-2 text-sm text-slate-400">You reached level {level.level}. Keep the streak alive!</p>
          <button onClick={onClose} className="btn-primary mt-6">
            Let's go <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </Modal>
  );
}

function Summary({ s, onAgain }: { s: QuizSummary; onAgain: () => void }) {
  const { saved, busy, save } = useSaver();
  const [open, setOpen] = useState<string | null>(null);
  const { meta } = useLive();
  const grade = s.accuracy >= 0.9 ? 'Outstanding!' : s.accuracy >= 0.7 ? 'Great work!' : s.accuracy >= 0.5 ? 'Good effort!' : 'Keep practising!';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.85, rotate: -720 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        className="card relative overflow-hidden p-6 text-center sm:p-10"
      >
        <div className="dateline flex justify-between gap-3 border-b border-mauve pb-1.5">
          <span>Extra edition</span>
          <span className="hidden sm:inline">{today}</span>
          <span>Free</span>
        </div>
        <div className="py-2">
          <span className="nameplate text-[length:clamp(1.5rem,8vw,2.25rem)] sm:text-6xl">The NewsQuest</span>
        </div>
        <div className="border-t-[3px] border-mauve" />
        <div className="mt-[3px] border-t border-mauve" />
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: -3 }}
          transition={{ type: 'spring', stiffness: 320, damping: 12 }}
          className="mx-auto mt-6 w-fit bg-mauve px-3 py-1 font-condensed text-sm font-semibold uppercase tracking-[0.3em] text-peach"
        >
          Extra! Extra!
        </motion.div>
        <h1 className="relative mt-4 font-display text-5xl font-black uppercase leading-[0.95] text-white sm:text-7xl">{grade}</h1>
        <p className="relative mx-auto mt-3 max-w-xl text-lg italic text-slate-400">
          {s.label} – reader answers {s.correct} of {s.answered} correctly in {fmtDuration(s.durationMs)}.
        </p>
        {s.perfect && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: 'spring' }} className="chip relative mt-3 !bg-bronze">
            <Star className="h-3.5 w-3.5" /> Perfect run · +10 bonus coins
          </motion.div>
        )}
      </motion.div>

      <div className="relative mt-8 flex flex-col items-center justify-center gap-8 sm:flex-row">
        <ProgressRing value={s.accuracy} size={168} stroke={14} color={PALETTE.mauve}>
          <div>
            <div className="font-display text-4xl font-black text-white">{pct(s.accuracy)}</div>
            <div className="text-xs text-slate-400">
              {s.correct}/{s.answered} correct
            </div>
          </div>
        </ProgressRing>
      </div>

      <div className="grid grid-cols-2 gap-3 text-left">
        {[
          { icon: Zap, label: 'XP earned', value: `+${s.xp}`, color: 'text-violet-300' },
          { icon: Coins, label: 'Coins', value: `+${s.coins}`, color: 'text-amber-300' },
          { icon: Flame, label: 'Best combo', value: `${s.maxCombo}`, color: 'text-orange-300' },
          { icon: ClockIcon, label: 'Time', value: fmtDuration(s.durationMs), color: 'text-sky-300' },
        ].map((x, i) => (
          <motion.div
            key={x.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.08 }}
            className="rounded-2xl border-2 border-mauve bg-ink-900 px-4 py-3 shadow-hard-sm"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <x.icon className={cx('h-3.5 w-3.5', x.color)} /> {x.label}
            </div>
            <div className="font-display text-2xl font-black text-white">{x.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="relative mx-auto mt-8 max-w-md text-left">
        <div className="mb-1 flex justify-between text-xs text-slate-400">
          <span>
            Level {s.level.level} · {s.level.title}
          </span>
          <span>
            {s.level.xpIntoLevel}/{s.level.xpForNext} XP
          </span>
        </div>
        <XPBar progress={s.level.progress} />
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-orange-300">
          <Flame className="h-3.5 w-3.5" /> {s.streak}-day streak
        </div>
      </div>

      <div className="relative mt-8 flex flex-wrap justify-center gap-3">
        <button onClick={onAgain} className="btn-cta">
          <RotateCcw className="h-5 w-5" /> Play again
        </button>
        <Link to="/arena" className="btn-ghost">
          <Trophy className="h-4 w-4" /> Arena
        </Link>
        <Link to="/" className="btn-ghost">
          <Home className="h-4 w-4" /> Home
        </Link>
      </div>

      {s.achievements.length > 0 && (
        <div>
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold text-white">
            <Sparkles className="h-5 w-5 text-amber-300" /> Unlocked this round
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {s.achievements.map((a, i) => (
              <AchievementCard key={a.id} a={{ ...a, unlockedAt: Date.now() }} index={i} />
            ))}
          </div>
        </div>
      )}

      {s.review.length > 0 && (
        <div>
          <h2 className="mb-4 font-display text-xl font-bold text-white">Review & save</h2>
          <div className="space-y-3">
            {s.review.map((r, i) => {
              const q = r.question as RevealedQuestion;
              const isOpen = open === r.questionId;
              const link = safeLink(q.source?.link);
              return (
                <motion.div
                  key={r.questionId + i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="card overflow-hidden"
                >
                  <button onClick={() => setOpen(isOpen ? null : r.questionId)} className="flex w-full items-center gap-3 p-4 text-left">
                    <span
                      className={cx(
                        'grid h-8 w-8 shrink-0 place-items-center border-2 border-mauve text-xs font-black',
                        r.skipped ? 'bg-ink-900 text-slate-300' : r.correct ? 'bg-mauve text-peach' : 'hatch bg-danger text-black',
                      )}
                    >
                      {r.skipped ? <SkipForward className="h-4 w-4" /> : r.correct ? '✓' : <X className="h-4 w-4" />}
                    </span>
                    <span className="line-clamp-1 flex-1 text-sm text-slate-200">{q.prompt}</span>
                    <span className="hidden text-[11px] text-slate-500 sm:block">{meta?.questionTypes[q.type] ?? q.type}</span>
                    <DifficultyBadge d={q.difficulty} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="space-y-4 border-t-2 border-mauve p-5">
                          <QuestionBody q={q} compact />
                          <Options q={q} selected={r.choice ?? null} answer={q.answer} compact />
                          <div className="rounded-2 border-2 border-mauve bg-ink-900 p-3 text-sm text-mauve">
                            <b>Why:</b> <span className="whitespace-pre-line">{q.explanation}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {q.articleId && (
                              <Link to={`/article/${q.articleId}`} className="btn-ghost !py-1.5 text-xs">
                                Read the story
                              </Link>
                            )}
                            {link && (
                              <a href={link} target="_blank" rel="noopener noreferrer" className="btn-ghost !py-1.5 text-xs">
                                Source <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <button onClick={() => save(q.id)} disabled={saved.has(q.id) || busy === q.id} className="btn-ghost ml-auto !py-1.5 text-xs">
                              {saved.has(q.id) ? <BookmarkCheck className="h-4 w-4 text-emerald-300" /> : <BookmarkPlus className="h-4 w-4" />}
                              {saved.has(q.id) ? 'Saved' : 'Save to Vault'}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface Clock {
  questionStart: number;
  limitMs: number;
  deadline: number | null;
}

export function PlayPage() {
  const { sid = '' } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const { user, refresh, setUser } = useAuth();
  const { meta } = useLive();
  const { toast, achievements } = useToast();
  const { saved, busy: saving, save } = useSaver();

  const [view, setView] = useState<QuizView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [pending, setPending] = useState(false);
  const [summary, setSummary] = useState<QuizSummary | null>(null);
  const [levelUp, setLevelUp] = useState<LevelInfo | null>(null);
  const [clock, setClock] = useState<Clock>({ questionStart: Date.now(), limitMs: 0, deadline: null });
  const [now, setNow] = useState(Date.now());
  const [floatXp, setFloatXp] = useState<{ id: number; xp: number } | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const lastTick = useRef(-1);
  const answering = useRef(false);

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 404) setError(e.message);
      else toast((e as Error).message, 'error');
    },
    [toast],
  );

  const applyView = useCallback((v: QuizView) => {
    const offset = Date.now() - v.serverNow;
    setView(v);
    setSelected(null);
    setResult(null);
    setClock({ questionStart: Date.now() - (v.elapsedMs ?? 0), limitMs: v.timeLimitMs, deadline: v.deadline ? v.deadline + offset : null });
    answering.current = false;
    lastTick.current = -1;
  }, []);

  const finish = useCallback(async () => {
    try {
      const s = await api.finish(sid);
      setSummary(s);
      if (s.perfect) celebrate();
      if (s.leveledUp) setLevelUp(s.level);
      achievements(s.achievements);
      void refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }, [sid, achievements, refresh]);

  const goNext = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      const v = await api.next(sid);
      if (v.over || !v.question || v.finished) await finish();
      else applyView(v);
    } catch (e) {
      fail(e);
    } finally {
      setPending(false);
    }
  }, [pending, sid, finish, applyView, fail]);

  useEffect(() => {
    const initial = (location.state as { view?: QuizView } | null)?.view;
    if (initial) nav(location.pathname, { replace: true, state: null });
    const boot = async () => {
      try {
        let v = initial && initial.sessionId === sid ? initial : await api.next(sid);
        if (v.phase === 'reveal') v = await api.next(sid);
        if (v.over || !v.question || v.finished) await finish();
        else applyView(v);
      } catch (e) {
        setError((e as Error).message);
      }
    };
    void boot();
  }, [sid]);

  useEffect(() => {
    if (!view || summary) return;
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, [view, summary]);

  const submit = useCallback(
    async (choice: number) => {
      if (!view?.question || result || answering.current) return;
      answering.current = true;
      setSelected(choice);
      try {
        const r = await api.answer(sid, view.question.id, choice);
        setResult(r);
        if (r.correct) {
          sfx.correct(r.combo);
          burst(0.5, 0.65, r.combo >= 5 ? 1.6 : 1);
          setFloatXp({ id: Date.now(), xp: r.xpGained });
        } else sfx.wrong();
        setView((v) => (v ? { ...v, combo: r.combo, lives: r.lives, correct: r.correctCount, answered: r.answered, xp: v.xp + r.xpGained, coins: v.coins + r.coinsGained } : v));
        if (user) setUser({ ...user, xp: user.xp + r.xpGained, coins: user.coins + r.coinsGained, streak: r.streak, activeToday: true });
        if (r.levelUp) setLevelUp(r.levelUp);
        if (view.mode === 'blitz') window.setTimeout(() => (r.over ? void finish() : void goNextRef.current()), r.correct ? 700 : 1300);
      } catch (e) {
        if (choice === -1) {
          void finish();
          return;
        }
        fail(e);
        answering.current = false;
        setSelected(null);
      }
    },
    [view, result, sid, user, setUser, fail, finish],
  );

  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;

  const remainingMs = useMemo(() => {
    if (!view) return null;
    if (clock.deadline) return clock.deadline - now;
    if (clock.limitMs) return clock.questionStart + clock.limitMs - now;
    return null;
  }, [view, clock, now]);
  const totalMs = clock.deadline ? 90_000 : clock.limitMs;

  useEffect(() => {
    if (remainingMs === null || result || !view?.question || summary) return;
    const secs = Math.ceil(remainingMs / 1000);
    if (secs <= 5 && secs > 0 && secs !== lastTick.current) {
      lastTick.current = secs;
      sfx.tick();
    }
    if (remainingMs <= 0) void submit(-1);
  }, [remainingMs, result, view, summary, submit]);

  const usePower = async (type: PowerupKey) => {
    if (!view?.question || result) return;
    try {
      const r = await api.powerup(sid, type);
      sfx.click();
      if (user) setUser({ ...user, coins: r.coins });
      if (type === 'fifty' && r.removed) setView({ ...view, removed: r.removed });
      if (type === 'time') {
        const offset = Date.now() - view.serverNow;
        setClock((c) => ({ ...c, limitMs: r.timeLimitMs ?? c.limitMs, deadline: r.deadline ? r.deadline + offset : c.deadline }));
        lastTick.current = -1;
      }
      if (type === 'skip') {
        answering.current = true;
        await goNext();
      }
    } catch (e) {
      fail(e);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!view?.question || summary || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (!result) {
        const k = e.key.toLowerCase();
        let idx = -1;
        if (/^[1-6]$/.test(k)) idx = Number(k) - 1;
        else if (/^[a-f]$/.test(k)) idx = k.charCodeAt(0) - 97;
        if (idx >= 0 && idx < view.question.options.length && !view.removed.includes(idx)) void submit(idx);
      } else if ((e.key === 'Enter' || e.key === ' ') && view.mode !== 'blitz') {
        e.preventDefault();
        if (result.over) void finish();
        else void goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, result, summary, submit, goNext, finish]);

  const playAgain = async () => {
    if (!summary) return;
    if (summary.mode === 'daily' || summary.mode === 'article') return nav('/arena');
    if (summary.mode === 'practice') return nav('/vault');
    try {
      const v = await api.startQuiz({ mode: summary.mode, count: 10 });
      setSummary(null);
      nav(`/play/${v.sessionId}`, { replace: true, state: { view: v } });
      applyView(v);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  if (error)
    return (
      <EmptyState icon={<XCircle className="h-6 w-6" />} title="This quiz is no longer available">
        {error}
        <Link to="/arena" className="text-violet-300 hover:underline">
          Back to the Arena
        </Link>
      </EmptyState>
    );

  if (summary)
    return (
      <>
        <Summary s={summary} onAgain={playAgain} />
        <LevelUpModal level={levelUp} onClose={() => setLevelUp(null)} />
      </>
    );

  if (!view?.question)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="h-8 w-8 text-violet-300" />
      </div>
    );

  const q = view.question;
  const frac = remainingMs !== null && totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 1;
  const secs = remainingMs === null ? null : Math.max(0, Math.ceil(remainingMs / 1000));
  const urgent = secs !== null && secs <= 5;
  const progressFrac = view.total ? (view.index + (result ? 1 : 0)) / view.total : null;
  const typeLabel = meta?.questionTypes[q.type] ?? q.type;
  const link = safeLink(result?.source?.link);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button onClick={() => setConfirmExit(true)} className="btn-subtle !p-2" aria-label="End quiz">
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{view.label}</div>
          <div className="text-xs text-slate-500">
            {view.total ? `Question ${view.index + 1} of ${view.total}` : `Question ${view.index + 1}`} · {view.correct}/{view.answered} correct
          </div>
        </div>
        {view.lives !== null && (
          <div className="flex gap-1" aria-label={`${view.lives} lives left`}>
            {Array.from({ length: 3 }, (_, i) => (
              <motion.span key={i} animate={{ scale: i < (view.lives ?? 0) ? 1 : 0.7, opacity: i < (view.lives ?? 0) ? 1 : 0.25 }}>
                <Heart className={cx('h-5 w-5', i < (view.lives ?? 0) ? 'fill-mauve text-mauve' : 'text-slate-700')} />
              </motion.span>
            ))}
          </div>
        )}
        <AnimatePresence>
          {view.combo >= 2 && (
            <motion.div
              key={view.combo}
              initial={{ scale: 1.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="flex items-center gap-1 border-2 border-mauve bg-mauve px-3 py-1 font-condensed text-sm font-semibold uppercase tracking-wider text-peach shadow-hollow"
            >
              <Flame className="h-4 w-4" /> {view.combo}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="relative flex items-center gap-1 border-2 border-mauve bg-sage px-3 py-1 font-mono text-sm font-bold text-mauve">
          <Zap className="h-4 w-4" /> {view.xp}
          <AnimatePresence>
            {floatXp && floatXp.xp > 0 && (
              <motion.span
                key={floatXp.id}
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: -36 }}
                transition={{ duration: 1.2 }}
                onAnimationComplete={() => setFloatXp(null)}
                className="pointer-events-none absolute -top-2 right-0 font-display text-lg font-black text-emerald-300"
              >
                +{floatXp.xp}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-1 border-2 border-mauve bg-sage px-3 py-1 font-mono text-sm font-bold text-mauve">
          <Coins className="h-4 w-4" /> {user?.coins ?? 0}
        </div>
      </div>

      <div className="mb-6 space-y-2">
        {progressFrac !== null && (
          <div className="h-3 overflow-hidden border-2 border-mauve bg-ink-900">
            <motion.div className="h-full bg-wood" animate={{ width: `${progressFrac * 100}%` }} />
          </div>
        )}
        {secs !== null && (
          <div className="flex items-center gap-3">
            <div className="h-3.5 flex-1 overflow-hidden border-2 border-mauve bg-ink-900">
              <div
                className={cx('h-full transition-[width] duration-100 ease-linear', urgent ? 'animate-pulse bg-mauve' : frac < 0.5 ? 'bg-screen' : 'bg-mauve')}
                style={{ width: `${frac * 100}%` }}
              />
            </div>
            <motion.span
              animate={urgent && !result ? { scale: [1, 1.25, 1] } : { scale: 1 }}
              transition={{ duration: 0.5, repeat: urgent && !result ? Infinity : 0 }}
              className={cx('w-12 text-right font-mono text-sm font-bold', urgent ? 'text-rose-400' : 'text-slate-300')}
            >
              {secs}s
            </motion.span>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={q.id + view.index}
          initial={{ opacity: 0, x: 60, rotateY: -8 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          exit={{ opacity: 0, x: -60, rotateY: 8 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformPerspective: 1200 }}
          className={cx(
            'card relative overflow-hidden p-6 sm:p-8',
            result && (result.correct ? '!shadow-[7px_7px_0_0_#111111]' : '!shadow-[7px_7px_0_-2px_#ECE8DE,7px_7px_0_0_#111111]'),
          )}
        >
          {view.combo >= 3 && result && (
            <motion.div
              className="pointer-events-none absolute inset-0 bg-bronze/20"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
          )}

          <div className="relative mb-5 flex flex-wrap items-center gap-2">
            <SectionBadge section={q.section} />
            <span className="chip !py-0.5 !text-[11px]">{typeLabel}</span>
            <DifficultyBadge d={q.difficulty} />
            {q.origin === 'ai' && (
              <span className="chip !py-0.5 !text-[11px] !text-violet-200">
                <Sparkles className="h-3 w-3" /> AI
              </span>
            )}
          </div>

          <div className="relative">
            <QuestionBody q={q} />
          </div>

          <div className="relative mt-6">
            <Options q={q} removed={view.removed} selected={selected} answer={result ? result.answer : null} onSelect={submit} disabled={pending || answering.current} />
          </div>

          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 16, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} className="relative overflow-hidden">
                <motion.div
                  aria-hidden
                  initial={{ opacity: 0, scale: 1.9, rotate: -24 }}
                  animate={{ opacity: 0.92, scale: 1, rotate: -8 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 520, damping: 20 }}
                  className="pointer-events-none absolute right-2 top-9 z-20"
                >
                  <span className="stamp !text-xl sm:!text-2xl">{result.correct ? 'Verified' : result.timedOut ? 'Too late' : 'False'}</span>
                </motion.div>

                <div className="mt-6 border-t-2 border-mauve/20 pt-5">
                  <div className="flex items-center gap-3">
                    <motion.div
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                      className={cx('grid h-10 w-10 place-items-center border-2 border-mauve', result.correct ? 'bg-mauve text-peach' : 'hatch bg-danger text-mauve')}
                    >
                      {result.correct ? <Target className="h-5 w-5" /> : <X className="h-5 w-5" />}
                    </motion.div>
                    <div>
                      <div className="font-display text-2xl font-black text-white">
                        {result.correct
                          ? result.combo >= 5
                            ? 'Unstoppable!'
                            : `${result.combo} combo!`
                          : result.combo >= 3
                          ? 'On fire!'
                          : result.correct
                          ? 'Correct!'
                          : result.timedOut
                          ? "Time's up!"
                          : 'Not quite'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {result.correct ? `+${result.xpGained} XP · +${result.coinsGained} coins` : `Answer: ${LETTERS[result.answer]}. ${q.options[result.answer]}`}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-3 rounded-xl border-2 border-mauve bg-ink-900 p-4 text-sm leading-relaxed text-slate-300">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-bronze-800" />
                    <span className="whitespace-pre-line">{result.explanation}</span>
                  </div>

                  {result.source && (
                    <div className="mt-3 text-xs text-slate-500">
                      Source: {sourceCredit(result.source.source) ? `${sourceCredit(result.source.source)} – ` : ''}
                      {result.source.headline}
                      {link && (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-violet-300 hover:underline">
                          open <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {result && view.mode !== 'blitz' && (
          <motion.div
            key={`next-${q.id}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.2 }}
            className="sticky bottom-3 z-30 mt-4 flex flex-wrap items-center gap-3 border-2 border-mauve bg-ink-950 p-3 shadow-hard"
          >
            <button onClick={() => save(q.id)} disabled={saved.has(q.id) || saving === q.id} className="btn-ghost">
              {saved.has(q.id) ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
              {saved.has(q.id) ? 'Saved' : 'Save to Vault'}
            </button>
            <span className="dateline hidden sm:inline">or press Enter</span>
            <button onClick={() => (result.over ? finish() : goNext())} disabled={pending} className="btn-cta ml-auto">
              {pending ? <Spinner className="h-5 w-5" /> : null}
              {result.over ? 'See results' : 'Next question'} <ArrowRight className="cta-arrow h-5 w-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!result && view.mode === 'practice' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 flex flex-wrap justify-center gap-2">
          {([
            { k: 'fifty' as const, icon: Divide, show: q.options.length >= 4 && !view.removed.length },
            { k: 'time' as const, icon: TimerReset, show: Boolean(clock.limitMs || clock.deadline) },
            { k: 'skip' as const, icon: SkipForward, show: true },
          ])
            .filter((p) => p.show)
            .map((p) => {
              const info = view.powerups[p.k];
              const afford = (user?.coins ?? 0) >= info.cost;
              return (
                <motion.button
                  key={p.k}
                  whileHover={afford ? { y: -2 } : undefined}
                  whileTap={afford ? { scale: 0.95 } : undefined}
                  disabled={!afford}
                  onClick={() => usePower(p.k)}
                  className="btn-ghost !rounded-full !py-2 text-xs"
                  title={afford ? `Costs ${info.cost} coins` : `Need ${info.cost} coins`}
                >
                  <p.icon className="h-4 w-4" /> {info.label}
                  <span className="flex items-center gap-0.5 text-amber-300">
                    <Coins className="h-3 w-3" />
                    {info.cost}
                  </span>
                </motion.button>
              );
            })}
        </motion.div>
      )}

      <p className="mt-4 text-center text-[11px] text-slate-600">
        Keyboard: press 1–{q.options.length} or A–{LETTERS[q.options.length - 1]} to answer{view.mode !== 'blitz' ? ', Enter for next' : ''}.
      </p>

      <Modal open={confirmExit} onClose={() => setConfirmExit(false)}>
        <h2 className="font-display text-xl font-bold text-white">End this quiz?</h2>
        <p className="mt-2 text-sm text-slate-400">Your answers so far are scored and you'll see the summary.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setConfirmExit(false)} className="btn-ghost">
            Keep playing
          </button>
          <button
            onClick={() => {
              setConfirmExit(false);
              void finish();
            }}
            className="btn-primary"
          >
            End & see results
          </button>
        </div>
      </Modal>
      <LevelUpModal level={levelUp} onClose={() => setLevelUp(null)} />
    </div>
  );
}