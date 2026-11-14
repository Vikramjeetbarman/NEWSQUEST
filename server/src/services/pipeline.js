import { config } from '../config.js';
import { DEMO_ARTICLES } from '../data/demo.js';
import { all, insertMany, one, run, tx } from '../db.js';
import { analyzeArticle, corpusAdd, corpusRemove, corpusReset } from '../nlp/analyze.js';
import { normKey } from '../nlp/text.js';
import { generateFor, rowToArticle, saveQuestions } from '../quiz/engine.js';
import { HttpError, hash, seededRandom, shuffle } from '../util.js';
import { aiEnabled, aiEnhance } from './ai.js';
import { SOURCES } from './feeds.js';
import { feedState, fetchAllFeeds, fetchFullText } from './fetcher.js';
import { broadcast } from './live.js';

export const scheduler = { running: false, lastRun: null, nextRun: null, lastAdded: 0, lastError: null, cycles: 0 };

const ARTICLE_COLS = [
  'id', 'source', 'section', 'feed_id', 'title', 'title_key', 'link', 'description', 'content', 'image', 'author',
  'published_at', 'fetched_at', 'summary', 'keywords', 'entities', 'is_demo',
];

const corpusText = (a) => `${a.title} ${a.description} ${a.content || ''}`;

export async function rebuildCorpus() {
  corpusReset();
  for (const r of await all('SELECT id, title, description, content FROM articles')) corpusAdd(corpusText(r), r.id);
}

export async function ingest(items, { isDemo = false } = {}) {
  if (!items.length) return [];
  const scope = isDemo ? 1 : 0;
  const known = await all('SELECT id, title_key, is_demo FROM articles WHERE id = ANY($1) OR (is_demo = $3 AND title_key = ANY($2))', [
    items.map((it) => it.id),
    items.map((it) => it.titleKey),
    scope,
  ]);
  const ids = new Set(known.map((r) => r.id));
  const titles = new Set(known.filter((r) => r.is_demo === scope).map((r) => r.title_key));
  const fresh = items.filter((it) => !ids.has(it.id) && !titles.has(it.titleKey));
  if (!fresh.length) return [];
  fresh.forEach((it) => corpusAdd(corpusText(it), it.id));
  const now = Date.now();
  const rows = fresh.map((it) => {
    const an = analyzeArticle(it);
    return [
      it.id, it.source, it.section, it.feedId || null, it.title, it.titleKey, it.link, it.description, it.content || null,
      it.image || null, it.author || null, it.publishedAt, now, JSON.stringify(an.summary), JSON.stringify(an.keywords),
      JSON.stringify(an.entities), scope,
    ];
  });
  await tx(() => insertMany('articles', ARTICLE_COLS, rows, 'ON CONFLICT (id) DO NOTHING'));
  await generateFor(
    fresh.map((f) => f.id),
    { isDemo },
  );
  return fresh;
}

export async function seedDemo() {
  const now = Date.now();
  const order = shuffle(
    DEMO_ARTICLES.map((_, i) => i),
    seededRandom('demo-order'),
  );
  const items = DEMO_ARTICLES.map((d, i) => ({
    id: hash(`demo:${d.key}`),
    source: 'archive',
    section: d.section,
    feedId: 'demo',
    title: d.title,
    titleKey: normKey(d.title).slice(0, 120),
    link: '',
    description: d.description,
    content: d.content,
    image: null,
    author: null,
    publishedAt: now - 15 * 60_000 - Math.round((order.indexOf(i) / DEMO_ARTICLES.length) * 46 * 3_600_000),
  }));
  const added = await ingest(items, { isDemo: true });
  await run('UPDATE articles SET published_at = v.at FROM unnest($1::text[], $2::bigint[]) AS v(id, at) WHERE articles.id = v.id AND articles.is_demo = 1', [
    items.map((it) => it.id),
    items.map((it) => it.publishedAt),
  ]);
  return added.length;
}

let liveTotal = 0;
let liveQuestionTotal = 0;
async function refreshLiveCount() {
  liveTotal = (await one("SELECT COUNT(*) AS n FROM articles WHERE is_demo = 0")).n;
  liveQuestionTotal = (await one("SELECT COUNT(*) AS n FROM questions q JOIN articles a ON a.id = q.article_id WHERE a.is_demo = 0")).n;
}
await refreshLiveCount();

export const liveCount = () => liveTotal;

export const demoScope = () => (liveQuestionTotal >= 10 || !config.demoFallback ? 0 : 1);

export function publicStatus() {
  const feeds = { ok: 0, blocked: 0, error: 0, offline: 0, pending: 0 };
  for (const f of feedState.values()) feeds[f.status] = (feeds[f.status] || 0) + 1;
  const live = liveCount();
  return {
    running: scheduler.running,
    lastRun: scheduler.lastRun,
    nextRun: scheduler.nextRun,
    lastAdded: scheduler.lastAdded,
    lastError: scheduler.lastError,
    intervalMinutes: config.fetchIntervalMinutes,
    liveCount: live,
    mode: demoScope() === 0 ? 'live' : config.demoFallback ? 'demo' : 'empty',
    feeds,
  };
}

function prune() {
  const cutoff = Date.now() - config.maxArticleAgeDays * 86_400_000;
  return all(
    'DELETE FROM articles WHERE is_demo = 0 AND (published_at < $1 OR source <> ALL($2)) RETURNING id',
    [cutoff, Object.keys(SOURCES)],
  ).then((deleted) => {
    for (const article of deleted) corpusRemove(article.id);
    return deleted.length;
  });
}

export async function runCycle() {
  if (scheduler.running) return { skipped: true };
  scheduler.running = true;
  broadcast('status', publicStatus());
  let added = [];
  try {
    const items = await fetchAllFeeds();
    added = await ingest(items, { isDemo: false });
    await prune();
    await refreshLiveCount();
    scheduler.lastError = null;
  } catch (err) {
    scheduler.lastError = String(err.message || err);
    console.error('[scheduler]', err);
  } finally {
    scheduler.running = false;
    scheduler.lastRun = Date.now();
    scheduler.lastAdded = added.length;
    scheduler.cycles++;
  }
  if (added.length) {
    broadcast('news', {
      added: added.length,
      headlines: added.slice(0, 3).map((a) => ({ id: a.id, title: a.title, section: a.section })),
    });
    if (config.fullTextMode === 'background') deepenInBackground(added.slice(0, 15).map((a) => a.id));
    if (config.ai.autoEnhance && aiEnabled()) {
      (async () => {
        for (const a of added.slice(0, 5)) await enhanceWithAI(a.id).catch(() => ({}));
      })();
    }
  }
  broadcast('status', publicStatus());
  return { added: added.length };
}

export async function startScheduler() {
  await prune();
  await refreshLiveCount();
  await rebuildCorpus();
  if (config.demoFallback) {
    const n = await seedDemo();
    if (n) console.log(`[demo] seeded ${n} archive stories`);
  }
  const loop = async () => {
    await runCycle();
    scheduler.nextRun = Date.now() + config.fetchIntervalMinutes * 60_000;
    setTimeout(loop, config.fetchIntervalMinutes * 60_000);
  };
  loop();
}

const inflight = new Map();

export function deepenArticle(id) {
  if (inflight.has(id)) return inflight.get(id);
  const p = (async () => {
    const row = await one('SELECT * FROM articles WHERE id = $1', [id]);
    if (!row) throw new HttpError(404, 'Article not found');
    if (row.is_demo) throw new HttpError(400, 'Archive stories already include their full text');
    if (row.deep) return rowToArticle(row);
    if (config.fullTextMode === 'off') throw new HttpError(400, 'Full-text reading is disabled on this server');
    const text = await fetchFullText(row.link);
    const previous = rowToArticle(row);
    const a = { ...previous, content: text };
    corpusAdd(corpusText(a), a.id);
    const an = analyzeArticle(a);
    await tx(async () => {
      await run('UPDATE articles SET content = $1, summary = $2, keywords = $3, entities = $4, deep = 1 WHERE id = $5', [
        text,
        JSON.stringify(an.summary),
        JSON.stringify(an.keywords),
        JSON.stringify(an.entities),
        id,
      ]);
      await run("DELETE FROM questions WHERE article_id = $1 AND origin = 'engine' AND type != 'match'", [id]);
    });
    await generateFor([id], { isDemo: false });
    return rowToArticle(await one('SELECT * FROM articles WHERE id = $1', [id]));
  })().finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

async function deepenInBackground(ids) {
  for (const id of ids) {
    try {
      await deepenArticle(id);
    } catch {}
  }
}

export async function enhanceWithAI(id) {
  const row = await one('SELECT * FROM articles WHERE id = $1', [id]);
  if (!row) throw new HttpError(404, 'Article not found');
  if (!aiEnabled()) throw new HttpError(400, 'AI enhancement is not configured on this server');
  const a = rowToArticle(row);
  const out = await aiEnhance(a);
  if (out.tldr) {
    const summary = { ...a.summary, tldr: out.tldr, points: out.points.length ? out.points : a.summary.points, ai: true };
    await run('UPDATE articles SET summary = $1, ai = 1 WHERE id = $2', [JSON.stringify(summary), id]);
  }
  const added = await saveQuestions(out.questions, 'ai');
  return { added, article: rowToArticle(await one('SELECT * FROM articles WHERE id = $1', [id])) };
}