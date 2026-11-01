import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BrainCircuit } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLive } from '../contexts/LiveContext';
import { cx, timeAgo } from '../lib/format';
import { SECTION_STYLE } from '../lib/sections';
import type { ArticleCard } from '../lib/types';
import { useStartQuiz } from '../lib/useStartQuiz';
import { StoryArt } from './StoryArt';
import { SectionBadge, SourceBadge, Spinner, sectionLabel } from './ui';

const PAGES = 5;
const ROTATE_MS = 7000;
const TICK_MS = 100;
const EXIT_S = 0.25;
const PRINT_S = 0.85;
const EASE = [0.65, 0, 0.35, 1] as const;

export function FrontPage({ stories }: { stories: ArticleCard[] | null }) {
  const { status } = useLive();
  const { start, starting } = useStartQuiz();
  const reduced = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const [turn, setTurn] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());

  const pages = (stories ?? []).slice(0, PAGES);
  const n = pages.length;
  const auto = !reduced && n > 1;
  const cur = n ? idx % n : 0;
  const lead = n ? pages[cur] : null;
  const more = n > 2 ? [pages[(cur + 1) % n], pages[(cur + 2) % n]] : n === 2 ? [pages[(cur + 1) % n]] : [];

  useEffect(() => {
    if (!auto || paused) return;
    const t = window.setInterval(() => {
      if (!document.hidden) setElapsed((e) => e + TICK_MS);
    }, TICK_MS);
    return () => window.clearInterval(t);
  }, [auto, paused]);

  useEffect(() => {
    if (elapsed < ROTATE_MS || !n) return;
    setIdx((i) => (i + 1) % n);
    setTurn((t) => t + 1);
    setElapsed(0);
  }, [elapsed, n]);

  const go = (i: number) => {
    if (i === cur) return;
    setIdx(i);
    setTurn((t) => t + 1);
    setElapsed(0);
  };

  const date = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const style = lead ? SECTION_STYLE[lead.section] : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.08, rotate: -720 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div aria-hidden className="absolute inset-0 translate-x-1.5 translate-y-3 rotate-[1.5deg] border-2 border-mauve bg-sage sm:translate-x-3 sm:rotate-[3deg]" />
      <div aria-hidden className="absolute inset-0 -translate-x-1 translate-y-1 -rotate-1 border-2 border-mauve bg-bronze sm:-translate-x-2 sm:-rotate-2" />

      <article aria-label="Today's front page" className="relative border-2 border-mauve bg-sage p-4 shadow-hard-lg sm:p-5">
        <div className="dateline flex justify-between gap-2 whitespace-nowrap border-b border-mauve pb-1 !text-[11px] !tracking-wider">
          <span>
            Late <span className="hidden sm:inline">city </span>edition
          </span>
          <span className="hidden sm:inline">{date}</span>
          <span>
            <span className="hidden sm:inline">{status?.mode === 'live' ? 'Live wires' : 'Demo archive'} · </span>
            {status?.intervalMinutes ?? 15} min
          </span>
        </div>

        <div className="py-1.5 text-center">
          <span className="nameplate text-[length:clamp(1.5rem,8vw,2.6rem)] sm:text-5xl">The NewsQuest</span>
        </div>

        <div className="border-t-[3px] border-mauve" />
        <div className="mt-[2px] border-t border-mauve" />

        {!lead ? (
          stories === null ? (
            <div className="mt-4 space-y-3" aria-hidden>
              <div className="skeleton h-4 w-28" />
              <div className="skeleton h-7 w-full" />
              <div className="skeleton h-7 w-4/5" />
              <div className="grid grid-cols-[40%_1fr] gap-3">
                <div className="skeleton h-32" />
                <div className="space-y-2">
                  {[100, 92, 96, 80, 88].map((w) => (
                    <div key={w} className="skeleton h-3" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="py-20 text-center italic text-slate-500">The presses are warming up - stories will appear here shortly.</p>
          )
        ) : (
          <div className="relative mt-3 min-h-[268px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={lead.id}
                initial={{ clipPath: 'inset(0% 0% 100% 0%)' }}
                animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
                exit={{ opacity: 0, transition: { duration: EXIT_S } }}
                transition={{ duration: PRINT_S, ease: EASE }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <SectionBadge section={lead.section} />
                  <SourceBadge source={lead.source} />
                  <span className="dateline ml-auto !text-[11px]">{timeAgo(lead.publishedAt)}</span>
                </div>

                <Link to={`/article/${lead.id}`} className="group mt-2 block">
                  <h2 className="line-clamp-3 font-display text-2xl font-black leading-[1.08] text-mauve sm:text-[1.7rem]">
                    <span className="headline-link">{lead.title}</span>
                  </h2>
                </Link>

                <div className="mt-3 grid grid-cols-[40%_1fr] gap-3">
                  <figure className="group relative h-28 overflow-hidden border-2 border-mauve bg-ink-900 sm:h-32">
                    {lead.image && !broken.has(lead.id) ? (
                      <img
                        src={lead.image}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="photo h-full w-full object-cover"
                        onError={() => setBroken((b) => new Set(b).add(lead.id))}
                      />
                    ) : (
                      <StoryArt seed={lead.id} section={lead.section} title={lead.title} />
                    )}
                    <figcaption className="absolute bottom-1.5 left-1.5 max-w-[90%] bg-mauve px-1.5 py-0.5 font-condensed text-[11px] font-semibold uppercase leading-tight tracking-wider text-peach">
                      {style?.subject}
                    </figcaption>
                  </figure>

                  <div className="flex min-w-0 flex-col">
                    <p className="line-clamp-max-h-[85px] overflow-hidden text-[13px] leading-[17px] text-slate-300 first-letter:float-left first-letter:mr-1 first-letter:mt-0.5 first-letter:font-display first-letter:font-black first-letter:text-[2.6rem] first-letter:font-black first-letter:leading-[0.8] first-letter:text-mauve sm:max-h-[102px]">
                      {lead.tldr || lead.description}
                    </p>
                    <Link to={`/article/${lead.id}`} className="dateline mt-auto pt-1 !text-[11px] !tracking-wider !text-mauve hover:underline">
                      Continued on page 2 →
                    </Link>
                  </div>
                </div>

                {turn > 0 && !reduced && (
                  <motion.div
                    key={turn}
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-10 h-1 bg-mauve"
                    initial={{ top: '0%', opacity: 1 }}
                    animate={{ top: '100%', opacity: [1, 1, 0] }}
                    transition={{ delay: EXIT_S, duration: PRINT_S, ease: EASE }}
                  />
                )}

                <div className="mt-3 flex items-center gap-3 bg-mauve px-3 py-2.5 text-peach">
                  <BrainCircuit className="h-6 w-6 shrink-0" />
                  <div className="min-w-0 flex-1 overflow-hidden leading-tight">
                    <motion.div key={lead.id} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-display text-xl font-black">
                      {lead.questionCount} {lead.questionCount === 1 ? 'question' : 'questions'}
                    </motion.div>
                    <div className="font-mono text-[11px] uppercase tracking-wider text-peach/90">printed from this story</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => start({ mode: 'article', articleId: lead.id })}
                    disabled={starting || !lead.questionCount}
                    className="btn-cta-invert shrink-0 !min-h-0 !px-4 !py-2 !text-sm"
                  >
                    {starting && <Spinner className="h-4 w-4" />} Quiz me <ArrowRight className="cta-arrow h-4 w-4" />
                  </button>
                </div>

                {more.length > 0 && (
                  <div className={cx('mt-3 grid border-y border-mauve', more.length > 1 && 'grid-cols-2 divide-x divide-mauve')}>
                    {more.map((m, i) => (
                      <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: EXIT_S, duration: 0.4 }}>
                        <Link to={`/article/${m.id}`} className={cx('group block py-2', i ? 'pl-3' : 'pr-3')}>
                          <div className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            {sectionLabel(m.section)} · {timeAgo(m.publishedAt)}
                          </div>
                          <div className="mt-0.5 line-clamp-2 font-display text-[15px] font-bold leading-snug text-mauve">
                            <span className="headline-link">{m.title}</span>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex gap-1" role="group" aria-label="Front page stories">
                    {pages.map((p, i) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => go(i)}
                        aria-label={`Story ${i + 1}: ${p.title}`}
                        aria-current={i === cur ? 'true' : undefined}
                        className={cx(
                          'grid h-7 w-7 place-items-center border-2 border-mauve font-mono text-xs font-bold transition-colors',
                          i === cur ? 'bg-mauve text-peach' : 'bg-sage text-mauve hover:bg-bronze',
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>

                  {auto && (
                    <div className="h-1 flex-1 bg-mauve/10" aria-hidden>
                      <div className="h-full bg-mauve" style={{ width: `${Math.min(100, (elapsed / ROTATE_MS) * 100)}%` }} />
                    </div>
                  )}
                  <span className="dateline ml-auto !text-[11px]">{auto ? (paused ? 'Paused' : 'Next story') : `P. ${cur + 1}/${n}`}</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </article>
    </motion.div>
  );
}