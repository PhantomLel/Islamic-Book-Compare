import { describe, expect, it } from 'vitest';
import { normalizeText } from './normalize';
import { VECTOR_FALLBACK_COUNT, rankResults } from './rank';
import type { RankInput } from './rank';
import type { BookDoc, VectorHit } from './types';
import { VECTOR_SCORE_FLOOR } from './vector';

const ABOVE = VECTOR_SCORE_FLOOR + 0.1;
const BELOW = VECTOR_SCORE_FLOOR - 0.1;

let counter = 0;
function book(title: string, extra: Partial<BookDoc> = {}): BookDoc {
    counter += 1;
    return {
        source: extra.source ?? 'Store A',
        url: extra.url ?? `https://example.com/${counter}`,
        title,
        titleNormalized: normalizeText(title),
        price: 10,
        instock: true,
        ...extra
    };
}
const hit = (doc: BookDoc, score: number): VectorHit => ({ ...doc, score });

function input(over: Partial<RankInput> = {}): RankInput {
    return {
        primary: [],
        titleOnly: [],
        description: [],
        vector: [],
        query: { title: 'sahih bukhari', author: '' },
        searchDesc: false,
        ...over
    };
}

const titles = (ranked: { title?: string | null }[]) => ranked.map((r) => r.title);

describe('rankResults (relevance)', () => {
    it('ranks an exact title above a higher-scoring vector neighbor', () => {
        const exact = book('Sahih Bukhari', { url: 'exact' });
        const neighbor = book('Sahih Muslim', { url: 'neighbor' });
        const out = rankResults(
            input({
                primary: [exact],
                vector: [hit(neighbor, 0.99), hit(exact, 0.8)]
            }),
            'rel'
        );
        expect(titles(out)).toEqual(['Sahih Bukhari', 'Sahih Muslim']);
        expect(out.map((r) => r._tier)).toEqual([1, 3]);
    });

    it('keeps a swapped word order in tier 1, below the exact phrase', () => {
        const swapped = book('Bukhari Sahih');
        const exact = book('Sahih Bukhari');
        const out = rankResults(input({ primary: [swapped, exact] }), 'rel');
        expect(titles(out)).toEqual(['Sahih Bukhari', 'Bukhari Sahih']);
        expect(out.every((r) => r._tier === 1)).toBe(true);
    });

    it('prefers a title that starts with the query, then shorter titles', () => {
        const long = book('The Complete Sahih Bukhari With Commentary');
        const prefix = book('Sahih Bukhari With Commentary');
        const short = book('Sahih Bukhari');
        const out = rankResults(input({ primary: [long, prefix, short] }), 'rel');
        expect(titles(out)).toEqual([
            'Sahih Bukhari',
            'Sahih Bukhari With Commentary',
            'The Complete Sahih Bukhari With Commentary'
        ]);
    });

    it('breaks relevance ties with the vector score, then price', () => {
        const a = book('Sahih Bukhari', { url: 'a', price: 5 });
        const b = book('Sahih Bukhari', { url: 'b', price: 20 });
        const c = book('Sahih Bukhari', { url: 'c', price: 1 });
        const out = rankResults(
            input({ primary: [a, b, c], vector: [hit(b, 0.9)] }),
            'rel'
        );
        expect(out.map((r) => r.url)).toEqual(['b', 'c', 'a']);
    });

    it('excludes a below-floor neighbor when keyword hits exist', () => {
        const exact = book('Sahih Bukhari');
        const near = book('Sahih Muslim');
        const far = book('Cooking For Beginners');
        const out = rankResults(
            input({ primary: [exact], vector: [hit(near, ABOVE), hit(far, BELOW)] }),
            'rel'
        );
        expect(titles(out)).toEqual(['Sahih Bukhari', 'Sahih Muslim']);
    });

    it('returns the top neighbors when nothing else matched and all are below the floor', () => {
        const neighbors = Array.from({ length: 25 }, (_, i) =>
            hit(book(`Neighbor ${i}`, { url: `n${i}` }), BELOW - i * 0.001)
        );
        const out = rankResults(input({ vector: neighbors }), 'rel');
        expect(out).toHaveLength(VECTOR_FALLBACK_COUNT);
        expect(out.every((r) => r._tier === 3)).toBe(true);
        expect(out.map((r) => r.url)).toEqual(neighbors.slice(0, 10).map((n) => n.url));
    });

    it('orders semantic-only hits by vector score', () => {
        const long = hit(book('A Very Long Title About Patience And Perseverance'), 0.95);
        const short = hit(book('Sabr'), 0.85);
        const out = rankResults(input({ vector: [short, long] }), 'rel');
        expect(titles(out)).toEqual([long.title, short.title]);
    });

    it('does not use the fallback when keyword hits exist but the vector is below the floor', () => {
        const exact = book('Sahih Bukhari');
        const far = hit(book('Cooking For Beginners'), BELOW);
        expect(rankResults(input({ primary: [exact], vector: [far] }), 'rel')).toHaveLength(1);
    });

    it('ranks title-only hits below primary hits, and description hits last', () => {
        const primary = book('Long Title That Mentions Sahih Bukhari In The Middle Somewhere');
        const titleOnly = book('Sahih Bukhari');
        const vec = book('Sahih Muslim');
        const desc = book('Some Other Book');
        const out = rankResults(
            input({
                primary: [primary],
                titleOnly: [titleOnly],
                vector: [hit(vec, ABOVE)],
                description: [desc],
                searchDesc: true
            }),
            'rel'
        );
        expect(out.map((r) => r._tier)).toEqual([1, 2, 3, 4]);
        expect(titles(out)).toEqual([primary.title, titleOnly.title, vec.title, desc.title]);
    });

    it('ignores description hits unless searchDesc is on', () => {
        const desc = book('Some Other Book');
        const exact = book('Sahih Bukhari');
        const off = rankResults(input({ primary: [exact], description: [desc] }), 'rel');
        expect(off).toHaveLength(1);
    });

    it('dedupes on (source, url), keeping the best tier', () => {
        const d = book('Sahih Bukhari', { url: 'same', source: 'S' });
        const out = rankResults(
            input({
                primary: [d],
                titleOnly: [{ ...d }],
                vector: [hit({ ...d }, ABOVE)]
            }),
            'rel'
        );
        expect(out).toHaveLength(1);
        expect(out[0]._tier).toBe(1);
    });

    it('treats the same URL in two stores as two listings', () => {
        const a = book('Sahih Bukhari', { url: 'same', source: 'S1' });
        const b = book('Sahih Bukhari', { url: 'same', source: 'S2' });
        expect(rankResults(input({ primary: [a, b] }), 'rel')).toHaveLength(2);
    });

    it('scores author-only queries against either author field', () => {
        const en = book('Riyad al-Salihin', {
            authorNormalized: 'nawawi',
            authorArabicNormalized: ''
        });
        const ar = book('Al-Arbaun', {
            authorNormalized: 'some long unrelated english author name here nawawi',
            authorArabicNormalized: 'نووي'
        });
        const out = rankResults(
            input({ primary: [ar, en], query: { title: '', author: 'nawawi' } }),
            'rel'
        );
        expect(titles(out)).toEqual(['Riyad al-Salihin', 'Al-Arbaun']);
    });

    it('does not mutate its input or leak the vector score field', () => {
        const d = book('Sahih Muslim');
        const h = hit(d, ABOVE);
        const out = rankResults(input({ vector: [h] }), 'rel');
        expect(h.score).toBe(ABOVE);
        expect('score' in out[0]).toBe(false);
        expect(out[0]._rank).toBe(0);
    });
});

describe('rankResults (price sorts)', () => {
    it('sorts tiers 1-3 by price and never includes below-floor neighbors', () => {
        const cheap = book('Sahih Bukhari Abridged', { price: 5 });
        const mid = book('Sahih Bukhari', { price: 12 });
        const neighborCheap = hit(book('Sahih Muslim', { price: 3 }), ABOVE);
        const loose = hit(book('Cooking For Beginners', { price: 1 }), BELOW);
        const input1 = input({ primary: [mid, cheap], vector: [neighborCheap, loose] });

        expect(titles(rankResults(input1, 'low'))).toEqual([
            'Sahih Muslim',
            'Sahih Bukhari Abridged',
            'Sahih Bukhari'
        ]);
        expect(titles(rankResults(input1, 'high'))).toEqual([
            'Sahih Bukhari',
            'Sahih Bukhari Abridged',
            'Sahih Muslim'
        ]);
    });

    it('does not fall back to below-floor neighbors for price sorts', () => {
        const loose = [hit(book('Cooking For Beginners'), BELOW), hit(book('Gardening'), BELOW)];
        expect(rankResults(input({ vector: loose }), 'low')).toEqual([]);
        expect(rankResults(input({ vector: loose }), 'high')).toEqual([]);
        expect(rankResults(input({ vector: loose }), 'rel')).toHaveLength(2);
    });

    it('sinks null or missing prices to the bottom for both directions', () => {
        const noPrice = book('Sahih Bukhari', { price: null });
        const missing = book('Sahih Bukhari Two');
        delete (missing as Partial<BookDoc>).price;
        const cheap = book('Sahih Bukhari Cheap', { price: 2 });
        const dear = book('Sahih Bukhari Dear', { price: 30 });

        const low = rankResults(input({ primary: [noPrice, missing, dear, cheap] }), 'low');
        expect(titles(low).slice(0, 2)).toEqual(['Sahih Bukhari Cheap', 'Sahih Bukhari Dear']);
        expect(low.slice(2).every((r) => r.price == null)).toBe(true);

        const high = rankResults(input({ primary: [noPrice, missing, cheap, dear] }), 'high');
        expect(titles(high).slice(0, 2)).toEqual(['Sahih Bukhari Dear', 'Sahih Bukhari Cheap']);
        expect(high.slice(2).every((r) => r.price == null)).toBe(true);
    });

    it('parses numeric string prices', () => {
        const a = book('Sahih Bukhari A', { price: '7.50' });
        const b = book('Sahih Bukhari B', { price: 3 });
        expect(titles(rankResults(input({ primary: [a, b] }), 'low'))).toEqual([
            'Sahih Bukhari B',
            'Sahih Bukhari A'
        ]);
    });

    it('includes description hits only when searchDesc is on', () => {
        const exact = book('Sahih Bukhari', { price: 10 });
        const desc = book('Some Other Book', { price: 1 });
        expect(
            rankResults(input({ primary: [exact], description: [desc], searchDesc: false }), 'low')
        ).toHaveLength(1);
        expect(
            titles(
                rankResults(input({ primary: [exact], description: [desc], searchDesc: true }), 'low')
            )
        ).toEqual(['Some Other Book', 'Sahih Bukhari']);
    });

    it('keeps relevance order among equal prices', () => {
        const exact = book('Sahih Bukhari', { price: 10 });
        const loose = book('The Story Of Sahih Bukhari Explained', { price: 10 });
        const out = rankResults(input({ primary: [loose, exact] }), 'low');
        expect(titles(out)).toEqual(['Sahih Bukhari', 'The Story Of Sahih Bukhari Explained']);
    });
});
