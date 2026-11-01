const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', rupee: '₹', middot: '·', bull: '•',
};

export function decodeEntities(s = '') {
  return String(s).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? m;
  });
}

const stripTags = (s) =>
  s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(br|v|p|div|v|li|v|h\d)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');

export function stripHtml(s = '') {
  let t = decodeEntities(stripTags(String(s)));
  if (/<[a-z]/i.test(t)) t = decodeEntities(stripTags(t));
  return t.replace(/\s+/g, ' ').trim();
}

const TITLE_PREFIX =
  /^(watch|video|videos|photos?|pics|in pics|live|live updates?|explained|listen|podcast|data|morning digest|evening wrap|top news|news wrap|breaking|exclusive|opinion|editorial|analysis|interview|q&a|faq)\s*[:|—–-]\s*/i;

export function cleanTitle(t = '') {
  let s = stripHtml(t);
  for (let i = 0; i < 2; i++) s = s.replace(TITLE_PREFIX, '');
  return s
    .replace(/\s*[-|—–]\s*(the hindu|times of india|toi|india news)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const wordCount = (s = '') => (s.match(/\S+/g) || []).length;

const ABBREV = new Set(
  'mr mrs ms dr prof sr jr st no nos vs etc inc ltd co corp govt dept rs approx est fig jan feb mar apr jun jul aug sep sept oct nov dec lt gen col capt ' +
  'maj hon rev gov sen rep mt smt shri sh pvt bros ave vol art sec cl ch ex adm brig cmdr supt insp'.split(' ')
);

export function splitSentences(text = '') {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const out = [];
  let start = 0;
  const re = /[.!?]+["'”)]*\s+(?=["'”(]*[A-Z0-9])/g;
  let m;
  while ((m = re.exec(t))) {
    if (t[m.index] === '.') {
      const tail = /([A-Za-z.]+)\.$/.exec(t.slice(Math.max(start, m.index - 14), m.index + 1));
      if (tail) {
        const w = tail[1].toLowerCase();
        if (ABBREV.has(w) || /^[a-z]\.$/.test(w) || /^([a-z]\.)+[a-z]$/.test(w)) continue;
      }
    }
    const end = m.index + m[0].length;
    out.push(t.slice(start, end).trim());
    start = end;
  }
  const rest = t.slice(start).trim();
  if (rest) out.push(rest);
  return out.filter((s) => s.length > 2);
}

export const STOPWORDS = new Set(
  'a about above across after again against ago ahead all almost along already also although always am among an and another any anyone anything are around ' +
  'as at away back be became because become becomes been before being below beside besides between beyond both but by can cannot could did do does doing done ' +
  'down during each either else even ever every few first for former from further get gets getting got had has have having he her here hers herself him himself ' +
  'his how however i if in into is it its itself just last later least less let like made make makes making many may me meanwhile might more most mostly much ' +
  'must my myself near nearly need needs neither never new next no nor not now of off often on once one only onto or other others otherwise our ours ourselves ' +
  'out over own per put rather really s said same say says see seen several she should since so some something still such than that the their theirs them ' +
  'themselves then there therefore these they this those though three through thus till to too two under unless until up upon us very via was we well were ' +
  'what whatever when where whereas whether which while who whom whose why will with within without would yet you your yours yourself day days week weeks ' +
  'month months year years time times today yesterday tomorrow tonight monday tuesday wednesday thursday friday saturday sunday mr mrs ms dr according amid ' +
  'including include includes included told tell tells asked added stated saying expected likely reportedly report reports reported news source sources ' +
  'official officials people part parts take taken takes way ways set sets come comes came go goes going went use used using know known show shows shown ' +
  'give given gives call called calls want wants look looks put says sought seeks among others lot lots whole'.split(/\s+/)
);

export function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(ss|x|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !/(ss|us|is|ics)$/.test(w)) return w.slice(0, -1);
  return w;
}

export const words = (text = '') => text.toLowerCase().match(/[a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9]/g) || [];

export const contentTokens = (text = '') =>
  words(text)
    .map((w) => w.replace(/^[-]+|[-]+$/g, ''))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .map(stem);

const VERB_BREAK = new Set(
  'won began begun took led became rose fell gave made held kept left lost met paid ran saw sent stood went wrote broke brought built bought caught ' +
  'chose drew drove fought found grew hit knew laid lay meant quit read rode rang sold shot shut sang sat slept spoke spent spun struck swore swept ' +
  'swam taught threw understood woke wore win wins become becomes help helps aims aim seeks seeks among others lot lots whole'.split(
    ' '
  )
);

export function keyphrases(text, idf, max = 8) {
  const chunks = String(text).split(/[,.:;!?("''”)]+|\s--\s/);
  const cands = new Map();
  const add = (toks) => {
    if (!toks.length || toks.length > 3) return;
    const phrase = toks.join(' ');
    const key = phrase.toLowerCase();
    const c = cands.get(key) || { text: phrase, count: 0, toks: toks.map((t) => stem(t.toLowerCase())) };
    c.count++;
    cands.set(key, c);
  };
  for (const chunk of chunks) {
    let cur = [];
    const flush = () => {
      if (cur.length > 3) cur.forEach((w) => add([w]));
      else add(cur);
      cur = [];
    };
    for (const raw of chunk.split(/\s+/)) {
      const w = raw.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').replace(/['’]s$/, '');
      const lw = w.toLowerCase();
      if (!lw || w.length < 3 || STOPWORDS.has(lw) || /^\d+$/.test(w) || (w === lw && (/^[a-z]{3,}ed$/.test(w) || VERB_BREAK.has(w)))) {
        flush();
        continue;
      }
      cur.push(w);
    }
    flush();
  }

  const scored = [...cands.values()].map((c) => {
    const base = c.toks.reduce((s, t) => s + idf(t), 0);
    return { text: c.text, score: +(base * (1 + 0.2 * (c.toks.length - 1)) * (1 + Math.log(c.count))).toFixed(3) };
  });
  scored.sort((a, b) => b.score - a.score);
  const out = [];
  for (const s of scored) {
    const l = s.text.toLowerCase();
    if (out.some((o) => o.text.toLowerCase().includes(l) || l.includes(o.text.toLowerCase()))) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

export function truncate(s = '', n = 220) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 30)).replace(/[,.:;\s]+$/, '')}…`;
}

export const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const phraseRegex = (phrase, flags = '') =>
  new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(phrase)}(?![A-Za-z0-9])`, flags);

export const containsPhrase = (text, phrase) => phraseRegex(phrase, 'i').test(text);

export const normKey = (s = '') => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();