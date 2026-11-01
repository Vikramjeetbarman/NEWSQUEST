import { all, insertMany } from '../db.js';
import { HONORIFICS, ROLE_POOL } from '../nlp/gazetteer.js';
import { normKey } from '../nlp/text.js';
import { parseJSON } from '../util.js';
import { generateArticleQuestions, generateMatchQuestion } from './generators.js';

export { QUESTION_TYPES, DIFFICULTIES } from './generators.js';

export function rowToArticle(r) {
  return {
    id: r.id,
    source: r.source,
    section: r.section,
    title: r.title,
    link: r.link,
    description: r.description,
    content: r.content || '',
    image: r.image,
    author: r.author,
    publishedAt: r.published_at,
    fetchedAt: r.fetched_at,
    summary: parseJSON(r.summary, { tldr: r.description, points: [], readingTime: 1 }),
    keywords: parseJSON(r.keywords, []),
    entities: parseJSON(r.entities, []),
    isDemo: Boolean(r.is_demo),
    deep: Boolean(r.deep),
    ai: Boolean(r.ai),
  };
}

export function rowToQuestion(r) {
  return {
    id: r.id,
    articleId: r.article_id,
    section: r.section,
    type: r.type,
    difficulty: r.difficulty,
    prompt: r.prompt,
    options: parseJSON(r.options, []),
    answer: r.answer,
    explanation: r.explanation,
    extra: parseJSON(r.extra, {}),
    origin: r.origin,
  };
}

export function publicQuestion(q) {
  const { context, statements, pairs, ask } = q.extra || {};
  return {
    id: q.id,
    section: q.section,
    type: q.type,
    difficulty: q.difficulty,
    prompt: q.prompt,
    options: q.options,
    context: context || null,
    statements: statements || null,
    pairs: pairs || null,
    ask: ask || null,
    origin: q.origin || 'engine',
  };
}

export function revealQuestion(q) {
  return { ...publicQuestion(q), answer: q.answer, explanation: q.explanation, source: q.extra?.source || null, articleId: q.articleId };
}

export function buildPools(articles) {
  const global = new Map();
  const bySection = new Map();
  const byArticle = new Map();
  const keywordsBySection = new Map();
  const roles = new Set(ROLE_POOL);
  const add = (map, type, name) => {
    if (!map.has(type)) map.set(type, new Set());
    map.get(type).add(name);
  };
  for (const a of articles) {
    if (!bySection.has(a.section)) bySection.set(a.section, new Map());
    const sec = bySection.get(a.section);
    const keys = new Set();
    for (const e of a.entities || []) {
      if (e.type === 'MISC') continue;
      add(global, e.type, e.text);
      add(sec, e.type, e.text);
      keys.add(normKey(e.text));
      if (e.canonical) keys.add(normKey(e.canonical));
      if (e.role && !HONORIFICS.has(e.role)) roles.add(e.role);
    }
    byArticle.set(a.id, keys);
    if (!keywordsBySection.has(a.section)) keywordsBySection.set(a.section, []);
    keywordsBySection.get(a.section).push(...(a.keywords || []).slice(0, 5).map((k) => k.text));
  }
  const freeze = (m) => new Map([...m].map(([k, v]) => [k, [...v]]));
  return {
    global: freeze(global),
    bySection: new Map([...bySection].map(([k, v]) => [k, freeze(v)])),
    byArticle,
    keywordsBySection,
    roles: [...roles],
  };
}

const QUESTION_COLS = ['id', 'article_id', 'section', 'type', 'difficulty', 'prompt', 'options', 'answer', 'explanation', 'extra', 'origin', 'created_at'];

export function saveQuestions(qs, origin = 'engine') {
  const now = Date.now();
  const rows = qs.map((q) => [
    q.id, q.articleId, q.section, q.type, q.difficulty, q.prompt, JSON.stringify(q.options), q.answer,
    q.explanation, JSON.stringify(q.extra || {}), q.origin || origin, now,
  ]);
  return insertMany('questions', QUESTION_COLS, rows, 'ON CONFLICT DO NOTHING');
}

export const ARTICLE_META_COLS =
  'id, source, section, feed_id, title, title_key, link, description, image, author, published_at, fetched_at, summary, keywords, entities, is_demo, deep, ai';

export async function generateFor(articleIds, { isDemo = null } = {}) {
  const cols = `${ARTICLE_META_COLS}, CASE WHEN id = ANY($1) THEN content END AS content`;
  const rows =
    isDemo === null
      ? await all(`SELECT ${cols} FROM articles`, [articleIds])
      : await all(`SELECT ${cols} FROM articles WHERE is_demo = $2`, [articleIds, isDemo ? 1 : 0]);
  const articles = rows.map(rowToArticle);
  const pools = buildPools(articles);
  const wanted = new Set(articleIds);
  const qs = [];
  for (const a of articles) if (wanted.has(a.id)) qs.push(...generateArticleQuestions(a, pools));

  const touched = new Set(articles.filter((a) => wanted.has(a.id)).map((a) => a.section));
  for (const section of touched) {
    const secArticles = articles.filter((a) => a.section === section).sort((x, y) => y.publishedAt - x.publishedAt).slice(0, 24);
    for (let i = 0; i < 3; i++) {
      const m = generateMatchQuestion(section, secArticles, `${secArticles[0]?.id || ''}:${i}`);
      if (m) qs.push(m);
    }
  }
  return saveQuestions(qs);
}