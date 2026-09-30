import type { Db } from 'mongodb';
import type { Book } from '../../index';
import { groupListings } from './group';
import type { GroupedBook } from './group';
import { KEYWORD_LIMIT, buildKeywordFilters, prepareQuery, runKeyword } from './keyword';
import type { KeywordResult } from './keyword';
import type { SearchParams } from './params';
import { rankResults } from './rank';
import type { VectorHit } from './types';
import { runVector, vectorQueryText } from './vector';

export type SearchResult = {
    results: Book[];
    total: number; // number of groups (one per book)
    totalCapped: boolean; // keyword primary count > KEYWORD_LIMIT
    page: number; // effective page after clamping
    start: number; // 0 when total is 0
    end: number;
};

const EMPTY_RESULT: SearchResult = {
    results: [],
    total: 0,
    totalCapped: false,
    page: 1,
    start: 0,
    end: 0
};

const debugEnabled = () => process.env.SEARCH_DEBUG === 'true';

/**
 * Keyword and vector searches run in parallel and are merged in tiers
 * (see `rank.ts`), then listings of the same book are grouped (`group.ts`),
 * then the requested page is sliced out.
 */
export async function runSearch(db: Db, p: SearchParams): Promise<SearchResult> {
    const q = prepareQuery(p.search, p.author);
    if (!q.hasTitle && !q.hasAuthor) return EMPTY_RESULT;

    const startedAt = Date.now();
    let keywordMs = 0;
    let vectorMs = 0;

    const keywordP = (async (): Promise<KeywordResult> => {
        const t = Date.now();
        try {
            return await runKeyword(
                db,
                buildKeywordFilters(q, {
                    exclude: p.exclude,
                    fuzzy: p.fuzzy,
                    searchDesc: p.searchDesc,
                    exactSearch: p.exactSearch
                })
            );
        } finally {
            keywordMs = Date.now() - t;
        }
    })();

    // Exact Search is keyword-only. Otherwise embed the RAW input (not the
    // normalized form) in the same `title\nauthor` shape the documents use.
    const vectorAttempted = !p.exactSearch;
    const vectorP = (async (): Promise<VectorHit[] | null> => {
        if (!vectorAttempted) return null;
        const t = Date.now();
        try {
            const text = vectorQueryText(q.hasTitle ? p.search : '', q.hasAuthor ? p.author : '');
            return await runVector(db, text, p.exclude);
        } finally {
            vectorMs = Date.now() - t;
        }
    })();

    const [keywordSettled, vectorSettled] = await Promise.allSettled([keywordP, vectorP]);

    if (keywordSettled.status === 'rejected') {
        console.error('[search] keyword search failed:', keywordSettled.reason);
    }
    if (vectorSettled.status === 'rejected') {
        console.error('[search] vector search failed:', vectorSettled.reason);
    }

    const keywordOk = keywordSettled.status === 'fulfilled';
    // A null value means the query could not be embedded (no key, timeout, Voyage error).
    const vectorOk = vectorSettled.status === 'fulfilled' && vectorSettled.value !== null;

    // Only when every search that was attempted has failed do we surface an error.
    if (!keywordOk && (!vectorAttempted || !vectorOk)) {
        throw keywordSettled.status === 'rejected'
            ? keywordSettled.reason
            : new Error('search failed');
    }

    const keyword: KeywordResult = keywordOk
        ? keywordSettled.value
        : { primary: [], titleOnly: [], description: [], primaryCount: 0 };
    const vector: VectorHit[] =
        vectorSettled.status === 'fulfilled' && vectorSettled.value ? vectorSettled.value : [];

    const ranked = rankResults(
        {
            primary: keyword.primary,
            titleOnly: keyword.titleOnly,
            description: keyword.description,
            vector,
            query: {
                title: q.hasTitle ? q.titleNorm : '',
                author: q.hasAuthor ? q.authorNorm : ''
            },
            searchDesc: p.searchDesc
        },
        p.sort
    );
    const grouped = groupListings(ranked, p.sort);

    const total = grouped.length;
    const page = Math.min(p.page, Math.max(1, Math.ceil(total / p.show)));
    const sliceStart = (page - 1) * p.show;
    const pageItems = grouped.slice(sliceStart, sliceStart + p.show);

    if (debugEnabled()) {
        console.log(
            `[search] keyword ${keywordMs}ms, vector ${vectorMs}ms, total ${Date.now() - startedAt}ms ` +
                `(keyword ${keyword.primary.length}/${keyword.titleOnly.length}/${keyword.description.length}, ` +
                `vector ${vector.length}, groups ${total})`
        );
    }

    const results = pageItems.map((item) => cleanForClient(item));

    return {
        results,
        total,
        totalCapped: keyword.primaryCount > KEYWORD_LIMIT,
        page,
        start: total ? sliceStart + 1 : 0,
        end: Math.min(page * p.show, total)
    };
}

/** `_tier` / `_rank` are internal; keep them only when debugging. */
function cleanForClient(item: GroupedBook): Book {
    if (debugEnabled()) return item as unknown as Book;
    const { _tier: _t, _rank: _r, ...rest } = item;
    return rest as unknown as Book;
}
