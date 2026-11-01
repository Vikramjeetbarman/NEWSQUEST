import {
  Clapperboard,
  Globe2,
  GraduationCap,
  HeartPulse,
  Landmark,
  Leaf,
  MessageSquareQuote,
  Rocket,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import type { Difficulty, SectionKey } from './types';

export const PALETTE = {
  mauve: '#111111',
  wood: '#3B3A37',
  screen: '#8A857B',
  bronze: '#D5D0C4',
  peach: '#ECE0DE',
  sage: '#F9F7F1',
  success: '#FFFFFF',
  danger: '#B5B0A5',
} as const;

export const PRINT_FILLS = [
  PALETTE.mauve,
  'repeating-linear-gradient(-45deg, #111111 0 3px, transparent 3px 7px)',
  PALETTE.screen,
  'radial-gradient(circle, #111111 1.3px, transparent 1.6px) 0 0 / 5px 5px',
] as const;

export interface SectionStyle {
  icon: LucideIcon;
  color: string;
  tile: string;
  subject: string;
}

const MAUVE = { color: PALETTE.mauve, tile: 'bg-mauve text-peach' };
const BRONZE = { color: PALETTE.bronze, tile: 'bg-bronze text-mauve' };
const SAGE = { color: PALETTE.sage, tile: 'bg-sage text-mauve' };
const WOOD = { color: PALETTE.wood, tile: 'bg-wood text-peach' };
const PEACH = { color: PALETTE.peach, tile: 'bg-peach text-mauve' };

export const SECTION_STYLE: Record<SectionKey, SectionStyle> = {
  national: { icon: Landmark, ...MAUVE, subject: 'Polity & Governance' },
  world: { icon: Globe2, ...BRONZE, subject: 'International Relations' },
  business: { icon: TrendingUp, ...SAGE, subject: 'Indian Economy' },
  scitech: { icon: Rocket, ...WOOD, subject: 'Science & Technology' },
  environment: { icon: Leaf, ...PEACH, subject: 'Environment & Ecology' },
  health: { icon: HeartPulse, ...MAUVE, subject: 'Health & Social Sector' },
  sports: { icon: Trophy, ...BRONZE, subject: 'Sports' },
  education: { icon: GraduationCap, ...SAGE, subject: 'Education' },
  opinion: { icon: MessageSquareQuote, ...WOOD, subject: 'Essay & Ethics' },
  entertainment: { icon: Clapperboard, ...PEACH, subject: 'Art & Culture' },
};

export const SECTION_ORDER: SectionKey[] = [
  'national',
  'world',
  'business',
  'scitech',
  'environment',
  'health',
  'sports',
  'education',
  'opinion',
  'entertainment',
];

export const DIFFICULTY_STYLE: Record<Difficulty, { label: string; className: string; color: string }> = {
  easy: { label: 'Easy', className: 'text-mauve bg-sage border-mauve', color: PALETTE.bronze },
  medium: { label: 'Medium', className: 'text-mauve bg-bronze border-mauve', color: PALETTE.screen },
  hard: { label: 'Hard', className: 'text-peach bg-wood border-mauve', color: PALETTE.wood },
  expert: { label: 'Expert', className: 'text-peach bg-mauve border-mauve', color: PALETTE.mauve },
};

export const TIER_STYLE = {
  bronze: { ring: 'bg-wood', text: 'text-wood-700' },
  silver: { ring: 'bg-screen', text: 'text-slate-400' },
  gold: { ring: 'bg-bronze', text: 'text-slate-300' },
  platinum: { ring: 'bg-mauve', text: 'text-mauve' },
} as const;