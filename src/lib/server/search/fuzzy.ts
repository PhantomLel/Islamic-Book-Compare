/**
 * One-edit regex expansion for Fuzzy Search.
 *
 * Only Latin tokens of 5+ letters are fuzzed. Arabic tokens are left alone:
 * the folding in `normalizeText` and the equivalence classes in `tokenRegex`
 * already cover most Arabic variation.
 *
 * This file has no imports on purpose: `normalize.ts` imports it, so it takes
 * the escape function as a parameter instead of importing it back.
 */

export const FUZZY_MIN_LENGTH = 5;
/** Max one-edit variants per query, shared across every fuzzed token. */
export const FUZZY_MAX_VARIANTS = 120;

const FUZZABLE_RE = /^[a-z]+$/;

export function isFuzzable(token: string): boolean {
    return token.length >= FUZZY_MIN_LENGTH && FUZZABLE_RE.test(token);
}

/**
 * A variant is a list of parts. `{ lit }` is a literal to escape; `{ raw }` is
 * a regex fragment inserted as-is (`.?` or `.`).
 */
type Part = { lit: string } | { raw: string };
type Variant = Part[];

function variantsFor(token: string): Variant[] {
    const n = token.length;
    const out: Variant[] = [];
    const seen = new Set<string>();
    const add = (v: Variant) => {
        const key = v.map((p) => ('lit' in p ? `L${p.lit}` : `R${p.raw}`)).join('|');
        if (seen.has(key)) return;
        seen.add(key);
        out.push(v);
    };

    // Substitution or deletion at position i: `.?` in place of the character.
    for (let i = 0; i < n; i++) {
        add([{ lit: token.slice(0, i) }, { raw: '.?' }, { lit: token.slice(i + 1) }]);
    }
    // Insertion between characters. (Insertion at either end is already covered
    // by the unanchored base pattern.)
    for (let i = 1; i < n; i++) {
        add([{ lit: token.slice(0, i) }, { raw: '.' }, { lit: token.slice(i) }]);
    }
    // Adjacent transposition. Skip swaps of identical letters (no-ops).
    for (let i = 0; i < n - 1; i++) {
        if (token[i] === token[i + 1]) continue;
        add([
            { lit: token.slice(0, i) + token[i + 1] + token[i] + token.slice(i + 2) }
        ]);
    }
    return out;
}

/** Number of one-edit variants `fuzzyRegexSource` would emit (excluding the exact token). */
export function fuzzyVariantCount(token: string): number {
    return isFuzzable(token) ? variantsFor(token).length : 0;
}

/**
 * Pick which tokens to fuzz so the total variant count stays within `cap`.
 * Longest tokens go first; a token that no longer fits is skipped.
 */
export function selectFuzzyTokens(tokens: string[], cap: number = FUZZY_MAX_VARIANTS): Set<string> {
    const candidates = Array.from(new Set(tokens.filter(isFuzzable)));
    // Stable sort: equal-length tokens keep their query order.
    candidates.sort((a, b) => b.length - a.length);
    const chosen = new Set<string>();
    let used = 0;
    for (const t of candidates) {
        const cost = fuzzyVariantCount(t);
        if (used + cost > cap) continue;
        chosen.add(t);
        used += cost;
    }
    return chosen;
}

/**
 * Regex source `(?:t|v1|v2|...)` for a fuzzable token. `escape` escapes the
 * literal pieces. Non-fuzzable tokens are returned escaped and unchanged.
 */
export function fuzzyRegexSource(token: string, escape: (s: string) => string): string {
    if (!isFuzzable(token)) return escape(token);
    const alts = [escape(token)];
    for (const v of variantsFor(token)) {
        alts.push(v.map((p) => ('lit' in p ? escape(p.lit) : p.raw)).join(''));
    }
    return `(?:${alts.join('|')})`;
}
