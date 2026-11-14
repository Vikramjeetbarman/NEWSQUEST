import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');

const envFile = path.join(SERVER_ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const env = process.env;
const num = (v, def, min, max) => {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const bool = (v, def) => (v == null || v === '' ? def : /^(1|true|yes|on)$/i.test(v));

const isProd = env.NODE_ENV === 'production';

if (env.DATABASE_SCHEMA && !/^[a-z_][a-z0-9_]{0,62}$/.test(env.DATABASE_SCHEMA))
  throw new Error('DATABASE_SCHEMA must be a lowercase SQL identifier (letters, digits, underscores)');

export const config = {
  port: num(env.PORT, 8787, 1, 65535),
  isProd,
  db: {
    url: env.DATABASE_URL || 'postgres://newsquest@localhost:5432/newsquest',
    schema: env.DATABASE_SCHEMA || null,
  },
  clientDist: path.resolve(SERVER_ROOT, '..', 'client', 'dist'),
  fetchIntervalMinutes: num(env.FETCH_INTERVAL_MINUTES, 15, 1, 1440),
  maxArticleAgeDays: num(env.MAX_ARTICLE_AGE_DAYS, 7, 1, 90),
  demoFallback: bool(env.DEMO_FALLBACK, true),
  timezone: env.APP_TIMEZONE || 'Asia/Kolkata',
  fullTextMode: ['off', 'ondemand', 'background'].includes(env.FULL_TEXT_MODE) ? env.FULL_TEXT_MODE : 'ondemand',
  cookieSecure: bool(env.COOKIE_SECURE, isProd),
  ai: {
    apiKey: env.OPENAI_API_KEY || '',
    baseUrl: (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    model: env.OPENAI_MODEL || 'gpt-4o-mini',
    autoEnhance: bool(env.AI_AUTO_ENHANCE, false),
  },
};