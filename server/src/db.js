import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import { config } from './config.js';

pg.types.setTypeParser(pg.types.builtins.INT8, Number);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number);

export const pool = new pg.Pool({
  connectionString: config.db.url,
  options: config.db.schema ? `-c search_path=${config.db.schema}` : undefined,
});
pool.on('error', (err) => console.error('[db] idle connection error:', err.message));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS articles (
  id           TEXT PRIMARY KEY,
  source       TEXT NOT NULL,
  section      TEXT NOT NULL,
  feed_id      TEXT,
  title        TEXT NOT NULL,
  title_key    TEXT NOT NULL,
  link         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  content      TEXT,
  image        TEXT,
  author       TEXT,
  published_at BIGINT NOT NULL,
  fetched_at   BIGINT NOT NULL,
  summary      TEXT,
  keywords     TEXT,
  entities     TEXT,
  is_demo      INTEGER NOT NULL DEFAULT 0,
  deep         INTEGER NOT NULL DEFAULT 0,
  ai           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_articles_pub ON articles(is_demo, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_section ON articles(is_demo, section, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_title ON articles(title_key);

CREATE TABLE IF NOT EXISTS questions (
  id          TEXT PRIMARY KEY,
  article_id  TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  section     TEXT NOT NULL,
  type        TEXT NOT NULL,
  difficulty  TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  options     TEXT NOT NULL,
  answer      INTEGER NOT NULL,
  explanation TEXT NOT NULL,
  extra       TEXT,
  origin      TEXT NOT NULL DEFAULT 'engine',
  created_at  BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_article ON questions(article_id);
CREATE INDEX IF NOT EXISTS idx_questions_section ON questions(section, difficulty);

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  username        TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  password_hash   TEXT,
  is_guest        INTEGER NOT NULL DEFAULT 0,
  avatar          TEXT NOT NULL DEFAULT '',
  xp              INTEGER NOT NULL DEFAULT 0,
  coins           INTEGER NOT NULL DEFAULT 50,
  streak          INTEGER NOT NULL DEFAULT 0,
  best_streak     INTEGER NOT NULL DEFAULT 0,
  last_active_day TEXT,
  stats           TEXT NOT NULL DEFAULT '{}',
  created_at      BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (lower(username));
CREATE INDEX IF NOT EXISTS idx_users_leaderboard ON users(is_guest, xp DESC, id);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS saved_questions (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  snapshot    TEXT NOT NULL,
  section     TEXT NOT NULL,
  difficulty  TEXT NOT NULL,
  type        TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  mastered    INTEGER NOT NULL DEFAULT 0,
  attempts    INTEGER NOT NULL DEFAULT 0,
  correct     INTEGER NOT NULL DEFAULT 0,
  saved_at    BIGINT NOT NULL,
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_user_time ON saved_questions(user_id, saved_at DESC);

CREATE TABLE IF NOT EXISTS attempts (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode        TEXT NOT NULL,
  label       TEXT,
  total       INTEGER NOT NULL,
  correct     INTEGER NOT NULL,
  xp          INTEGER NOT NULL,
  coins       INTEGER NOT NULL,
  max_combo   INTEGER NOT NULL,
  duration_ms BIGINT NOT NULL,
  day         TEXT NOT NULL,
  created_at  BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_time ON attempts(created_at);

CREATE TABLE IF NOT EXISTS answers (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  section     TEXT NOT NULL,
  difficulty  TEXT NOT NULL,
  type        TEXT NOT NULL,
  correct     INTEGER NOT NULL,
  time_ms     BIGINT NOT NULL,
  day         TEXT NOT NULL,
  created_at  BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_answers_user ON answers(user_id, day);
CREATE INDEX IF NOT EXISTS idx_answers_q ON answers(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_answers_user_time ON answers(user_id, created_at);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at    BIGINT NOT NULL,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS reads (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  read_at    BIGINT NOT NULL,
  PRIMARY KEY (user_id, article_id)
);

CREATE TABLE IF NOT EXISTS daily_challenges (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     TEXT NOT NULL,
  correct INTEGER NOT NULL,
  total   INTEGER NOT NULL,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id      TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data    TEXT NOT NULL,
  touched BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user ON quiz_sessions(user_id);
`;

const txClient = new AsyncLocalStorage();
const conn = () => txClient.getStore() ?? pool;

export const query = (text, params) => conn().query(text, params);
export const one = async (text, params) => (await query(text, params)).rows[0];
export const all = async (text, params) => (await query(text, params)).rows;
export const run = async (text, params) => (await query(text, params)).rowCount;

export async function insertMany(table, columns, rows, suffix = '') {
  const size = Math.floor(65_535 / columns.length);
  let added = 0;
  for (let i = 0; i < rows.length; i += size) {
    const params = [];
    const values = rows.slice(i, i + size).map((r) => `(${r.map((v) => `$${params.push(v)}`).join(', ')})`);
    added += await run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ${values.join(', ')} ${suffix}`, params);
  }
  return added;
}

export async function tx(fn) {
  if (txClient.getStore()) return fn();
  const client = await pool.connect();
  let broken;
  try {
    await client.query('BEGIN');
    const out = await txClient.run(client, fn);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch((e) => (broken = e));
    throw err;
  } finally {
    client.release(broken);
  }
}

export const closeDb = () => pool.end();

const redact = (url) => {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '(unparseable DATABASE_URL)';
  }
};

try {
  await tx(async () => {
    await query('SELECT pg_advisory_xact_lock(4206)');
    if (config.db.schema) await query(`CREATE SCHEMA IF NOT EXISTS ${config.db.schema}`);
    await query(SCHEMA);
  });
} catch (err) {
  console.error(`[db] Cannot set up PostgreSQL at ${redact(config.db.url)}: ${err.message}`);
  console.error('[db] Check that PostgreSQL is running and that DATABASE_URL in server/.env is correct.');
  process.exit(1);
}