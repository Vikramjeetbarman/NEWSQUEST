import { Router } from 'express';
import { all, one, run } from '../db.js';
import { DIFFICULTIES, QUESTION_TYPES, revealQuestion } from '../quiz/engine.js';
import { requireUser } from '../services/auth.js';
import { SECTIONS } from '../services/feeds.js';
import {
  ACHIEVEMENTS,
  POWERUPS,
  evaluateAchievements,
  levelInfo,
  effectiveStreak,
  publicAchievement,
} from '../services/gamification.js';
import {
  MODES,
  answerQuestion,
  catalog,
  findQuestionForUser,
  finishQuiz,
  getDailyStatus,
  isPendingInQuiz,
  nextQuestion,
  startQuiz,
  usePowerup,
} from '../services/quizSessions.js';
import { HttpError, asyncH, dayKey, parseJSON, rateLimit, vEnum, vInt, vList, vStr } from '../util.js';
import { publicUser } from '../services/auth.js';

export const quizRouter = Router();
const SECTION_KEYS = Object.keys(SECTIONS);
const TYPE_KEYS = Object.keys(QUESTION_TYPES);
const QID = /^[a-f0-9]{16}$/;
const SID = /^[a-zA-Z0-9_-]{8,40}$/;
const sid = (req) => {
  if (!SID.test(req.params.sid)) throw new HttpError(404, 'Quiz session not found');
  return req.params.sid;
};

quizRouter.get(
  '/quiz/catalog',
  asyncH(async (req, res) => res.json({ ...(await catalog()), daily: await getDailyStatus(req.user?.id) })),
);

quizRouter.get(
  '/quiz/daily',
  asyncH(async (req, res) => res.json(await getDailyStatus(req.user?.id))),
);

const startLimiter = rateLimit({ windowMs: 60_000, max: 30, key: 'quiz-start' });
quizRouter.post(
  '/quiz/start',
  requireUser,
  startLimiter,
  asyncH(async (req, res) => {
    const b = req.body || {};
    const mode = vEnum(b.mode, Object.keys(MODES), null);
    if (!mode) throw new HttpError(400, 'Unknown quiz mode');
    const opts = {
      mode,
      sections: vList(b.sections, SECTION_KEYS, 20),
      difficulties: vList(b.difficulties, DIFFICULTIES, 4),
      types: vList(b.types, TYPE_KEYS, 20),
      count: vInt(b.count, { min: 1, max: 30, def: 10 }),
      articleId: typeof b.articleId === 'string' && QID.test(b.articleId) ? b.articleId : null,
      questionIds: Array.isArray(b.questionIds) ? b.questionIds.filter((x) => typeof x === 'string' && QID.test(x)).slice(0, 50) : [],
    };
    res.status(201).json(await startQuiz(req.user, opts));
  }),
);

quizRouter.post(
  '/quiz/:sid/answer',
  requireUser,
  asyncH(async (req, res) => {
    const questionId = vStr(req.body?.questionId, { name: 'questionId', max: 40 });
    const choice = Number.isInteger(req.body?.choice) ? req.body.choice : -1;
    if (choice < -1 || choice > 9) throw new HttpError(400, 'Invalid choice');
    res.json(await answerQuestion(sid(req), req.user, { questionId, choice }));
  }),
);

quizRouter.post(
  '/quiz/:sid/next',
  requireUser,
  asyncH(async (req, res) => res.json(await nextQuestion(sid(req), req.user))),
);

quizRouter.post(
  '/quiz/:sid/powerup',
  requireUser,
  asyncH(async (req, res) => {
    const type = vEnum(req.body?.type, Object.keys(POWERUPS), null);
    if (!type) throw new HttpError(400, 'Unknown power-up');
    res.json(await usePowerup(sid(req), req.user, type));
  }),
);

quizRouter.post(
  '/quiz/:sid/finish',
  requireUser,
  asyncH(async (req, res) => res.json(await finishQuiz(sid(req), req.user))),
);

function vaultRow(r) {
  return {
    questionId: r.question_id,
    question: parseJSON(r.snapshot, null),
    section: r.section,
    difficulty: r.difficulty,
    type: r.type,
    note: r.note,
    mastered: Boolean(r.mastered),
    attempts: r.attempts,
    correct: r.correct,
    savedAt: r.saved_at,
  };
}

quizRouter.get(
  '/vault',
  requireUser,
  asyncH(async (req, res) => {
    const args = [req.user.id];
    const p = (v) => `$${args.push(v)}`;
    const where = ['user_id = $1'];
    const section = vEnum(req.query.section, SECTION_KEYS, null);
    const difficulty = vEnum(req.query.difficulty, DIFFICULTIES, null);
    const type = vEnum(req.query.type, TYPE_KEYS, null);
    if (section) where.push(`section = ${p(section)}`);
    if (difficulty) where.push(`difficulty = ${p(difficulty)}`);
    if (type) where.push(`type = ${p(type)}`);
    if (req.query.mastered === '1' || req.query.mastered === '0') where.push(`mastered = ${p(Number(req.query.mastered))}`);
    const rows = await all(`SELECT * FROM saved_questions WHERE ${where.join(' AND ')} ORDER BY saved_at DESC LIMIT 1000`, args);
    const counts = await one('SELECT COUNT(*) AS total, SUM(mastered) AS mastered FROM saved_questions WHERE user_id = $1', [req.user.id]);
    res.json({ items: rows.map(vaultRow), total: counts.total, mastered: counts.mastered || 0 });
  }),
);

const vaultLimiter = rateLimit({ windowMs: 60_000, max: 60, key: 'vault' });
quizRouter.post(
  '/vault',
  requireUser,
  vaultLimiter,
  asyncH(async (req, res) => {
    const qid = vStr(req.body?.questionId, { name: 'questionId', max: 40, pattern: QID });
    const note = vStr(req.body?.note, { name: 'Note', max: 500, optional: true }) || '';
    if (isPendingInQuiz(req.user.id, qid)) throw new HttpError(409, 'Answer the question first, then save it to your Vault');
    const q = await findQuestionForUser(req.user.id, qid);
    if (!q) throw new HttpError(404, 'Question not found');
    const count = (await one('SELECT COUNT(*) AS n FROM saved_questions WHERE user_id = $1', [req.user.id])).n;
    if (count >= 2000) throw new HttpError(409, 'Your Vault is full (2,000 questions). Remove some to save more.');
    await run(
      'INSERT INTO saved_questions (user_id, question_id, snapshot, section, difficulty, type, note, saved_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING',
      [req.user.id, q.id, JSON.stringify(revealQuestion(q)), q.section, q.difficulty, q.type, note, Date.now()],
    );
    res.status(201).json({ ok: true, achievements: await evaluateAchievements(req.user.id) });
  }),
);

quizRouter.patch(
  '/vault/:qid',
  requireUser,
  asyncH(async (req, res) => {
    if (!QID.test(req.params.qid)) throw new HttpError(404, 'Not in your Vault');
    const note = vStr(req.body?.note, { name: 'Note', max: 500, optional: true });
    const mastered = typeof req.body?.mastered === 'boolean' ? (req.body.mastered ? 1 : 0) : null;
    const changed = await run(
      'UPDATE saved_questions SET note = COALESCE($1, note), mastered = COALESCE($2, mastered) WHERE user_id = $3 AND question_id = $4',
      [note ?? (req.body?.note === '' ? '' : null), mastered, req.user.id, req.params.qid],
    );
    if (!changed) throw new HttpError(404, 'Not in your Vault');
    res.json({ ok: true, achievements: await evaluateAchievements(req.user.id) });
  }),
);

quizRouter.delete(
  '/vault/:qid',
  requireUser,
  asyncH(async (req, res) => {
    if (!QID.test(req.params.qid)) throw new HttpError(404, 'Not in your Vault');
    await run('DELETE FROM saved_questions WHERE user_id = $1 AND question_id = $2', [req.user.id, req.params.qid]);
    res.json({ ok: true });
  }),
);

const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

quizRouter.get(
  '/vault/export',
  requireUser,
  asyncH(async (req, res) => {
    const format = vEnum(req.query.format, ['csv', 'json'], 'json');
    const items = (await all('SELECT * FROM saved_questions WHERE user_id = $1 ORDER BY saved_at DESC', [req.user.id])).map(vaultRow);
    const stamp = dayKey();
    if (format === 'json') {
      res.set('Content-Disposition', `attachment; filename="newsquest-vault-${stamp}.json"`);
      return res.json({ exportedAt: new Date().toISOString(), items });
    }
    const header = ['Section', 'Type', 'Difficulty', 'Question', 'Statements', 'Option A', 'Option B', 'Option C', 'Option D', 'Answer', 'Explanation', 'Source', 'Note', 'Mastered'];
    const lines = [header.map(csvCell).join(',')];
    for (const it of items) {
      const q = it.question || {};
      const opts = q.options || [];
      lines.push(
        [
          SECTIONS[it.section]?.label || it.section,
          QUESTION_TYPES[it.type] || it.type,
          it.difficulty,
          q.prompt,
          (q.statements || []).map((s, i) => `${i + 1}. ${s}`).join(' | '),
          opts[0], opts[1], opts[2], opts[3],
          opts[q.answer],
          q.explanation,
          q.source?.headline,
          it.note,
          it.mastered ? 'yes' : 'no',
        ]
          .map(csvCell)
          .join(','),
      );
    }
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="newsquest-vault-${stamp}.csv"`);
    res.send(`\uFEFF${lines.join('\r\n')}`);
  }),
);

const AVATARS = ['🦉', '🦅', '🐼', '🐯', '🦚', '🐘', '🐆', '🐬', '🧠', '⚡', '🏆', '🎯', '👑', '🥇'];

quizRouter.get(
  '/profile',
  requireUser,
  asyncH(async (req, res) => {
    const uid = req.user.id;
    const since = Date.now() - 180 * 86_400_000;
    const [bySection, byType, byDifficulty, heatmap, attempts, unlockedRows, vault, savedRows, readsRow, rankRow] = await Promise.all([
      all('SELECT section, COUNT(*) AS total, SUM(correct) AS correct FROM answers WHERE user_id = $1 GROUP BY section', [uid]),
      all('SELECT type, COUNT(*) AS total, SUM(correct) AS correct FROM answers WHERE user_id = $1 GROUP BY type', [uid]),
      all('SELECT difficulty, COUNT(*) AS total, SUM(correct) AS correct FROM answers WHERE user_id = $1 GROUP BY difficulty', [uid]),
      all('SELECT day, COUNT(*) AS n, SUM(correct) AS correct FROM answers WHERE user_id = $1 AND created_at > $2 GROUP BY day', [uid, since]),
      all('SELECT * FROM attempts WHERE user_id = $1 AND total > 0 ORDER BY created_at DESC LIMIT 12', [uid]),
      all('SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = $1', [uid]),
      one('SELECT COUNT(*) AS total, SUM(mastered) AS mastered FROM saved_questions WHERE user_id = $1', [uid]),
      all('SELECT question_id, snapshot, section, mastered, saved_at FROM saved_questions WHERE user_id = $1 ORDER BY saved_at DESC LIMIT 5', [uid]),
      one('SELECT COUNT(*) AS n FROM reads WHERE user_id = $1', [uid]),
      one('SELECT COUNT(*) + 1 AS r FROM users WHERE is_guest = 0 AND xp > $1', [req.user.xp]),
    ]);
    const recent = attempts.map((a) => ({
      id: a.id,
      mode: a.mode,
      label: a.label,
      total: a.total,
      correct: a.correct,
      xp: a.xp,
      coins: a.coins,
      maxCombo: a.max_combo,
      durationMs: a.duration_ms,
      createdAt: a.created_at,
    }));
    const unlocked = new Map(unlockedRows.map((r) => [r.achievement_id, r.unlocked_at]));
    const achievements = ACHIEVEMENTS.map((a) => ({ ...publicAchievement(a), unlockedAt: unlocked.get(a.id) || null }));
    const savedRecent = savedRows.map((r) => ({
      questionId: r.question_id,
      prompt: parseJSON(r.snapshot, {})?.prompt || '',
      section: r.section,
      mastered: Boolean(r.mastered),
      savedAt: r.saved_at,
    }));
    const reads = readsRow.n;
    const rank = rankRow.r;
    res.json({
      user: publicUser(req.user),
      bySection,
      byType,
      byDifficulty,
      heatmap,
      recent,
      achievements,
      vault: { total: vault.total, mastered: vault.mastered || 0, recent: savedRecent },
      reads,
      rank,
      avatars: AVATARS,
    });
  }),
);

quizRouter.patch(
  '/profile',
  requireUser,
  asyncH(async (req, res) => {
    const displayName = vStr(req.body?.displayName, { name: 'Display name', min: 1, max: 32, optional: true, visible: true });
    const avatar = req.body?.avatar === undefined ? undefined : vEnum(req.body.avatar, AVATARS, null);
    if (avatar === null) throw new HttpError(400, 'Pick one of the available avatars');
    const user = await one(
      'UPDATE users SET display_name = COALESCE($1, display_name), avatar = COALESCE($2, avatar) WHERE id = $3 RETURNING *',
      [displayName ?? null, avatar ?? null, req.user.id],
    );
    res.json({ user: publicUser(user) });
  }),
);

const ACHIEVEMENT_XP = JSON.stringify(Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a.reward.xp])));

quizRouter.get(
  '/leaderboard',
  asyncH(async (req, res) => {
    const period = vEnum(req.query.period, ['week', 'all'], 'week');
    const since = Date.now() - 7 * 86_400_000;
    const WEEK = `WITH w AS (
      SELECT user_id, xp FROM attempts WHERE created_at > $1
      UNION ALL
      SELECT user_id, ($2::jsonb ->> achievement_id)::int FROM user_achievements WHERE unlocked_at > $1
    ), s AS (SELECT user_id, SUM(xp) AS score FROM w GROUP BY user_id)`;
    const weekArgs = [since, ACHIEVEMENT_XP];
    const players =
      period === 'all'
        ? (await one('SELECT COUNT(*) AS n FROM users WHERE is_guest = 0 AND xp > 0')).n
        : (await one(`${WEEK} SELECT COUNT(*) AS n FROM s JOIN users u ON u.id = s.user_id WHERE u.is_guest = 0 AND s.score > 0`, weekArgs)).n;
    const rows =
      period === 'all'
        ? await all(
            'SELECT id, display_name, avatar, xp, streak, best_streak, last_active_day, xp AS score FROM users WHERE is_guest = 0 AND xp > 0 ORDER BY xp DESC, id LIMIT 50',
          )
        : await all(
            `${WEEK} SELECT u.id, u.display_name, u.avatar, u.xp, u.streak, u.best_streak, u.last_active_day, s.score FROM s JOIN users u ON u.id = s.user_id WHERE u.is_guest = 0 AND s.score > 0 ORDER BY s.score DESC, u.id LIMIT 50`,
            weekArgs,
          );
    let rank = 0;
    const items = rows.map((r, i) => {
      if (i === 0 || r.score < rows[i - 1].score) rank = i + 1;
      const { level, title } = levelInfo(r.xp);
      return {
        rank,
        displayName: r.display_name,
        avatar: r.avatar,
        score: r.score,
        level,
        title,
        streak: effectiveStreak(r),
        isYou: req.user?.id === r.id,
      };
    });
    let me = null;
    if (req.user) {
      const score =
        period === 'all'
          ? req.user.xp
          : (await one(`${WEEK} SELECT COALESCE((SELECT score FROM s WHERE user_id = $3), 0) AS score`, [...weekArgs, req.user.id])).score;
      const ahead =
        period === 'all'
          ? (await one('SELECT COUNT(*) AS n FROM users WHERE is_guest = 0 AND xp > $1', [score])).n
          : (await one(`${WEEK} SELECT COUNT(*) AS n FROM s JOIN users u ON u.id = s.user_id WHERE u.is_guest = 0 AND s.score > $1`, [...weekArgs, score])).n;
      me = { rank: score > 0 ? ahead + 1 : null, score, isGuest: Boolean(req.user.is_guest) };
    }
    res.json({ period, items, players, me });
  }),
);