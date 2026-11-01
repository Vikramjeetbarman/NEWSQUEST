import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AchievementIcon } from '../components/AchievementBadge';
import { TIER_STYLE } from '../lib/sections';
import { sfx } from '../lib/sound';
import { stars } from '../lib/celebrate';
import type { Achievement } from '../lib/types';

type Kind = 'success' | 'error' | 'info';
type ToastBody = { kind: Kind; text: string } | { kind: 'achievement'; achievement: Achievement };
type Toast = ToastBody & { id: number };

interface ToastApi {
  toast: (text: string, kind?: Kind) => void;
  achievements: (list: Achievement[] | undefined) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (t: ToastBody, ms: number) => {
      const id = ++seq.current;
      setItems((l) => [...l.slice(-4), { ...t, id }]);
      window.setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast: (text, kind = 'info') => push({ kind, text }, kind === 'error' ? 6000 : 3800),
      achievements: (list) => {
        if (!list?.length) return;
        sfx.unlock();
        stars();
        list.forEach((a, i) => window.setTimeout(() => push({ kind: 'achievement', achievement: a }, 6500), i * 450));
      },
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-3" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="glass-strong pointer-events-auto relative overflow-hidden rounded-2xl p-4"
            >
              {t.kind === 'achievement' ? (
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ rotate: -30, scale: 0.4 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 0.1 }}
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-mauve p-[3px] ${TIER_STYLE[t.achievement.tier].ring}`}
                  >
                    <div className="grid h-full w-full place-items-center rounded-full border-2 border-mauve bg-ink-900">
                      <AchievementIcon name={t.achievement.icon} className={`h-5 w-5 ${TIER_STYLE[t.achievement.tier].text}`} />
                    </div>
                  </motion.div>
                  <div className="min-w-0">
                    <div className="label !text-wood-700">Achievement unlocked</div>
                    <div className="font-display font-bold text-white">{t.achievement.name}</div>
                    <div className="truncate text-xs text-slate-400">
                      {t.achievement.desc} • +{t.achievement.reward.xp} XP • +{t.achievement.reward.coins} coins
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 pr-5">
                  {t.kind === 'success' ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  ) : t.kind === 'error' ? (
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
                  ) : (
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
                  )}
                  <p className="text-sm text-slate-200">{t.text}</p>
                </div>
              )}
              <button
                onClick={() => dismiss(t.id)}
                className="absolute right-2 top-2 rounded-lg p-1 text-slate-500 hover:bg-mauve hover:text-peach"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast outside provider');
  return c;
}