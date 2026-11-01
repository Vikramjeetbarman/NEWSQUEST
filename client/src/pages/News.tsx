import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  BookText,
  Building2,
  CalendarDays,
  FileBarChart,
  Gavel,
  Hash,
  Layers,
  ListChecks,
  MapPin,
  Search,
  Swords,
  Users,
  Waypoints,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArticleCard, ArticleCardSkeleton } from '../components/ArticleCard';
import { WordCloud } from '../components/charts';
import { EmptyState, Skeleton, Spinner } from '../components/ui';
import { useLive } from '../contexts/LiveContext';
import { api } from '../lib/api';
import { cx, timeAgo } from '../lib/format';
import { SECTION_ORDER, SECTION_STYLE } from '../lib/sections';
import type { ArticleCard as Card, Digest, LensItem, SectionKey } from '../lib/types';
import { useStartQuiz } from '../lib/useStartQuiz';

const LENS: { key: keyof Omit<Digest['lens'], 'numbers'>; label: string; icon: LucideIcon }[] = [
  { key: 'persons', label: 'People', icon: Users },
  { key: 'places', label: 'Places', icon: MapPin },
  { key: 'organisations', label: 'Organisations', icon: Building2 },
  { key: 'schemes', label: 'Schemes & Missions', icon: Layers },
  { key: 'laws', label: 'Laws & Bills', icon: Gavel },
  { key: 'events', label: 'Events & Summits', icon: CalendarDays },
  { key: 'reports', label: 'Reports & Indices', icon: FileBarChart },
  { key: 'awards', label: 'Awards', icon: Award },
];

function LensGroup({ label, icon: Icon, items }: { label: string; icon: LucideIcon; items: LensItem[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <Link
            key={it.name}
            to={`/article/${it.articleId}`}
            title={it.headline}
            className="group rounded-xl border-2 border-mauve bg-ink-900 px-3 py-1.5 text-sm font-semibold text-slate-200 transition hover:bg-mauve hover:text-peach"
          >
            {it.name}
            {it.role && <span className="ml-1.5 text-xs font-normal text-slate-500 group-hover:text-sage"> ({it.role})</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

function DigestView({ digest, section }: { digest: Digest; section: SectionKey | 'all' }) {
  const { start, starting } = useStartQuiz();
  const hasLens = LENS.some((l) => digest.lens[l.key].length) || digest.lens.numbers.length;

  if (!digest.articleCount)
    return (
      <EmptyState icon={<BookText className="h-6 w-6" />} title="No stories here yet">
        New articles for this section will appear automatically when the next fetch cycle finds them.
      </EmptyState>
    );

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card relative overflow-hidden p-6 lg:col-span-2">
        <div className="relative mb-4 flex flex-wrap items-center gap-3">
          <ListChecks className="h-5 w-5 text-violet-300" />
          <h2 className="font-display text-xl font-bold text-white">The 60-second brief</h2>
          <span className="chip">{digest.articleCount} {digest.articleCount === 1 ? 'story' : 'stories'} analysed</span>
          <button
            onClick={() => start(section === 'all' ? { mode: 'classic', count: 10 } : { mode: 'classic', sections: [section], count: 10 })}
            disabled={starting}
            className="btn-cta ml-auto !min-h-0 !px-5 !py-2.5 !text-sm"
          >
            {starting ? <Spinner className="h-4 w-4" /> : <Swords className="h-4 w-4" />} Quiz this section
          </button>
        </div>
        <ol className="relative space-y-3">
          {digest.brief.map((b, i) => (
            <motion.li
              key={b.articleId}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex gap-3"
            >
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center border-2 border-mauve bg-mauve font-display text-xs font-black text-peach">
                {i + 1}
              </span>
              <Link to={`/article/${b.articleId}`} className="font-medium text-slate-200 decoration-bronze decoration-2 underline-offset-4 transition hover:text-white hover:underline">
                {b.text}
              </Link>
            </motion.li>
          ))}
        </ol>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Hash className="h-5 w-5 text-fuchsia-300" />
          <h2 className="font-display text-xl font-bold text-white">Key themes</h2>
        </div>
        <WordCloud words={digest.themes.map((t) => ({ term: t.term, weight: t.count * 2 + t.weight }))} linkTo={(t) => `/news?q=${encodeURIComponent(t)}`} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-6 lg:col-span-2">
        <div className="mb-5 flex items-center gap-2">
          <Waypoints className="h-5 w-5 text-sky-300" />
          <h2 className="font-display text-xl font-bold text-white">Topic-wise storylines</h2>
        </div>
        <div className="relative space-y-5 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[2px] before:bg-mauve">
          {digest.storylines.map((s, i) => (
            <motion.div
              key={s.label + i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="relative pl-9"
            >
              <span className="absolute left-0 top-1 grid h-6 w-6 place-items-center rounded-full border-2 border-mauve bg-bronze">
                <span className="h-2 w-2 rounded-full bg-mauve" />
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-bold text-white">{s.label}</h3>
                {s.size > 1 && <span className="chip !py-0.5">{s.size} stories</span>}
                <span className="text-xs text-slate-500">{timeAgo(s.latest)}</span>
              </div>
              <p className="mt-1 text-sm text-slate-400">{s.summary}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {s.articles.map((a) => (
                  <Link key={a.id} to={`/article/${a.id}`} className="rounded-lg border-2 border-mauve/30 bg-ink-900 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-mauve hover:bg-mauve hover:text-peach">
                    {a.title.length > 70 ? `${a.title.slice(0, 70)}...` : a.title}
                  </Link>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
        <div className="mb-4 flex items-center gap-2">
          <FileBarChart className="h-5 w-5 text-amber-300" />
          <h2 className="font-display text-xl font-bold text-white">By the numbers</h2>
        </div>
        {digest.lens.numbers.length ? (
          <div className="space-y-3">
            {digest.lens.numbers.map((n, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/article/${n.articleId}`} className="card-hover block rounded-xl border-2 border-mauve bg-peach p-3 shadow-hard-sm">
                  <div className="font-display text-2xl font-black text-white">{n.value}</div>
                  <div className="mt-0.5 line-clamp-2 text-xs font-medium text-slate-300">{n.context}</div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No standout figures in this batch.</p>
        )}
      </motion.div>

      {hasLens && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card p-6 lg:col-span-3">
          <div className="mb-5 flex items-center gap-2">
            <Award className="h-5 w-5 text-emerald-300" />
            <h2 className="font-display text-xl font-bold text-white">Exam lens</h2>
            <span className="text-sm text-slate-500">— who, where and what to remember</span>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {LENS.map((l) => (
              <LensGroup key={l.key} label={l.label} icon={l.icon} items={digest.lens[l.key]} />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function NewsPage() {
  const params = useParams();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const { meta, newsVersion } = useLive();
  const section = (SECTION_ORDER as string[]).includes(params.section ?? '') ? (params.section as SectionKey) : null;
  const q = sp.get('q') ?? '';
  const [search, setSearch] = useState(q);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [items, setItems] = useState<Card[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setSearch(q), [q]);

  useEffect(() => {
    setDigest(null);
    if (q) return;
    api.digest(section ?? 'all').then(setDigest, (e) => setError(e.message));
  }, [section, q, newsVersion]);

  useEffect(() => {
    setItems(null);
    api.news({ section: section ?? undefined, q: q || undefined, limit: 24 }).then(
      (r) => {
        setItems(r.items);
        setTotal(r.total);
      },
      (e) => setError(e.message),
    );
  }, [section, q, newsVersion]);

  const loadMore = async () => {
    if (!items) return;
    setLoadingMore(true);
    try {
      const r = await api.news({ section: section ?? undefined, q: q || undefined, limit: 24, offset: items.length });
      setItems([...items, ...r.items]);
    } finally {
      setLoadingMore(false);
    }
  };

  const info = useMemo(() => meta?.sections.find((s) => s.key === section), [meta, section]);
  const style = section ? SECTION_STYLE[section] : null;
  const Icon = style?.icon;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = search.trim();
    setSp(v ? { q: v } : {});
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={section ?? 'all'}
              initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className={cx('grid h-14 w-14 place-items-center rounded-2xl', style?.tile ?? 'bg-bronze text-mauve')}
            >
              {Icon ? <Icon className="h-7 w-7" /> : <Layers className="h-7 w-7" />}
            </motion.div>
          </AnimatePresence>
          <div>
            <div className="label">{style ? style.subject : 'All sections'}</div>
            <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">{q ? `Results for "${q}"` : (info?.label ?? "Today's News")}</h1>
            <p className="text-sm text-slate-400">{q ? `${total} matching ${total === 1 ? 'story' : 'stories'}` : (info?.blurb ?? 'Topic-wise summaries across every section, refreshed automatically.')}</p>
          </div>
        </div>
        <form onSubmit={submit} className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search headlines..." className="input !pl-10 !pr-9" maxLength={80} />
          {q && (
            <button type="button" onClick={() => setSp({})} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-white" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
      </motion.div>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1">
          {[null, ...SECTION_ORDER].map((k) => {
            const active = k === section;
            const st = k ? SECTION_STYLE[k] : null;
            const TabIcon = st?.icon ?? Layers;
            const label = k ? (meta?.sections.find((s) => s.key === k)?.label ?? k) : 'All';
            return (
              <button
                key={k ?? 'all'}
                onClick={() => nav(k ? `/news/${k}${q ? `?q=${encodeURIComponent(q)}` : ''}` : `/news${q ? `?q=${encodeURIComponent(q)}` : ''}`)}
                className={cx(
                  'relative flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-bold transition-colors',
                  active ? 'border-mauve text-peach' : 'border-transparent text-slate-300 hover:border-mauve hover:text-white',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="section-tab"
                    className="absolute -inset-[2px] rounded-xl bg-mauve shadow-[3px_3px_0_0_#8A857B]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className={cx('relative grid h-5 w-5 place-items-center rounded-md border-2 border-mauve', st?.tile ?? 'bg-bronze text-mauve')}>
                  <TabIcon className="h-3 w-3" />
                </span>
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <div className="card !bg-danger-p4 text-sm font-semibold text-black">{error}</div>}

      {!q && (
        digest ? (
          <DigestView digest={digest} section={section ?? 'all'} />
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            <Skeleton className="h-72 lg:col-span-2" />
            <Skeleton className="h-72" />
          </div>
        )
      )}

      <section>
        {!q && (
          <div className="mb-5 flex items-center gap-2">
            <BookText className="h-5 w-5 text-slate-400" />
            <h2 className="font-display text-xl font-bold text-white">All stories</h2>
            <span className="text-sm text-slate-500">({total})</span>
          </div>
        )}
        {items === null ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <ArticleCardSkeleton key={i} />
            ))}
          </div>
        ) : items.length ? (
          <>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {items.map((a, i) => (
                <ArticleCard key={a.id} a={a} index={(i % 24)} />
              ))}
            </div>
            {items.length < total && (
              <div className="mt-8 text-center">
                <button onClick={loadMore} disabled={loadingMore} className="btn-ghost">
                  {loadingMore && <Spinner className="h-4 w-4" />} Load more stories
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyState icon={<Search className="h-6 w-6" />} title="Nothing found">
            Try a different keyword or section.
          </EmptyState>
        )}
      </section>
    </div>
  );
}