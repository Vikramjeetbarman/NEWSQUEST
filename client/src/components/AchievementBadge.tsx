import { motion } from 'framer-motion';
import {
  Archive,
  Award,
  BadgeCheck,
  BookMarked,
  BookOpen,
  Bookmark,
  Brain,
  CalendarCheck,
  CalendarHeart,
  CalendarRange,
  Clapperboard,
  Cpu,
  Crown,
  Flame,
  Footprints,
  Gauge,
  Gem,
  Globe2,
  GraduationCap,
  HeartPulse,
  Landmark,
  Leaf,
  Library,
  Lock,
  Medal,
  Moon,
  Newspaper,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Sun,
  SunMedium,
  Sunrise,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Wand2,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { TIER_STYLE } from '../lib/sections';
import { cx, timeAgo } from '../lib/format';
import type { Achievement } from '../lib/types';

const ICONS: Record<string, LucideIcon> = {
  Archive, Award, BadgeCheck, BookMarked, BookOpen, Bookmark, Brain, CalendarCheck, CalendarHeart, CalendarRange,
  Clapperboard, Cpu, Crown, Flame, Footprints, Gauge, Gem, Globe2, GraduationCap, HeartPulse, Landmark, Leaf, Library,
  Medal, Moon, Newspaper, Rocket, Shield, Sparkles, Star, Sun, SunMedium, Sunrise, Target, Timer, TrendingUp, Trophy,
  Wand2, Waves, Zap,
};

export function AchievementIcon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] || Award;
  return <I className={className} />;
}

export function AchievementCard({ a, index = 0 }: { a: Achievement; index?: number }) {
  const unlocked = Boolean(a.unlockedAt);
  const tier = TIER_STYLE[a.tier];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: Math.min(index * 0.025, 0.5), type: 'spring', stiffness: 260, damping: 24 }}
      whileHover={unlocked ? { y: -4, rotateX: 6, rotateY: -6 } : { y: -2 }}
      style={{ transformPerspective: 600 }}
      className={cx(
        'card group relative flex flex-col items-center gap-2 overflow-hidden p-4 text-center',
        !unlocked && '!border-dashed !bg-ink-950 !shadow-none',
      )}
      title={unlocked ? `Unlocked ${timeAgo(a.unlockedAt)}` : 'Locked'}
    >
      <div className={cx('relative grid h-14 w-14 place-items-center rounded-full border-2 border-mauve p-[3px]', tier.ring)}>
        <div className="grid h-full w-full place-items-center rounded-full border-2 border-mauve bg-ink-900">
          {unlocked ? (
            <AchievementIcon name={a.icon} className={cx('h-6 w-6', tier.text)} />
          ) : (
            <Lock className="h-5 w-5 text-slate-500" />
          )}
        </div>
      </div>
      <div className="relative">
        <div className="font-display text-sm font-bold text-white">{a.name}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{a.desc}</div>
      </div>
      <div className={cx('relative mt-auto text-[11px] font-bold uppercase tracking-widest', tier.text)}>
        {a.tier} • +{a.reward.xp} XP
      </div>
    </motion.div>
  );
}