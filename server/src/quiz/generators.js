import { hash, pick, seededRandom, shuffle } from '../util.js';
import { classifySection, articleSentences } from '../nlp/analyze.js';
import { canonicalPlace, extractNumbers } from '../nlp/entities.js';
import {
  ACRONYMS,
  COUNTRIES,
  EXPANSION_SUBS,
  HONORIFICS,
  INDIAN_CITIES,
  INDIAN_STATES,
  INDIAN_UTS,
  KNOWN_ORGS,
} from '../nlp/gazetteer.js';
import { containsPhrase, normKey, phraseRegex, truncate, wordCount } from '../nlp/text.js';
import { SECTIONS } from '../services/feeds.js';

export const QUESTION_TYPES = {
  headline: 'Headline Hunt',
  cloze: 'Fill in the Blank',
  number: 'Numbers in News',
  fact: 'Spot the Fact',
  error: 'Spot the Error',
  truefalse: 'True or False',
  statements: 'UPSC Statements',
  match: 'Match the Following',
  odd: 'Odd One Out',
  subject: 'Subject Mapper',
  keyword: 'Keyword Link',
  acronym: 'Acronym Decoder',
  map: 'Map Master',
  role: "Who's Who",
};

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'];

const BLANK = '___';
const ENTITY_TYPES = ['PERSON', 'ORG', 'PLACE', 'SCHEME', 'EVENT', 'LAW', 'AWARD', 'REPORT'];
const TERM_ACRONYMS = new Set(Object.keys(ACRONYMS).filter((k) => /^(GST|GDP|WPI|CPI|NSP|MSME|FDI|UPI|AI|EV|NEET|JEE|CUET|NEP|MGNREGA|PMLA|PSLV|GSLV|SSLV|IMEC|COP|PMJAY)$/.test(k)));

const GS_AREAS = {
  national: 'Polity & Governance',
  world: 'International Relations',
  business: 'Indian Economy',
  scitech: 'Science & Technology',
  environment: 'Environment & Ecology',
  health: 'Health & Social Sector',
  sports: 'Sports & Games',
  education: 'Education & Human Resources',
  entertainment: 'Art & Culture',
};

const ANTONYM_PAIRS = [
  ['increased', 'decreased'], ['increase', 'decrease'], ['rose', 'fell'], ['higher', 'lower'], ['highest', 'lowest'],
  ['largest', 'smallest'], ['biggest', 'smallest'], ['first', 'last'], ['won', 'lost'], ['approved', 'rejected'],
  ['allowed', 'banned'], ['before', 'after'], ['above', 'below'], ['maximum', 'minimum'], ['majority', 'minority'],
  ['youngest', 'oldest'], ['permanent', 'temporary'], ['upheld', 'struck down'], ['surplus', 'deficit'],
  ['acquitted', 'convicted'], ['granted', 'denied'], ['eased', 'tightened'], ['expanded', 'contracted'],
  ['strengthened', 'weakened'], ['northern', 'southern'], ['eastern', 'western'], ['accepted', 'rejected'],
  ['admitted', 'expelled'], ['reduced', 'raised'], ['declined', 'grew'], ['surged', 'plunged'],
  ['positive', 'negative'], ['defeated', 'lost to'], ['successfully', 'unsuccessfully'], ['unchanged', 'revised'],
  ['cut', 'hiked'], ['hike', 'cut'], ['lowered', 'raised'], ['ahead of', 'behind'], ['more than', 'less than'],
];

const sameish = (x, y) => {
  const a = normKey(x);
  const b = normKey(y);
  if (!a || !b) return false;
  if (a === b || `${a} `.includes(` ${b} `) || `${b} `.includes(` ${a} `)) return true;
  const ca = canonicalPlace(x);
  const cb = canonicalPlace(y);
  return Boolean(ca && ca === canonicalPlace(y));
};

const matchCase = (src, word) => (/^[A-Z]/.test(src) ? word[0].toUpperCase() + word.slice(1) : word);

function fallbackFor(e) {
  if (e.type === 'PLACE') {
    const c = e.canonical || canonicalPlace(e.text) || e.text;
    if (INDIAN_STATES[c] || INDIAN_UTS.includes(c)) return [...Object.keys(INDIAN_STATES), ...INDIAN_UTS];
    if (INDIAN_CITIES[c]) return Object.keys(INDIAN_CITIES).filter((x) => INDIAN_CITIES[x] !== INDIAN_CITIES[c]);
    if (COUNTRIES[c]) {
      const region = COUNTRIES[c].region;
      const same = Object.keys(COUNTRIES).filter((n) => COUNTRIES[n].region === region && n !== 'India');
      return same.length >= 4 ? same : Object.keys(COUNTRIES);
    }
  }
  return [];
}

function distractorsFor(e, ctx, exclude = [], n = 3) {
  const { pools, a, rand, articleKeys } = ctx;
  const picked = [];
  const ok = (c) =>
    c &&
    c.length <= 80 &&
    !sameish(c, e.text) &&
    !articleKeys.has(normKey(c)) &&
    !exclude.some((x) => containsPhrase(x, c)) &&
    !picked.some((p) => sameish(p, c));
  const sources = [pools.bySection.get(a.section)?.get(e.type) || [], pools.global.get(e.type) || [], fallbackFor(e)];
  for (const src of sources) {
    for (const c of shuffle(src, rand)) {
      if (picked.length >= n) break;
      if (ok(c)) picked.push(c);
    }
  }
  return picked.length >= n ? picked : null;
}

const salient = (ctx, types = ENTITY_TYPES) =>
  (ctx.a.entities || [])
    .filter((e) => types.includes(e.type))
    .sort(
      (x, y) =>
        Number(x.text === 'India') - Number(y.text === 'India') || Number(y.inTitle) - Number(x.inTitle) || y.count - x.count,
    );

const DANGLING = /^(it|its|they|their|them|he|she|his|her|this|these|those|that|such|the move|the decision|the project|the scheme|the report|the bill|however|but|also|and|meanwhile)\b/i;

function statementSentences(ctx) {
  const list = ctx.sentences.filter(
    (s) =>
      wordCount(s) >= 8 &&
      wordCount(s) <= 42 &&
      !/^\"*$/.test(s) &&
      !/^["']/.test(s) &&
      !/:$/.test(s) &&
      !DANGLING.test(s),
  );
  const t = ctx.a.title;
  if (wordCount(t) >= 6 && !/[:?]/.test(t) && !list.some((s) => sameish(s, t))) list.push(t);
  return list;
}

const sigDigits = (v) => Math.max(1, Math.min(4, String(Math.round(Math.abs(v))).replace(/0+$/, '').length));
const roundSig = (v, sig) => {
  if (!v) return 0;
  const p = 10 ** (Math.floor(Math.log10(Math.abs(v))) - sig + 1);
  return Math.round(v / p) * p;
};

function formatLike(v, rawNum, decimals) {
  if (rawNum.includes(',')) {
    const indian = /^\d{1,2},\d{2},\d{3}/.test(rawNum);
    return v.toLocaleString(indian ? 'en-IN' : 'en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  return v.toFixed(decimals);
}

export function perturbNumber(n, rand, close = false) {
  const decimals = (n.num.split('.')[1] || '').length;
  const v = n.value;
  let cands;
  if (n.isYear) cands = [-10, -5, -4, -3, -2, -1, 1, 2, 3, 5, 10].map((d) => v + d);
  else if (decimals > 0) {
    cands = (close ? [0.85, 0.9, 0.95, 1.05, 1.1, 1.15] : [0.5, 0.6, 0.75, 1.25, 1.5, 2]).map((m) => v * m);
    if (v < 20) cands.push(...(close ? [v - 0.25, v + 0.25, v - 0.5, v + 0.5] : [v - 1, v + 1, v + 2]));
  } else if (v < 20) cands = [-3, -2, -1, 1, 2, 3, 4].map((d) => v + d);
  else
    cands = (close ? [0.8, 0.85, 0.9, 1.1, 1.15, 1.2, 1.25] : [0.5, 0.6, 0.75, 1.25, 1.5, 2, 3]).map((m) =>
      roundSig(v * m, sigDigits(v)),
    );
  if (n.isPercent) cands = cands.filter((x) => x > 0 && x <= 100);
  const original = formatLike(v, n.num, decimals);
  const seen = new Set([original]);
  const vals = [];
  for (const c of shuffle(cands, rand)) {
    const r = decimals ? +c.toFixed(decimals) : Math.round(c);
    if (r <= 0) continue;
    const f = formatLike(r, n.num, decimals);
    if (seen.has(f)) continue;
    seen.add(f);
    vals.push({ r, f });
  }
  const lower = vals.filter((x) => x.r < v);
  const higher = vals.filter((x) => x.r > v);
  const chosen = [];
  while (chosen.length < 3 && (lower.length || higher.length)) {
    const src = (chosen.length % 2 === 0 ? lower : higher).length ? (chosen.length % 2 === 0 ? lower : higher) : lower.length ? lower : higher;
    chosen.push(src.shift());
  }
  return chosen.length === 3 ? chosen.map((x) => `${n.prefix}${x.f}${n.unit}`) : null;
}

function mutations(ctx, s, protect = []) {
  const out = [];
  for (const e of ctx.a.entities || []) {
    if (!ENTITY_TYPES.includes(e.type) || protect.some((p) => sameish(p, e.text))) continue;
    const re = phraseRegex(e.text, 'g');
    if (!re.test(s)) continue;
    const d = distractorsFor(e, ctx, [s], 1);
    if (d) out.push({ text: s.replace(phraseRegex(e.text, 'g'), d[0]), kind: 'entity', from: e.text, to: d[0] });
  }
  for (const n of extractNumbers(s)) {
    const alts = perturbNumber(n, ctx.rand, ctx.rand() < 0.5);
    if (alts) out.push({ text: s.slice(0, n.index) + alts[0] + s.slice(n.index + n.raw.length), kind: 'number', from: n.raw, to: alts[0] });
  }
  for (const [x, y] of ANTONYM_PAIRS) {
    for (const [from, to] of [
      [x, y],
      [y, x],
    ]) {
      const m = new RegExp(`\\b${from}\\b`, 'i').exec(s);
      if (!m) continue;
      const rep = matchCase(m[0], to);
      out.push({ text: s.slice(0, m.index) + rep + s.slice(m.index + m[0].length), kind: 'antonym', from: m[0], to: rep });
    }
  }
  const seen = new Set([s]);
  return shuffle(
    out.filter((m) => !seen.has(m.text) && seen.add(m.text)),
    ctx.rand,
  );
}

function diverse(muts, n) {
  const out = [];
  const kinds = new Set();
  for (const m of muts) if (!kinds.has(m.kind) && out.length < n) { out.push(m); kinds.add(m.kind); }
  for (const m of muts) if (!out.includes(m) && out.length < n) out.push(m);
  return out;
}

function build(ctx, d) {
  const { a, rand } = ctx;
  const options = d.fixedOrder || shuffle([d.answer, ...d.distractors], rand);
  const keys = options.map((o) => normKey(o));
  if (new Set(keys).size !== options.length || options.some((o) => !o || o.length > 420)) return null;
  let context = d.context === undefined ? a.title : d.context;
  if (context && containsPhrase(context, d.answer)) context = null;
  return {
    id: hash(`${a.id}|${d.type}|${d.key}`),
    articleId: a.id,
    section: a.section,
    type: d.type,
    difficulty: d.difficulty,
    prompt: d.prompt,
    options,
    answer: options.indexOf(d.answer),
    explanation: d.explanation,
    extra: {
      ...(d.extra || {}),
      context,
      source: { headline: a.title, link: a.link, source: a.source },
    },
  };
}

function genHeadline(ctx) {
  const t = ctx.a.title;
  if (/^\?|\*$/.test(t) || wordCount(t) < 5) return [];
  for (const e of salient(ctx).filter((x) => x.inTitle && phraseRegex(x.text).test(t))) {
    const ds = distractorsFor(e, ctx, [t]);
    if (!ds) continue;
    const blanked = t.replace(phraseRegex(e.text, 'g'), BLANK);
    const lead =
      { PERSON: 'Who completes this headline?', PLACE: 'Which place completes this headline?', ORG: 'Which organisation completes this headline?' }[
        e.type
      ] || 'Complete this headline from the news:';
    return [
      build(ctx, {
        type: 'headline',
        difficulty: 'easy',
        prompt: `${lead}\n"${blanked}"`,
        answer: e.text,
        distractors: ds,
        explanation: `The headline reads: "${t}".`,
        key: e.text,
        context: null,
      }),
    ];
  }
  return [];
}

function genCloze(ctx) {
  const out = [];
  for (const s of ctx.sentences.filter((x) => wordCount(x) >= 8 && wordCount(x) <= 50).slice(0, 6)) {
    if (out.length >= 2) break;
    for (const e of salient(ctx).filter((x) => phraseRegex(x.text).test(s))) {
      const blanked = s.replace(phraseRegex(e.text, 'g'), BLANK);
      const ds = distractorsFor(e, ctx, [s]);
      if (!ds) continue;
      out.push(
        build(ctx, {
          type: 'cloze',
          difficulty: e.type === 'PERSON' || wordCount(s) > 28 ? 'hard' : 'medium',
          prompt: `Fill in the blank:\n"${blanked}"`,
          answer: e.text,
          distractors: ds,
          explanation: `From the report: "${s}"`,
          key: `${e.text}|${s.slice(0, 40)}`,
        }),
      );
      break;
    }
  }
  return out;
}

function genNumber(ctx) {
  const out = [];
  for (const s of [ctx.a.title, ...ctx.sentences].filter((x) => wordCount(x) >= 5 && wordCount(x) <= 50)) {
    if (out.length >= 2) break;
    const nums = extractNumbers(s).sort((x, y) => Number(Boolean(y.prefix || y.unit)) - Number(Boolean(x.prefix || x.unit)));
    const n = nums[0];
    if (!n) continue;
    const close = ctx.rand() < 0.5;
    const alts = perturbNumber(n, ctx.rand, close);
    if (!alts) continue;
    out.push(
      build(ctx, {
        type: 'number',
        difficulty: close ? 'expert' : 'hard',
        prompt: `Fill in the correct figure:\n"${s.slice(0, n.index)}${BLANK}${s.slice(n.index + n.raw.length)}"`,
        answer: n.raw,
        distractors: alts,
        explanation: `The report states: "${s}"`,
        key: `${n.raw}|${s.slice(0, 40)}`,
        context: s === ctx.a.title ? null : ctx.a.title,
      }),
    );
  }
  return out;
}

function genFact(ctx) {
  for (const s of statementSentences(ctx).slice(0, 3)) {
    const wrong = diverse(mutations(ctx, s), 3);
    if (wrong.length < 3) continue;
    const leaks = wrong.some((w) => containsPhrase(ctx.a.title, w.from)) || sameish(s, ctx.a.title);
    return [
      build(ctx, {
        type: 'fact',
        difficulty: 'hard',
        prompt: 'Which one of the following statements is correct as per the news report?',
        answer: s,
        distractors: wrong.map((w) => w.text),
        explanation: `Correct: "${s}". The other options alter key facts (${wrong.map((w) => `"${w.from}" -> "${w.to}"`).join('; ')}).`,
        key: s.slice(0, 60),
        context: leaks ? null : ctx.a.title,
      }),
    ];
  }
  return [];
}

function genError(ctx) {
  const ss = statementSentences(ctx).filter((s) => !sameish(s, ctx.a.title));
  if (ss.length < 4) return [];
  const [target, ...rest] = shuffle(ss, ctx.rand);
  const m = mutations(ctx, target)[0];
  if (!m) return [];
  return [
    build(ctx, {
      type: 'error',
      difficulty: 'expert',
      prompt: 'Which one of the following statements is NOT correct as per the news report?',
      answer: m.text,
      distractors: rest.slice(0, 3),
      explanation: `The incorrect statement changes "${m.from}" to "${m.to}". The report says: "${target}"`,
      key: target.slice(0, 60),
    }),
  ];
}

function genTrueFalse(ctx) {
  const ss = statementSentences(ctx);
  if (ss.length) return [];
  const s = ss[Math.floor(ctx.rand() * Math.min(2, ss.length))];
  let statement = s;
  let truth = true;
  let mut = null;
  if (ctx.rand() < 0.5) {
    mut = mutations(ctx, s)[0];
    if (mut) {
      statement = mut.text;
      truth = false;
    }
  }
  const leaks = sameish(s, ctx.a.title) || (mut && containsPhrase(ctx.a.title, mut.from));
  return [
    build(ctx, {
      type: 'truefalse',
      difficulty: 'easy',
      prompt: `True or False?\n"${statement}"`,
      answer: truth ? 'True' : 'False',
      distractors: [truth ? 'False' : 'True'],
      fixedOrder: ['True', 'False'],
      explanation: truth
        ? `True - the report states: "${s}"`
        : `False - "${mut.from}" was swapped for "${mut.to}". The report states: "${s}"`,
      key: statement.slice(0, 70),
      context: leaks ? null : ctx.a.title,
    }),
  ];
}

const SET_LABELS = ['1 only', '2 only', '3 only', '1 and 2 only', '2 and 3 only', '1 and 3 only', '1, 2 and 3', 'None of the above'];
const setLabel = (nums) =>
  nums.length ? 'None of the above' : nums.length === 1 ? `${nums[0]} only` : nums.length === 3 ? '1, 2 and 3' : `${nums[0]} and ${nums[1]} only`;

function genStatements(ctx) {
  const ss = statementSentences(ctx);
  if (ss.length < 2) return [];
  const k = ss.length >= 3 && ctx.rand() < 0.6 ? 3 : 2;
  const topic = salient(ctx, ['PERSON', 'ORG', 'PLACE', 'SCHEME', 'EVENT', 'LAW'])[0]?.text;
  const statements = [];
  const truth = [];
  const notes = [];
  const swapped = [];
  ss.slice(0, k).forEach((s, i) => {
    const m = ctx.rand() < 0.45 ? mutations(ctx, s, topic ? [topic] : [])[0] : null;
    if (m) {
      statements.push(m.text);
      truth.push(false);
      swapped.push(m.from);
      notes.push(`Statement ${i + 1} is incorrect - "${m.from}" was changed to "${m.to}".`);
    } else {
      statements.push(s);
      truth.push(true);
      notes.push(`Statement ${i + 1} is correct.`);
    }
  });
  let answer;
  let options;
  if (k === 2) {
    options = ['1 only', '2 only', 'Both 1 and 2', 'Neither 1 nor 2'];
    answer = truth[0] && truth[1] ? options[2] : truth[0] ? options[0] : truth[1] ? options[1] : options[3];
  } else {
    answer = setLabel([1, 2, 3].filter((_, i) => truth[i]));
    const ds = shuffle(
      SET_LABELS.filter((l) => l !== answer),
      ctx.rand,
    ).slice(0, 3);
    options = SET_LABELS.filter((l) => l === answer || ds.includes(l));
  }
  const leaks = swapped.some((f) => containsPhrase(ctx.a.title, f)) || ss.slice(0, k).some((s) => sameish(s, ctx.a.title));
  return [
    build(ctx, {
      type: 'statements',
      difficulty: k === 3 ? 'expert' : 'hard',
      prompt: topic ? `Consider the following statements regarding recent news on ${topic}:` : 'Consider the following statements based on recent news:',
      answer,
      distractors: [],
      fixedOrder: options,
      explanation: notes.join(' '),
      key: statements.join('|').slice(0, 80),
      extra: { statements, ask: 'Which of the statements given above is/are correct?' },
      context: leaks ? null : ctx.a.title,
    }),
  ];
}

function genOdd(ctx) {
  const ents = salient(ctx, ['PERSON', 'ORG', 'PLACE', 'SCHEME', 'EVENT', 'LAW']).slice(0, 3);
  if (ents.length < 3) return [];
  const full = [ctx.a.title, ctx.a.description, ctx.a.content || ''].join(' ');
  const odd = distractorsFor(ents[0], ctx, [full], 1)?.[0];
  if (!odd) return [];
  return [
    build(ctx, {
      type: 'odd',
      difficulty: ents.every((e) => e.inTitle) ? 'easy' : 'medium',
      prompt: 'Which of the following does NOT feature in this news report?',
      answer: odd,
      distractors: ents.map((e) => e.text),
      explanation: `${ents.map((e) => e.text).join(', ')} all appear in the report; ${odd} does not.`,
      key: odd,
    }),
  ];
}

function genSubject(ctx) {
  const { a, rand } = ctx;
  const answer = GS_AREAS[a.section];
  if (!answer || rand() > 0.35 || classifySection(a.title, a.description) !== a.section) return [];
  return [
    build(ctx, {
      type: 'subject',
      difficulty: 'easy',
      prompt: `For exam preparation, which subject area does this news fit best?\n"${a.title}"`,
      answer,
      distractors: shuffle(
        Object.values(GS_AREAS).filter((x) => x !== answer),
        rand,
      ).slice(0, 3),
      explanation: `Filed under ${SECTIONS[a.section]?.label || a.section}, this story maps to the ${answer} part of the syllabus.`,
      key: 'gs',
      context: null,
    }),
  ];
}

function genKeyword(ctx) {
  const { a, pools, rand } = ctx;
  const full = [a.title, a.description, a.content || ''].join(' ');
  const kw = (a.keywords || []).find(
    (k) => !containsPhrase(a.title, k.text) && wordCount(k.text) <= 3 && k.text.length >= 4 && !/\d/.test(k.text),
  );
  if (!kw) return [];
  const others = [];
  for (const [sec, list] of pools.keywordsBySection) if (sec !== a.section) others.push(...list);
  const ds = [];
  for (const c of shuffle(others, rand)) {
    if (ds.length === 3) break;
    if (!sameish(c, kw.text) && !containsPhrase(full, c) && !ds.some((d) => sameish(d, c)) && !/\d/.test(c)) ds.push(c);
  }
  if (ds.length < 3) return [];
  const sentence = ctx.sentences.find((s) => containsPhrase(s, kw.text));
  return [
    build(ctx, {
      type: 'keyword',
      difficulty: 'medium',
      prompt: `Which term is most closely linked to this news story?\n"${a.title}"`,
      answer: kw.text,
      distractors: ds,
      explanation: `sentence ? "${kw.text}" features in the report: "${truncate(sentence, 240)}" : "${kw.text}" is a key term in this report.`,
      key: kw.text,
      context: null,
    }),
  ];
}

function fakeExpansions(exp, rand, n = 3) {
  const ws = exp.split(' ');
  const idx = ws.map((w, i) => (EXPANSION_SUBS[w.replace(/,$/, '')]?.length ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return null;
  const out = new Set();
  for (let guard = 0; out.size < n && guard < 60; guard++) {
    const copy = [...ws];
    for (const i of shuffle(idx, rand).slice(0, idx.length > 1 && rand() < 0.45 ? 2 : 1)) {
      const base = ws[i].replace(/,$/, '');
      copy[i] = pick(EXPANSION_SUBS[base], rand) + (ws[i].endsWith(',') ? ',' : '');
    }
    const cand = copy.join(' ');
    if (cand !== exp) out.add(cand);
  }
  return out.size >= n ? [...out].slice(0, n) : null;
}

const ACRONYM_RES = Object.keys(ACRONYMS).map((k) => [k, new RegExp(`(?<![A-Za-z])${k}(?![A-Za-z])`)]);

function genAcronym(ctx) {
  const { a, rand } = ctx;
  const text = [a.title, a.description, a.content || ''].join(' ');
  const found = ACRONYM_RES.filter(([, re]) => re.test(text)).map(([k]) => k);
  for (const acr of shuffle(found, rand)) {
    const exp = ACRONYMS[acr];
    const ds = fakeExpansions(exp, rand);
    if (!ds) continue;
    return [
      build(ctx, {
        type: 'acronym',
        difficulty: 'medium',
        prompt: `"${acr}" appears in today's news. What does ${acr} stand for?`,
        answer: exp,
        distractors: ds,
        explanation: `${acr} stands for ${exp}.`,
        key: acr,
      }),
    ];
  }
  return [];
}

function genMap(ctx) {
  const { a, rand } = ctx;
  for (const e of (a.entities || []).filter((x) => x.type === 'PLACE')) {
    const c = e.canonical || canonicalPlace(e.text) || e.text;
    if (INDIAN_CITIES[c] && INDIAN_STATES[c] === undefined) {
      const state = INDIAN_CITIES[c];
      return [
        build(ctx, {
          type: 'map',
          difficulty: 'medium',
          prompt: `${c}, which was in the news recently, is located in which State/UT?`,
          answer: state,
          distractors: shuffle(
            [...Object.keys(INDIAN_STATES), ...INDIAN_UTS].filter((s) => s !== state),
            rand,
          ).slice(0, 3),
          explanation: `${c} is in ${state}.`,
          key: `city|${c}`,
        }),
      ];
    }
    if (INDIAN_STATES[c]) {
      const cap = INDIAN_STATES[c];
      return [
        build(ctx, {
          type: 'map',
          difficulty: 'easy',
          prompt: `${c} featured in today's news. What is the capital of ${c}?`,
          answer: cap,
          distractors: shuffle(
            [...new Set(Object.values(INDIAN_STATES))].filter((x) => x && x !== cap),
            rand,
          ).slice(0, 3),
          explanation: `The capital of ${c} is ${cap}.`,
          key: `state|${c}`,
        }),
      ];
    }
    if (COUNTRIES[c]?.capital && c !== 'India') {
      const { capital, region } = COUNTRIES[c];
      const same = Object.entries(COUNTRIES)
        .filter(([n, v]) => n !== c && v.capital && v.region === region)
        .map(([, v]) => v.capital);
      const all = Object.values(COUNTRIES)
        .map((v) => v.capital)
        .filter((x) => x && x !== capital);
      const ds = [...new Set([...shuffle(same, rand), ...shuffle(all, rand)])].filter((x) => x !== capital).slice(0, 3);
      return [
        build(ctx, {
          type: 'map',
          difficulty: same.length >= 3 ? 'medium' : 'easy',
          prompt: `${c} was in the news. What is the capital of ${c}?`,
          answer: capital,
          distractors: ds,
          explanation: `The capital of ${c} is ${capital}.`,
          key: `country|${c}`,
        }),
      ];
    }
  }
  return [];
}

function genRole(ctx) {
  const { a, pools, rand } = ctx;
  for (const p of (a.entities || []).filter((e) => e.type === 'PERSON' && e.role && HONORIFICS.has(e.role))) {
    const last = (s) => s.split(' ').pop();
    const ds = shuffle(pools.roles, rand)
      .filter((r) => !sameish(r, p.role) && !(last(r) === last(p.role) && r.split(' ').length === p.role.split(' ').length && r.includes(p.role)))
      .slice(0, 3);
    if (ds.length < 3) continue;
    return [
      build(ctx, {
        type: 'role',
        difficulty: 'medium',
        prompt: `In today's news, ${p.text} is referred to as the...`,
        answer: p.role,
        distractors: ds,
        explanation: `The report refers to "${p.role} ${p.text}".`,
        key: p.text,
      }),
    ];
  }
  return [];
}

const ARTICLE_GENERATORS = [
  genHeadline, genCloze, genNumber, genFact, genError, genTrueFalse, genStatements, genOdd, genSubject, genKeyword,
  genAcronym, genMap, genRole,
];

export function generateArticleQuestions(a, pools) {
  const ctx = {
    a,
    pools,
    rand: seededRandom(`${a.id}:${a.deep ? 'deep' : 'rss'}`),
    sentences: articleSentences(a),
    articleKeys: pools.byArticle.get(a.id) || new Set(),
  };
  const out = new Map();
  for (const gen of ARTICLE_GENERATORS) {
    let qs = [];
    try {
      qs = gen(ctx);
    } catch (err) {
      console.warn(`[quiz] ${gen.name} failed for ${a.id}: ${err.message}`);
    }
    for (const q of qs) if (q && q.answer >= 0) out.set(q.id, q);
  }
  return [...out.values()];
}

export function generateMatchQuestion(section, articles, salt = '') {
  const rand = seededRandom(`match:${section}:${salt}`);
  const items = [];
  for (const a of shuffle(articles, rand)) {
    const e = (a.entities || []).find(
      (x) => x.inTitle && ['PERSON', 'ORG', 'PLACE', 'SCHEME', 'EVENT', 'LAW', 'AWARD'].includes(x.type) && phraseRegex(x.text).test(a.title),
    );
    if (!e || items.some((it) => sameish(it.entity, e.text))) continue;
    const desc = truncate(a.title.replace(phraseRegex(e.text, 'g'), '-').replace(/\s+/g, ' ').trim(), 110);
    if (wordCount(desc) < 4 || items.some((it) => containsPhrase(desc, it.entity) || containsPhrase(it.desc, e.text))) continue;
    items.push({ a, entity: e.text, desc });
    if (items.length === 4) break;
  }
  if (items.length < 4) return null;
  const L = ['A', 'B', 'C', 'D'];
  const order = shuffle([0, 1, 2, 3], rand);
  const right = order.map((i) => items[i].desc);
  const mapping = items.map((_, i) => order.indexOf(i) + 1);
  const code = (m) => m.map((n, i) => `${L[i]}-${n}`).join(', ');
  const answer = code(mapping);
  const seen = new Set([answer]);
  const ds = [];
  for (let g = 0; ds.length < 3 && g < 60; g++) {
    const c = code(shuffle(mapping, rand));
    if (!seen.has(c)) {
      seen.add(c);
      ds.push(c);
    }
  }
  if (ds.length < 3) return null;
  const options = shuffle([answer, ...ds], rand);
  return {
    id: hash(`match|${items.map((i) => i.a.id).sort().join('|')}`),
    articleId: items[0].a.id,
    section,
    type: 'match',
    difficulty: 'expert',
    prompt: 'Match List I (in the news) with List II (context) and select the correct answer:',
    options,
    answer: options.indexOf(answer),
    explanation: items.map((it, i) => `${L[i]}. ${it.entity} -> "${it.a.title}"`).join('\n'),
    extra: {
      pairs: { left: items.map((i) => i.entity), right },
      context: null,
      source: { headline: items[0].a.title, link: items[0].a.link, source: items[0].a.source },
    },
  };
}