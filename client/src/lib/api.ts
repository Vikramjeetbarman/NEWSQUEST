import type {
  Achievement,
  AnswerResult,
  ArticleCard,
  ArticleResponse,
  Catalog,
  DailyStatus,
  Difficulty,
  Digest,
  FeedInfo,
  LeaderMe,
  LeaderRow,
  Meta,
  ModeKey,
  PipelineStatus,
  PowerupKey,
  PowerupResult,
  Profile,
  QuizSummary,
  QuizView,
  SectionKey,
  SourceKey,
  Trending,
  User,
  VaultItem,
} from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the NewsQuest server. Is it running?');
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  return data as T;
}

const get = <T>(p: string) => request<T>('GET', p);
const post = <T>(p: string, b: unknown = {}) => request<T>('POST', p, b);

const qs = (o: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

type WithAch = { achievements: Achievement[] };

export const api = {
  me: () => get<{ user: User | null }>('/auth/me'),
  guest: () => post<{ user: User }>('/auth/guest'),
  login: (username: string, password: string) => post<{ user: User }>('/auth/login', { username, password }),
  register: (username: string, password: string, displayName?: string) =>
    post<{ user: User }>('/auth/register', { username, password, displayName }),
  logout: () => post<{ ok: true }>('/auth/logout'),

  meta: () => get<Meta>('/meta'),
  news: (o: { section?: SectionKey; source?: SourceKey; q?: string; limit?: number; offset?: number } = {}) =>
    get<{ items: ArticleCard[]; total: number }>(`/news${qs(o)}`),
  ticker: () => get<{ items: { id: string; title: string; section: SectionKey; source: SourceKey; publishedAt: number }[] }>('/news/ticker'),
  trending: () => get<Trending>('/news/trending'),
  digest: (section: SectionKey | 'all') => get<Digest>(`/sections/${section}/digest`),
  article: (id: string) => get<ArticleResponse>(`/articles/${encodeURIComponent(id)}`),
  markRead: (id: string) => post<{ ok: true } & WithAch>(`/articles/${encodeURIComponent(id)}/read`),
  deepRead: (id: string) => post<{ ok: true } & WithAch>(`/articles/${encodeURIComponent(id)}/deep`),
  aiEnhance: (id: string) => post<{ ok: true; added: number }>(`/articles/${encodeURIComponent(id)}/ai`),
  sources: () => get<{ feeds: FeedInfo[]; status: PipelineStatus }>('/sources'),
  refresh: () => post<{ added: number; skipped?: boolean; status: PipelineStatus }>('/admin/refresh'),

  catalog: () => get<Catalog>('/quiz/catalog'),
  daily: () => get<DailyStatus>('/quiz/daily'),
  startQuiz: (o: {
    mode: ModeKey;
    sections?: SectionKey[];
    difficulties?: Difficulty[];
    types?: string[];
    count?: number;
    articleId?: string;
    questionIds?: string[];
  }) => post<QuizView>('/quiz/start', o),
  answer: (sid: string, questionId: string, choice: number) => post<AnswerResult>(`/quiz/${sid}/answer`, { questionId, choice }),
  next: (sid: string) => post<QuizView>(`/quiz/${sid}/next`),
  powerup: (sid: string, type: PowerupKey) => post<PowerupResult>(`/quiz/${sid}/powerup`, { type }),
  finish: (sid: string) => post<QuizSummary>(`/quiz/${sid}/finish`),

  vault: (o: { section?: SectionKey; difficulty?: Difficulty; type?: string; mastered?: '0' | '1' } = {}) =>
    get<{ items: VaultItem[]; total: number; mastered: number }>(`/vault${qs(o)}`),
  save: (questionId: string, note?: string) => post<{ ok: true } & WithAch>('/vault', { questionId, note }),
  updateSaved: (qid: string, patch: { note?: string; mastered?: boolean }) =>
    request<{ ok: true } & WithAch>('PATCH', `/vault/${qid}`, patch),
  unsave: (qid: string) => request<{ ok: true }>('DELETE', `/vault/${qid}`),
  exportUrl: (format: 'csv' | 'json') => `/api/vault/export?format=${format}`,

  profile: () => get<Profile>('/profile'),
  updateProfile: (patch: { displayName?: string; avatar?: string }) => request<{ user: User }>('PATCH', '/profile', patch),
  leaderboard: (period: 'week' | 'all') =>
    get<{ period: string; items: LeaderRow[]; players: number; me: LeaderMe | null }>(`/leaderboard?period=${period}`),
};