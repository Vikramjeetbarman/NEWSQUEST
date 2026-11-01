import { Router } from 'express';
import { one, run, tx } from '../db.js';
import {
  createSession,
  createUser,
  destroySession,
  hashPassword,
  publicUser,
  verifyAgainstDummy,
  verifyPassword,
} from '../services/auth.js';
import { HttpError, asyncH, rateLimit, vStr } from '../util.js';

export const authRouter = Router();
const limiter = rateLimit({ windowMs: 15 * 60_000, max: 30, key: 'auth' });

const USERNAME = /^[a-zA-Z0-9_.-]+$/;
const readCreds = (body) => ({
  username: vStr(body?.username, { name: 'Username', min: 3, max: 24, pattern: USERNAME }),
  password: vStr(body?.password, { name: 'Password', min: 8, max: 128 }),
});

authRouter.get('/me', (req, res) => res.json({ user: publicUser(req.user) }));

authRouter.post(
  '/register',
  limiter,
  asyncH(async (req, res) => {
    const { username, password } = readCreds(req.body);
    const displayName = vStr(req.body?.displayName, { name: 'Display name', min: 1, max: 32, optional: true }) || username;
    if (await one('SELECT 1 FROM users WHERE lower(username) = lower($1)', [username])) throw new HttpError(409, 'That username is taken');
    const passwordHash = await hashPassword(password);
    let user;
    try {
      if (req.user?.is_guest) {
        user = await tx(async () => {
          const u = await one('UPDATE users SET username = $1, display_name = $2, password_hash = $3, is_guest = 0 WHERE id = $4 RETURNING *', [
            username,
            displayName,
            passwordHash,
            req.user.id,
          ]);
          await run('DELETE FROM sessions WHERE user_id = $1', [req.user.id]);
          return u;
        });
      } else {
        user = await createUser({ username, displayName, passwordHash });
      }
    } catch (err) {
      if (err.code === '23505') throw new HttpError(409, 'That username is taken');
      throw err;
    }
    await createSession(res, user.id);
    res.status(201).json({ user: publicUser(user) });
  }),
);

authRouter.post(
  '/login',
  limiter,
  asyncH(async (req, res) => {
    const { username, password } = readCreds(req.body);
    const user = await one('SELECT * FROM users WHERE lower(username) = lower($1) AND is_guest = 0', [username]);
    const ok = user ? await verifyPassword(password, user.password_hash) : await verifyAgainstDummy(password);
    if (!ok) throw new HttpError(401, 'Invalid username or password');
    await createSession(res, user.id);
    res.json({ user: publicUser(user) });
  }),
);

const GUEST_NAMES = ['Curious Owl', 'Swift Falcon', 'Bright Panda', 'Keen Tiger', 'Bold Peacock', 'Wise Elephant', 'Quick Cheetah', 'Calm Dolphin'];

authRouter.post(
  '/guest',
  limiter,
  asyncH(async (req, res) => {
    if (req.user) return res.json({ user: publicUser(req.user) });
    const suffix = Math.random().toString(36).slice(2, 8);
    const user = await createUser({
      username: `guest_${suffix}`,
      displayName: `${GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)]} ${suffix.slice(0, 3).toUpperCase()}`,
      isGuest: true,
    });
    await createSession(res, user.id);
    res.status(201).json({ user: publicUser(user) });
  }),
);

authRouter.post(
  '/logout',
  asyncH(async (req, res) => {
    await destroySession(req, res);
    res.json({ ok: true });
  }),
);