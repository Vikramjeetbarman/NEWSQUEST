import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { BrainCircuit, Clock, Sparkles } from 'lucide-react';
import { useState, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { SECTION_STYLE } from '../lib/sections';
import { cx, timeAgo } from '../lib/format';
import type { ArticleCard as Card } from '../lib/types';
import { StoryArt } from './StoryArt';
import { SectionBadge, SourceBadge } from './ui';

export function ArticleCard({ a, index = 0, featured = false }: { a: Card; index?: number; featured?: boolean }) {
  const style = SECTION_STYLE[a.section];
  const [broken, setBroken] = useState(false);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [5, -5]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(mx, [0, 1], [-5, 5]), { stiffness: 200, damping: 20 });

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cx('group relative', featured && 'md:col-span-2')}
    >
      <Link
        to={`/article/${a.id}`}
        className="card card-hover relative flex h-full flex-col overflow-hidden"
      >
        <div className={cx('relative overflow-hidden border-b-2 border-mauve bg-ink-900', featured ? 'h-56' : 'h-36')}>
          {a.image && !broken ? (
            <img
              src={a.image}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="photo h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              onError={() => setBroken(true)}
            />
          ) : (
            <>
              <StoryArt seed={a.id} section={a.section} title={a.title} className="transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute bottom-2 left-2 max-w-[80%] bg-mauve px-2 py-0.5 font-condensed text-[11px] font-semibold uppercase tracking-[0.14em] text-peach">
                {style.subject}
              </div>
            </>
          )}
          <div className="absolute left-3 top-3 flex gap-1.5">
            <SourceBadge source={a.source} />
            {a.ai && (
              <span className="flex items-center gap-1 border-2 border-mauve bg-mauve px-2 py-0.5 font-condensed text-[11px] font-semibold uppercase tracking-wider text-peach">
                <Sparkles className="h-3 w-3" /> AI
              </span>
            )}
          </div>
        </div>
        <div className="relative flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-center gap-2 border-b border-mauve/25 pb-2">
            <SectionBadge section={a.section} />
            <span className="dateline ml-auto flex items-center gap-1 !text-[11px]">
              <Clock className="h-3 w-3" /> {timeAgo(a.publishedAt)}
            </span>
          </div>
          <h3 className={cx('font-display font-black leading-tight text-white', featured ? 'text-2xl sm:text-3xl' : 'text-lg')}>
            <span className="headline-link">{a.title}</span>
          </h3>
          <p
            className={cx(
              'text-sm leading-relaxed text-slate-400',
              featured
                ? 'line-clamp-4 first-letter:float-left first-letter:mr-1.5 first-letter:mt-1 first-letter:font-display first-letter:text-5xl first-letter:font-black first-letter:leading-[0.8] first-letter:text-mauve'
                : 'line-clamp-2',
            )}
          >
            {a.tldr || a.description}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
            {a.keywords.slice(0, featured ? 4 : 2).map((k) => (
              <span key={k} className="font-mono text-[11px] text-slate-500">
                #{k}
              </span>
            ))}
            <span className="ml-auto flex items-center gap-1 bg-mauve px-2 py-0.5 font-condensed text-[11px] font-semibold uppercase tracking-wider text-peach">
              <BrainCircuit className="h-3 w-3" /> {a.questionCount} Qs
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function ArticleCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton h-36 rounded-none" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-5 w-full" />
        <div className="skeleton h-4 w-4/5" />
      </div>
    </div>
  );
}