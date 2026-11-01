import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { one, run } from '../db.js';
import { HttpError, asyncH, dayKey, newId, sha256 } from '../util.js';
import { effectiveStreak, getStats, levelInfo } from './gamification.js';

const scrypt = promisify(crypto.scrypt);
const N = 16384;
const KEYLEN = 64;
export const COOKIE = 'nq_session';
const SESSION_MS = 30 * 86_400_000;

export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const dk = await scrypt(pw, salt, KEYLEN, { N, r: 8, p: 1 });
  return `scrypt$${N}$${salt.toString('base64')}$${dk.toString('base64')}`;
}

export async function verifyPassword(pw, stored) {
  const [alg, n, saltB64, hashB64] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const dk = await scrypt(pw, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(n), r: 8, p: 1 });
  return crypto.timingSafeEqual(dk, expected);
}

let dummyHash = null;
export async function verifyAgainstDummy(pw) {
  dummyHash ||= await hashPassword('not-a-real-password');
  await verifyPassword(pw, dummyHash);
  return false;
}

export async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = Date.now() + SESSION_MS;
  await run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [sha256(token), userId, expires]);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: SESSION_MS,
    path: '/',
  });
}

export async function destroySession(req, res) {
  const token = req.cookies?.[COOKIE];
  if (token) await run('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  res.clearCookie(COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure: config.cookieSecure });
}

export const attachUser = asyncH(async (req, _res, next) => {
  const token = req.cookies?.[COOKIE];
  if (typeof token === 'string' && token.length >= 20 && token.length <= 100) {
    const row = await one(
      'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > $2',
      [sha256(token), Date.now()],
    );
    if (row) req.user = row;
  }
  next();
});

export function requireUser(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in (or continue as a guest) first'));
  next();
}

export function createUser({ username, displayName, passwordHash = null, isGuest = false }) {
  return one(
    'INSERT INTO users (id, username, display_name, password_hash, is_guest, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [newId(), username, displayName, passwordHash, isGuest ? 1 : 0, Date.now()],
  );
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    avatar: u.avatar,
    isGuest: Boolean(u.is_guest),
    xp: u.xp,
    coins: u.coins,
    streak: effectiveStreak(u),
    bestStreak: u.best_streak,
    lastActiveDay: u.last_active_day,
    activeToday: u.last_active_day === dayKey(),
    createdAt: u.created_at,
    level: levelInfo(u.xp),
    stats: getStats(u),
  };
}

setInterval(() => {
  run('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]).catch((err) => console.error('[auth] session cleanup failed:', err.message));
}, 3_600_000).unref();