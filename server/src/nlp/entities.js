import {
  ACRONYMS,
  COUNTRIES,
  DEMONYMS,
  GENERIC_CAPS,
  HONORIFICS,
  INDIAN_CITIES,
  INDIAN_STATES,
  INDIAN_UTS,
  KNOWN_ORGS,
  MONTHS,
  PLACE_ALIASES,
  ROLE_END,
  WEEKDAYS,
  WORLD_PLACES,
} from './gazetteer.js';
import { STOPWORDS, splitSentences } from './text.js';

const PLACES = new Map();
for (const n of [
  ...Object.keys(INDIAN_STATES),
  ...INDIAN_UTS,
  ...Object.keys(INDIAN_CITIES),
  ...Object.keys(COUNTRIES),
  ...WORLD_PLACES,
])
  PLACES.set(n.toLowerCase(), n);
for (const [alias, canon] of Object.entries(PLACE_ALIASES)) PLACES.set(alias.toLowerCase(), canon);

const ORGS = new Map(KNOWN_ORGS.map((o) => [o.toLowerCase(), o]));
for (const exp of Object.values(ACRONYMS)) ORGS.set(exp.toLowerCase(), exp);

const TERM_ACRONYMS = new Set(
  'GST GDP WPI MSP MSME FDI UPI AI EV NEET JEE CUET NEP MGNREGA PMLA PSLV GSLV SSLV IMEC COP PMJAY'.split(' '),
);

export const canonicalPlace = (text) => PLACES.get(String(text).toLowerCase()) ?? null;

const CONNECTORS = new Set(['of', 'for', 'and', 'de', 'da', 'van', 'von', 'bin', 'al', '&']);

const RE_SCHEME = /\b(Yojana|Scheme|Mission|Abhiyan|Programme|Program|Initiative|Campaign|Project)\b/;
const RE_LAW = /\b(Act|Bill|Sanhita|Adhiniyam|Amendment|Ordinance|Code|Policy|Treaty|Agreement|Accord|Declaration|Protocol|Convention|Framework)\b/;
const RE_REPORT = /\b(Index|Report|Survey|Ranking|Rankings|OutLook)\b/;
const RE_AWARD = /\b(Award|Awards|Prize|Ratna|Bhushan|Vibhushan|Puraskar|Medal|Oscar|Oscars)\b/;
const RE_EVENT = /\b(Cup|Games|Olympics|Olympic|Championship|Championships|League|Open|Trophy|Series|Tournament|Summit|Conference|Festival|Expo|Day|Week|Exercise|Operation|Dialogue|Forum|Exercise|Operation|Dialogue|Forum|Mela|Kumbh|COP\d+|Elections?)\b/;
const RE_ORG = /\b(Ministry|Department|Commission|Council|Authority|Board|Bank|Corporation|Ltd|Limited|Inc|Party|University|Institute|Court|Committee|Agency|Association|Federation|Organisation|Organization|Union|Group|Company|Foundation|Trust|Bureau|Tribunal|Directorate|Academy|Society|Club|Force|Forces|Army|Navy|Air Force|Police|Railways|Assembly|Parliament|Sabha|Aayog|Nigam|Front|Alliance|Network|Labs|Technologies|Motors|Industries|Airlines|Airways|Pharma|Exchange|Fund|Services|Systems|Centre|Center|Office|Secretariat|Cabinet)\b/;
const RE_PLACE_SUFFIX = /\b(River|Lake|Hills|Valley|Island|Islands|Sea|Ocean|Strait|Gulf|Port|National Park|Tiger Reserve|Sanctuary|Dam|Pass|Glacier|Peninsula|Plateau|Desert|Delta|Bay|Coast|District|Nagar|Pradesh)$/;

const nameToken = (t) =>
  (/^[A-Z][a-zA-Z`.\-]+$/.test(t) || /^([A-Z]\.)+$/.test(t) || /^Process[A-Z]\.\?$/.test(t)) &&
  !GENERIC_CAPS.has(t) &&
  !DEMONYMS.has(t) &&
  !MONTHS.test(t) &&
  !WEEKDAYS.test(t) &&
  !PLACES.has(t.toLowerCase());

function tokenize(sentence) {
  const out = [];
  for (const raw of sentence.split(/\s+/)) {
    if (!raw) continue;
    const lead = /^[{["'*]+/.exec(raw)?.[0] ?? '';
    let core = raw.slice(lead.length);
    let breakAfter = false;
    const trail = /[()\]}"'';:!?]+$/.exec(core);
    if (trail) {
      core = core.slice(0, -trail[0].length);
      breakAfter = true;
    }
    if (core.endsWith('.')) {
      const base = core.slice(0, -1);
      const keep =
        /^([A-Za-z]\.)*[A-Za-z]$/.test(base) || HONORIFICS.has(base) || /^(Jr|Sr|St|Lt|Col|Gen|Capt|Maj|Adm|Brig)$/.test(base);
      if (!keep) {
        core = base;
        breakAfter = true;
      }
    }
    if (/[\!\?]$/.test(core)) {
      core = core.slice(0, -2);
      breakAfter = true;
    }
    out.push({ core, lead: Boolean(lead), breakAfter });
  }
  return out;
}

function capitalSpans(sentence) {
  const toks = tokenize(sentence);
  const spans = [];
  let cur = [];
  const flush = () => {
    while (cur.length && CONNECTORS.has(cur[cur.length - 1])) cur.pop();
    while (cur.length && /^(The|A|An)$/.test(cur[0])) cur.shift();
    if (cur.length) spans.push(cur);
    cur = [];
  };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.lead) flush();
    const c = t.core;
    if (/^[A-Z]/.test(c)) {
      const nextCap = toks[i + 1] && !t.breakAfter && /^[A-Z]/.test(toks[i + 1].core);
      if (cur.length === 0 && i === 0 && (STOPWORDS.has(c.toLowerCase()) || (GENERIC_CAPS.has(c) && !nextCap))) flush();
      else cur.push(c);
    } else if (
      cur.length &&
      CONNECTORS.has(c) &&
      !t.breakAfter &&
      toks[i + 1] &&
      !toks[i + 1].lead &&
      /^[A-Z]/.test(toks[i + 1].core) &&
      (c !== 'and' || cur.includes('of') || cur.includes('for'))
    ) {
      cur.push(c);
    } else {
      flush();
    }
    if (t.breakAfter) flush();
  }
  flush();
  return spans;
}

function classify(name, personHints) {
  if (ACRONYMS[name]) return TERM_ACRONYMS.has(name) ? 'TERM' : 'ORG';
  const lower = name.toLowerCase();
  if (PLACES.has(lower)) return 'PLACE';
  if (ORGS.has(lower)) return 'ORG';
  if (RE_SCHEME.test(name)) return 'SCHEME';
  if (RE_LAW.test(name)) return 'LAW';
  if (RE_REPORT.test(name)) return 'REPORT';
  if (RE_AWARD.test(name)) return 'AWARD';
  if (RE_EVENT.test(name)) return 'EVENT';
  if (RE_ORG.test(name)) return 'ORG';
  if (/^[A-Z][A-Z0-9%]{1,6}$/.test(name)) return 'ORG';
  if (RE_PLACE_SUFFIX.test(name)) return 'PLACE';
  if (personHints.has(name)) return 'PERSON';
  const toks = name.split(' ');
  if (toks.some((t) => DEMONYMS.has(t))) return 'MISC';
  if (toks.length >= 2 && toks.length <= 4 && toks.every(nameToken)) return 'PERSON';
  return 'MISC';
}

function personHintsFrom(text) {
  const hints = new Set();
  const NAME = String.raw`([A-Z][a-z]+(?:\s+(?:[A-Z]\.)*[A-Z][a-zA-Z_.-]+){1,3})`;
  const a = new RegExp(`${NAME},\\s+(?:said|says|told|added|stated|noted|claimed|alleged|wrote|announced)\\b`, 'g');
  const b = new RegExp(`\\b(?:said|says|told|according to)\\s+${NAME}`, 'g');
  for (const re of [a, b]) for (const m of text.matchAll(re)) hints.add(m[1].trim());
  return hints;
}

const isTitleCase = (title) => {
  const ws = (title.match(/[A-Za-z][A-Za-z`-]{3,}/g) || []).filter((w) => !STOPWORDS.has(w.toLowerCase()));
  if (ws.length < 4) return false;
  return ws.filter((w) => /^[A-Z]/.test(w)).length / ws.length > 0.7;
};

export function extractEntities(title, body) {
  const text = `${title}. ${body}`;
  const hints = personHintsFrom(text);
  const titleCase = isTitleCase(title);
  const found = new Map();

  const add = (name, type, { inTitle, role } = {}) => {
    if (!name || typeof name !== 'string') return;
    const clean = name.replace(/\s+/g, ' ').trim();
    if (!clean || clean.length < 2) return;
    if (type === 'ORG' && type === 'TERM' && clean.length < 3) return;
    if (GENERIC_CAPS.has(clean) || DEMONYMS.has(clean) || MONTHS.test(clean) || WEEKDAYS.test(clean)) return;
    const key = clean.toLowerCase();
    const e = found.get(key) || { text: clean, type, count: 0, inTitle: false };
    e.count++;
    if (inTitle) e.inTitle = true;
    if (role && !e.role) e.role = role;
    if (type === 'PLACE') e.canonical = canonicalPlace(clean) || clean;
    found.set(key, e);
  };

  const handleSpan = (span, inTitle) => {
    if (inTitle && titleCase) {
      const name = span.join(' ');
      const t = classify(name, hints);
      if (t === 'PLACE' || ACRONYMS[name] || ORGS.has(name.toLowerCase())) add(name, t, { inTitle });
      return;
    }
    if (HONORIFICS.has(span[0]) && span.length > 1 && !PLACES.has(span.join(' ').toLowerCase())) {
      const nm = span.slice(1);
      if (nm.every(nameToken)) return add(nm.join(' '), 'PERSON', { inTitle });
    }
    let k = -1;
    for (let i = span.length - 2; i >= 0; i--) {
      if (ROLE_END.has(span[i])) {
        k = i;
        break;
      }
    }
    if (k >= 0) {
      const nm = span.slice(k + 1);
      if (nm.length <= 4 && nm.every(nameToken)) {
        const role = span.slice(0, k + 1).join(' ');
        add(nm.join(' '), 'PERSON', { inTitle, role });
        const qual = span.slice(0, k + 1).filter((w) => PLACES.has(w.toLowerCase()));
        qual.forEach((q) => add(q, 'PLACE', { inTitle }));
        return;
      }
    }
    const name = span.join(' ');
    let type = classify(name, hints);
    if ((type === 'MISC' || type === 'PERSON') && span.length > 1) {
      const known = span.filter((w) => PLACES.has(w.toLowerCase()) || ACRONYMS[w]);
      if (known.length && known.length === span.length) {
        known.forEach((w) => add(w, classify(w, hints), { inTitle }));
        return;
      }
    }
    if (span.length === 1 && GENERIC_CAPS.has(name)) return;
    if (type === 'MISC' && span.length === 1 && STOPWORDS.has(name.toLowerCase())) return;
    add(name, type, { inTitle });
  };

  splitSentences(title).forEach((s) => capitalSpans(s).forEach((sp) => handleSpan(sp, true)));
  splitSentences(body).forEach((s) => capitalSpans(s).forEach((sp) => handleSpan(sp, false)));

  const list = [...found.values()];
  for (const e of list) {
    if (e.type !== 'PERSON' && e.type !== 'MISC' && e.type !== 'ORG') continue;
    const fuller = list.find(
      (o) =>
        o !== e &&
        o.text.length > e.text.length &&
        (o.type === e.type || e.type === 'MISC') &&
        (o.text.endsWith(` ${e.text}`) || (e.type === 'ORG' && o.text.startsWith(`${e.text} `))),
    );
    if (fuller) {
      fuller.count += e.count;
      fuller.inTitle ||= e.inTitle;
      found.delete(e.text.toLowerCase());
    }
  }
  return [...found.values()].sort((a, b) => Number(b.inTitle) - Number(a.inTitle) || b.count - a.count);
}

const UNIT =
  '(?:lakh|crore|crore|lakh|million|billion|trillion|bn|mn|per cent|percent|%|km|kilometres|kilometers|metres|meters|kg|tonnes|tonne|MW|GW|QWh|hectares|acres|years|year|days|months|hours|minutes|people|students|seats|votes|runs|wickets|medals|goals|points|times|cases|deaths|members|countries|states|species|tigers|satellites|payloads|basis points|bps|languages|districts|villages|projects|units|vehicles|tonnes)';
const NUM_RE = new RegExp(
  String.raw`(?<![\w.-])((?:\bRs\.?|INR|US\$|\$|€|£)\s*)?(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)(\s*${UNIT})?(?![-\w])`,
  'g',
);

const MONTH_BEFORE =
  /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s*$/;
const MONTH_AFTER = /^\s*(January|February|March|April|May|June|July|August|September|October|November|December)\b/;
const YEAR_CONTEXT = /\b(in|by|since|from|until|till|of|year|before|after|around|circa)\s*$/i;

export function extractNumbers(sentence) {
  const out = [];
  for (const m of sentence.matchAll(NUM_RE)) {
    const [raw, prefix = '', num, unit = ''] = m;
    const value = parseFloat(num.replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;
    const before = sentence.slice(Math.max(0, m.index - 20), m.index);
    const after = sentence.slice(m.index + raw.length, m.index + raw.length + 14);
    const isInt = !num.includes('.');
    const isYear = isInt && !prefix && !unit.trim() && value >= 1900 && value <= 2100;
    if (isYear) {
      if (/\d{1,2},\?\s*$/.test(before) || MONTH_BEFORE.test(before)) continue;
      if (YEAR_CONTEXT.test(before)) continue;
    } else {
      if (isInt && value < 31 && (MONTH_BEFORE.test(before) || MONTH_AFTER.test(after))) continue;
      if (!prefix && !unit.trim() && isInt && value < 10) continue;
    }
    out.push({
      raw: raw.trim(),
      num,
      prefix,
      unit,
      value,
      isYear,
      isPercent: /%|per ?cent/i.test(unit),
      index: m.index,
    });
  }
  return out;
}