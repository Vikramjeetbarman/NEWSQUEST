import { all, one, run, tx } from '../db.js';
import { dayKey, hourOf, parseJSON, prevDayKey } from '../util.js';

export const LEVEL_TITLES = [
  'Rookie Reader',
  'Headline Scout',
  'Current Affairs Cadet',
  'News Navigator',
  'Policy Pundit',
  'Editorial Expert',
  'Prelims Pro',
  'Mains Maestro',
  'Interview Ace',
  'Civil Services Sage',
  'Oracle of Affairs',
];

export const xpForLevel = (L) => 50 * L * (L - 1);

export function levelInfo(xp) {
  let L = 1;
  while (xpForLevel(L + 1) <= xp) L++;
  const base = xpForLevel(L);
  const next = xpForLevel(L + 1);
  return {
    level: L,
    title: LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((L - 1) / 2))],
    xpInLevel: xp - base,
    xpIntoLevel: xp - base,
    xpForNext: next - base,
    progress: (xp - base) / (next - base),
  };
}

export const BASE_XP = { easy: 10, medium: 15, hard: 25, expert: 40 };
export const MODE_MULT = { classic: 1, blitz: 1, survival: 1.2, daily: 1.5, practice: 0.5, article: 1 };
export const POWERUPS = {
  fifty: { cost: 15, label: '50:50' },
  time: { cost: 10, label: '+15 seconds' },
  skip: { cost: 12, label: 'Skip' },
};

export function xpForAnswer({ difficulty, combo, timeMs, mode }) {
  const base = BASE_XP[difficulty] || 10;
  const comboMult = 1 + Math.min(Math.max(combo - 1, 0), 10) * 0.1;
  const speed = timeMs < 5000 ? 5 : timeMs < 10000 ? 2 : 0;
  return Math.round((base * comboMult + speed) * (MODE_MULT[mode] || 1));
}

export const coinsForAnswer = (difficulty) => (difficulty === 'hard' || difficulty === 'expert' ? 2 : 1);

export const defaultStats = () => ({
  quizzes: 0,
  answered: 0,
  correct: 0,
  perfects: 0,
  maxCombo: 0,
  fast: 0,
  dailies: 0,
  expertCorrect: 0,
  survivalBest: 0,
  blitzBest: 0,
  nightOwl: 0,
  earlyBird: 0,
  deepReads: 0,
  powerups: 0,
  sectionCorrect: {},
});

export const getStats = (user) => ({ ...defaultStats(), ...parseJSON(user.stats, {}) });

export function updateStats(userId, fn) {
  return tx(async () => {
    const u = await one('SELECT stats FROM users WHERE id = $1 FOR NO KEY UPDATE', [userId]);
    if (!u) return null;
    const s = getStats(u);
    fn(s);
    await run('UPDATE users SET stats = $1 WHERE id = $2', [JSON.stringify(s), userId]);
    return s;
  });
}

export function touchStreak(userId) {
  return tx(async () => {
    const u = await one('SELECT streak, best_streak, last_active_day FROM users WHERE id = $1 FOR NO KEY UPDATE', [userId]);
    const today = dayKey();
    if (u.last_active_day === today) return u.streak;
    const streak = u.last_active_day === prevDayKey(today) ? u.streak + 1 : 1;
    await run('UPDATE users SET streak = $1, best_streak = GREATEST(best_streak, $1), last_active_day = $2 WHERE id = $3', [
      streak,
      today,
      userId,
    ]);
    return streak;
  });
}

export function effectiveStreak(u) {
  const today = dayKey();
  return u.last_active_day === today || u.last_active_day === prevDayKey(today) ? u.streak : 0;
}

export const nowHour = () => hourOf();

const SECTION_BADGES = {
  national: ['Polity Pro', 'Landmark'],
  world: ['Globe Trotter', 'Globe2'],
  business: ['Market Mind', 'TrendingUp'],
  scitech: ['Rocket Scientist', 'Rocket'],
  environment: ['Green Guardian', 'Leaf'],
  health: ['Health Hero', 'HeartPulse'],
  sports: ['Sports Buff', 'Trophy'],
  education: ['Scholar', 'GraduationCap'],
  entertainment: ['Culture Vulture', 'Clapperboard'],
};

const A = (id, name, desc, icon, tier, test, reward) => ({ id, name, desc, icon, tier, test, reward });
const R = { bronze: { xp: 25, coins: 10 }, silver: { xp: 60, coins: 25 }, gold: { xp: 150, coins: 60 }, platinum: { xp: 400, coins: 150 } };

export const ACHIEVEMENTS = [
  A('first_quiz', 'First Steps', 'Complete your first quiz', 'Footprints', 'bronze', (c) => c.s.quizzes >= 1),
  A('quiz_10', 'Regular Reader', 'Complete 10 quizzes', 'BookOpen', 'silver', (c) => c.s.quizzes >= 10),
  A('quiz_50', 'Quiz Machine', 'Complete 50 quizzes', 'Cpu', 'gold', (c) => c.s.quizzes >= 50),
  A('correct_100', 'Century', 'Answer 100 questions correctly', 'Target', 'silver', (c) => c.s.correct >= 100),
  A('correct_500', 'Knowledge Bank', 'Answer 500 questions correctly', 'Landmark', 'gold', (c) => c.s.correct >= 500),
  A('correct_2000', 'Encyclopedia', 'Answer 2,000 questions correctly', 'Library', 'platinum', (c) => c.s.correct >= 2000),
  A('combo_5', 'On Fire', 'Reach a 5x combo', 'Flame', 'bronze', (c) => c.s.maxCombo >= 5),
  A('combo_10', 'Unstoppable', 'Reach a 10x combo', 'Zap', 'silver', (c) => c.s.maxCombo >= 10),
  A('combo_20', 'Legendary Run', 'Reach a 20x combo', 'Crown', 'gold', (c) => c.s.maxCombo >= 20),
  A('perfect_1', 'Flawless', 'Finish a quiz of 5+ questions with no mistakes', 'Sparkles', 'silver', (c) => c.s.perfects >= 1),
  A('perfect_10', 'Perfectionist', 'Finish 10 perfect quizzes', 'Gem', 'gold', (c) => c.s.perfects >= 10),
  A('speed_10', 'Speed Demon', 'Answer 10 questions correctly in under 3 seconds', 'Gauge', 'silver', (c) => c.s.fast >= 10),
  A('streak_3', 'Habit Forming', 'Keep a 3-day streak', 'CalendarCheck', 'bronze', (c) => c.u.best_streak >= 3),
  A('streak_7', 'Week Warrior', 'Keep a 7-day streak', 'CalendarRange', 'silver', (c) => c.u.best_streak >= 7),
  A('streak_30', 'Monthly Master', 'Keep a 30-day streak', 'CalendarHeart', 'platinum', (c) => c.u.best_streak >= 30),
  A('daily_1', 'Daily Dose', 'Complete a Daily Challenge', 'Sun', 'bronze', (c) => c.s.dailies >= 1),
  A('daily_10', 'Committed', 'Complete 10 Daily Challenges', 'SunMedium', 'gold', (c) => c.s.dailies >= 10),
  A('vault_1', 'Collector', 'Save a question to your Vault', 'Bookmark', 'bronze', (c) => c.saved >= 1),
  A('vault_25', 'Archivist', 'Save 25 questions to your Vault', 'Archive', 'silver', (c) => c.saved >= 25),
  A('mastered_10', 'Revision Hero', 'Master 10 Vault questions', 'BadgeCheck', 'gold', (c) => c.mastered >= 10),
  A('read_10', 'Well Read', 'Read 10 articles', 'Newspaper', 'bronze', (c) => c.reads >= 10),
  A('read_50', 'Bookworm', 'Read 50 articles', 'BookMarked', 'silver', (c) => c.reads >= 50),
  ...Object.entries(SECTION_BADGES).map(([sec, [name, icon]]) =>
    A(`section_${sec}`, name, `Answer 25 ${sec === 'scitech' ? 'Science & Tech' : sec} questions correctly`, icon, 'silver', (c) => (c.s.sectionCorrect[sec] || 0) >= 25),
  ),
  A('polymath', 'Polymath', 'Answer 10 questions correctly in every section', 'Brain', 'gold', (c) =>
    Object.keys(SECTION_BADGES).every((s) => (c.s.sectionCorrect[s] || 0) >= 10),
  ),
  A('expert_25', 'Expert Ace', 'Answer 25 expert questions correctly', 'Medal', 'gold', (c) => c.s.expertCorrect >= 25),
  A('survivor_15', 'Survivor', 'Score 15 in a single Survival run', 'Shield', 'gold', (c) => c.s.survivalBest >= 15),
  A('blitz_15', 'Lightning', 'Score 15 in a single Blitz', 'Timer', 'silver', (c) => c.s.blitzBest >= 15),
  A('night_owl', 'Night Owl', 'Finish a quiz between 11 pm and 4 am', 'Moon', 'bronze', (c) => c.s.nightOwl >= 1),
  A('early_bird', 'Early Bird', 'Finish a quiz between 5 am and 7 am', 'Sunrise', 'bronze', (c) => c.s.earlyBird >= 1),
  A('powerup_10', 'Strategist', 'Use 10 power-ups', 'Wand2', 'bronze', (c) => c.s.powerups >= 10),
  A('deep_5', 'Deep Diver', 'Use Deep Read on 5 articles', 'Waves', 'silver', (c) => c.s.deepReads >= 5),
  A('level_5', 'Rising Star', 'Reach level 5', 'Star', 'silver', (c) => c.level >= 5),
  A('level_10', 'Elite Aspirant', 'Reach level 10', 'Award', 'gold', (c) => c.level >= 10),
  A('level_20', 'Grandmaster', 'Reach level 20', 'Crown', 'platinum', (c) => c.level >= 20),
].map((a) => ({ ...a, reward: R[a.tier] }));

export const publicAchievement = ({ id, name, desc, icon, tier, reward }) => ({ id, name, desc, icon, tier, reward });

export async function evaluateAchievements(userId) {
  const have = new Set((await all('SELECT achievement_id FROM user_achievements WHERE user_id = $1', [userId])).map((r) => r.achievement_id));
  const unlocked = [];
  for (let pass = 0; pass < 3; pass++) {
    const u = await one('SELECT * FROM users WHERE id = $1', [userId]);
    const counts = await one(
      `SELECT (SELECT COUNT(*) FROM saved_questions WHERE user_id = $1) AS saved,
              (SELECT COUNT(*) FROM saved_questions WHERE user_id = $1 AND mastered = 1) AS mastered,
              (SELECT COUNT(*) FROM reads WHERE user_id = $1) AS reads`,
      [userId],
    );
    const c = { u, s: getStats(u), level: levelInfo(u.xp).level, ...counts };
    const fresh = ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.test(c));
    if (!fresh.length) break;
    const now = Date.now();
    for (const a of fresh) {
      have.add(a.id);
      const added = await tx(async () => {
        const n = await run(
          'INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [userId, a.id, now],
        );
        if (n) await run('UPDATE users SET xp = xp + $1, coins = coins + $2 WHERE id = $3', [a.reward.xp, a.reward.coins, userId]);
        return n;
      });
      if (added) unlocked.push(publicAchievement(a));
    }
  }
  return unlocked;
}