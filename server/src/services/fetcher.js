import { XMLParser } from 'fast-xml-parser';
import { config } from '../config.js';
import { classifySection } from '../nlp/analyze.js';
import { cleanTitle, decodeEntities, normKey, stripHtml } from '../nlp/text.js';
import { HttpError, hash } from '../util.js';
import { FEEDS, isAllowedHost } from './feeds.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 NewsQuest/1.0';
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', trimValues: true });

export const feedState = new Map(
  FEEDS.map((f) => [f.id, { ...f, status: 'pending', message: 'Not fetched yet', items: 0, lastAttempt: null, lastOk: null, ms: null, etag: null, lastModified: null }]),
);

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const txt = (v) => {
  if (v == null) return '';
  if (Array.isArray(v)) return txt(v[0]);
  if (typeof v === 'object') return String(v['#text'] ?? v['@_href'] ?? '');
  return String(v);
};

const httpUrl = (u) => {
  const s = decodeEntities(String(u || '')).trim();
  return /^https?:\/\/[^\s"<>]+$/i.test(s) ? s : null;
};

export function normLink(link) {
  try {
    const u = new URL(link);
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return link;
  }
}

function looksBlocked(body) {
  return /zscaler|access denied|has been blocked|web filter|forbidden|policy violation|captcha/i.test(body.slice(0, 5000));
}

function describeError(err) {
  const code = String(err?.cause?.code || err?.code || '');
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return ['error', 'Timed out waiting for the feed'];
  if (/ECONNRESET|ECONNREFUSED|UND_ERR_SOCKET/.test(code)) return ['blocked', 'Connection reset - likely blocked by a network proxy or firewall'];
  if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS/.test(code)) return ['blocked', 'TLS certificate rejected (corporate TLS inspection?)'];
  if (/ENOTFOUND|EAI_AGAIN/.test(code)) return ['offline', 'DNS lookup failed - are you online?'];
  return ['error', String(err?.message || err).slice(0, 200)];
}

function extractImage(item, rawDesc) {
  const cands = [
    ...asArray(item['media:content']).map((m) => m?.['@_url']),
    ...asArray(item['media:thumbnail']).map((m) => m?.['@_url']),
    ...asArray(item.enclosure)
      .filter((e) => !e?.['@_type'] || /^image\//.test(e['@_type']))
      .map((e) => e?.['@_url']),
    /img[^>]+src=["']([^"']+)["']/i.exec(rawDesc)?.[1],
  ];
  for (const c of cands) {
    const u = httpUrl(c);
    if (u) return u;
  }
  return null;
}

function normalizeItem(item, feed, now) {
  const rawTitle = txt(item.title);
  const link = httpUrl(txt(item.link) || txt(item.guid));
  const title = cleanTitle(stripHtml(rawTitle));
  if (!title || !link) return null;
  const rawDesc = txt(item.description) || txt(item.summary);
  const description = stripHtml(rawDesc).slice(0, 2500);
  const encoded = stripHtml(txt(item['content:encoded']) || txt(item.content));
  const content = encoded.length > description.length + 40 ? encoded.slice(0, 20000) : '';
  let published = Date.parse(txt(item.pubDate) || txt(item.published) || txt(item.updated) || txt(item['dc:date']));
  if (!Number.isFinite(published) || published > now + 5 * 60_000) published = now;
  if (now - published > config.maxArticleAgeDays * 86_400_000) return null;
  return {
    id: hash(normLink(link)),
    source: feed.source,
    section: feed.section === 'auto' ? classifySection(title, description) : feed.section,
    feedId: feed.id,
    title,
    titleKey: normKey(title).slice(0, 120),
    link,
    description,
    content,
    image: extractImage(item, rawDesc),
    author: stripHtml(txt(item['dc:creator'])) || txt(item.author).slice(0, 120) || null,
    publishedAt: published,
  };
}

async function fetchFeed(feed) {
  const st = feedState.get(feed.id);
  const t0 = Date.now();
  st.lastAttempt = t0;
  const headers = { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5' };
  if (st.etag) headers['If-None-Match'] = st.etag;
  if (st.lastModified) headers['If-Modified-Since'] = st.lastModified;
  try {
    const res = await fetch(feed.url, { headers, signal: AbortSignal.timeout(20_000) });
    st.ms = Date.now() - t0;
    if (res.status === 304) {
      Object.assign(st, { status: 'ok', message: 'Not modified since last fetch', lastOk: Date.now() });
      return [];
    }
    const body = (await res.text()).slice(0, 6_000_000);
    if (!res.ok) {
      const blocked = res.status === 403 || res.status === 451 || looksBlocked(body);
      Object.assign(st, { status: blocked ? 'blocked' : 'error', message: `HTTP ${res.status}${blocked ? ' - access blocked' : ''}` });
      return [];
    }
    if (!/^\s*(<\?xml|<rss|<feed|<rdf)/i.test(body)) {
      const blocked = looksBlocked(body);
      Object.assign(st, { status: blocked ? 'blocked' : 'error', message: blocked ? 'Blocked by a network filter (received an HTML block page)' : 'Response was not an RSS feed' });
      return [];
    }
    const doc = parser.parse(body);
    const items = asArray(doc?.rss?.channel?.item ?? doc?.feed?.entry ?? doc?.['rdf:RDF']?.item);
    const now = Date.now();
    const out = items.map((it) => normalizeItem(it, feed, now)).filter(Boolean);
    Object.assign(st, {
      status: 'ok',
      message: `${out.length} recent stories`,
      items: out.length,
      lastOk: now,
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
    });
    return out;
  } catch (err) {
    const [status, message] = describeError(err);
    Object.assign(st, { status, message, ms: Date.now() - t0 });
    return [];
  }
}

export async function fetchAllFeeds() {
  const queue = [...FEEDS];
  const results = [];
  const worker = async () => {
    while (queue.length) results.push(...(await fetchFeed(queue.shift())));
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  const byId = new Map();
  const titles = new Set();
  for (const it of results.sort((a, b) => b.publishedAt - a.publishedAt)) {
    if (byId.has(it.id) || titles.has(it.titleKey)) continue;
    byId.set(it.id, it);
    titles.add(it.titleKey);
  }
  return [...byId.values()];
}

function findArticleBody(node, depth = 0) {
  if (!node || depth > 8) return '';
  if (Array.isArray(node)) return node.map((n) => findArticleBody(n, depth + 1)).sort((a, b) => b.length - a.length)[0] || '';
  if (typeof node === 'object') {
    if (typeof node.articleBody === 'string') return node.articleBody;
    return Object.values(node).map((n) => findArticleBody(n, depth + 1)).sort((a, b) => b.length - a.length)[0] || '';
  }
  return '';
}

export function extractArticleText(html) {
  let best = '';
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const body = findArticleBody(JSON.parse(m[1].trim()));
      if (body.length > best.length) best = body;
    } catch {}
  }
  if (best.length < 400) {
    const paras = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => stripHtml(m[1]))
      .filter((p) => p.length > 60 && !/subscribe|sign in|©|copyright|download the app|follow us/i.test(p));
    const joined = paras.join('\n\n');
    if (joined.length > best.length) best = joined;
  }
  return stripHtml(best).slice(0, 20000);
}

export async function fetchFullText(link) {
  let url = new URL(link);
  for (let hop = 0; hop < 4; hop++) {
    if (!/^https?:$/.test(url.protocol) || url.port || url.username || !isAllowedHost(url.hostname))
      throw new HttpError(400, 'This source is not allowed for deep reads');
    let res;
    try {
      res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(15_000) });
    } catch (err) {
      throw new HttpError(502, describeError(err)[1]);
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) break;
      url = new URL(loc, url);
      continue;
    }
    const html = (await res.text()).slice(0, 4_000_000);
    if (!res.ok || looksBlocked(html)) throw new HttpError(502, res.ok ? 'The page was blocked by a network filter' : `Source responded with HTTP ${res.status}`);
    const text = extractArticleText(html);
    if (text.length < 200) throw new HttpError(502, 'Could not extract the article text');
    return text;
  }
  throw new HttpError(502, 'Too many redirects');
}