/**
 * Curated alias groups: sets of equivalent (normalized) token sequences.
 *
 * The Arabic forms let an English query find Arabic titles and the reverse.
 * This is not a translation layer; keep the list short and high-confidence.
 * Every entry must already be a fixed point of `normalizeText` (unit-tested).
 */
export const ALIAS_GROUPS: string[][] = [
    ['bukhari', 'bukharee', 'bukhary', 'بخاري'],
    ['muslim', 'مسلم'],
    ['tirmidhi', 'tirmizi', 'tirmithi', 'ترمذي'],
    ['abu dawud', 'abu dawood', 'abu daud', 'ابو داود'],
    ['nasai', 'nasaa i', 'نساي'],
    ['ibn majah', 'ibn maja', 'ابن ماجه'],
    ['nawawi', 'nawawee', 'نووي'],
    ['riyad salihin', 'riyadh saliheen', 'riyadus saliheen', 'رياض صالحين'],
    ['quran', 'qur an', 'koran', 'قران'],
    ['tafsir', 'tafseer', 'تفسير'],
    ['hadith', 'hadeeth', 'حديث'],
    ['sahih', 'saheeh', 'صحيح'],
    ['aqidah', 'aqeedah', 'aqida', 'عقيده'],
    ['fiqh', 'فقه'],
    ['seerah', 'sirah', 'sira', 'سيره'],
    ['ibn taymiyyah', 'ibn taymiya', 'ibn taimiyah', 'ابن تيميه'],
    ['ibn qayyim', 'ibn al qayyim', 'ibn qayyim al jawziyya', 'ابن قيم']
];

/** Max alternative token lists returned by `expandAliases` (the original included). */
export const MAX_ALIAS_ALTERNATIVES = 8;

type AliasIndex = {
    /** entry text -> index of its group */
    entryToGroup: Map<string, number>;
    /** group index -> entries as token arrays */
    groups: string[][][];
    maxEntryTokens: number;
};

function buildIndex(groups: string[][]): AliasIndex {
    const entryToGroup = new Map<string, number>();
    const tokenGroups: string[][][] = [];
    let maxEntryTokens = 1;
    groups.forEach((group, gi) => {
        const entries = group.map((e) => e.split(' '));
        tokenGroups.push(entries);
        for (const [ei, entry] of entries.entries()) {
            maxEntryTokens = Math.max(maxEntryTokens, entry.length);
            // First group wins if an entry is (mistakenly) listed twice.
            const key = group[ei];
            if (!entryToGroup.has(key)) entryToGroup.set(key, gi);
        }
    });
    return { entryToGroup, groups: tokenGroups, maxEntryTokens };
}

const INDEX = buildIndex(ALIAS_GROUPS);

/**
 * Expand a token list into alternative token lists using the alias groups.
 *
 * Single- and multi-token aliases are matched greedily (longest first), left
 * to right. The first alternative is always the original list. At most
 * `MAX_ALIAS_ALTERNATIVES` alternatives are returned.
 */
export function expandAliases(tokens: string[]): string[][] {
    if (tokens.length === 0) return [[]];

    // One segment per position: either the literal token, or all spellings of
    // the alias group matched there (original spelling first).
    const segments: string[][][] = [];
    let i = 0;
    while (i < tokens.length) {
        let matched = false;
        const longest = Math.min(INDEX.maxEntryTokens, tokens.length - i);
        for (let len = longest; len >= 1; len--) {
            const span = tokens.slice(i, i + len);
            const gi = INDEX.entryToGroup.get(span.join(' '));
            if (gi === undefined) continue;

            const original = span.join(' ');
            const options: string[][] = [span];
            for (const entry of INDEX.groups[gi]) {
                if (entry.join(' ') !== original) options.push(entry);
            }
            segments.push(options);
            i += len;
            matched = true;
            break;
        }
        if (!matched) {
            segments.push([[tokens[i]]]);
            i += 1;
        }
    }

    // Enumerate the product of segment options, stopping at the cap. Order: the
    // original, consistent spellings across all aliases (below), then combos in
    // order of how many segments deviate from the original (1, 2, ...). That
    // keeps the original first and spreads the limited slots across different
    // aliases instead of exhausting the first one.
    const results: string[][] = [];
    const seen = new Set<string>();
    const push = (choice: number[]): boolean => {
        const tokensOut = choice.flatMap((optIdx, segIdx) => segments[segIdx][optIdx]);
        const key = tokensOut.join(' ');
        if (!seen.has(key)) {
            seen.add(key);
            results.push(tokensOut);
        }
        return results.length >= MAX_ALIAS_ALTERNATIVES;
    };

    const aliasSegs = segments.map((s, idx) => (s.length > 1 ? idx : -1)).filter((idx) => idx >= 0);

    // Fill `choice` for exactly `deviations` more alias segments, starting at aliasSegs[from].
    const walk = (choice: number[], from: number, deviations: number): boolean => {
        if (deviations === 0) return push(choice);
        for (let a = from; a <= aliasSegs.length - deviations; a++) {
            const segIdx = aliasSegs[a];
            for (let optIdx = 1; optIdx < segments[segIdx].length; optIdx++) {
                const next = choice.slice();
                next[segIdx] = optIdx;
                if (walk(next, a + 1, deviations - 1)) return true;
            }
        }
        return false;
    };

    const zeros = segments.map(() => 0);
    if (push(zeros)) return results;

    // Consistent spellings across every alias in the query come next: the last
    // option of each group (the Arabic form for the built-in list), then the
    // 1st, 2nd, ... options. Otherwise "sahih bukhari" could never reach a title
    // written entirely in Arabic once the cap is hit.
    const maxOptions = Math.max(...aliasSegs.map((idx) => segments[idx].length));
    const uniform = (pick: (optionCount: number) => number): number[] =>
        segments.map((options) => (options.length > 1 ? pick(options.length) : 0));
    if (aliasSegs.length > 1) {
        if (push(uniform((n) => n - 1))) return results;
        for (let k = 1; k < maxOptions; k++) {
            if (push(uniform((n) => Math.min(k, n - 1)))) return results;
        }
    }

    for (let deviations = 1; deviations <= aliasSegs.length; deviations++) {
        if (walk(zeros, 0, deviations)) break;
    }
    return results;
}
