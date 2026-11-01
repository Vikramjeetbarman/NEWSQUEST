import { extractEntities, extractNumbers } from './entities.js';
import { contentTokens, keyphrases, normKey, splitSentences, truncate, wordCount } from './text.js';

const df = new Map();
let docCount = 0;

export function corpusAdd(text) {
    for (const t of new Set(contentTokens(text))) df.set(t, (df.get(t) || 0) + 1);
    docCount++;
}

export function corpusReset() {
    df.clear();
    docCount = 0;
}

export const idf = (t) => Math.log((docCount + 1) / ((df.get(t) || 0) + 1)) + 1;

function scoreSentences(sentences, title) {
    const titleToks = new Set(contentTokens(title));
    return sentences.map((s, i) => {
        const toks = contentTokens(s);
        const tf = new Map();
        toks.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
        let w = 0;
        for (const [t, c] of tf) w += (1 + Math.log(c)) * idf(t);
        w = toks.length ? w / Math.sqrt(toks.length) : 0;
        const overlap = titleToks.size ? [...tf.keys()].filter((t) => titleToks.has(t)).length / titleToks.size : 0;
        const pos = i === 0 ? 0.6 : i === 1 ? 0.3 : i < 4 ? 0.1 : 0;
        const len = wordCount(s);
        const lenPen = len < 7 ? 0.5 : len > 40 ? 0.75 : 1;
        const quotePen = /^["']/.test(s) ? 0.8 : 1;
        const num = /\d/.test(s) ? 0.15 : 0;
        return { s, i, score: (w + overlap * 2 + pos + num) * lenPen * quotePen, toks: new Set(tf.keys()) };
    });
}

const jaccard = (a, b) => {
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    return inter / (a.size + b.size - inter);
};

function mmr(items, k, lambda = 0.72) {
    if (!items.length) return [];
    const max = Math.max(...items.map((x) => x.score)) || 1;
    const chosen = [];
    const pool = [...items];
    while (chosen.length < k && pool.length) {
        let best = null;
        let bestVal = -Infinity;
        for (const it of pool) {
            const sim = chosen.length ? Math.max(...chosen.map((c) => jaccard(c.toks, it.toks))) : 0;
            const val = lambda * (it.score / max) - (1 - lambda) * sim;
            if (val > bestVal) {
                bestVal = val;
                best = it;
            }
        }
        chosen.push(best);
        pool.splice(pool.indexOf(best), 1);
    }
    return chosen;
}

export function articleSentences({ description = '', content = '' }) {
    const body = content && content.length > description.length ? content : description;
    return splitSentences(body).filter((s) => wordCount(s) >= 5 && !/^(also read|read more|click here|subscribe)/i.test(s));
}

export function analyzeArticle(a) {
    const sentences = articleSentences(a);
    const body = sentences.join(' ');
    const scored = scoreSentences(sentences, a.title);
    const k = Math.min(5, Math.max(1, Math.ceil(sentences.length / 3)));
    const points = mmr(scored, Math.min(k + (sentences.length > 2 ? 1 : 0), sentences.length))
        .sort((x, y) => x.i - y.i)
        .map((x) => x.s);
    const best = [...scored].sort((x, y) => y.score - x.score)[0];
    const tldr = truncate(best ? best.s : a.title, 240);
    const entities = extractEntities(a.title, body).slice(0, 30);
    const kws = keyphrases(`${a.title}. ${body}`, idf, 10);
    return {
        summary: { tldr, points, readingTime: Math.max(1, Math.round(wordCount(`${a.title} ${body}`) / 200)) },
        keywords: kws,
        entities,
    };
}

const LEXICON = {
    national: 'parliament|lok sabha|rajya sabha|supreme court|high court|election|elections|cabinet|chief minister|governor|constitution|assembly|bjp|congress|ministry|union government|centre|scheme|yojana|police|court|bill|state government|caste|census|reservation|delimitation',
    world: 'united nations|bilateral|summit|foreign|diplomat|diplomatic|embassy|nato|g20|brics|china|pakistan|russia|ukraine|israel|gaza|iran|bangladesh|sri lanka|nepal|us president|white house|kremlin|beijing|washington|war|ceasefire|sanctions',
    business: 'market|markets|sensex|nifty|rbi|inflation|gdp|bank|banks|economy|economic|rupee|shares|stock|stocks|company|companies|tax|gst|investment|investors|trade|exports|imports|revenue|profit|startup|ipo|repo rate|fiscal|budget|crore|industry',
    scitech: 'isro|space|satellite|rocket|launch|ai|artificial intelligence|technology|tech|research|scientists|study|quantum|software|smartphone|cyber|nasa|robot|chip|semiconductor|physics|chemistry|astronomers|moon|mars|genome',
    environment: 'climate|environment|environmental|pollution|forest|forests|wildlife|tiger|tigers|emission|emissions|carbon|monsoon|flood|floods|heatwave|biodiversity|air quality|aqi|renewable|solar|cop28|cop29|cop30|net zero|species|conservation|cyclone|glacier',
    health: 'health|hospital|hospitals|disease|virus|vaccine|vaccination|covid|patients|doctors|medical|cancer|dengue|malaria|tuberculosis|who|nutrition|mental health|ayushman',
    sports: 'cricket|match|tournament|world cup|olympic|olympics|football|hockey|tennis|badminton|chess|medal|medals|ipl|bcci|wicket|wickets|goal|championship|athlete|athletics|javelin|grand slam|t20|odi|test match',
    education: 'exam|exams|students|student|university|universities|school|schools|cbse|neet|jee|upsc|education|college|colleges|ugc|admission|curriculum|teachers|nep',
    entertainment: 'film|films|movie|movies|actor|actress|box office|music|bollywood|series|ott|director|song|oscar|oscars|cinema|album|netflix',
};

const LEX_RE = Object.fromEntries(Object.entries(LEXICON).map(([k, v]) => [k, new RegExp(`\\b(?:${v})\\b`, 'gi')]));

export function classifySection(title, description = '') {
    let best = 'national';
    let bestScore = 0;
    for (const [sec, re] of Object.entries(LEX_RE)) {
        const score = (title.match(re) || []).length * 2 + (description.match(re) || []).length;
        if (score > bestScore) {
            best = sec;
            bestScore = score;
        }
    }
    return best;
}

export function buildDigest(articles) {
    const prepared = articles.map((a) => {
        const ents = (a.entities || []).filter((e) => e.type !== 'MISC' && e.type !== 'TERM');
        const sig = new Set([
            ...(a.keywords || []).slice(0, 6).flatMap((k) => contentTokens(k.text)),
            ...ents.slice(0, 6).map((e) => `${e.type || e.s}:${normKey(e.text)}`),
        ]);
        return { a, ents, sig };
    });

    const clusters = [];
    for (const p of prepared) {
        let best = null;
        let bestSim = 0;
        for (const c of clusters) {
            const sim = jaccard(c.sig, p.sig);
            if (sim > bestSim) {
                bestSim = sim;
                best = c;
            }
        }
        if (best && bestSim >= 0.18) {
            best.items.push(p);
            p.sig.forEach((t) => best.sig.add(t));
        } else clusters.push({ items: [p], sig: new Set(p.sig) });
    }

    const storylines = clusters
        .map((c) => {
            const entCount = new Map();
            c.items.forEach((p) =>
                p.ents.slice(0, 5).forEach((e) => entCount.set(e.text, (entCount.get(e.text) || 0) + 1 + (e.inTitle ? 0.5 : 0)))
            );
            const topEnt = [...entCount.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
            const lead = c.items[0].a;
            const label = topEnt || lead.keywords?.[0]?.text || lead.title;
            return {
                label,
                summary: lead.summary?.tldr || lead.description,
                size: c.items.length,
                latest: Math.max(...c.items.map((p) => p.a.publishedAt)),
                articles: c.items.slice(0, 6).map((p) => ({ id: p.a.id, title: p.a.title })),
            };
        })
        .sort((x, y) => y.size - x.size || y.latest - x.latest)
        .slice(0, 6);

    const brief = storylines.slice(0, 5).map((s) => ({ text: s.summary, articleId: s.articles[0].id }));

    const themeMap = new Map();
    for (const { a } of prepared) {
        for (const k of (a.keywords || []).slice(0, 6)) {
            const key = k.text.toLowerCase();
            const t = themeMap.get(key) || { term: k.text, weight: 0, count: 0 };
            t.weight += k.score;
            t.count++;
            themeMap.set(key, t);
        }
    }

    const themes = [...themeMap.values()]
        .sort((x, y) => y.count - x.count || y.weight - x.weight)
        .slice(0, 14)
        .map((t) => ({ term: t.term, count: t.count, weight: +t.weight.toFixed(2) }));

    const lensMap = { PERSON: new Map(), PLACE: new Map(), ORG: new Map(), SCHEME: new Map(), LAW: new Map(), EVENT: new Map(), REPORT: new Map(), AWARD: new Map() };
    for (const { a, ents } of prepared) {
        for (const e of ents) {
            const m = lensMap[e.type];
            if (!m) continue;
            const v = m.get(e.text) || { name: e.text, count: 0, articleId: a.id, headline: a.title, role: e.role };
            v.count += e.count;
            m.set(e.text, v);
        }
    }

    const top = (m, n = 8) => [...m.values()].sort((x, y) => y.count - x.count).slice(0, n);

    const numbers = [];
    for (const { a } of prepared) {
        for (const s of articleSentences(a).slice(0, 4)) {
            const n = extractNumbers(s).find((x) => !x.isYear);
            if (n) {
                numbers.push({ value: n.raw, context: truncate(s, 180), articleId: a.id });
                break;
            }
        }
        if (numbers.length >= 8) break;
    }

    return {
        articleCount: articles.length,
        brief,
        storylines,
        themes,
        lens: {
            persons: top(lensMap.PERSON),
            places: top(lensMap.PLACE),
            organisations: top(lensMap.ORG),
            schemes: top(lensMap.SCHEME, 6),
            laws: top(lensMap.LAW, 6),
            events: top(lensMap.EVENT, 6),
            reports: top(lensMap.REPORT, 6),
            awards: top(lensMap.AWARD, 6),
            numbers,
        },
    };
}