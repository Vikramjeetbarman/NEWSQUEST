import { all, one, run, tx } from '../db.js';
import { publicQuestion, revealQuestion, rowToQuestion } from '../quiz/engine.js';
import { DIFFICULTIES, QUESTION_TYPES } from '../quiz/generators.js';
import { HttpError, dayKey, newId, parseJSON, seededRandom, shuffle } from '../util.js';
import {
  POWERUPS,
  coinsForAnswer,
  evaluateAchievements,
  levelInfo,
  nowHour,
  touchStreak,
  updateStats,
  xpForAnswer,
} from './gamification.js';
import { demoScope } from './pipeline.js';
import { SECTIONS } from './feeds.js';

export const MODES = {
  classic: { label: 'Classic', perQuestionMs: 30_000, desc: 'Pick sections & difficulty. 30s per question.' },
  blitz: { label: 'Blitz', totalMs: 90_000, desc: 'Answer as many as you can in 90 seconds.' },
  survival: { label: 'Survival', perQuestionMs: 20_000, lives: 3, desc: 'Three lives. How far can you go?' },
  daily: { label: 'Daily Challenge', perQuestionMs: 25_000, count: 10, desc: '10 hand-picked questions. Once a day. 1.5x XP.' },
  practice: { label: 'Vault Practice', perQuestionMs: 0, desc: 'Revise saved questions at your own pace.' },
  article: { label: 'Article Quiz', perQuestionMs: 30_000, desc: 'Test yourself on one story.' },
};

const TTL = 2 * 3_600_000;
const GRACE_MS = 2500;
const sessions = new Map();

const saveSql = `INSERT INTO quiz_sessions (id, user_id, data, touched) VALUES ($1, $2, $3, $4)
  ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, touched = EXCLUDED.touched`;
const persist = (s) => run(saveSql, [s.id, s.userId, JSON.stringify(s), s.touched]);

await run('DELETE FROM quiz_sessions WHERE touched < $1', [Date.now() - TTL]);
for (const r of await all('SELECT data FROM quiz_sessions')) {
  const s = parseJSON(r.data, null);
  if (s?.id) sessions.set(s.id, s);
}

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.touched > TTL) sessions.delete(id);
  run('DELETE FROM quiz_sessions WHERE touched < $1', [now - TTL]).catch((err) => console.error('[quiz] session cleanup failed:', err.message));
}, 10 * 60_000).unref();

const queues = new Map();
function serial(key, fn) {
  const job = (queues.get(key) || Promise.resolve()).then(fn);
  const done = job.then(
    () => {},
    () => {},
  );
  queues.set(key, done);
  done.then(() => queues.get(key) === done && queues.delete(key));
  return job;
}

async function candidateRows({ sections, difficulties, types, articleId }) {
  const args = [demoScope()];
  const p = (v) => `$${args.push(v)}`;
  const where = ['a.is_demo = $1'];
  if (articleId) where.push(`q.article_id = ${p(articleId)}`);
  if (sections?.length) where.push(`q.section = ANY(${p(sections)})`);
  if (difficulties?.length) where.push(`q.difficulty = ANY(${p(difficulties)})`);
  if (types?.length) where.push(`q.type = ANY(${p(types)})`);
  const rows = await all(
    `SELECT q.* FROM questions q JOIN articles a ON a.id = q.article_id WHERE ${where.join(' AND ')}
    ORDER BY a.published_at DESC, q.id LIMIT 1500`,
    args,
  );
  return rows.map(rowToQuestion);
}

async function pickQuestions(userId, filters, count, { perArticle = 2, rand = Math.random } = {}) {
  const candidates = await candidateRows(filters);
  const seen = new Set((await all('SELECT DISTINCT question_id FROM answers WHERE user_id = $1', [userId])).map((r) => r.question_id));
  const fresh = shuffle(candidates.filter((q) => !seen.has(q.id)), rand);
  const old = shuffle(candidates.filter((q) => seen.has(q.id)), rand);
  const out = [];
  const picked = new Set();
  const pool = [...fresh, ...old];
  const perArt = new Map();
  const perType = new Map();
  const typeCap = Math.max(2, Math.ceil(count / 4));
  for (const pass of [0, 1]) {
    for (const q of pool) {
      if (out.length >= count) break;
      if (picked.has(q)) continue;
      const n = perArt.get(q.articleId) || 0;
      const t = perType.get(q.type) || 0;
      if (pass === 0 && (n >= perArticle || t >= typeCap)) continue;
      out.push(q);
      picked.add(q);
      perArt.set(q.articleId, n + 1);
      perType.set(q.type, t + 1);
    }
  }
  return out;
}

async function dailyQuestions() {
  const day = dayKey();
  const rand = seededRandom(`daily:${day}:${demoScope()}`);
  const candidates = shuffle(await candidateRows({}), rand);
  const plan = ['easy', 'easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard', 'expert', 'expert'];
  const out = [];
  const picked = new Set();
  const usedArt = new Set();
  const usedType = new Map();
  for (const diff of plan) {
    const q =
      candidates.find((x) => x.difficulty === diff && !picked.has(x) && !usedArt.has(x.articleId) && (usedType.get(x.type) || 0) < 2) ||
      candidates.find((x) => !picked.has(x) && !usedArt.has(x.articleId)) ||
      candidates.find((x) => !picked.has(x));
    if (!q) break;
    out.push(q);
    picked.add(q);
    usedArt.add(q.articleId);
    usedType.set(q.type, (usedType.get(q.type) || 0) + 1);
  }
  const order = { easy: 0, medium: 1, hard: 2, expert: 3 };
  return out.sort((a, b) => order[a.difficulty] - order[b.difficulty]);
}

async function practiceQuestions(userId, ids) {
  const rows = ids.length
    ? await all('SELECT snapshot FROM saved_questions WHERE user_id = $1 AND question_id = ANY($2)', [userId, ids])
    : await all('SELECT snapshot FROM saved_questions WHERE user_id = $1 ORDER BY mastered ASC, saved_at DESC LIMIT 20', [userId]);
  return shuffle(rows.map((r) => snapshotToQuestion(parseJSON(r.snapshot, null))).filter(Boolean));
}

export function snapshotToQuestion(s) {
  if (!s?.id || !Array.isArray(s.options)) return null;
  return {
    id: s.id,
    articleId: s.articleId,
    section: s.section,
    type: s.type,
    difficulty: s.difficulty,
    prompt: s.prompt,
    options: s.options,
    answer: s.answer,
    explanation: s.explanation,
    origin: s.origin,
    extra: { context: s.context, statements: s.statements, pairs: s.pairs, ask: s.ask, source: s.source },
  };
}

export async function getDailyStatus(userId) {
  const row = userId ? await one('SELECT correct, total FROM daily_challenges WHERE user_id = $1 AND day = $2', [userId, dayKey()]) : null;
  const active = userId ? [...sessions.values()].find((s) => s.userId === userId && s.mode === 'daily' && !s.finished) : null;
  return { day: dayKey(), done: Boolean(row) && !active, inProgress: Boolean(active), result: row || null, sessionId: active?.id || null };
}

export function startQuiz(user, opts) {
  return serial(`start:${user.id}`, () => openQuiz(user, opts));
}

async function openQuiz(user, opts) {
  const mode = opts.mode;
  const cfg = MODES[mode];
  let questions = [];
  let label = cfg.label;

  if (mode === 'daily') {
    const status = await getDailyStatus(user.id);
    if (status.inProgress) return resume(status.sessionId, user.id);
    if (status.done) throw new HttpError(409, 'You have already played today’s Daily Challenge. Come back tomorrow!');
    questions = await dailyQuestions();
  } else if (mode === 'practice') {
    questions = await practiceQuestions(user.id, opts.questionIds || []);
    label = 'Vault Practice';
  } else if (mode === 'article') {
    if (!opts.articleId) throw new HttpError(400, 'articleId is required');
    questions = await pickQuestions(user.id, { articleId: opts.articleId }, 10, { perArticle: 99 });
    const art = await one('SELECT title FROM articles WHERE id = $1', [opts.articleId]);
    label = art ? `Quiz: ${art.title}` : label;
  } else {
    const count = mode === 'blitz' ? 60 : mode === 'survival' ? 80 : opts.count;
    questions = await pickQuestions(user.id, opts, count);
    if (opts.sections?.length === 1) label = `${cfg.label} · ${SECTIONS[opts.sections[0]]?.label || opts.sections[0]}`;
  }

  if (!questions.length) throw new HttpError(404, 'No questions match those filters yet - try widening your selection.');

  const now = Date.now();
  const s = {
    id: newId(12),
    attemptId: newId(),
    userId: user.id,
    mode,
    label,
    questions,
    index: 0,
    phase: 'question',
    startedAt: now,
    questionStartedAt: now,
    touched: now,
    deadline: cfg.totalMs ? now + cfg.totalMs : null,
    perQuestionMs: cfg.perQuestionMs || 0,
    extraMs: 0,
    lives: cfg.lives || null,
    combo: 0,
    maxCombo: 0,
    correct: 0,
    answered: 0,
    xp: 0,
    coins: 0,
    log: [],
    removed: [],
    finished: false,
    summary: null,
  };

  sessions.set(s.id, s);
  await tx(async () => {
    await run(
      `INSERT INTO attempts (id, user_id, mode, label, total, correct, xp, coins, max_combo, duration_ms, day, created_at)
      VALUES ($1, $2, $3, $4, 0, 0, 0, 0, 0, 0, $5, $6)`,
      [s.attemptId, user.id, mode, label, dayKey(), now],
    );
    if (mode === 'daily') {
      await run('INSERT INTO daily_challenges (user_id, day, correct, total) VALUES ($1, $2, 0, $3) ON CONFLICT DO NOTHING', [
        user.id,
        dayKey(),
        questions.length,
      ]);
    }
    await persist(s);
  });
  return view(s);
}

function getSession(sid, userId) {
  const s = sessions.get(sid);
  if (!s || s.userId !== userId) throw new HttpError(404, 'Quiz session not found or expired');
  s.touched = Date.now();
  return s;
}

function resume(sid, userId) {
  return view(getSession(sid, userId));
}

const timeLimit = (s) => (s.perQuestionMs ? s.perQuestionMs + s.extraMs : 0);

function view(s) {
  const q = s.questions[s.index];
  const total = s.mode === 'blitz' || s.mode === 'survival' ? null : s.questions.length;
  return {
    sessionId: s.id,
    mode: s.mode,
    label: s.label,
    index: s.index,
    total,
    phase: s.phase,
    question: q && !s.finished ? publicQuestion(q) : null,
    removed: s.removed,
    timeLimitMs: timeLimit(s),
    elapsedMs: s.phase === 'question' ? Date.now() - s.questionStartedAt : 0,
    deadline: s.deadline,
    serverNow: Date.now(),
    lives: s.lives,
    combo: s.combo,
    correct: s.correct,
    answered: s.answered,
    xp: s.xp,
    coins: s.coins,
    finished: s.finished,
    powerups: POWERUPS,
  };
}

const isOver = (s) =>
  s.index >= s.questions.length || (s.lives !== null && s.lives <= 0) || (s.deadline !== null && Date.now() > s.deadline);

export const answerQuestion = (sid, user, body) => serial(sid, () => answer(sid, user, body));
export const nextQuestion = (sid, user) => serial(sid, () => advance(sid, user));
export const usePowerup = (sid, user, type) => serial(sid, () => applyPowerup(sid, user, type));
export const finishQuiz = (sid, user) => serial(sid, () => finish(sid, user));

async function answer(sid, user, { questionId, choice }) {
  const s = getSession(sid, user.id);
  if (s.finished) throw new HttpError(409, 'This quiz is already finished');
  if (s.phase !== 'question') throw new HttpError(409, 'Already answered - continue to the next question');
  const q = s.questions[s.index];
  if (!q || q.id !== questionId) throw new HttpError(409, 'That is not the current question');
  const now = Date.now();
  const timeMs = now - s.questionStartedAt;
  const limit = timeLimit(s);
  const timedOut =
    choice === -1 || (limit > 0 && timeMs > limit + GRACE_MS) || (s.deadline !== null && now > s.deadline + GRACE_MS);
  const correct = !timedOut && choice === q.answer;

  s.answered++;
  s.phase = 'reveal';
  let xp = 0;
  let coins = 0;
  if (correct) {
    s.correct++;
    s.combo++;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    xp = xpForAnswer({ difficulty: q.difficulty, combo: s.combo, timeMs, mode: s.mode });
    coins = coinsForAnswer(q.difficulty);
  } else {
    s.combo = 0;
    if (s.lives !== null) s.lives--;
  }
  s.xp += xp;
  s.coins += coins;
  s.log.push({ questionId: q.id, choice, correct, timeMs, timedOut });

  const before = levelInfo(user.xp);
  const current = await touchStreak(user.id);
  await run(
    `INSERT INTO answers (user_id, question_id, section, difficulty, type, correct, time_ms, day, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [user.id, q.id, q.section, q.difficulty, q.type, correct ? 1 : 0, timeMs, dayKey(), now],
  );

  let streak = null;
  await tx(async () => {
    if (xp || coins) await run('UPDATE users SET xp = xp + $1, coins = coins + $2 WHERE id = $3', [xp, coins, user.id]);
    await run(
      'UPDATE attempts SET total = $1, correct = $2, xp = $3, coins = $4, max_combo = $5, duration_ms = $6 WHERE id = $7',
      [s.answered, s.correct, s.xp, s.coins, s.maxCombo, now - s.startedAt, s.attemptId],
    );
    if (s.mode === 'daily') {
      await run('UPDATE daily_challenges SET correct = $1 WHERE user_id = $2 AND day = $3', [s.correct, user.id, dayKey()]);
    }
    if (s.mode === 'practice') {
      await run(
        `UPDATE saved_questions SET attempts = attempts + 1, correct = correct + $1, mastered = CASE WHEN correct + $1 >= 3 THEN 1 ELSE mastered END
        WHERE user_id = $2 AND question_id = $3`,
        [correct ? 1 : 0, user.id, q.id],
      );
    }
    await updateStats(user.id, (st) => {
      st.answered++;
      if (correct) {
        st.correct++;
        st.sectionCorrect[q.section] = (st.sectionCorrect[q.section] || 0) + 1;
        if (q.difficulty === 'expert') st.expertCorrect++;
        if (timeMs < 3000) st.fast++;
      }
      st.maxCombo = Math.max(st.maxCombo, s.combo);
    });
    streak = await touchStreak(user.id);
  });

  await persist(s);

  const after = levelInfo(user.xp + xp);
  user.xp += xp;

  return {
    correct,
    timedOut,
    answer: q.answer,
    explanation: q.explanation,
    source: q.extra?.source || null,
    xpGained: xp,
    coinsGained: coins,
    combo: s.combo,
    lives: s.lives,
    correctCount: s.correct,
    answered: s.answered,
    over: isOver({ ...s, index: s.index + 1 }),
    levelUp: after.level > before.level ? after : null,
    streak,
  };
}

async function advance(sid, user) {
  const s = getSession(sid, user.id);
  if (s.finished) return view(s);
  if (s.phase === 'reveal') {
    s.index++;
    s.phase = 'question';
    s.removed = [];
    s.extraMs = 0;
    s.questionStartedAt = Date.now();
    await persist(s);
  }
  if (isOver(s)) return { ...view(s), over: true, question: null };
  return view(s);
}

async function applyPowerup(sid, user, type) {
  const s = getSession(sid, user.id);
  const p = POWERUPS[type];
  if (!p) throw new HttpError(400, 'Unknown power-up');
  if (s.finished || s.phase !== 'question') throw new HttpError(409, 'Power-ups can only be used on an open question');
  const q = s.questions[s.index];
  if (type === 'fifty' && (q.options.length < 4 || s.removed.length)) throw new HttpError(409, '50:50 is not available for this question');
  if (type === 'time' && !s.perQuestionMs && !s.deadline) throw new HttpError(409, 'This mode has no timer');
  const paid = await run('UPDATE users SET coins = coins - $1 WHERE id = $2 AND coins >= $1', [p.cost, user.id]);
  if (!paid) throw new HttpError(402, `You need ${p.cost} coins for ${p.label}`);
  await updateStats(user.id, (st) => st.powerups++);
  const out = { type, cost: p.cost };
  if (type === 'fifty') {
    const wrong = shuffle(
      q.options.map((_, i) => i).filter((i) => i !== q.answer),
      Math.random,
    ).slice(0, 2);
    s.removed = wrong.sort();
    out.removed = s.removed;
  } else if (type === 'time') {
    if (s.deadline) s.deadline += 15_000;
    else s.extraMs += 15_000;
    out.timeLimitMs = timeLimit(s);
    out.deadline = s.deadline;
  } else if (type === 'skip') {
    s.log.push({ questionId: q.id, choice: null, correct: null, skipped: true, timeMs: Date.now() - s.questionStartedAt });
    s.phase = 'reveal';
    out.skipped = true;
  }
  await persist(s);
  out.coins = (await one('SELECT coins FROM users WHERE id = $1', [user.id])).coins;
  return out;
}

async function finish(sid, user) {
  const s = getSession(sid, user.id);
  if (s.finished) return s.summary;
  s.finished = true;
  const now = Date.now();
  const perfect = s.answered >= 5 && s.correct === s.answered && s.mode !== 'practice';
  let bonusCoins = s.answered > 0 ? 5 : 0;
  if (perfect) bonusCoins += 10;
  const before = levelInfo(user.xp);
  let streak = null;
  await tx(async () => {
    if (s.answered > 0) {
      if (bonusCoins) await run('UPDATE users SET coins = coins + $1 WHERE id = $2', [bonusCoins, user.id]);
      await run('UPDATE attempts SET coins = coins + $1, duration_ms = $2 WHERE id = $3', [bonusCoins, now - s.startedAt, s.attemptId]);
      const h = nowHour();
      await updateStats(user.id, (st) => {
        st.quizzes++;
        if (perfect) st.perfects++;
        if (s.mode === 'daily') st.dailies++;
        if (s.mode === 'survival') st.survivalBest = Math.max(st.survivalBest, s.correct);
        if (s.mode === 'blitz') st.blitzBest = Math.max(st.blitzBest, s.correct);
        if (h >= 23 || h < 4) st.nightOwl++;
        if (h >= 5 && h < 7) st.earlyBird++;
      });
      streak = await touchStreak(user.id);
    } else {
      await run('DELETE FROM attempts WHERE id = $1', [s.attemptId]);
    }
  });

  const achievements = s.answered > 0 ? await evaluateAchievements(user.id) : [];
  const fresh = await one('SELECT xp, coins, streak FROM users WHERE id = $1', [user.id]);
  const after = levelInfo(fresh.xp);
  const byId = new Map(s.questions.map((q) => [q.id, q]));
  s.summary = {
    sessionId: s.id,
    mode: s.mode,
    label: s.label,
    answered: s.answered,
    correct: s.correct,
    accuracy: s.answered ? s.correct / s.answered : 0,
    xp: s.xp,
    coins: s.coins + bonusCoins,
    bonusCoins,
    perfect,
    maxCombo: s.maxCombo,
    durationMs: now - s.startedAt,
    streak: streak ?? fresh.streak,
    level: after,
    leveledUp: after.level > before.level,
    totals: { xp: fresh.xp, coins: fresh.coins },
    achievements,
    review: s.log.map((l) => ({ ...l, question: revealQuestion(byId.get(l.questionId)) })),
  };
  await persist(s);
  return s.summary;
}

export function isPendingInQuiz(userId, questionId) {
  for (const s of sessions.values()) {
    if (s.userId !== userId || s.finished) continue;
    const q = s.questions[s.index];
    if (s.phase === 'question' && q?.id === questionId) return true;
    if (s.questions.slice(s.index + 1).some((x) => x.id === questionId)) return true;
  }
  return false;
}

export async function findQuestionForUser(userId, questionId) {
  const row = await one('SELECT * FROM questions WHERE id = $1', [questionId]);
  if (row) return rowToQuestion(row);
  for (const s of sessions.values()) if (s.userId === userId) for (const q of s.questions) if (q.id === questionId) return q;
  return null;
}

export async function  catalog() {
  const scope = demoScope();
  const rows = await all(
    `SELECT q.section, q.type, q.difficulty, COUNT(*) AS n FROM questions q JOIN articles a ON a.id = q.article_id
    WHERE a.is_demo = $1 GROUP BY q.section, q.type, q.difficulty`,
    [scope],
  );
  const sum = (key) => {
    const m = {};
    for (const r of rows) m[r[key]] = (m[r[key]] || 0) + r.n;
    return m;
  };
  return {
    total: rows.reduce((a, r) => a + r.n, 0),
    bySection: sum('section'),
    byType: sum('type'),
    byDifficulty: sum('difficulty'),
    matrix: rows.map((r) => ({ section: r.section, type: r.type, difficulty: r.difficulty, count: Number(r.n) })),
    modes: MODES,
    types: QUESTION_TYPES,
    difficulties: DIFFICULTIES,
    powerups: POWERUPS,
  };
}