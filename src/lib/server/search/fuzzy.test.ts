import { describe, expect, it } from 'vitest';
import {
    FUZZY_MAX_VARIANTS,
    fuzzyRegexSource,
    fuzzyVariantCount,
    isFuzzable,
    selectFuzzyTokens
} from './fuzzy';
import { escapeRegex, tokenRegex } from './normalize';

const fuzzy = (token: string) => new RegExp(fuzzyRegexSource(token, escapeRegex), 'i');

describe('fuzzy', () => {
    it('bukhary fuzz matches bukhari', () => {
        expect(fuzzy('bukhary').test('sahih bukhari')).toBe(true);
    });

    it('tolerates single edits', () => {
        const re = fuzzy('tirmidhi');
        expect(re.test('tirmizhi')).toBe(true); // substitution
        expect(fuzzy('tirmizhi').test('tirmidhi')).toBe(true); // ...in the other direction
        expect(re.test('tirmdhi')).toBe(true); // deletion
        expect(re.test('tirmiddhi')).toBe(true); // insertion
        expect(re.test('tirmedhi')).toBe(true); // substitution
        expect(re.test('trimidhi')).toBe(true); // transposition
    });

    it('does not match two edits apart', () => {
        expect(fuzzy('tirmidhi').test('tarmedhi')).toBe(false);
    });

    it('does not fuzz tokens under 5 characters', () => {
        expect(isFuzzable('ibn')).toBe(false);
        expect(isFuzzable('fiqh')).toBe(false);
        expect(isFuzzable('sahih')).toBe(true);
        expect(fuzzyVariantCount('fiqh')).toBe(0);
        expect(fuzzyRegexSource('fiqh', escapeRegex)).toBe('fiqh');
        expect(tokenRegex('fiqh', { fuzzy: true })).toBe(tokenRegex('fiqh'));
    });

    it('never fuzzes Arabic or digit tokens', () => {
        expect(isFuzzable('بخاري')).toBe(false);
        expect(isFuzzable('12345')).toBe(false);
    });

    it('keeps the total variant count within the cap, longest tokens first', () => {
        const tokens = ['sahih', 'bukhari', 'muhammad', 'abdurrahman', 'ibnkathir', 'tafsirulquran'];
        const chosen = selectFuzzyTokens(tokens);
        const total = [...chosen].reduce((sum, t) => sum + fuzzyVariantCount(t), 0);
        expect(total).toBeLessThanOrEqual(FUZZY_MAX_VARIANTS);
        expect(chosen.has('tafsirulquran')).toBe(true);
    });

    it('drops the shortest tokens first when the cap is hit', () => {
        const tokens = ['abcdefghijklmnopqrstuvwxy', 'sahih', 'bukhari', 'muhammad', 'abdurrahman'];
        const cap = fuzzyVariantCount('abcdefghijklmnopqrstuvwxy') + fuzzyVariantCount('abdurrahman');
        const chosen = selectFuzzyTokens(tokens, cap);
        expect(chosen.has('abcdefghijklmnopqrstuvwxy')).toBe(true);
        expect(chosen.has('abdurrahman')).toBe(true);
        expect(chosen.has('sahih')).toBe(false);
        expect(chosen.has('bukhari')).toBe(false);
    });

    it('honors a small explicit cap', () => {
        expect(selectFuzzyTokens(['sahih', 'bukhari'], 1).size).toBe(0);
    });
});
