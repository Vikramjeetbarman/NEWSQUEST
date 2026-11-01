import { motion, useScroll, useSpring } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lightbulb,
  Sparkles,
  Swords,
  Tags,
  Waves,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArticleCard } from '../components/ArticleCard';
import { StoryArt } from '../components/StoryArt';
import { DifficultyBadge, EmptyState, SectionBadge, Skeleton, SourceBadge, Spinner, sourceCredit } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';
import { cx, fmtDate, timeAgo } from '../lib/format';
import { DIFFICULTY_STYLE, SECTION_STYLE } from '../lib/sections';
import type { ArticleResponse, Difficulty } from '../lib/types';
import { useStartQuiz } from '../lib/useStartQuiz';

const ENTITY_LABEL: Record<string, string> = {
  PERSON: 'People',
  PLACE: 'Places',
  ORG: 'Organisations',
  SCHEME: 'Schemes',
  LAW: 'Laws',
  EVENT: 'Events',
  REPORT: 'Reports',
  AWARD: 'Awards',
  TERM: 'Terms',
};

const safeLink = (u: string | null) => (u && /^https:\/\//i.test(u) ? u : null);

export function ArticlePage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { meta } = useLive();
  const { toast, achievements } = useToast();
  const { start, starting } = useStartQuiz();
  const [data, setData] = useState<ArticleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'deep' | 'ai' | null>(null);
  const [imgBroken, setImgBroken] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });

  const load = () => api.article(id).then(setData, (e) => setError(e.message));
  useEffect(() => {
    setData(null);
    setError(null);
    void load();
  }, [id]);

  useEffect(() => {
    if (!user || !data || data.read) return;
    const t = window.setTimeout(() => {
      api.markRead(id).then((r) => achievements(r.achievements), () => {});
    }, 4000);
    return () => window.clearTimeout(t);
  }, [user, data, id, achievements]);

  const entityGroups = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of data?.article.entities ?? []) {
      if (e.type === 'MISC') continue;
      const l = m.get(e.type) ?? [];
      if (l.length < 8) l.push(e.role ? `${e.text} (${e.role})` : e.text);
      m.set(e.type, l);
    }
    return [...m.entries()];
  }, [data]);

  const diffCounts = useMemo(() => {
    const c: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0, expert: 0 };
    for (const b of data?.questions.breakdown ?? []) c[b.difficulty] += b.n;
    return c;
  }, [data]);

  const typeCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const b of data?.questions.breakdown ?? []) c.set(b.type, (c.get(b.type) ?? 0) + b.n);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (error)
    return (
      <EmptyState icon={<BookOpen className="h-6 w-6" />} title="Story not found">
        {error}{' '}
        <Link to="/news" className="text-violet-300 hover:underline">
          Back to the news
        </Link>
      </EmptyState>
    );

  if (!data)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-14 w-3/4" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );

  const a = data.article;
  const style = SECTION_STYLE[a.section];
  const link = safeLink(a.link);
  const paragraphs = (a.content || a.description)
    .split(/\n{1,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const doDeep = async () => {
    setBusy('deep');
    try {
      await api.deepRead(id);
      toast('Deep read complete. Article enriched.', 'success');
      await load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const doAI = async () => {
    setBusy('ai');
    try {
      const r = await api.aiEnhance(id);
      toast(`AI added ${r.added} new questions.`, 'success');
      await load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="space-y-10">
      <motion.div className="fixed left-0 right-0 top-0 z-50 h-1.5 origin-left bg-mauve" style={{ scaleX: progress }} />

      <header className="relative">
        <Link to={`/news/${a.section}`} className="btn-subtle relative -ml-3 mb-4 px-3">
          <ArrowLeft className="h-4 w-4" /> {meta?.sections.find((s) => s.key === a.section)?.label ?? 'News'}
        </Link>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative flex flex-wrap items-center gap-2">
          <SectionBadge section={a.section} />
          <SourceBadge source={a.source} />
          {a.deep && <span className="chip !py-0.5"><Waves className="h-3 w-3" /> Full text</span>}
          {a.ai && <span className="chip !py-0.5"><Sparkles className="h-3 w-3" /> AI enhanced</span>}
          <span className="dateline flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {fmtDate(a.publishedAt)} · {timeAgo(a.publishedAt)} · {a.readingTime} min read
          </span>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative mt-5 max-w-5xl font-display text-4xl font-black leading-[1.05] text-white sm:text-6xl"
        >
          {a.title}
        </motion.h1>
        <div className="relative mt-5 flex items-center gap-3">
          {a.author && <span className="font-condensed text-xs font-semibold uppercase tracking-[0.2em] text-mauve">By {a.author}</span>}
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="h-[3px] flex-1 origin-left bg-mauve"
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <motion.figure
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            className="group relative h-64 overflow-hidden border-2 border-mauve bg-ink-900 shadow-hard sm:h-80"
          >
            {a.image && !imgBroken ? (
              <img src={a.image} alt="" referrerPolicy="no-referrer" className="photo h-full w-full object-cover" onError={() => setImgBroken(true)} />
            ) : (
              <StoryArt seed={a.id} section={a.section} title={a.title} />
            )}
            <figcaption className="absolute bottom-0 left-0 bg-mauve px-3 py-1 font-condensed text-[11px] font-semibold uppercase tracking-[0.2em] text-peach">
              {a.image && !imgBroken ? 'Photo' : 'Illustration'} · {style.subject}
            </figcaption>
          </motion.figure>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden rounded-2xl border-2 border-mauve bg-mauve p-6 shadow-hard-bronze"
          >
            <div className="label mb-2 flex items-center gap-2 !text-bronze">
              <Lightbulb className="h-4 w-4" /> In brief
            </div>
            <p className="font-display text-xl font-bold italic leading-snug text-peach">{a.summary.tldr}</p>
          </motion.div>

          {a.summary.points.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-6">
              <h2 className="mb-4 font-display text-lg font-extrabold text-white">Key points</h2>
              <ul className="space-y-3">
                {a.summary.points.map((p, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.07 }}
                    className="flex gap-3 text-slate-300"
                  >
                    <span className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center border-2 border-mauve', style.tile)}>
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                    <span>{p}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}

          <div className="card p-6">
            <h2 className="mb-4 font-display text-lg font-extrabold text-white">{a.deep ? 'Full story' : 'From the report'}</h2>
            <div className="space-y-4 text-[17px] leading-relaxed text-slate-300 md:columns-2 md:gap-10 md:[column-rule:1px_solid_#111111]">
              {paragraphs.map((p, i) => (
                <p key={i} className={i === 0 ? 'dropcap' : undefined}>
                  {p}
                </p>
              ))}
            </div>
          </div>

          {sourceCredit(a.source) && (
            <p className="mt-6 text-sm italic text-slate-500">
              Source: {sourceCredit(a.source)} · {fmtDate(a.publishedAt)}. Summary and questions by NewsQuest, based on the original release.
            </p>
          )}

          {link && (
            <div className="mt-6 flex flex-wrap gap-2 border-t-2 border-mauve/15 pt-5">
              <a href={link} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                Read original release <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          )}

          {data.canDeepRead && (
            <button onClick={doDeep} disabled={busy !== null} className="btn-ghost" title="Fetch the full article text to improve the summary and questions">
              {busy === 'deep' ? <Spinner className="h-4 w-4" /> : <Waves className="h-4 w-4" />} Deep read
            </button>
          )}

          {data.canAi && user && (
            <button onClick={doAI} disabled={busy !== null} className="btn-ghost">
              {busy === 'ai' ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />} Generate AI questions
            </button>
          )}

          {a.isDemo && <span className="self-center text-xs text-slate-500">Demo Archive story — a curated sample shown while live feeds are unavailable.</span>}
        </div>

        <aside className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card relative overflow-hidden p-6 lg:sticky lg:top-24"
          >
            <div className="relative flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-mauve bg-bronze shadow-hard-sm">
                <BrainCircuit className="h-6 w-6 text-mauve" />
              </div>
              <div>
                <div className="font-display text-4xl font-black text-white">{data.questions.total}</div>
                <div className="text-xs font-medium text-slate-400">questions from this story</div>
              </div>
            </div>

            <div className="relative mt-5 flex h-3.5 overflow-hidden border-2 border-mauve bg-ink-900">
              {(Object.keys(diffCounts) as Difficulty[]).map((d) =>
                diffCounts[d] ? (
                  <motion.div
                    key={d}
                    initial={{ width: 0 }}
                    animate={{ width: `${(diffCounts[d] / Math.max(1, data.questions.total)) * 100}%` }}
                    transition={{ duration: 0.9, delay: 0.3 }}
                    style={{ background: DIFFICULTY_STYLE[d].color }}
                  />
                ) : null
              )}
            </div>

            <div className="relative mt-3 flex flex-wrap gap-1.5">
              {(Object.keys(diffCounts) as Difficulty[]).map((d) =>
                diffCounts[d] ? (
                  <span key={d} className="flex items-center gap-1 text-xs text-slate-400">
                    <DifficultyBadge d={d} /> ({diffCounts[d]})
                  </span>
                ) : null
              )}
            </div>

            <div className="relative mt-4 flex flex-wrap gap-1.5">
              {typeCounts.map(([t, n]) => (
                <span key={t} className="rounded-md bg-mauve/10 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                  {meta?.questionTypes[t] ?? t} · ({n})
                </span>
              ))}
            </div>

            <button
              onClick={() => start({ mode: 'article', articleId: a.id })}
              disabled={starting || !data.questions.total}
              className="btn-cta mt-5 w-full !px-4"
            >
              {starting ? <Spinner className="h-5 w-5" /> : <Swords className="h-5 w-5" />} Quiz me on this story
              <ArrowRight className="cta-arrow h-5 w-5" />
            </button>
          </motion.div>

          {a.keywords.length > 0 && (
            <div className="card p-6">
              <h3 className="mb-3 flex items-center gap-2 font-display font-semibold text-white">
                <Tags className="h-4 w-4 text-sky-300" /> Keywords
              </h3>
              <div className="flex flex-wrap gap-2">
                {a.keywords.map((k) => (
                  <Link key={k.text} to={`/news?q=${encodeURIComponent(k.text)}`} className="rounded-lg border-2 border-mauve bg-ink-900 px-2.5 py-1 text-xs font-bold text-mauve transition hover:bg-mauve hover:text-peach">
                    #{k.text}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {entityGroups.length > 0 && (
            <div className="card space-y-4 p-6">
              <h3 className="font-display font-semibold text-white">In this story</h3>
              {entityGroups.map(([type, list]) => (
                <div key={type}>
                  <div className="label mb-1.5">{ENTITY_LABEL[type] ?? type}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((t) => (
                      <span key={t} className="rounded-lg border-2 border-mauve/40 bg-ink-900 px-2 py-0.5 text-xs font-medium text-slate-200">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {data.related.length > 0 && (
        <section>
          <h2 className="mb-5 font-display text-2xl font-bold text-white">Related coverage</h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {data.related.map((r, i) => (
              <ArticleCard key={r.id} a={r} index={i} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}