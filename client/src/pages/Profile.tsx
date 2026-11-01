import { motion } from 'framer-motion';
import {
  Award,
  BookOpen,
  Bookmark,
  Coins,
  Crown,
  Flame,
  Gamepad2,
  LogIn,
  Medal,
  Pencil,
  ShieldCheck,
  Target,
  TrendingUp,
  UserRound,
  Zap,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AchievementCard } from '../components/AchievementBadge';
import { BarList, Heatmap, RadarChart } from '../components/charts';
import {
  AnimatedNumber,
  EmptyState,
  Modal,
  ProgressRing,
  SectionBadge,
  Skeleton,
  Spinner,
  XPBar,
  sectionLabel,
} from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';
import { cx, fmtDuration, pct, timeAgo } from '../lib/format';
import {
  DIFFICULTY_STYLE,
  PALETTE,
  PRINT_FILLS,
  SECTION_ORDER,
  SECTION_STYLE,
} from '../lib/sections';
import type { Profile } from '../lib/types';

export function ProfilePage() {
  const { user, loading: authLoading, setUser, ensureUser } = useAuth();
  const { meta } = useLive();
  const { toast } = useToast();
  const nav = useNavigate();
  const [p, setP] = useState<Profile | null>(null);
  const [pickAvatar, setPickAvatar] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.profile().then(setP, (e) => toast((e as Error).message, 'error'));
  }, [user?.id, user?.xp]);

  if (!authLoading && !user)
    return (
      <EmptyState icon={<UserRound className="h-6 w-6" />} title="No profile yet">
        Sign in to see your progress, saved questions, streak, achievements and rank – or try the demo as a guest, no sign-up needed.
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/login" className="btn-primary">
            <LogIn className="h-4 w-4" /> Sign in
          </Link>
          <button
            onClick={async () => {
              setBusy(true);
              try {
                await ensureUser();
              } catch (e) {
                toast((e as Error).message, 'error');
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="btn-ghost"
          >
            {busy ? <Spinner className="h-4 w-4" /> : <UserRound className="h-4 w-4" />} Try as a guest
          </button>
        </div>
      </EmptyState>
    );

  if (!p || !user)
    return (
      <div className="space-y-6">
        <Skeleton className="h-56 w-full rounded-3xl" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-80 rounded-3xl" />
        </div>
      </div>
    );

  const u = p.user;
  const accuracy = u.stats.answered ? u.stats.correct / u.stats.answered : 0;
  const unlocked = p.achievements.filter((a) => a.unlockedAt).length;

  const update = async (patch: { displayName?: string; avatar?: string }) => {
    try {
      const r = await api.updateProfile(patch);
      setUser(r.user);
      setP((x) => (x ? { ...x, user: r.user } : x));
      return true;
    } catch (e) {
      toast((e as Error).message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitName = async (e: FormEvent) => {
    e.preventDefault();
    if (await update({ displayName: name.trim() })) setEditing(false);
  };

  const radar = SECTION_ORDER.map((k) => {
    const row = p.bySection.find((r) => r.section === k);
    return {
      label: sectionLabel(k).split(' ')[0],
      value: row && row.total ? row.correct / row.total : 0,
      color: SECTION_STYLE[k].color,
      sub: row ? `${row.correct}/${row.total}` : '0/0',
    };
  });

  const tiles = [
    { icon: Gamepad2, label: 'Quizzes', value: u.stats.quizzes, color: 'text-violet-300' },
    { icon: Target, label: 'Answered', value: u.stats.answered, color: 'text-sky-300' },
    { icon: Flame, label: 'Best streak', value: u.bestStreak, color: 'text-orange-300', suffix: 'd' },
    { icon: Zap, label: 'Max combo', value: u.stats.maxCombo, color: 'text-amber-300', prefix: '⚡' },
    { icon: Crown, label: 'Perfect runs', value: u.stats.perfects, color: 'text-fuchsia-300' },
    { icon: BookOpen, label: 'Stories read', value: p.reads, color: 'text-emerald-300' },
    { icon: Bookmark, label: 'In vault', value: p.vault.total, color: 'text-cyan-300' },
    { icon: ShieldCheck, label: 'Mastered', value: p.vault.mastered, color: 'text-lime-300' },
  ];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card relative overflow-hidden p-6 sm:p-8">
        <div className="relative flex flex-col items-center gap-6 md:flex-row md:items-center">
          <button onClick={() => setPickAvatar(true)} className="group relative" aria-label="Change avatar">
            <ProgressRing value={u.level.progress} size={132} stroke={8}>
              <motion.span whileHover={{ scale: 1.1, rotate: 8 }} className="text-6xl">
                {u.avatar}
              </motion.span>
            </ProgressRing>
          </button>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-mauve px-3 py-0.5 font-condensed text-xs font-semibold uppercase tracking-[0.16em] text-peach">
            Lvl {u.level.level}
          </span>
        </div>
        <div className="flex-1 text-center md:text-left">
          {editing ? (
            <form onSubmit={submitName} className="flex max-w-sm gap-2">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} autoFocus aria-label="Display name" />
              <button className="btn-primary py-2" disabled={busy || !name.trim()}>
                Save
              </button>
              <button type="button" className="btn-ghost py-2" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <h1 className="flex items-center justify-center gap-2 font-display text-4xl font-black text-white md:justify-start">
              {u.displayName}
              <button
                onClick={() => {
                  setName(u.displayName);
                  setEditing(true);
                }}
                className="text-slate-500 transition hover:text-white"
                aria-label="Edit display name"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </h1>
          )}
          <div className="mt-1 text-sm text-slate-400">
            <span className="rounded-md border-2 border-mauve bg-bronze px-1.5 font-bold text-mauve">{u.level.title}</span> • @{u.username} • joined {timeAgo(u.createdAt)}
            {u.isGuest && <span className="chip ml-2 !bg-peach !py-0.5 !text-[11px]">Guest</span>}
          </div>
          <div className="mt-4 max-w-md">
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>{u.xp.toLocaleString('en-IN')} XP total</span>
              <span>
                {u.level.xpIntoLevel}/{u.level.xpForNext} to level {u.level.level + 1}
              </span>
            </div>
            <XPBar progress={u.level.progress} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { icon: Medal, label: u.isGuest ? 'Would rank' : 'Rank', value: `#${p.rank}`, tone: 'bg-bronze text-mauve' },
            { icon: Flame, label: 'Streak', value: `${u.streak}d`, tone: 'bg-mauve text-peach' },
            { icon: Coins, label: 'Coins', value: u.coins, tone: 'bg-peach text-mauve' },
          ].map((x) => (
            <div key={x.label} className={cx('rounded-2xl border-2 border-mauve px-4 py-3 shadow-hard-sm', x.tone)}>
              <x.icon className="mx-auto h-5 w-5" />
              <div className="mt-1 font-display text-2xl font-black">{x.value}</div>
              <div className="font-condensed text-[11px] font-semibold uppercase tracking-wider">{x.label}</div>
            </div>
          ))}
        </div>

        {u.isGuest && (
          <div className="relative mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border-2 border-mauve bg-peach p-4 text-sm font-medium text-mauve sm:flex-row">
            <span>You're playing as a guest. Create an account to keep your XP, streak and vault safe and to appear on the leaderboard – progress carries over.</span>
            <Link to="/login?mode=register" className="btn-primary shrink-0 !py-2">
              Claim my profile
            </Link>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="card flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:text-left"
      >
        <div className={cx('grid h-14 w-14 shrink-0 place-items-center border-2 border-mauve', u.activeToday ? 'bg-mauve text-peach' : 'bg-sage text-mauve')}>
          <Flame className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <div className="font-display text-xl font-black text-white">
            {u.activeToday
              ? `${u.streak}-day streak – today is done`
              : u.streak > 0
              ? `Keep your ${u.streak}-day streak alive`
              : 'Start a streak today'}
          </div>
          <p className="text-sm text-slate-400">
            {u.activeToday
              ? 'Come back tomorrow and answer any question to keep it going.'
              : 'Answer any question today – any mode, any section – to count the day.'}{' '}
            Best: {u.bestStreak} {u.bestStreak === 1 ? 'day' : 'days'}.
          </p>
        </div>
        {!u.activeToday && (
          <button onClick={() => nav('/arena?mode=daily')} className="btn-cta shrink-0">
            <Flame className="-h-4 w-4" /> Play today
          </button>
        )}
      </motion.div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            whileHover={{ y: -4 }}
            className="card p-4"
          >
            <t.icon className={cx('h-5 w-5', t.color)} />
            <div className="mt-2 font-display text-3xl font-black text-white">
              {t.prefix}
              <AnimatedNumber value={t.value} />
              {t.suffix}
            </div>
            <div className="text-xs text-slate-500">{t.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="card p-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="section-title">Section mastery</h2>
            <span className="text-sm text-slate-400">
              Overall <b className="text-white">{pct(accuracy)}</b>
            </span>
          </div>
          <div className="flex justify-center">
            <RadarChart axes={radar} size={340} />
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="card space-y-6 p-6">
          <div>
            <h2 className="section-title mb-4">Activity</h2>
            <Heatmap data={p.heatmap} weeks={20} />
          </div>
          <div>
            <h3 className="label mb-3">Accuracy by difficulty</h3>
            <BarList
              rows={(Object.keys(DIFFICULTY_STYLE) as (keyof typeof DIFFICULTY_STYLE)[]).map((d) => {
                const r = p.byDifficulty.find((x) => x.difficulty === d);
                return { label: DIFFICULTY_STYLE[d].label, value: r?.correct ?? 0, total: r?.total ?? 0, color: DIFFICULTY_STYLE[d].color };
              })}
            />
          </div>
        </motion.div>
      </div>

      {p.byType.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="card p-6">
          <h2 className="section-title mb-4">Question-type accuracy</h2>
          <div className="grid gap-x-10 md:grid-cols-2">
            <BarList
              rows={[...p.byType]
                .sort((a, b) => b.total - a.total)
                .map((r, i) => ({
                  label: meta?.questionTypes[r.type] ?? r.type,
                  value: r.correct,
                  total: r.total,
                  color: PRINT_FILLS[i % PRINT_FILLS.length],
                }))}
            />
          </div>
        </motion.div>
      )}

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title flex items-center gap-2">
            <Bookmark className="h-5 w-5" /> Saved questions
          </h2>
          <Link to="/vault" className="btn-ghost shrink-0 !py-2">
            Open vault ({p.vault.total})
          </Link>
        </div>
        {p.vault.recent.length ? (
          <div className="card divide-y-2 divide-mauve/15">
            {p.vault.recent.map((s) => (
              <Link key={s.questionId} to="/vault" className="flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-bronze/40">
                {s.mastered ? (
                  <ShieldCheck className="h-4 w-4 shrink-0 text-mauve" aria-label="Mastered" />
                ) : (
                  <Bookmark className="h-4 w-4 shrink-0 text-mauve" aria-label="Saved" />
                )}
                <span className="line-clamp-1 flex-1 text-slate-200">{s.prompt}</span>
                <SectionBadge section={s.section} className="hidden sm:inline-flex" />
                <span className="hidden shrink-0 text-xs text-slate-500 md:inline">{timeAgo(s.savedAt)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Bookmark className="h-6 w-6" />} title="Nothing saved yet">
            After answering a question in a quiz, press <b>Save to Vault</b> to keep it for revision.
          </EmptyState>
        )}
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-300" /> Achievements
          </h2>
          <span className="text-sm text-slate-400">
            {unlocked}/{p.achievements.length} unlocked
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[...p.achievements]
            .sort((a, b) => Number(Boolean(b.unlockedAt)) - Number(Boolean(a.unlockedAt)))
            .map((a, i) => (
              <AchievementCard key={a.id} a={a} index={i} />
            ))}
        </div>
      </div>

      <div>
        <h2 className="section-title mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-sky-300" /> Recent matches
        </h2>
        {p.recent.length ? (
          <div className="card divide-y-2 divide-mauve/15">
            {p.recent.map((r) => {
              const acc = r.total ? r.correct / r.total : 0;
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-3 text-sm">
                  <ProgressRing value={acc} size={40} stroke={5} color={PALETTE.wood}>
                    <span className="text-[11px] font-bold text-white">{pct(acc)}</span>
                  </ProgressRing>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-white">{r.label}</div>
                    <div className="text-xs text-slate-500">
                      {timeAgo(r.createdAt)} • {fmtDuration(r.durationMs)}
                    </div>
                  </div>
                  <span className="text-slate-400">
                    {r.correct}/{r.total}
                  </span>
                  <span className="flex items-center gap-1 text-violet-300">
                    <Zap className="h-3.5 w-3.5" />+{r.xp}
                  </span>
                  <span className="flex items-center gap-1 text-orange-300">
                    <Flame className="h-3.5 w-3.5" />
                    {r.maxCombo}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<Gamepad2 className="h-6 w-6" />} title="No matches yet">
            <Link to="/arena" className="text-violet-300 hover:underline">
              Start your first quiz
            </Link>
          </EmptyState>
        )}
      </div>

      <Modal open={pickAvatar} onClose={() => setPickAvatar(false)}>
        <h2 className="mb-4 font-display text-xl font-bold text-white">Pick your avatar</h2>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
          {p.avatars.map((a) => (
            <motion.button
              key={a}
              whileHover={{ scale: 1.15, rotate: 6 }}
              whileTap={{ scale: 0.9 }}
              disabled={busy}
              onClick={async () => {
                if (await update({ avatar: a })) setPickAvatar(false);
              }}
              className={cx(
                'grid aspect-square place-items-center rounded-2xl border-2 text-3xl transition',
                a === u.avatar ? 'border-mauve bg-bronze shadow-hard-sm' : 'border-mauve/20 bg-ink-900 hover:border-mauve'
              )}
            >
              {a}
            </motion.button>
          ))}
        </div>
        {busy && <Spinner className="mx-auto mt-4 h-5 w-5" />}
      </Modal>
    </div>
  );
}