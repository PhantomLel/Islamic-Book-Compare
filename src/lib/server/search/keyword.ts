import type { Db, Document } from 'mongodb';
import { expandAliases } from './aliases';
import { selectFuzzyTokens } from './fuzzy';
import { escapeRegex, normalizeText, phraseRegex, tokenRegex, tokenize } from './normalize';
import type { BookDoc } from './types';

export const KEYWORD_LIMIT = 400; // primary hits
export const KEYWORD_TITLE_ONLY_LIMIT = 200;
export const KEYWORD_DESCRIPTION_LIMIT = 200;

// --- Query preparation (pure) ----------------------------------------------

export type PreparedQuery = {
    /** Fully normalized title / author text ('' when absent). */
    titleNorm: string;
    authorNorm: string;
    /** Tokens after stopword removal, before alias expansion. */
    titleTokens: string[];
    authorTokens: string[];
    /** Alternative token lists after alias expansion (first = original). Empty when absent. */
    titleAlts: string[][];
    authorAlts: string[][];
    hasTitle: boolean;
    hasAuthor: boolean;
};

export function prepareQuery(search: string, author: string): PreparedQuery {
    const titleNorm = normalizeText(search);
    const authorNorm = normalizeText(author);
    const titleTokens = titleNorm ? tokenize(titleNorm) : [];
    const authorTokens = authorNorm ? tokenize(authorNorm) : [];
    return {
        titleNorm,
        authorNorm,
        titleTokens,
        authorTokens,
        titleAlts: titleTokens.length ? expandAliases(titleTokens) : [],
        authorAlts: authorTokens.length ? expandAliases(authorTokens) : [],
        hasTitle: titleTokens.length > 0,
        hasAuthor: authorTokens.length > 0
    };
}

// --- Filter construction (pure) --------------------------------------------

export type KeywordOptions = {
    exclude: string[];
    fuzzy: boolean;
    searchDesc: boolean;
    exactSearch: boolean;
};

export type KeywordFilters = {
    /** Title AND author (or whichever single one was given). */
    primary: Document;
    /** Title matches, author does not (only when both were given, never for Exact Search). */
    titleOnly?: Document;
    /** Description matches, title does not (only with searchDesc and a title). */
    description?: Document;
};

const regexCond = (field: string, source: string): Document => ({
    [field]: { $regex: source, $options: 'i' }
});

const allOf = (conds: Document[]): Document => (conds.length === 1 ? conds[0] : { $and: conds });
const anyOf = (conds: Document[]): Document => (conds.length === 1 ? conds[0] : { $or: conds });

/** Every token must match `field` (any order). */
function tokensOnField(
    field: string,
    tokens: string[],
    toRegex: (token: string) => string
): Document {
    return allOf(tokens.map((t) => regexCond(field, toRegex(t))));
}

function baseFilter(exclude: string[]): Document {
    const base: Document = { instock: true };
    if (exclude.length > 0) base.source = { $nin: exclude };
    return base;
}

export function buildKeywordFilters(q: PreparedQuery, opts: KeywordOptions): KeywordFilters {
    const base = baseFilter(opts.exclude);

    if (opts.exactSearch) {
        // One contiguous phrase per field. No aliases, fuzzy, description or title-only tier.
        const conds: Document[] = [base];
        if (q.hasTitle) {
            conds.push(regexCond('titleNormalized', phraseRegex(q.titleNorm)));
        }
        if (q.hasAuthor) {
            const src = phraseRegex(q.authorNorm);
            conds.push(
                anyOf([
                    regexCond('authorNormalized', src),
                    regexCond('authorArabicNormalized', src)
                ])
            );
        }
        return { primary: { $and: conds } };
    }

    const fuzzed = opts.fuzzy
        ? selectFuzzyTokens([...q.titleAlts.flat(), ...q.authorAlts.flat()])
        : new Set<string>();
    const toRegex = (token: string) => tokenRegex(token, { fuzzy: fuzzed.has(token) });

    const titleClause: Document | null = q.hasTitle
        ? anyOf(q.titleAlts.map((alt) => tokensOnField('titleNormalized', alt, toRegex)))
        : null;

    const authorClause: Document | null = q.hasAuthor
        ? anyOf(
              q.authorAlts.flatMap((alt) => [
                  tokensOnField('authorNormalized', alt, toRegex),
                  tokensOnField('authorArabicNormalized', alt, toRegex)
              ])
          )
        : null;

    const primaryConds: Document[] = [base];
    if (titleClause) primaryConds.push(titleClause);
    if (authorClause) primaryConds.push(authorClause);
    const filters: KeywordFilters = { primary: { $and: primaryConds } };

    if (titleClause && authorClause) {
        filters.titleOnly = { $and: [base, titleClause, { $nor: [authorClause] }] };
    }

    if (opts.searchDesc && titleClause) {
        // Descriptions are raw text: escaped tokens only (no classes, no fuzzy).
        const descClause = anyOf(
            q.titleAlts.map((alt) => tokensOnField('description', alt, escapeRegex))
        );
        filters.description = { $and: [base, descClause, { $nor: [titleClause] }] };
    }

    return filters;
}

// --- Execution --------------------------------------------------------------

export type KeywordResult = {
    primary: BookDoc[];
    titleOnly: BookDoc[];
    description: BookDoc[];
    /** Uncapped number of primary matches (for "N+" in the UI). */
    primaryCount: number;
};

/**
 * Deterministic cap biased toward concise titles: sort by normalized title
 * length (then `_id`) before limiting.
 */
function rankedSlice(limit: number): Document[] {
    return [
        {
            $addFields: {
                _titleLen: { $strLenCP: { $ifNull: ['$titleNormalized', ''] } }
            }
        },
        { $sort: { _titleLen: 1, _id: 1 } },
        { $limit: limit },
        { $project: { embedding: 0, embeddingModel: 0, _titleLen: 0, _id: 0 } }
    ];
}

export async function runKeyword(db: Db, filters: KeywordFilters): Promise<KeywordResult> {
    const books = db.collection('books');

    const primaryP = books
        .aggregate([
            { $match: filters.primary },
            {
                $facet: {
                    docs: rankedSlice(KEYWORD_LIMIT),
                    count: [{ $count: 'n' }]
                }
            }
        ])
        .toArray();

    const titleOnlyP = filters.titleOnly
        ? books
              .aggregate([
                  { $match: filters.titleOnly },
                  ...rankedSlice(KEYWORD_TITLE_ONLY_LIMIT)
              ])
              .toArray()
        : Promise.resolve([] as Document[]);

    const descriptionP = filters.description
        ? books
              .aggregate([
                  { $match: filters.description },
                  ...rankedSlice(KEYWORD_DESCRIPTION_LIMIT)
              ])
              .toArray()
        : Promise.resolve([] as Document[]);

    const [primaryRows, titleOnly, description] = await Promise.all([
        primaryP,
        titleOnlyP,
        descriptionP
    ]);

    const facet = primaryRows[0] as { docs?: Document[]; count?: { n: number }[] } | undefined;
    const primary = (facet?.docs ?? []) as unknown as BookDoc[];

    return {
        primary,
        titleOnly: titleOnly as unknown as BookDoc[],
        description: description as unknown as BookDoc[],
        primaryCount: facet?.count?.[0]?.n ?? primary.length
    };
}
