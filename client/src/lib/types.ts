export type SectionKey =
  | 'national'
  | 'world'
  | 'business'
  | 'scitech'
  | 'environment'
  | 'health'
  | 'sports'
  | 'education'
  | 'opinion'
  | 'entertainment';

export type SourceKey = 'pib' | 'air' | 'toi' | 'hindu' | 'archive';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type ModeKey = 'classic' | 'blitz' | 'survival' | 'daily' | 'practice' | 'article';
export type PowerupKey = 'fifty' | 'time' | 'skip';

export interface SectionInfo {
  key: SectionKey;
  label: string;
  blurb: string;
  articles: number;
  questions: number;
  latest: number | null;
}

export interface FeedCounts {
  ok: number;
  blocked: number;
  error: number;
  offline: number;
  pending: number;
}

export interface PipelineStatus {
  running: boolean;
  lastRun: number | null;
  nextRun: number | null;
  lastAdded: number;
  lastError: string | null;
  intervalMinutes: number;
  liveCount: number;
  mode: 'live' | 'demo' | 'empty';
  feeds: FeedCounts;
}

export interface Meta {
  sections: SectionInfo[];
  sources: Record<SourceKey, { name: string; short: string; home: string | null; credit: string | null }>;
  status: PipelineStatus;
  questionTypes: Record<string, string>;
  aiEnabled: boolean;
  fullTextMode: string;
  demo: boolean;
  timezone: string;
}

export interface ArticleCard {
  id: string;
  source: SourceKey;
  section: SectionKey;
  title: string;
  description: string;
  image: string | null;
  link: string | null;
  publishedAt: number;
  tldr: string;
  readingTime: number;
  keywords: string[];
  questionCount: number;
  isDemo: boolean;
  deep: boolean;
  ai: boolean;
}

export interface Entity {
  text: string;
  type: string;
  count: number;
  inTitle?: boolean;
  role?: string | null;
}

export interface ArticleFull extends Omit<ArticleCard, 'keywords'> {
  content: string;
  summary: { tldr: string; points: string[]; readingTime: number };
  keywords: { text: string; score: number }[];
  entities: Entity[];
  author: string | null;
}

export interface ArticleResponse {
  article: ArticleFull;
  questions: { total: number; breakdown: { type: string; difficulty: Difficulty; n: number }[] };
  related: ArticleCard[];
  read: boolean;
  canDeepRead: boolean;
  canAi: boolean;
}

export interface LensItem {
  name: string;
  count: number;
  articleId: string;
  headline: string;
  role?: string | null;
}

export interface Digest {
  section: SectionKey | 'all';
  generatedAt: number;
  articleCount: number;
  brief: { text: string; articleId: string }[];
  storylines: { label: string; summary: string; size: number; latest: number; articles: { id: string; title: string }[] }[];
  themes: { term: string; count: number; weight: number }[];
  lens: {
    persons: LensItem[];
    places: LensItem[];
    organisations: LensItem[];
    schemes: LensItem[];
    laws: LensItem[];
    events: LensItem[];
    reports: LensItem[];
    awards: LensItem[];
    numbers: { value: string; context: string; articleId: string }[];
  };
}

export interface Trending {
  topics: { term: string; type: string; count: number; mentions: number; articleIds: string[] }[];
  stories: ArticleCard[];
}

export interface LevelInfo {
  level: number;
  title: string;
  xpInLevel: number;
  xpIntoLevel: number;
  xpForNext: number;
  progress: number;
}

export interface UserStats {
  quizzes: number;
  answered: number;
  correct: number;
  perfects: number;
  maxCombo: number;
  fast: number;
  dailies: number;
  expertCorrect: number;
  survivalBest: number;
  blitzBest: number;
  deepReads: number;
  powerups: number;
  sectionCorrect: Partial<Record<SectionKey, number>>;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  isGuest: boolean;
  xp: number;
  coins: number;
  streak: number;
  bestStreak: number;
  lastActiveDay: string | null;
  activeToday: boolean;
  createdAt: number;
  level: LevelInfo;
  stats: UserStats;
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  reward: { xp: number; coins: number };
  unlockedAt?: number | null;
}

export interface PublicQuestion {
  id: string;
  section: SectionKey;
  type: string;
  difficulty: Difficulty;
  prompt: string;
  options: string[];
  context: string | null;
  statements: string[] | null;
  pairs: { left: string[]; right: string[] } | null;
  ask: string | null;
  origin: string;
}

export interface SourceRef {
  headline: string;
  link: string | null;
  source: SourceKey;
}

export interface RevealedQuestion extends PublicQuestion {
  answer: number;
  explanation: string;
  source: SourceRef | null;
  articleId: string;
}

export interface Powerup {
  cost: number;
  label: string;
}

export interface QuizView {
  sessionId: string;
  mode: ModeKey;
  label: string;
  index: number;
  total: number | null;
  phase: 'question' | 'reveal';
  question: PublicQuestion | null;
  removed: number[];
  timeLimitMs: number;
  elapsedMs: number;
  deadline: number | null;
  serverNow: number;
  lives: number | null;
  combo: number;
  correct: number;
  answered: number;
  xp: number;
  coins: number;
  finished: boolean;
  powerups: Record<PowerupKey, Powerup>;
  over?: boolean;
}

export interface AnswerResult {
  correct: boolean;
  timedOut: boolean;
  answer: number;
  explanation: string;
  source: SourceRef | null;
  xpGained: number;
  coinsGained: number;
  combo: number;
  lives: number | null;
  correctCount: number;
  answered: number;
  over: boolean;
  levelUp: LevelInfo | null;
  streak: number;
}

export interface PowerupResult {
  type: PowerupKey;
  cost: number;
  coins: number;
  removed?: number[];
  timeLimitMs?: number;
  deadline?: number | null;
  skipped?: boolean;
}

export interface QuizSummary {
  sessionId: string;
  mode: ModeKey;
  label: string;
  answered: number;
  correct: number;
  accuracy: number;
  xp: number;
  coins: number;
  bonusCoins: number;
  perfect: boolean;
  maxCombo: number;
  durationMs: number;
  streak: number;
  level: LevelInfo;
  leveledUp: boolean;
  totals: { xp: number; coins: number };
  achievements: Achievement[];
  review: {
    questionId: string;
    choice: number | null;
    correct: boolean | null;
    timeMs: number;
    timedOut?: boolean;
    skipped?: boolean;
    question: RevealedQuestion;
  }[];
}

export interface ModeInfo {
  label: string;
  desc: string;
  perQuestionMs?: number;
  totalMs?: number;
  lives?: number;
  count?: number;
}

export interface DailyStatus {
  day: string;
  done: boolean;
  inProgress: boolean;
  result: { correct: number; total: number } | null;
  sessionId: string | null;
}

export interface Catalog {
  total: number;
  bySection: Partial<Record<SectionKey, number>>;
  byType: Record<string, number>;
  byDifficulty: Partial<Record<Difficulty, number>>;
  modes: Record<ModeKey, ModeInfo>;
  types: Record<string, string>;
  difficulties: Difficulty[];
  powerups: Record<PowerupKey, Powerup>;
  daily: DailyStatus;
}

export interface VaultItem {
  questionId: string;
  question: RevealedQuestion | null;
  section: SectionKey;
  difficulty: Difficulty;
  type: string;
  note: string;
  mastered: boolean;
  attempts: number;
  correct: number;
  savedAt: number;
}

export interface Breakdown {
  total: number;
  correct: number;
}

export interface Profile {
  user: User;
  bySection: (Breakdown & { section: SectionKey })[];
  byType: (Breakdown & { type: string })[];
  byDifficulty: (Breakdown & { difficulty: Difficulty })[];
  heatmap: { day: string; n: number; correct: number }[];
  recent: {
    id: string;
    mode: ModeKey;
    label: string;
    total: number;
    correct: number;
    xp: number;
    coins: number;
    maxCombo: number;
    durationMs: number;
    createdAt: number;
  }[];
  achievements: Achievement[];
  vault: { total: number; mastered: number; recent: { questionId: string; prompt: string; section: SectionKey; mastered: boolean; savedAt: number }[] };
  reads: number;
  rank: number;
  avatars: string[];
}

export interface LeaderRow {
  rank: number;
  displayName: string;
  avatar: string;
  score: number;
  level: number;
  title: string;
  streak: number;
  isYou: boolean;
}

export interface LeaderMe {
  rank: number | null;
  score: number;
  isGuest: boolean;
}

export interface FeedInfo {
  id: string;
  source: SourceKey;
  sourceName: string;
  section: SectionKey | 'auto';
  url: string;
  status: 'pending' | 'ok' | 'blocked' | 'error' | 'offline';
  message: string;
  items: number;
  lastAttempt: number | null;
  lastOk: number | null;
  ms: number | null;
}