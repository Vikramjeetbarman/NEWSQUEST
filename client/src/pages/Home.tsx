import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarClock,
  Coins,
  Flame,
  Layers,
  Newspaper,
  Rss,
  ScrollText,
  Sparkles,
  Swords,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArticleCard, ArticleCardSkeleton } from '../components/ArticleCard';
import { WordCloud } from '../components/charts';
import { FrontPage } from '../components/FrontPage';
import { StoryArt } from '../components/StoryArt';
import { AnimatedNumber, Typewriter, XPBar } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { api } from '../lib/api';
import { greeting, timeAgo } from '../lib/format';
import { SECTION_ORDER, SECTION_STYLE } from '../lib/sections';
import type { ArticleCard as Card, DailyStatus, Trending } from '../lib/types';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] } }),
};

function ExtraSeal({ className }: { className: string }) {
  const id = `seal-${useId().replace(/:/g, '')}`;
  return (
    <motion.div
      initial={{ scale: 0, rotate: -90 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ delay: 1.1, type: 'spring', stiffness: 220, damping: 12 }}
      className={`absolute grid h-28 w-28 place-items-center rounded-full border-2 border-mauve bg-mauve text-peach shadow-hollow sm:h-32 sm:w-32 ${className}`}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full animate-spin-slow" aria-hidden>
        <defs>
          <path id={id} d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
        </defs>
        <text className="fill-peach font-condensed text-[10px] font-semibold uppercase">
          <textPath href={`#${id}`} textLength="236" lengthAdjust="spacing">
            Extra ★ Extra ★ Read all about it ★
          </textPath>
        </text>
      </svg>
      <span className="absolute inset-[22%] rounded-full border border-peach/50" />
      <span className="font-masthead text-4xl font-bold leading-none">N</span>
    </motion.div>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const { meta, newsVersion } = useLive();
  const [latest, setLatest] = useState<Card[] | null>(null);
  const [trending, setTrending] = useState<Trending | null>(null);
  const [daily, setDaily] = useState<DailyStatus | null>(null);

  useEffect(() => {
    api.news({ limit: 7 }).then((r) => setLatest(r.items), () => setLatest([]));
    api.trending().then(setTrending, () => {});
  }, [newsVersion]);

  useEffect(() => {
    api.daily().then(setDaily, () => {});
  }, [user?.id]);

  const totalArticles = meta?.sections.reduce((s, x) => s + x.articles, 0) ?? 0;
  const totalQs = meta?.sections.reduce((s, x) => s + x.questions, 0) ?? 0;
  const typeCount = meta ? Object.keys(meta.questionTypes).length : 14;

  return (
    <div className="space-y-20">
      <section className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <motion.div initial="hidden" animate="show" className="relative z-10">
          <motion.div variants={fadeUp} custom={0} className="chip mb-6 !bg-mauve !text-peach">
            <Sparkles className="h-3.5 w-3.5" />
            <Typewriter text={user ? `${greeting()}, ${user.displayName.split(' ')[0]}` : 'Current affairs, gamified'} delay={500} />
          </motion.div>
          <h1 className="font-display text-[2.6rem] font-black leading-[0.98] text-white sm:text-7xl">
            {['Read today.', 'Rank tomorrow.'].map((line, i) => (
              <motion.span
                initial={{ y: '110%' }}
                animate={{ y: 0 }}
                transition={{ delay: 0.15 + i * 0.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className={i ? 'text-accent inline-block' : 'inline-block'}
                key={line}
              >
                {line}
              </motion.span>
            ))}
          </h1>
          <motion.p variants={fadeUp} custom={2} className="mt-6 max-w-xl text-xl leading-relaxed text-slate-400">
            NewsQuest pulls fresh releases from the <b>Press Information Bureau</b> and{' '}
            <b className="font-display font-bold italic text-slate-200">News On AIR</b>, condenses them into section-wise digests and turns every story
            into exam-grade MCQs - UPSC statements, match-the-following, spot the error and more.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="mt-8 flex flex-wrap gap-4">
            <Link to="/arena?mode=daily" className="btn-cta">
              <Swords className="h-5 w-5" /> {daily?.done ? 'Enter the Arena' : 'Play Daily Challenge'}
              <ArrowRight className="h-5 w-5" /> Today's digest
            </Link>
            <Link to="/news" className="btn-ghost min-h-[3.25rem] px-6 text-base">
              <ScrollText className="h-5 w-5" /> Today's digest
            </Link>
          </motion.div>
        </motion.div>
        <motion.div variants={fadeUp} custom={4} className="mt-10 max-w-x1">
          <div className="label mb-2">By the numbers</div>
          <dl className="grid grid-cols-2 border-y-2 border-mauve sm:grid-cols-4">
            {[
              { label: 'Stories', value: totalArticles, icon: Newspaper },
              { label: 'Questions', value: totalQs, icon: BrainCircuit },
              { label: 'Sections', value: meta?.sections.length ?? 10, icon: Layers },
              { label: 'Formats', value: typeCount, icon: Sparkles },
            ].map((s, i) => (
              <div key={s.label} className={`px-4 py-3 ${i % 2 ? 'border-l border-mauve' : ''} ${i >= 2 ? 'sm:border-l' : ''} ${i > 1 ? 'border-t border-mauve sm:border-t-0' : ''}`}>
                <dd className="font-display text-4xl font-black text-white">
                  <AnimatedNumber value={s.value} />
                </dd>
                <dt className="mt-0.5 flex items-center gap-1.5 font-condensed text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <s.icon className="h-3.5 w-3.5" /> {s.label}
                </dt>
              </div>
            ))}
          </dl>
        </motion.div>
      </section>

      <div className="relative mx-auto w-full max-w-[540px] pr-3 pt-8 lg:pt-4">
        <FrontPage stories={latest} />
        <div className="hidden sm:block">
          <ExtraSeal className="-right-5 -top-8 z-20" />
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="card relative overflow-hidden p-6 lg:col-span-2"
        >
          {user ? (
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl border-2 border-mauve bg-bronze text-5xl shadow-hard">
                {user.avatar}
              </div>
              <div className="flex-1">
                <div className="label">Level {user.level.level}</div>
                <div className="font-display text-3xl font-black text-white">{user.level.title}</div>
                <XPBar progress={user.level.progress} className="mt-3" />
                <div className="mt-1.5 text-xs text-slate-500">
                  {user.level.xpIntoLevel} / {user.level.xpForNext} XP to level {user.level.level + 1}
                </div>
              </div>
              <div className="flex gap-3 sm:flex-col">
                <span className="chip !text-orange-300"><Flame className="h-3.5 w-3.5" /> {user.streak}-day streak</span>
                <span className="chip !text-amber-300"><Coins className="h-3.5 w-3.5" /> {user.coins} coins</span>
              </div>
            </div>
          ) : (
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <h2 className="font-display text-2xl font-bold text-white">Start your aspirant journey</h2>
                <p className="mt-1 text-slate-400">
                  Play instantly as a guest - your XP, streaks, achievements and saved questions are kept. Create an account any time to secure them.
                </p>
              </div>
              <Link to="/login?mode=register" className="btn-primary">
                Create free account <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
          <Link
            to="/arena?mode=daily"
            className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border-2 border-mauve bg-mauve p-6 shadow-hard-bronze transition duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            <motion.div
              className="absolute -right-6 -top-6 text-bronze/25"
              animate={{ rotate: 360 }}
              transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            >
              <CalendarClock className="h-36 w-36" />
            </motion.div>
            <div className="relative">
              <div className="label !text-bronze">Daily Challenge · {daily?.day ?? 'today'}</div>
              <div className="mt-1 font-display text-3xl font-black text-peach">
                {daily?.done ? 'Done! ' + daily.result?.correct + '/' + daily.result?.total : daily?.inProgress ? 'Resume your run' : '10 questions · 1.5x XP'}
              </div>
              <p className="mt-1 text-sm text-sage">Same set for everyone today. Climb from easy to expert.</p>
            </div>
            <div className="btn-cta-invert mt-6 w-fit min-h-0 px-5 py-2.5 !text-sm">
              {daily?.done ? 'See the arena' : 'Play now'} <ArrowRight className="cta-arrow h-4 w-4" />
            </div>
          </Link>
        </motion.div>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="label mb-1">Section-wise</div>
            <h2 className="section-title">Pick your beat</h2>
          </div>
          <Link to="/news" className="btn-subtle">All sections <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {SECTION_ORDER.map((key, i) => {
            const s = SECTION_STYLE[key];
            const info = meta?.sections.find((x) => x.key === key);
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 220, damping: 22 }}
              >
                <Link to={`/news/${key}`} className="card card-hover group relative flex h-full flex-col overflow-hidden">
                  <div className="relative h-28 overflow-hidden border-b-2 border-mauve">
                    <StoryArt seed={`section-${key}`} section={key} title={info?.label ?? key} className="transition-transform duration-700 group-hover:scale-110" />
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div>
                      <div className="font-display font-bold text-white">{info?.label ?? key}</div>
                      <div className="text-[11px] font-medium text-slate-500">{s.subject}</div>
                    </div>
                    <div className="mt-auto flex gap-3 text-xs font-medium text-slate-400">
                      <span>{info?.articles ?? 0} {info?.articles === 1 ? 'story' : 'stories'}</span>
                      <span className="font-bold text-violet-300">{info?.questions ?? 0} Qs</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {trending && trending.topics.length > 0 && (
        <section className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <div className="card relative overflow-hidden p-6">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-fuchsia-300" />
              <h2 className="font-display text-xl font-bold text-white">Trending in the news</h2>
            </div>
            <WordCloud words={trending.topics.map((t) => ({ term: t.term, weight: t.count * 3 + t.mentions }))} linkTo={(t) => `/news?q=${encodeURIComponent(t)}`} />
          </div>
          <div className="card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-300" />
              <h2 className="font-display text-xl font-bold text-white">Hot storylines</h2>
            </div>
            <ol className="space-y-1">
              {trending.stories.slice(0, 5).map((s, i) => (
                <motion.li key={s.id} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                  <Link to={`/article/${s.id}`} className="group flex items-start gap-4 rounded-xl border-2 border-transparent p-3 transition hover:border-mauve hover:bg-ink-900">
                    <span className="font-display text-3xl font-black text-slate-600 transition group-hover:text-mauve">{String(i + 1).padStart(2, '0')}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-100 group-hover:text-white">{s.title}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {meta?.sections.find((x) => x.key === s.section)?.label} · {timeAgo(s.publishedAt)} · {s.questionCount} questions
                      </div>
                    </div>
                  </Link>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <section>
        <div className="mb-8 text-center">
          <div className="label mb-1">The pipeline</div>
          <h2 className="section-title">From headline to high score</h2>
        </div>
        <div className="relative grid gap-5 md:grid-cols-3">
          <div className="absolute left-[16%] right-[16%] top-10 hidden border-t-[3px] border-dashed border-mauve md:block" />
          {[
            { icon: Rss, title: 'Fetch', text: 'RSS feeds from PIB (Government of India) and News On AIR are polled on a schedule, de-duplicated and pushed live to your screen.', color: 'bg-bronze text-mauve' },
            { icon: BookOpenCheck, title: 'Summarise', text: 'Each story is condensed into a TL;DR and key points; sections get topic-wise digests with an exam lens of people, places, schemes and numbers.', color: 'bg-mauve text-peach' },
            { icon: BrainCircuit, title: 'Quiz', text: `${typeCount} question formats at four difficulty levels - play solo modes, earn XP and badges, and save tricky ones to your Vault for revision.`, color: 'bg-peach text-mauve' },
          ].map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              className="card relative p-6 text-center"
            >
              <motion.div
                whileInView={{ rotate: [0, -10, 10, 0] }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 + i * 0.15, duration: 0.8 }}
                className={`mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border-2 border-mauve shadow-hard-sm ${s.color}`}
              >
                <s.icon className="h-6 w-6" />
              </motion.div>
              <h3 className="font-display text-lg font-bold text-white">
                {i + 1}. {s.title}
              </h3>
              <p className="mt-2 text-sm text-slate-400">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="label mb-1">Fresh off the wire</div>
            <h2 className="section-title">Latest stories</h2>
          </div>
          <Link to="/news" className="btn-subtle">View all <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {latest === null
            ? Array.from({ length: 6 }, (_, i) => <ArticleCardSkeleton key={i} />)
            : latest.slice(0, 7).map((a, i) => <ArticleCard key={a.id} a={a} index={i} featured={i === 0} />)}
        </div>
      </section>
    </div>
  );
}