import { describe, expect, it } from 'vitest';
import { MAX_QUERY_LENGTH, parseSearchParams } from './params';

const parse = (qs: string) => parseSearchParams(new URL(`http://x/search?${qs}`));

describe('parseSearchParams', () => {
    it('applies defaults', () => {
        expect(parse('')).toEqual({
            search: '',
            author: '',
            page: 1,
            show: 15,
            sort: 'rel',
            exclude: [],
            fuzzy: false,
            searchDesc: false,
            exactSearch: false
        });
    });

    it('falls back to page 1 for invalid pages', () => {
        expect(parse('page=abc').page).toBe(1);
        expect(parse('page=-3').page).toBe(1);
        expect(parse('page=0').page).toBe(1);
        expect(parse('page=').page).toBe(1);
        expect(parse('page=2.9').page).toBe(2);
        expect(parse('page=7').page).toBe(7);
    });

    it('only accepts the supported page sizes', () => {
        expect(parse('show=1000').show).toBe(15);
        expect(parse('show=100000').show).toBe(15);
        expect(parse('show=abc').show).toBe(15);
        expect(parse('show=-15').show).toBe(15);
        expect(parse('show=45').show).toBe(45);
        expect(parse('show=75').show).toBe(75);
    });

    it('only accepts known sorts', () => {
        expect(parse('sort=foo').sort).toBe('rel');
        expect(parse('sort=low').sort).toBe('low');
        expect(parse('sort=high').sort).toBe('high');
        expect(parse('sort=rel').sort).toBe('rel');
    });

    it('trims and caps query text', () => {
        expect(parse('search=%20%20sahih%20bukhari%20&author=%20x%20')).toMatchObject({
            search: 'sahih bukhari',
            author: 'x'
        });
        const long = 'a'.repeat(MAX_QUERY_LENGTH + 100);
        expect(parse(`search=${long}&author=${long}`).search.length).toBe(MAX_QUERY_LENGTH);
        expect(parse(`search=${long}&author=${long}`).author.length).toBe(MAX_QUERY_LENGTH);
    });

    it('reads flags and repeated exclude params', () => {
        const p = parse('fuzzy=true&searchDesc=true&exactSearch=true&exclude=A&exclude=B&exclude=');
        expect(p).toMatchObject({
            fuzzy: true,
            searchDesc: true,
            exactSearch: true,
            exclude: ['A', 'B']
        });
        expect(parse('fuzzy=1&searchDesc=yes&exactSearch=false')).toMatchObject({
            fuzzy: false,
            searchDesc: false,
            exactSearch: false
        });
    });
});
