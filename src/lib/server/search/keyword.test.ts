import { describe, expect, it } from 'vitest';
import { buildKeywordFilters, prepareQuery } from './keyword';
import type { KeywordOptions } from './keyword';

const OPTS: KeywordOptions = { exclude: [], fuzzy: false, searchDesc: false, exactSearch: false };

type Doc = Record<string, any>;

/**
 * Tiny evaluator for the subset of Mongo filter syntax the builders emit:
 * $and, $or, $nor, equality, $nin and $regex/$options.
 */
function matches(filter: Doc, doc: Doc): boolean {
    return Object.entries(filter).every(([key, cond]) => {
        if (key === '$and') return (cond as Doc[]).every((c) => matches(c, doc));
        if (key === '$or') return (cond as Doc[]).some((c) => matches(c, doc));
        if (key === '$nor') return !(cond as Doc[]).some((c) => matches(c, doc));
        const value = doc[key];
        if (cond && typeof cond === 'object' && '$regex' in cond) {
            return typeof value === 'string' && new RegExp(cond.$regex, cond.$options).test(value);
        }
        if (cond && typeof cond === 'object' && '$nin' in cond) {
            return !cond.$nin.includes(value);
        }
        return value === cond;
    });
}

const book = (over: Doc): Doc => ({ instock: true, source: 'S', ...over });

describe('prepareQuery', () => {
    it('normalizes, tokenizes and expands aliases', () => {
        const q = prepareQuery('Sahih al-Bukharee', '');
        expect(q.titleNorm).toBe('sahih al bukharee');
        expect(q.titleTokens).toEqual(['sahih', 'bukharee']);
        expect(q.titleAlts[0]).toEqual(['sahih', 'bukharee']);
        expect(q.titleAlts).toContainEqual(['sahih', 'bukhari']);
        expect(q.titleAlts).toContainEqual(['صحيح', 'بخاري']);
        expect(q.hasTitle).toBe(true);
        expect(q.hasAuthor).toBe(false);
        expect(q.authorAlts).toEqual([]);
    });

    it('treats punctuation-only input as empty', () => {
        const q = prepareQuery('(*)', '  ');
        expect(q.hasTitle).toBe(false);
        expect(q.hasAuthor).toBe(false);
    });
});

describe('buildKeywordFilters', () => {
    it('applies the in-stock filter and store exclusions', () => {
        const f = buildKeywordFilters(prepareQuery('sahih', ''), { ...OPTS, exclude: ['X', 'Y'] });
        expect(matches(f.primary, book({ titleNormalized: 'sahih' }))).toBe(true);
        expect(matches(f.primary, book({ titleNormalized: 'sahih', instock: false }))).toBe(false);
        expect(matches(f.primary, book({ titleNormalized: 'sahih', source: 'X' }))).toBe(false);
    });

    it('matches title tokens in any order', () => {
        const f = buildKeywordFilters(prepareQuery('sahih bukhari', ''), OPTS);
        expect(matches(f.primary, book({ titleNormalized: 'bukhari sahih' }))).toBe(true);
        expect(matches(f.primary, book({ titleNormalized: 'sahih al-bukhari' }))).toBe(true);
        expect(matches(f.primary, book({ titleNormalized: 'sahih muslim' }))).toBe(false);
    });

    it('finds Arabic titles from English aliases and back', () => {
        const en = buildKeywordFilters(prepareQuery('Bukharee', ''), OPTS);
        expect(matches(en.primary, book({ titleNormalized: 'صحيح بخاري' }))).toBe(true);
        expect(matches(en.primary, book({ titleNormalized: 'sahih bukhari' }))).toBe(true);
        const ar = buildKeywordFilters(prepareQuery('صحيح البخاري', ''), OPTS);
        expect(matches(ar.primary, book({ titleNormalized: 'Sahih al-Bukhari' }))).toBe(true);
    });

    it('does not throw or over-match on regex metacharacters', () => {
        for (const raw of ['c++', 'a(b', '[x', '*', '?', 'a.b', '\\', '$^']) {
            const f = buildKeywordFilters(prepareQuery(raw, raw), OPTS);
            expect(() => matches(f.primary, book({ titleNormalized: 'x', authorNormalized: 'y' }))).not.toThrow();
        }
        const f = buildKeywordFilters(prepareQuery('what (is) islam?', ''), OPTS);
        expect(matches(f.primary, book({ titleNormalized: 'what is islam' }))).toBe(true);
    });

    it('matches authors on either author field', () => {
        const f = buildKeywordFilters(prepareQuery('', 'ابن تيمية'), OPTS);
        expect(matches(f.primary, book({ authorArabicNormalized: 'ابن تيميه' }))).toBe(true);
        expect(matches(f.primary, book({ authorNormalized: 'ibn taymiyyah' }))).toBe(true);
        expect(matches(f.primary, book({ authorNormalized: 'someone else' }))).toBe(false);
        expect(f.titleOnly).toBeUndefined();
    });

    it('requires both title and author for the primary query and offers a title-only tier', () => {
        const f = buildKeywordFilters(prepareQuery('sahih', 'bukhari'), OPTS);
        const good = book({ titleNormalized: 'sahih', authorNormalized: 'imam bukhari' });
        const otherAuthor = book({ titleNormalized: 'sahih', authorNormalized: 'muslim' });
        const noAuthor = book({ titleNormalized: 'sahih' });
        expect(matches(f.primary, good)).toBe(true);
        expect(matches(f.primary, otherAuthor)).toBe(false);
        expect(matches(f.titleOnly!, good)).toBe(false);
        expect(matches(f.titleOnly!, otherAuthor)).toBe(true);
        expect(matches(f.titleOnly!, noAuthor)).toBe(true);
    });

    it('builds a description query only with searchDesc and a title', () => {
        const off = buildKeywordFilters(prepareQuery('patience', ''), OPTS);
        expect(off.description).toBeUndefined();
        const authorOnly = buildKeywordFilters(prepareQuery('', 'x author'), {
            ...OPTS,
            searchDesc: true
        });
        expect(authorOnly.description).toBeUndefined();

        const on = buildKeywordFilters(prepareQuery('patience', ''), { ...OPTS, searchDesc: true });
        expect(matches(on.description!, book({ titleNormalized: 'other', description: 'On PATIENCE.' }))).toBe(true);
        expect(matches(on.description!, book({ titleNormalized: 'patience', description: 'patience' }))).toBe(false);
        expect(matches(on.description!, book({ titleNormalized: 'other', description: 'nothing' }))).toBe(false);
    });

    it('applies fuzzy matching only when asked', () => {
        const strict = buildKeywordFilters(prepareQuery('tirmizhi', ''), OPTS);
        const fuzzy = buildKeywordFilters(prepareQuery('tirmizhi', ''), { ...OPTS, fuzzy: true });
        const stored = book({ titleNormalized: 'shamail tirmidhi' });
        expect(matches(strict.primary, stored)).toBe(false);
        expect(matches(fuzzy.primary, stored)).toBe(true);
    });

    describe('Exact Search', () => {
        const exact = { ...OPTS, exactSearch: true };

        it('requires a contiguous phrase', () => {
            const f = buildKeywordFilters(prepareQuery('sahih al bukhari', ''), exact);
            expect(matches(f.primary, book({ titleNormalized: 'Sahih al-Bukhari (2 vols)' }))).toBe(true);
            expect(matches(f.primary, book({ titleNormalized: 'bukhari sahih' }))).toBe(false);
            expect(matches(f.primary, book({ titleNormalized: 'sahih bukhari' }))).toBe(false);
        });

        it('matches a partial phrase inside a longer title', () => {
            const f = buildKeywordFilters(prepareQuery('riyad al salihin', ''), exact);
            expect(matches(f.primary, book({ titleNormalized: 'the gardens: riyad al-salihin' }))).toBe(true);
        });

        it('uses no aliases, no fuzzy, no description and no title-only tier', () => {
            const f = buildKeywordFilters(
                prepareQuery('bukharee', 'nawawee'),
                { ...exact, fuzzy: true, searchDesc: true }
            );
            expect(f.titleOnly).toBeUndefined();
            expect(f.description).toBeUndefined();
            const doc = book({ titleNormalized: 'bukhari', authorNormalized: 'nawawi' });
            expect(matches(f.primary, doc)).toBe(false);
        });

        it('checks the author phrase against either author field', () => {
            const f = buildKeywordFilters(prepareQuery('', 'ابن تيميه'), exact);
            expect(matches(f.primary, book({ authorArabicNormalized: 'ابن تيميه' }))).toBe(true);
            expect(matches(f.primary, book({ authorNormalized: 'x' }))).toBe(false);
        });
    });
});
