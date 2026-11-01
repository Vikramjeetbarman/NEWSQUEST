import { Router } from 'express';
import { config } from '../config.js';
import { all, one, run } from '../db.js';
import { buildDigest } from '../nlp/analyze.js';
import { truncate } from '../nlp/text.js';
import { ARTICLE_META_COLS, QUESTION_TYPES, rowToArticle } from '../quiz/engine.js';
import { aiEnabled } from '../services/ai.js';
import { evaluateAchievements, updateStats } from '../services/gamification.js';
import { requireUser } from '../services/auth.js';
import { SECTIONS, SOURCES } from '../services/feeds.js';
import { feedState } from '../services/fetcher.js';
import { sseHandler } from '../services/live.js';
import { demoScope, deepenArticle, enhanceWithAI, publicStatus, runCycle } from '../services/pipeline.js';
import { HttpError, asyncH, rateLimit, vEnum, vInt, vStr } from '../util.js';

export const newsRouter = Router();

const SECTION_KEYS = Object.keys(SECTIONS);
const SOURCE_KEYS = Object.keys(SOURCES);
const ID = /^[a-f0-9]{16}$/;

function card(a, counts) {
  return {
    id: a.id,
    source: a.source,
    section: a.section,
    title: a.title,
    description: truncate(a.description, 320),
    image: a.image,
    link: a.link || null,
    publishedAt: a.publishedAt,
    tldr: a.summary?.tldr || '',
    readingTime: a.summary?.readingTime || 1,
    keywords: (a.keywords || []).slice(0, 4).map((k) => k.text),
    questionCount: counts.get(a.id) || 0,
    isDemo: a.isDemo,
    deep: a.deep,
    ai: a.ai,
  };
}

async function cards(articles) {
  const rows = await all('SELECT article_id, COUNT(*) AS n FROM questions WHERE article_id = ANY($1) GROUP BY article_id', [
    articles.map((a) => a.id),
  ]);
  const counts = new Map(rows.map((r) => [r.article_id, r.n]));
  return articles.map((a) => card(a, counts));
}

async function sectionCounts(scope) {
  const [rows, qs] = await Promise.all([
    all('SELECT section, COUNT(*) AS n, MAX(published_at) AS latest FROM articles WHERE is_demo = $1 GROUP BY section', [scope]),
    all(
      'SELECT q.section, COUNT(*) AS n FROM questions q JOIN articles a ON a.id = q.article_id WHERE a.is_demo = $1 GROUP BY q.section',
      [scope],
    ),
  ]);
  const art = new Map(rows.map((r) => [r.section, r]));
  const qn = new Map(qs.map((r) => [r.section, r.n]));
  return SECTION_KEYS.map((key) => ({
    key,
    ...SECTIONS[key],
    articles: art.get(key)?.n || 0,
    latest: art.get(key)?.latest || null,
    questions: qn.get(key) || 0,
  }));
}

newsRouter.get(
  '/meta',
  asyncH(async (_req, res) => {
    const scope = demoScope();
    res.json({
      sections: await sectionCounts(scope),
      sources: SOURCES,
      status: publicStatus(),
      questionTypes: QUESTION_TYPES,
      aiEnabled: aiEnabled(),
      fullTextMode: config.fullTextMode,
      demo: scope === 1,
      timezone: config.timezone,
    });
  }),
);

newsRouter.get(
  '/news',
  asyncH(async (req, res) => {
    const section = vEnum(req.query.section, SECTION_KEYS, null);
    const source = vEnum(req.query.source, SOURCE_KEYS, null);
    const q = vStr(req.query.q, { name: 'Search', max: 80, optional: true });
    const limit = vInt(req.query.limit, { min: 1, max: 60, def: 24 });
    const offset = vInt(req.query.offset, { min: 0, max: 5000, def: 0 });
    const args = [demoScope()];
    const p = (v) => `$${args.push(v)}`;
    const where = ['is_demo = $1'];
    if (section) where.push(`section = ${p(section)}`);
    if (source) where.push(`source = ${p(source)}`);
    if (q) {
      const like = p(`%${q.replace(/[\%_]/g, (m) => `\\${m}`)}%`);
      where.push(`(title ILIKE ${like} OR description ILIKE ${like})`);
    }
    const w = where.join(' AND ');
    const [count, rows] = await Promise.all([
      one(`SELECT COUNT(*) AS n FROM articles WHERE ${w}`, args.slice()),
      all(`SELECT ${ARTICLE_META_COLS} FROM articles WHERE ${w} ORDER BY published_at DESC, id LIMIT ${p(limit)} OFFSET ${p(offset)}`, args),
    ]);
    res.json({ items: await cards(rows.map(rowToArticle)), total: count.n });
  }),
);

newsRouter.get(
  '/news/ticker',
  asyncH(async (_req, res) => {
    const rows = await all('SELECT id, title, section, source, published_at FROM articles WHERE is_demo = $1 ORDER BY published_at DESC LIMIT 15', [
      demoScope(),
    ]);
    res.json({ items: rows.map((r) => ({ id: r.id, title: r.title, section: r.section, source: r.source, publishedAt: r.published_at })) });
  }),
);

newsRouter.get(
  '/news/trending',
  asyncH(async (_req, res) => {
    const rows = (await all(`SELECT ${ARTICLE_META_COLS} FROM articles WHERE is_demo = $1 ORDER BY published_at DESC LIMIT 150`, [demoScope()])).map(
      rowToArticle,
    );
    const topics = new Map();
    for (const a of rows)
      for (const e of a.entities || [])
        if (['MISC', 'TERM'].includes(e.type) && e.text !== 'India') {
          const key = e.text.toLowerCase();
          const t = topics.get(key) || { term: e.text, type: e.type, count: 0, mentions: 0, articleIds: [] };
          if (!t.articleIds[t.articleIds.length - 1] !== a.id) {
            t.count++;
            t.articleIds.push(a.id);
          }
          t.mentions += e.count;
          topics.set(key, t);
        }
    const list = [...topics.values()]
      .sort((x, y) => y.count - x.count || y.mentions - x.mentions)
      .slice(0, 16)
      .map((t) => ({ ...t, articleIds: t.articleIds.slice(0, 6) }));
    const hot = new Set(list.slice(0, 8).flatMap((t) => t.articleIds));
    const stories = rows.filter((a) => hot.has(a.id)).slice(0, 6);
    res.json({ topics: list, stories: await cards(stories) });
  }),
);

const digestCache = new Map();
newsRouter.get(
  '/sections/:section/digest',
  asyncH(async (req, res) => {
    const section = req.params.section === 'all' ? 'all' : vEnum(req.params.section, SECTION_KEYS, null);
    if (!section) throw new HttpError(404, 'Unknown section');
    const scope = demoScope();
    const stamp = await one('SELECT MAX(fetched_at) AS f, COUNT(*) AS n FROM articles WHERE is_demo = $1', [scope]);
    const key = `${section}:${scope}:${stamp.f}:${stamp.n}`;
    if (!digestCache.has(key)) {
      const rows =
        section === 'all'
          ? await all(`SELECT ${ARTICLE_META_COLS} FROM articles WHERE is_demo = $1 ORDER BY published_at DESC LIMIT 80`, [scope])
          : await all(`SELECT ${ARTICLE_META_COLS} FROM articles WHERE is_demo = $1 AND section = $2 ORDER BY published_at DESC LIMIT 60`, [
              scope,
              section,
            ]);
      if (digestCache.size > 50) digestCache.clear();
      digestCache.set(key, { section, generatedAt: Date.now(), ...buildDigest(rows.map(rowToArticle)) });
    }
    res.json(digestCache.get(key));
  }),
);

async function loadArticle(id) {
  if (!ID.test(id)) throw new HttpError(404, 'Article not found');
  const row = await one('SELECT * FROM articles WHERE id = $1', [id]);
  if (!row) throw new HttpError(404, 'Article not found');
  return rowToArticle(row);
}

newsRouter.get(
  '/articles/:id',
  asyncH(async (req, res) => {
    const a = await loadArticle(req.params.id);
    const qs = await all('SELECT type, difficulty, COUNT(*) AS n FROM questions WHERE article_id = $1 GROUP BY type, difficulty', [a.id]);
    const keyEnts = (x) => (x.entities || []).filter((e) => !['MISC', 'TERM'].includes(e.type) && e.text !== 'India');
    const ents = new Set(keyEnts(a).slice(0, 6).map((e) => e.text.toLowerCase()));
    const related = (
      await all(`SELECT ${ARTICLE_META_COLS} FROM articles WHERE is_demo = $1 AND id != $2 ORDER BY published_at DESC LIMIT 120`, [
        a.isDemo ? 1 : 0,
        a.id,
      ])
    )
      .map(rowToArticle)
      .map((o) => {
        const shared = new Set(keyEnts(o).filter((e) => ents.has(e.text.toLowerCase())).map((e) => e.text.toLowerCase())).size;
        const same = o.section === a.section;
        return { o, shared, score: shared * 2 + (same ? 1 : 0) };
      })
      .filter((x) => x.shared >= 2 || (x.shared === 1 && x.o.section === a.section))
      .sort((x, y) => y.score - x.score)
      .slice(0, 4)
      .map((x) => x.o);
    const read = req.user ? Boolean(await one('SELECT 1 FROM reads WHERE user_id = $1 AND article_id = $2', [req.user.id, a.id])) : false;
    const [main, ...relatedCards] = await cards([a, ...related]);
    res.json({
      article: { ...main, content: a.content || a.description, summary: a.summary, keywords: a.keywords, entities: a.entities, author: a.author },
      questions: { total: qs.reduce((s, r) => s + r.n, 0), breakdown: qs },
      related: relatedCards,
      read,
      canDeepRead: !a.isDemo && !a.deep && config.fullTextMode !== 'off',
      canAI: aiEnabled(),
    });
  }),
);

newsRouter.post(
  '/articles/:id/read',
  asyncH(async (req, res) => {
    const a = await loadArticle(req.params.id);
    if (!req.user) return res.json({ ok: true, achievements: [] });
    await run('INSERT INTO reads (user_id, article_id, read_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [req.user.id, a.id, Date.now()]);
    res.json({ ok: true, achievements: await evaluateAchievements(req.user.id) });
  }),
);

const deepLimiter = rateLimit({ windowMs: 60_000, max: 6, key: 'deep' });
newsRouter.post(
  '/articles/:id/deep',
  deepLimiter,
  asyncH(async (req, res) => {
    await loadArticle(req.params.id);
    const updated = await deepenArticle(req.params.id);
    let achievements = [];
    if (req.user) {
      await updateStats(req.user.id, (s) => s.deepReads++);
      achievements = await evaluateAchievements(req.user.id);
    }
    res.json({ ok: true, article: updated.id, achievements });
  }),
);

const aiLimiter = rateLimit({ windowMs: 60_000, max: 4, key: 'ai' });
newsRouter.post(
  '/articles/:id/ai',
  requireUser,
  aiLimiter,
  asyncH(async (req, res) => {
    await loadArticle(req.params.id);
    const out = await enhanceWithAI(req.params.id);
    res.json({ ok: true, added: out.added });
  }),
);

newsRouter.get('/sources', (_req, res) => {
  const feeds = [...feedState.values()].map(({ etag: _e, lastModified: _l, ...f }) => ({ ...f, sourceName: SOURCES[f.source]?.name }));
  res.json({ feeds, status: publicStatus() });
});

const refreshLimiter = rateLimit({ windowMs: 60_000, max: 2, key: 'refresh' });
newsRouter.post(
  '/admin/refresh',
  requireUser,
  refreshLimiter,
  asyncH(async (_req, res) => {
    const r = await runCycle();
    res.json({ ...r, status: publicStatus() });
  }),
);

newsRouter.get('/stream', sseHandler);