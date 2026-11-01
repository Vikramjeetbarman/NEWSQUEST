import { AnimatePresence, motion } from 'framer-motion';
import { Check, Quote, X } from 'lucide-react';
import { LETTERS, cx } from '../lib/format';
import type { PublicQuestion } from '../lib/types';

interface Props {
  q: PublicQuestion;
  removed?: number[];
  selected?: number | null;
  answer?: number | null;
  onSelect?: (i: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function QuestionBody({ q, compact }: { q: PublicQuestion; compact?: boolean }) {
  return (
    <div className="space-y-4">
      <h2 className={cx('font-display font-black leading-snug text-white', compact ? 'text-lg' : 'text-2xl sm:text-3xl')}>
        {q.prompt}
      </h2>
      {q.context && (
        <div className="relative border-1-[6px] border-mauve bg-ink-900 py-4 pl-10 pr-4 text-base italic leading-relaxed text-slate-300">
          <Quote className="absolute left-3 top-4 h-5 w-5 fill-mauve text-mauve" />
          <span>{q.context}</span>
        </div>
      )}
      {q.statements && (
        <ol className="space-y-2">
          {q.statements.map((s, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex gap-3 border-2 border-mauve bg-ink-900 p-3 text-sm text-slate-200"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center bg-mauve font-condensed text-xs font-semibold text-peach">{i + 1}</span>
              <span>{s}</span>
            </motion.li>
          ))}
        </ol>
      )}
      {q.pairs && (
        <div className="grid grid-cols-2 gap-[2px] overflow-hidden border-2 border-mauve bg-mauve text-sm">
          <div className="bg-mauve px-3 py-2 font-condensed text-xs font-semibold uppercase tracking-[0.16em] text-peach">List I · In the news</div>
          <div className="bg-wood px-3 py-2 font-condensed text-xs font-semibold uppercase tracking-[0.16em] text-peach">List II · Context</div>
          {q.pairs.left.map((l, i) => (
            <div key={i} className="contents">
              <div className="bg-ink-900 px-3 py-2.5 font-medium text-slate-200">
                <b className="mr-2 font-display text-mauve">{LETTERS[i]}</b>
                {l}
              </div>
              <div className="bg-ink-900 px-3 py-2.5 text-slate-300">
                <b className="mr-2 font-display text-mauve">{i + 1}.</b>
                {q.pairs!.right[i]}
              </div>
            </div>
          ))}
        </div>
      )}
      {q.ask && <p className="text-sm font-bold text-slate-300">{q.ask}</p>}
    </div>
  );
}

export function QuestionOptions({ q, removed = [], selected = null, answer = null, onSelect, disabled, compact }: Props) {
  const revealed = answer !== null && answer !== undefined;
  return (
    <div className={cx('grid gap-3', q.options.length > 2 && !compact ? 'sm:grid-cols-2' : '')}>
      <AnimatePresence initial={false}>
        {q.options.map((opt, i) => {
          if (removed.includes(i)) {
            return (
              <motion.div
                key={`removed-${i}`}
                initial={{ opacity: 1 }}
                animate={{ opacity: 0.25, scale: 0.97 }}
                className="border-2 border-dashed border-mauve/40 px-4 py-3.5 text-sm text-slate-600 line-through"
              >
                {opt}
              </motion.div>
            );
          }
          const isAnswer = revealed && i === answer;
          const isWrongPick = revealed && i === selected && i !== answer;
          return (
            <motion.button
              key={i}
              type="button"
              disabled={disabled || revealed}
              onClick={() => onSelect?.(i)}
              initial={{ opacity: 0, y: 12 }}
              animate={
                isWrongPick
                  ? { opacity: 1, y: 0, x: [0, -10, 10, -6, 6, 0] }
                  : isAnswer
                  ? { opacity: 1, y: 0, scale: [1, 1.04, 1] }
                  : { opacity: revealed ? 0.5 : 1, y: 0 }
              }
              transition={{ delay: revealed ? 0 : i * 0.06, duration: isWrongPick ? 0.45 : 0.35 }}
              whileHover={!revealed && !disabled ? { y: -2, scale: 1.01 } : undefined}
              whileTap={!revealed && !disabled ? { scale: 0.98 } : undefined}
              className={cx(
                'group relative flex items-center gap-3 overflow-hidden border-2 border-mauve px-4 text-left text-[15px] transition-[background-color,box-shadow]',
                compact ? 'py-2.5' : 'py-3.5',
                isAnswer
                  ? 'bg-mauve font-semibold text-peach shadow-hollow'
                  : isWrongPick
                  ? 'hatch bg-danger text-black shadow-hard'
                  : selected === i
                  ? 'bg-bronze text-mauve shadow-hard'
                  : 'bg-ink-900 text-slate-200 shadow-hard-sm hover:bg-sage hover:shadow-hard',
              )}
            >
              <span
                className={cx(
                  'grid h-7 w-7 shrink-0 place-items-center border-2 font-display text-sm font-black transition-colors',
                  isAnswer ? 'border-peach bg-peach text-mauve' : isWrongPick ? 'border-mauve bg-mauve text-peach' : 'border-mauve bg-sage text-mauve group-hover:bg-mauve group-hover:text-peach',
                )}
              >
                {isAnswer ? <Check className="h-4 w-4" /> : isWrongPick ? <X className="h-4 w-4" /> : LETTERS[i]}
              </span>
              <span className={cx('leading-snug', isWrongPick && 'line-through decoration-2')}>{opt}</span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}