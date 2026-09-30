import { describe, expect, it } from 'vitest';
import { escapeRegex, normalizeText, phraseRegex, tokenRegex, tokenize } from './normalize';

/**
 * KEEP IN SYNC: this table must be identical to CASES in
 * `book-scraper/tests/test_normalize.py`. The two normalizers have to produce
 * byte-identical output, or stored `*Normalized` fields drift from query text.
 */
export const CASES: Array<[string, string]> = [
    // hamza / alif forms
    ['أحمد', 'احمد'],
    ['إسلام', 'اسلام'],
    ['آمن', 'امن'],
    ['ٱلرحمن', 'رحمن'],
    ['مؤمن', 'مومن'],
    ['مسائل', 'مسايل'],
    // ة/ه, ى/ي, Persian letters, tatweel
    ['مكتبة', 'مكتبه'],
    ['موسى', 'موسي'],
    ['علی', 'علي'],
    ['کتاب', 'كتاب'],
    ['كتـــاب', 'كتاب'],
    // harakat
    ['بِسْمِ اللَّهِ', 'بسم الله'],
    // leading ال
    ['الله', 'الله'],
    ['ﷲ', 'الله'],
    ['البخاري', 'بخاري'],
    ['(البخاري)', 'بخاري'],
    ['صحيح البخاري', 'صحيح بخاري'],
    ['الكتاب', 'كتاب'],
    ['الحج', 'الحج'],
    ['الإمام', 'امام'],
    ['السلام عليكم', 'سلام عليكم'],
    // Latin diacritics and transliteration marks
    ['Ṣaḥīḥ al-Bukhārī', 'sahih al bukhari'],
    ['Qurʾān', 'qur an'],
    ["Qur'an", 'qur an'],
    ['Qur’an', 'qur an'],
    ['Riyāḍ al-Ṣāliḥīn', 'riyad al salihin'],
    ['İstanbul', 'istanbul'],
    ['Şeker', 'seker'],
    // punctuation, width, whitespace
    ['Al-Bukhari', 'al bukhari'],
    ['Dar-us-Salam (Vol. 2)', 'dar us salam vol 2'],
    ['ＡＢＣ', 'abc'],
    ['  Hello   World  ', 'hello world'],
    ['a(b)*c+?', 'a b c'],
    ['', '']
];

describe('normalizeText', () => {
    it.each(CASES)('%j -> %j', (input, expected) => {
        expect(normalizeText(input)).toBe(expected);
    });

    it('is idempotent', () => {
        for (const [, expected] of CASES) {
            expect(normalizeText(expected)).toBe(expected);
        }
    });

    it('keeps الله intact but strips ال from long words', () => {
        expect(normalizeText('الله')).toBe('الله');
        expect(normalizeText('البخاري')).toBe('بخاري');
        expect(normalizeText('(البخاري)')).toBe('بخاري');
    });
});

describe('tokenize', () => {
    it('drops stopwords and dedupes', () => {
        expect(tokenize(normalizeText('Ṣaḥīḥ al-Bukhārī'))).toEqual(['sahih', 'bukhari']);
        expect(tokenize('sahih sahih bukhari')).toEqual(['sahih', 'bukhari']);
    });

    it('keeps stopwords when nothing else remains', () => {
        expect(tokenize('the')).toEqual(['the']);
        expect(tokenize('al the')).toEqual(['al', 'the']);
    });

    it('keeps name particles', () => {
        expect(tokenize('ibn abu umm bin')).toEqual(['ibn', 'abu', 'umm', 'bin']);
    });

    it('returns [] for empty input', () => {
        expect(tokenize('')).toEqual([]);
    });
});

describe('escapeRegex', () => {
    it('escapes regex metacharacters', () => {
        const escaped = escapeRegex('a(b)*c+?');
        expect(escaped).toBe('a\\(b\\)\\*c\\+\\?');
        expect(new RegExp(escaped).test('a(b)*c+?')).toBe(true);
        expect(() => new RegExp(escapeRegex('[.*+?^${}()|[]\\'))).not.toThrow();
    });
});

describe('tokenRegex', () => {
    const test = (token: string, text: string, opts?: { fuzzy?: boolean }) =>
        new RegExp(tokenRegex(token, opts), 'i').test(text);

    it('matches both old and new Arabic spellings', () => {
        expect(test('مكتبه', 'مكتبة')).toBe(true);
        expect(test('مكتبه', 'مكتبه')).toBe(true);
        expect(test('موسي', 'موسى')).toBe(true);
        expect(test('امام', 'إمام')).toBe(true);
        expect(test('مومن', 'مؤمن')).toBe(true);
        expect(test('كتاب', 'کتاب')).toBe(true);
    });

    it('tolerates tatweel in stored text', () => {
        expect(test('كتاب', 'كتـــاب')).toBe(true);
    });

    it('anchors short Latin tokens to a word start', () => {
        expect(test('ali', 'quality')).toBe(false);
        expect(test('ali', 'ali ibn abi talib')).toBe(true);
        expect(test('ali', 'imam al-ali')).toBe(true);
    });

    it('leaves longer Latin tokens unanchored', () => {
        expect(test('bukhari', 'sahih albukhari')).toBe(true);
    });

    it('leaves Arabic tokens unanchored (prefixes attach)', () => {
        expect(test('كتاب', 'والكتاب')).toBe(true);
    });

    it('produces a valid regex for any token', () => {
        for (const t of ['a', 'c++', 'x(y', '[z', '\\', 'ا', 'bukhari']) {
            expect(() => new RegExp(tokenRegex(t), 'i')).not.toThrow();
        }
    });

    it('delegates to fuzzy for eligible tokens', () => {
        expect(test('bukhary', 'sahih bukhari', { fuzzy: true })).toBe(true);
        expect(test('bukhary', 'sahih bukhari')).toBe(false);
        // too short to fuzz: stays exact
        expect(test('ali', 'ale', { fuzzy: true })).toBe(false);
    });
});

describe('phraseRegex', () => {
    const test = (phrase: string, text: string) =>
        new RegExp(phraseRegex(phrase), 'i').test(text);

    it('matches a contiguous phrase across old-style punctuation', () => {
        expect(test('sahih al bukhari', 'Sahih al-Bukhari')).toBe(true);
        expect(test('sahih al bukhari', 'sahih al bukhari (2 vols)')).toBe(true);
    });

    it('does not match reordered words', () => {
        expect(test('sahih bukhari', 'bukhari sahih')).toBe(false);
    });

    it('applies Arabic equivalence classes', () => {
        expect(test('مكتبه اسلاميه', 'مكتبة اسلامية')).toBe(true);
    });
});
