import { normalizeText } from './normalize';
import type { SearchParams } from './params';
import { listingKey, priceOf } from './types';
import type { BookDoc, VectorHit } from './types';
import { VECTOR_SCORE_FLOOR } from './vector';

export type RankTier = 1 | 2 | 3 | 4;
export type RankedBook = BookDoc & { _tier: RankTier; _rank: number };

export type RankInput = {
    /** Tier 1: keyword hits matching title and author. */
    primary: BookDoc[];
    /** Tier 2: title matched, author did not. */
    titleOnly: BookDoc[];
    /** Tier 4: description matches. */
    description: BookDoc[];
    /** Tier 3: nearest neighbors, best first, each with a `score`. */
    vector: VectorHit[];
    /** Normalized query text ('' when that part was not given). */
    query: { title: string; author: string };
    searchDesc: boolean;
    /** Override for tests; defaults to VECTOR_SCORE_FLOOR. */
    vectorFloor?: number;
};

/** How many neighbors to show when nothing else matched (paraphrase queries). */
export const VECTOR_FALLBACK_COUNT = 10;

type Entry = { doc: BookDoc; tier: RankTier; vec: number };
type Relevance = { phrase: number; prefix: number; coverage: number };

function relevanceAgainst(field: string, query: string): Relevance {
    const text = normalizeText(field);
    if (!text || !query) return { phrase: 0, prefix: 0, coverage: 0 };
    const firstToken = query.split(' ')[0];
    return {
        phrase: text.includes(query) ? 1 : 0,
        prefix: text.startsWith(firstToken) ? 1 : 0,
        coverage: Math.min(1, query.length / Math.max(text.length, 1))
    };
}

function compareRelevance(a: Relevance, b: Relevance): number {
    return b.phrase - a.phrase || b.prefix - a.prefix || b.coverage - a.coverage;
}

/**
 * Title queries are scored against the title. Author-only queries are scored
 * against whichever author field (English / Arabic) fits better.
 */
function relevanceOf(doc: BookDoc, query: RankInput['query']): Relevance {
    if (query.title) {
        return relevanceAgainst(doc.titleNormalized || doc.title || '', query.title);
    }
    const candidates = [doc.authorNormalized, doc.authorArabicNormalized]
        .filter((f): f is string => typeof f === 'string' && f !== '')
        .map((f) => relevanceAgainst(f, query.author));
    if (candidates.length === 0) return { phrase: 0, prefix: 0, coverage: 0 };
    return candidates.reduce((best, cur) => (compareRelevance(cur, best) < 0 ? cur : best));
}

/** Ascending by price, missing prices last. */
function comparePriceAsc(a: number | null, b: number | null): number {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
}

/** Descending by price, missing prices last. */
function comparePriceDesc(a: number | null, b: number | null): number {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return b - a;
}

function strip(entry: Entry, rank: number): RankedBook {
    // `score` is only meaningful while ranking; drop it from vector docs.
    const { score: _score, ...rest } = entry.doc as BookDoc & { score?: unknown };
    return { ...rest, _tier: entry.tier, _rank: rank } as RankedBook;
}

export function rankResults(input: RankInput, sort: SearchParams['sort']): RankedBook[] {
    const floor = input.vectorFloor ?? VECTOR_SCORE_FLOOR;

    const vecScore = new Map<string, number>();
    for (const hit of input.vector) vecScore.set(listingKey(hit), hit.score);

    // Dedupe on (source, url), keeping the highest tier (tiers are added best first).
    const entries = new Map<string, Entry>();
    const add = (doc: BookDoc, tier: RankTier) => {
        const key = listingKey(doc);
        if (entries.has(key)) return;
        entries.set(key, { doc, tier, vec: vecScore.get(key) ?? 0 });
    };
    for (const d of input.primary) add(d, 1);
    for (const d of input.titleOnly) add(d, 2);
    for (const h of input.vector) if (h.score >= floor) add(h, 3);
    if (input.searchDesc) for (const d of input.description) add(d, 4);

    // Paraphrase fallback: nothing matched, so show the closest neighbors anyway.
    // Relevance sort only; price sorts never include below-floor neighbors.
    if (entries.size === 0 && sort === 'rel' && input.vector.length > 0) {
        const nearest = [...input.vector]
            .sort((a, b) => b.score - a.score)
            .slice(0, VECTOR_FALLBACK_COUNT);
        for (const h of nearest) add(h, 3);
    }

    const relCache = new Map<Entry, Relevance>();
    const rel = (e: Entry): Relevance => {
        let r = relCache.get(e);
        if (!r) {
            r = relevanceOf(e.doc, input.query);
            relCache.set(e, r);
        }
        return r;
    };

    const byRelevance = (a: Entry, b: Entry): number => {
        if (a.tier !== b.tier) return a.tier - b.tier;
        // Semantic-only hits have no phrase/prefix signal worth trusting over the
        // vector score (title length would otherwise dominate), so they lead with it.
        if (a.tier === 3 && a.vec !== b.vec) return b.vec - a.vec;
        return (
            compareRelevance(rel(a), rel(b)) ||
            b.vec - a.vec ||
            comparePriceAsc(priceOf(a.doc), priceOf(b.doc))
        );
    };

    const ordered = [...entries.values()].sort(byRelevance);

    if (sort === 'low' || sort === 'high') {
        // Tier boundaries are dropped; ties keep the relevance order (stable sort).
        const cmp = sort === 'low' ? comparePriceAsc : comparePriceDesc;
        ordered.sort((a, b) => cmp(priceOf(a.doc), priceOf(b.doc)));
    }

    return ordered.map((e, i) => strip(e, i));
}
