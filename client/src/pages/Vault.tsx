import { AnimatePresence, motion } from 'framer-motion';
import { Bookmark, CheckCircle2, ChevronDown, Circle, Download, ExternalLink, Filter, GraduationCap, Play, StickyNote, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QuestionBody, QuestionOptions as Options } from '../components/QuestionView';
import { DifficultyBadge, EmptyState, PageHeader, ProgressRing, SectionBadge, Skeleton, Spinner, sectionLabel } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';
import { cx, timeAgo } from '../lib/format';
import { DIFFICULTY_STYLE, PALETTE, SECTION_ORDER } from '../lib/sections';
import type { Difficulty, SectionKey, VaultItem } from '../lib/types';
import { useStartQuiz } from '../lib/useStartQuiz';

type Filters = { section?: SectionKey; difficulty?: Difficulty; type?: string; mastered?: '0' | '1' };

function Item({ it, index, onChange, onRemove }: { it: VaultItem; index: number; onChange: (it: VaultItem) => void; onRemove: () => void }) {
  const { toast, achievements } = useToast();
  const { meta } = useLive();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(it.note);
  const [savingNote, setSavingNote] = useState(false);
  const q = it.question;
  const link = q?.source?.link && /^https:\/\/v\//.test(q.source.link) ? q.source.link : null;

  const patch = async (p: { note?: string; mastered?: boolean }) => {
    try {
      const r = await api.updateSaved(it.questionId, p);
      onChange({ ...it, ...p });
      achievements(r.achievements);
      return true;
    } catch (e) {
      toast((e as Error).message, 'error');
      return false;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40, transition: { duration: 0.2 } }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className={cx('card overflow-hidden', it.mastered && '!border-emerald-400/25')}
    >
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={() => patch({ mastered: !it.mastered })}
          aria-label={it.mastered ? 'Mark as not mastered' : 'Mark as mastered'}
          className="shrink-0 text-slate-500 transition hover:text-emerald-300"
        >
          {it.mastered ? <CheckCircle2 className="h-6 w-6 text-emerald-400" /> : <Circle className="h-6 w-6" />}
        </button>
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className={cx('line-clamp-2 flex-1 text-sm', it.mastered ? 'text-slate-400' : 'text-slate-100')}>
            {q?.prompt ?? 'This question is no longer available.'}
          </span>
          <span className="hidden shrink-0 items-center gap-2 md:flex">
            <SectionBadge section={it.section} />
            <DifficultyBadge d={it.difficulty} />
          </span>
          <motion.span animate={{ rotate: open ? 180 : 0 }}>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </motion.span>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && q && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="space-y-4 border-t-2 border-mauve p-5">
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span className="chip !py-0.5 !text-[11px]">{meta?.questionTypes[q.type] ?? q.type}</span>
                <span>Saved {timeAgo(it.savedAt)}</span>
                {it.attempts > 0 && (
                  <span>
                    • Practised ({it.attempts}) ({it.correct} correct)
                  </span>
                )}
              </div>
              <QuestionBody q={q} compact />
              <Options q={q} answer={q.answer} compact />
              <div className="rounded-xl border-2 border-mauve bg-success p-3 text-sm text-mauve">
                <b>Why:</b> <span className="whitespace-pre-line">{q.explanation}</span>
              </div>
              <div>
                <label className="label mb-1.5 flex items-center gap-1.5" htmlFor={`note-${it.questionId}`}>
                  <StickyNote className="h-3.5 w-3.5" /> Your note
                </label>
                <textarea
                  id={`note-${it.questionId}`}
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Mnemonic, related fact, page reference..."
                  className="input resize-y"
                />
                {note !== it.note && (
                  <button
                    onClick={async () => {
                      setSavingNote(true);
                      if (await patch({ note })) toast('Note saved', 'success');
                      setSavingNote(false);
                    }}
                    className="btn-subtle mt-2 text-xs"
                  >
                    {savingNote && <Spinner className="h-3 w-3" />} Save note
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/article/${q.articleId}`} className="btn-ghost !py-1.5 text-xs">
                  Read the story
                </Link>
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="btn-ghost !py-1.5 text-xs">
                    Source <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  onClick={async () => {
                    try {
                      await api.unsave(it.questionId);
                      onRemove();
                    } catch (e) {
                      toast((e as Error).message, 'error');
                    }
                  }}
                  className="btn-ghost ml-auto !py-1.5 text-xs hover:!bg-danger hover:!text-black"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function VaultPage() {
  const { user, loading: authLoading } = useAuth();
  const { meta } = useLive();
  const { start, starting } = useStartQuiz();
  const [filters, setFilters] = useState<Filters>({});
  const [data, setData] = useState<{ items: VaultItem[]; total: number; mastered: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    api
      .vault(filters)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ items: [], total: 0, mastered: 0 }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [user?.id, filters]);

  const practiceIds = useMemo(() => (data?.items ?? []).filter((i) => i.question && !i.mastered).map((i) => i.questionId), [data]);
  const set = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v || undefined }));

  if (authLoading || !user) {
    return (
      <EmptyState icon={<Bookmark className="h-6 w-6" />} title="Your Vault is empty">
        Play a quiz and tap <b>Save to Vault</b> on any question to build your revision deck.{' '}
        <Link to="/arena" className="text-violet-300 hover:underline">
          Go to the Arena
        </Link>
      </EmptyState>
    );
  }

  const masteredFrac = data && data.total ? data.mastered / data.total : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Revision deck"
        title={
          <>
            Question <span className="text-accent">Vault</span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={api.exportUrl('csv')} className="btn-ghost text-sm">
              <Download className="h-4 w-4" /> CSV
            </a>
            <a href={api.exportUrl('json')} className="btn-ghost text-sm">
              <Download className="h-4 w-4" /> JSON
            </a>
          </div>
        }
      >
        Saved questions for exam prep. Practise untimed; answer a question right 3 times in practice to master it automatically.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card flex flex-col items-center p-6 text-center">
            <ProgressRing value={masteredFrac} size={140} stroke={14} color={PALETTE.mauve} />
            <div>
              <div className="font-display text-4xl font-black text-white">{data?.mastered ?? 0}</div>
              <div className="text-[11px] font-medium text-slate-400">of {data?.total ?? 0} mastered</div>
            </div>
          </motion.div>
          <button
            disabled={!practiceIds.length || starting}
            onClick={() => start({ mode: 'practice', questionIds: practiceIds.slice(0, 30) })}
            className="btn-cta mt-6 w-full !px-4 !text-sm !tracking-[0.12em]"
          >
            {starting ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            Practise ({Math.min(practiceIds.length, 30)}) unmastered
          </button>
          <p className="mt-2 text-[11px] text-slate-500">Uses the filters below.</p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card space-y-4 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Filter className="h-4 w-4 text-violet-300" /> Filters
            </div>
            <div>
              <label className="block">
                <span className="label mb-1 block">Section</span>
                <select className="input" value={filters.section ?? ''} onChange={(e) => set('section', e.target.value)}>
                  <option value="">All sections</option>
                  {SECTION_ORDER.map((k) => (
                    <option key={k} value={k}>
                      {sectionLabel(k)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <label className="block">
                <span className="label mb-1 block">Difficulty</span>
                <select className="input" value={filters.difficulty ?? ''} onChange={(e) => set('difficulty', e.target.value)}>
                  <option value="">Any</option>
                  {(Object.keys(DIFFICULTY_STYLE) as Difficulty[]).map((d) => (
                    <option key={d} value={d}>
                      {DIFFICULTY_STYLE[d].label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <label className="block">
                <span className="label mb-1 block">Question type</span>
                <select className="input" value={filters.type ?? ''} onChange={(e) => set('type', e.target.value)}>
                  <option value="">All types</option>
                  {Object.entries(meta?.questionTypes ?? {}).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <span className="label mb-1 block">Status</span>
              <div className="grid grid-cols-3 gap-1 rounded-xl border-2 border-mauve bg-ink-900 p-1 text-xs">
                {(
                  [
                    ['', 'All'],
                    ['0', 'Learning'],
                    ['1', 'Mastered'],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => set('mastered', v)}
                    className={cx('rounded-lg py-1.5 font-bold transition', (filters.mastered ?? '') === v ? 'bg-mauve text-peach' : 'text-slate-300 hover:bg-sage hover:text-white')}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </aside>

        <section className="space-y-3">
          {loading && !data ? (
            Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
          ) : data && data.items.length ? (
            <AnimatePresence initial={false}>
              {data.items.map((it, i) => (
                <Item
                  key={it.questionId}
                  it={it}
                  index={i}
                  onChange={(n) =>
                    setData((d) =>
                      d
                        ? {
                            ...d,
                            items: d.items.map((x) => (x.questionId === n.questionId ? n : x)),
                            mastered: d.mastered + (n.mastered === it.mastered ? 0 : n.mastered ? 1 : -1),
                          }
                        : d
                    )
                  }
                  onRemove={() =>
                    setData((d) =>
                      d
                        ? {
                            ...d,
                            items: d.items.filter((x) => x.questionId !== it.questionId),
                            total: d.total - 1,
                            mastered: d.mastered - (it.mastered ? 1 : 0),
                          }
                        : d
                    )
                  }
                />
              ))}
            </AnimatePresence>
          ) : (
            <EmptyState icon={<GraduationCap className="h-6 w-6" />} title={Object.keys(filters).some((k) => filters[k as keyof Filters]) ? 'Nothing matches these filters' : 'Nothing saved yet'}>
              Save questions from any quiz review to revise them here.{' '}
              <Link to="/arena" className="text-violet-300 hover:underline">
                Play a quiz
              </Link>
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}