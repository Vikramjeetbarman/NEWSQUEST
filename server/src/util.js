import crypto from 'node:crypto';
import { config } from './config.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

export const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const newId = (bytes = 9) => crypto.randomBytes(bytes).toString('base64url');
export const hash = (s, len = 16) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, len);
export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function parseJSON(s, fallback) {
  if (s === null) return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

export function seededRandom(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) {
    h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = (arr, rand = Math.random) => arr[Math.floor(rand() * arr.length)];

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, hour: '2-digit', hourCycle: 'h23' });

export const dayKey = (ts = Date.now()) => dayFmt.format(ts);
export const hourOf = (ts = Date.now()) => Number(hourFmt.format(ts));
export const prevDayKey = (day) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export function rateLimit({ windowMs, max, key = 'default' }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref();
  return (req, res, next) => {
    const k = `${key}:${req.ip}`;
    const now = Date.now();
    let entry = hits.get(k);
    if (!entry || entry.reset < now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(k, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests, please slow down.' });
    }
    next();
  };
}

export function vStr(v, { name = 'value', min = 0, max = 200, pattern, optional = false, visible = false } = {}) {
  if (v == null || v === '') {
    if (optional) return undefined;
    throw new HttpError(400, `${name} is required`);
  }
  if (typeof v !== 'string') throw new HttpError(400, `${name} must be text`);
  const s = visible ? v.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim() : v.trim();
  if (s.length < min || s.length > max) throw new HttpError(400, `${name} must be ${min}-${max} characters`);
  if (pattern && !pattern.test(s)) throw new HttpError(400, `${name} has invalid characters`);
  return s;
}

export function vInt(v, { min = 0, max = 1e9, def } = {}) {
  if (v == null || v === '') return def;
  const n = Number(v);
  if (!Number.isInteger(n)) return def;
  return clamp(n, min, max);
}

export function vEnum(v, allowed, def) {
  return allowed.includes(v) ? v : def;
}

export function vList(v, allowed, maxLen = 20) {
  const arr = Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(',') : [];
  return [...new Set(arr.filter((x) => typeof x === 'string' && allowed.includes(x)))].slice(0, maxLen);
}