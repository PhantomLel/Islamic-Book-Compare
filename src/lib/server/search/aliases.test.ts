import { describe, expect, it } from 'vitest';
import { ALIAS_GROUPS, MAX_ALIAS_ALTERNATIVES, expandAliases } from './aliases';
import { normalizeText } from './normalize';

describe('ALIAS_GROUPS', () => {
    it('stores every entry already normalized', () => {
        for (const group of ALIAS_GROUPS) {
            for (const entry of group) {
                expect(normalizeText(entry), entry).toBe(entry);
            }
        }
    });

    it('lists no entry in more than one group', () => {
        const seen = new Set<string>();
        for (const entry of ALIAS_GROUPS.flat()) {
            expect(seen.has(entry), entry).toBe(false);
            seen.add(entry);
        }
    });
});

describe('expandAliases', () => {
    it('returns the original tokens first', () => {
        expect(expandAliases(['bukharee'])[0]).toEqual(['bukharee']);
    });

    it('expands bukharee to include the Arabic form', () => {
        const alts = expandAliases(['bukharee']);
        expect(alts).toContainEqual(['bukhari']);
        expect(alts).toContainEqual(['بخاري']);
    });

    it('expands the Arabic form back to English', () => {
        expect(expandAliases(['بخاري'])).toContainEqual(['bukhari']);
    });

    it('matches multi-token aliases greedily', () => {
        const alts = expandAliases(['abu', 'dawud']);
        expect(alts).toContainEqual(['abu', 'dawood']);
        expect(alts).toContainEqual(['ابو', 'داود']);
    });

    it('expands aliases inside a longer query and keeps the rest', () => {
        const alts = expandAliases(['sahih', 'bukhari']);
        expect(alts[0]).toEqual(['sahih', 'bukhari']);
        expect(alts).toContainEqual(['صحيح', 'بخاري']);
        expect(alts).toContainEqual(['saheeh', 'bukhari']);
        expect(alts).toContainEqual(['sahih', 'bukharee']);
    });

    it('passes through tokens without aliases', () => {
        expect(expandAliases(['zzz', 'yyy'])).toEqual([['zzz', 'yyy']]);
    });

    it('returns a single empty alternative for no tokens', () => {
        expect(expandAliases([])).toEqual([[]]);
    });

    it('enforces the alternative cap', () => {
        const many = ['bukhari', 'muslim', 'tirmidhi', 'nawawi', 'hadith', 'sahih', 'tafsir'];
        const alts = expandAliases(many);
        expect(alts.length).toBe(MAX_ALIAS_ALTERNATIVES);
        expect(alts[0]).toEqual(many);
        expect(new Set(alts.map((a) => a.join(' '))).size).toBe(alts.length);
    });
});
