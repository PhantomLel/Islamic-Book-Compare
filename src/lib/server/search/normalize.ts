import { fuzzyRegexSource, isFuzzable } from './fuzzy';

/**
 * Text normalization shared by the query side (this file) and the catalog
 * side (`book-scraper/normalize.py`). The two MUST stay in sync: stored
 * `titleNormalized` / `authorNormalized` values and query tokens are compared
 * as plain substrings, so any drift silently breaks matching.
 *
 * Keep the case table in `normalize.test.ts` identical to
 * `book-scraper/tests/test_normalize.py`.
 */

// Arabic letter folds (step 3). Written as escapes so the source stays readable.
const ARABIC_FOLDS: Record<string, string> = {
    '\u0623': '\u0627', // أ -> ا
    '\u0625': '\u0627', // إ -> ا
    '\u0622': '\u0627', // آ -> ا
    '\u0671': '\u0627', // ٱ -> ا
    '\u0624': '\u0648', // ؤ -> و
    '\u0626': '\u064A', // ئ -> ي
    '\u0649': '\u064A', // ى -> ي
    '\u06CC': '\u064A', // ی (Persian/Urdu yeh) -> ي
    '\u0629': '\u0647', // ة -> ه
    '\u06A9': '\u0643' // ک (Persian/Urdu kaf) -> ك
};
const ARABIC_FOLD_RE = /[\u0623\u0625\u0622\u0671\u0624\u0626\u0649\u06CC\u0629\u06A9]/g;

// Harakat / Quranic marks and tatweel (step 4).
const HARAKAT_TATWEEL_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

// Step 6: anything that is not a letter or digit becomes a space. The
// U+02B0-U+02FF "spacing modifier" block is included explicitly because
// apostrophe-like letters (ʿ ʾ ʼ ʻ) are category Lm and would survive \p{L}.
// Whitespace is also replaced (with a space) so the result is identical to
// `[^\p{L}\p{N}\s]` followed by whitespace collapsing, but has no dependence
// on which characters each runtime considers whitespace.
const NON_WORD_RE = /[^\p{L}\p{N}]|[\u02B0-\u02FF]/gu;

const AL = '\u0627\u0644'; // ال
const MIN_LETTERS_AFTER_AL = 3;

/**
 * The single source of truth for search text. Steps, in order:
 *  1. NFKC
 *  2. fold Latin diacritics (NFD, drop combining marks, NFC)
 *  3. fold Arabic letter variants
 *  4. drop harakat and tatweel
 *  5. lowercase
 *  6. everything that is not a letter/digit becomes a space
 *  7. strip a leading ال from each word when >= 3 letters remain
 *  8. collapse whitespace and trim
 */
export function normalizeText(input: string): string {
    if (!input) return '';

    // 1-2. NFKC, then remove every combining mark (Latin diacritics, plus the
    // Arabic marks that NFD splits off أ إ آ ؤ ئ). Arabic letters are folded
    // explicitly in step 3 either way.
    let s = input.normalize('NFKC').normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');

    // 3.
    s = s.replace(ARABIC_FOLD_RE, (c) => ARABIC_FOLDS[c]);

    // 4.
    s = s.replace(HARAKAT_TATWEEL_RE, '');

    // 5.
    s = s.toLowerCase();

    // 6.
    s = s.replace(NON_WORD_RE, ' ');

    // 7-8.
    const words: string[] = [];
    for (const raw of s.split(' ')) {
        if (!raw) continue;
        if (raw.startsWith(AL) && Array.from(raw).length - AL.length >= MIN_LETTERS_AFTER_AL) {
            words.push(raw.slice(AL.length));
        } else {
            words.push(raw);
        }
    }
    return words.join(' ');
}

const STOPWORDS = new Set(['al', 'el', 'the', 'a', 'an', 'of', 'and', 'wa', 'fi']);

/**
 * Split a normalized string into unique tokens (order preserved). Stopwords are
 * dropped only when at least one non-stopword remains. `ibn`, `bin`, `abu`,
 * `umm` are deliberately kept: they carry meaning in names.
 */
export function tokenize(normalized: string): string[] {
    const seen = new Set<string>();
    const tokens: string[] = [];
    for (const t of normalized.split(/\s+/)) {
        if (!t || seen.has(t)) continue;
        seen.add(t);
        tokens.push(t);
    }
    const meaningful = tokens.filter((t) => !STOPWORDS.has(t));
    return meaningful.length > 0 ? meaningful : tokens;
}

export function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Regex construction ----------------------------------------------------

// Equivalence classes so rows still holding the OLD normalization (before the
// backfill) match the new query forms. Keys are the folded (new) letters.
const ARABIC_CLASSES: Record<string, string> = {
    '\u0647': '[\u0647\u0629]', // ه -> [هة]
    '\u064A': '[\u064A\u0649\u0626\u06CC]', // ي -> [يىئی]
    '\u0627': '[\u0627\u0623\u0625\u0622\u0671]', // ا -> [اأإآٱ]
    '\u0648': '[\u0648\u0624]', // و -> [وؤ]
    '\u0643': '[\u0643\u06A9]' // ك -> [كک]
};

const ARABIC_LETTER_RE = /[\u0600-\u06FF]/;
const TATWEEL_OPT = '\u0640*';
const LATIN_TOKEN_RE = /^[a-z0-9]+$/;
const WORD_START = '(?:^|[^a-z0-9])';
const MAX_ANCHORED_LATIN_LEN = 3;

/** Word separator used between words of a phrase pattern (old rows keep punctuation). */
const PHRASE_GAP = '[^a-z0-9\u0600-\u06FF]+';

/** Regex source for one word: escaped literals, Arabic equivalence classes, optional tatweel. */
function wordPattern(word: string): string {
    let out = '';
    let prevArabic = false;
    for (const ch of word) {
        const isArabic = ARABIC_LETTER_RE.test(ch);
        if (isArabic && prevArabic) out += TATWEEL_OPT;
        out += ARABIC_CLASSES[ch] ?? escapeRegex(ch);
        prevArabic = isArabic;
    }
    return out;
}

/**
 * Regex SOURCE string for one token, for use in Mongo `$regex` with
 * `$options: 'i'`.
 *  - Arabic letters become equivalence classes (+ optional tatweel).
 *  - Latin tokens of <= 3 chars are anchored to a word start so `ali` does not
 *    match `quality`. Longer Latin tokens and all Arabic tokens stay
 *    unanchored (Arabic attaches prefixes like و ب ل ف).
 *  - With `opts.fuzzy`, eligible tokens delegate to `fuzzy.ts`.
 */
export function tokenRegex(token: string, opts: { fuzzy?: boolean } = {}): string {
    if (opts.fuzzy && isFuzzable(token)) {
        return fuzzyRegexSource(token, escapeRegex);
    }
    const body = wordPattern(token);
    if (LATIN_TOKEN_RE.test(token) && token.length <= MAX_ANCHORED_LATIN_LEN) {
        return WORD_START + body;
    }
    return body;
}

/**
 * Regex SOURCE for an Exact Search phrase: the whole normalized string as one
 * contiguous pattern. Spaces become a flexible separator so rows that still
 * hold punctuation (`al-bukhari`) match the folded query (`al bukhari`).
 */
export function phraseRegex(normalized: string): string {
    return normalized
        .split(' ')
        .filter(Boolean)
        .map(wordPattern)
        .join(PHRASE_GAP);
}
