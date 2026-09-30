import type { Db } from 'mongodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../embed', () => ({
    EMBED_MODEL: 'test-model',
    embedQuery: vi.fn()
}));

import { embedQuery } from '../embed';
import { runSearch } from './index';
import { KEYWORD_LIMIT } from './keyword';
import { normalizeText } from './normalize';
import { parseSearchParams } from './params';
import type { SearchParams } from './params';
import type { BookDoc } from './types';
import { VECTOR_NUM_CANDIDATES, VECTOR_SCORE_FLOOR } from './vector';

type Pipeline = Record<string, any>[];
type Handlers = {
    primary?: (p: Pipeline) => Promise<any[]>;
    secondary?: (p: Pipeline) => Promise<any[]>;
    vector?: (p: Pipeline) => Promise<any[]>;
};

/** Just enough of `Db` for `db.collection('books').aggregate(pipeline).toArray()`. */
function fakeDb(handlers: Handlers): { db: Db; pipelines: Pipeline[] } {
    const pipelines: Pipeline[] = [];
    const route = (p: Pipeline): Promise<any[]> => {
        pipelines.push(p);
        if (p[0].$vectorSearch) return (handlers.vector ?? (async () => []))(p);
        if (p[1]?.$facet) return (handlers.primary ?? (async () => [{ docs: [], count: [] }]))(p);
        return (handlers.secondary ?? (async () => []))(p);
    };
    const db = {
        collection: () => ({ aggregate: (p: Pipeline) => ({ toArray: () => route(p) }) })
    } as unknown as Db;
    return { db, pipelines };
}

const params = (qs: string): SearchParams => parseSearchParams(new URL(`http://x/search?${qs}`));

let n = 0;
function book(title: string, source = 'Store A', price = 10, extra: Partial<BookDoc> = {}): BookDoc {
    n += 1;
    return {
        source,
        url: `https://${source.replace(/\W/g, '')}.example/${n}`,
        title,
        author: 'Someone',
        titleNormalized: normalizeText(title),
        price,
        instock: true,
        ...extra
    };
}
const facet = (docs: BookDoc[], count = docs.length) => [{ docs, count: [{ n: count }] }];

const VECTOR = [0.1, 0.2, 0.3];

beforeEach(() => {
    vi.mocked(embedQuery).mockReset();
    vi.mocked(embedQuery).mockResolvedValue(VECTOR);
    delete (globalThis as any).__queryEmbedCache;
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('runSearch', () => {
    it('returns an empty result without touching Mongo when there is no usable query', async () => {
        const { db, pipelines } = fakeDb({});
        for (const qs of ['', 'search=%20&author=', 'search=(*)&author=%3F%3F']) {
            const r = await runSearch(db, params(qs));
            expect(r).toMatchObject({ results: [], total: 0, totalCapped: false, page: 1, start: 0, end: 0 });
        }
        expect(pipelines).toHaveLength(0);
        expect(embedQuery).not.toHaveBeenCalled();
    });

    it('merges keyword and vector hits, ranks them in tiers, and hides internals', async () => {
        const exact = book('Sahih Bukhari');
        const neighbor = book('Sahih Muslim', 'Store B');
        const noise = book('Cooking For Beginners', 'Store C');
        const { db } = fakeDb({
            primary: async () => facet([exact]),
            vector: async () => [
                { ...neighbor, score: VECTOR_SCORE_FLOOR + 0.1 },
                { ...noise, score: VECTOR_SCORE_FLOOR - 0.1 }
            ]
        });

        const r = await runSearch(db, params('search=sahih%20bukhari'));
        expect(r.results.map((b) => b.title)).toEqual(['Sahih Bukhari', 'Sahih Muslim']);
        expect(r).toMatchObject({ total: 2, totalCapped: false, page: 1, start: 1, end: 2 });
        for (const b of r.results) {
            expect(b).not.toHaveProperty('_tier');
            expect(b).not.toHaveProperty('_rank');
            expect(b).not.toHaveProperty('score');
        }
    });

    it('embeds the raw title\\nauthor text, not the normalized form', async () => {
        const { db } = fakeDb({});
        await runSearch(db, params('search=%E1%B9%A2a%E1%B8%A5%C4%AB%E1%B8%A5%20al-Bukh%C4%81r%C4%AB&author=Imam%20Bukhari'));
        expect(embedQuery).toHaveBeenCalledWith('Ṣaḥīḥ al-Bukhārī\nImam Bukhari');
    });

    it('shows one card per book with the other stores as offers', async () => {
        const a = book('Sahih Bukhari', 'Store A', 30, { author: 'Imam Bukhari' });
        const b = book('Sahih Bukhari', 'Store B', 12, { author: 'Imam Bukhari' });
        const { db } = fakeDb({ primary: async () => facet([a, b]) });
        const r = await runSearch(db, params('search=sahih%20bukhari'));
        expect(r.total).toBe(1);
        expect(r.results[0]).toMatchObject({ source: 'Store B', price: 12 });
        expect(r.results[0].offers).toEqual([
            { source: 'Store A', price: 30, url: a.url, instock: true }
        ]);
    });

    it('paginates groups and clamps a page past the end to the last page', async () => {
        const docs = Array.from({ length: 20 }, (_, i) => book(`Sahih Book ${i}`, 'Store A', i + 1));
        const { db } = fakeDb({ primary: async () => facet(docs) });

        const first = await runSearch(db, params('search=sahih&sort=low'));
        expect(first).toMatchObject({ total: 20, page: 1, start: 1, end: 15 });
        expect(first.results).toHaveLength(15);

        const last = await runSearch(db, params('search=sahih&sort=low&page=999'));
        expect(last).toMatchObject({ total: 20, page: 2, start: 16, end: 20 });
        expect(last.results.map((b) => b.title)).toEqual(
            docs.slice(15).map((d) => d.title)
        );
    });

    it('sanitizes invalid page and show values', async () => {
        const docs = Array.from({ length: 20 }, (_, i) => book(`Sahih Book ${i}`));
        const { db } = fakeDb({ primary: async () => facet(docs) });
        const r = await runSearch(db, params('search=sahih&page=-4&show=100000'));
        expect(r).toMatchObject({ page: 1, start: 1, end: 15 });
        expect(r.results).toHaveLength(15);
    });

    it('flags a capped keyword result set', async () => {
        const docs = [book('Quran One')];
        const { db } = fakeDb({ primary: async () => facet(docs, KEYWORD_LIMIT + 1) });
        expect((await runSearch(db, params('search=quran'))).totalCapped).toBe(true);
        const ok = fakeDb({ primary: async () => facet(docs, KEYWORD_LIMIT) });
        expect((await runSearch(ok.db, params('search=quran'))).totalCapped).toBe(false);
    });

    it('falls back to vector hits when the keyword search fails', async () => {
        const hit = { ...book('Sahih Muslim'), score: VECTOR_SCORE_FLOOR + 0.1 };
        const { db } = fakeDb({
            primary: async () => {
                throw new Error('mongo down');
            },
            vector: async () => [hit]
        });
        const r = await runSearch(db, params('search=sahih'));
        expect(r.results.map((b) => b.title)).toEqual(['Sahih Muslim']);
    });

    it('still returns keyword hits when Voyage fails', async () => {
        vi.mocked(embedQuery).mockResolvedValue(null);
        const { db } = fakeDb({ primary: async () => facet([book('Sahih Bukhari')]) });
        const r = await runSearch(db, params('search=sahih'));
        expect(r.total).toBe(1);
    });

    it('still returns keyword hits when the vector query errors', async () => {
        const { db } = fakeDb({
            primary: async () => facet([book('Sahih Bukhari')]),
            vector: async () => {
                throw new Error('index missing');
            }
        });
        expect((await runSearch(db, params('search=sahih'))).total).toBe(1);
    });

    it('throws only when everything that was attempted failed', async () => {
        const boom = async () => {
            throw new Error('boom');
        };
        await expect(
            runSearch(fakeDb({ primary: boom, vector: boom }).db, params('search=sahih'))
        ).rejects.toThrow('boom');

        // keyword fails and the query could not be embedded
        delete (globalThis as any).__queryEmbedCache; // the first case cached a vector
        vi.mocked(embedQuery).mockResolvedValue(null);
        await expect(
            runSearch(fakeDb({ primary: boom }).db, params('search=sahih'))
        ).rejects.toThrow('boom');

        // Exact Search never uses vector, so a keyword failure is fatal
        await expect(
            runSearch(fakeDb({ primary: boom }).db, params('search=sahih&exactSearch=true'))
        ).rejects.toThrow('boom');
    });

    it('does not embed or run vector search for Exact Search', async () => {
        const { db, pipelines } = fakeDb({ primary: async () => facet([book('Sahih Bukhari')]) });
        const r = await runSearch(db, params('search=sahih&exactSearch=true'));
        expect(r.total).toBe(1);
        expect(embedQuery).not.toHaveBeenCalled();
        expect(pipelines.some((p) => p[0].$vectorSearch)).toBe(false);
    });

    it('returns a valid empty result (not an error) when nothing matches anywhere', async () => {
        const { db } = fakeDb({});
        const r = await runSearch(db, params('search=zzzz&page=5'));
        expect(r).toMatchObject({ results: [], total: 0, page: 1, start: 0, end: 0 });
    });

    it('only queries descriptions with searchDesc, and title-only with title + author', async () => {
        const off = fakeDb({});
        await runSearch(off.db, params('search=patience'));
        expect(off.pipelines.filter((p) => !p[0].$vectorSearch && !p[1]?.$facet)).toHaveLength(0);

        const on = fakeDb({});
        await runSearch(on.db, params('search=patience&author=x&searchDesc=true'));
        const secondary = on.pipelines.filter((p) => !p[0].$vectorSearch && !p[1]?.$facet);
        expect(secondary).toHaveLength(2); // title-only + description
    });

    it('passes store exclusions to both searches', async () => {
        const { db, pipelines } = fakeDb({});
        await runSearch(db, params('search=sahih&exclude=Store%20X'));
        const vec = pipelines.find((p) => p[0].$vectorSearch)!;
        expect(vec[0].$vectorSearch.filter).toEqual({ instock: true, source: { $nin: ['Store X'] } });
        expect(vec[0].$vectorSearch.numCandidates).toBe(VECTOR_NUM_CANDIDATES);
        expect(vec[0].$vectorSearch.numCandidates).toBeGreaterThanOrEqual(10 * vec[0].$vectorSearch.limit);
        const kw = pipelines.find((p) => p[1]?.$facet)!;
        expect(JSON.stringify(kw[0].$match)).toContain('"$nin":["Store X"]');
    });
});
