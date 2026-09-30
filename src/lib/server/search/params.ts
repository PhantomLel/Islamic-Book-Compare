export type SearchParams = {
    search: string; // raw, trimmed
    author: string; // raw, trimmed
    page: number; // integer >= 1
    show: 15 | 45 | 75; // anything else -> 15
    sort: 'rel' | 'low' | 'high'; // anything else -> 'rel'
    exclude: string[];
    fuzzy: boolean; // fuzzy=true
    searchDesc: boolean; // searchDesc=true
    exactSearch: boolean; // exactSearch=true
};

/** Cap on raw query text so a pasted paragraph cannot blow up regex/alias expansion. */
export const MAX_QUERY_LENGTH = 200;

const SHOW_VALUES = [15, 45, 75] as const;
const SORT_VALUES = ['rel', 'low', 'high'] as const;

function cleanText(value: string | null): string {
    return (value ?? '').slice(0, MAX_QUERY_LENGTH).trim();
}

/**
 * Parse and clamp the search URL params. The upper bound of `page` depends on
 * the total, so it is clamped later in `runSearch`.
 */
export function parseSearchParams(url: URL): SearchParams {
    const sp = url.searchParams;

    const rawPage = Number.parseInt(sp.get('page') ?? '', 10);
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

    const rawShow = Number.parseInt(sp.get('show') ?? '', 10);
    const show = (SHOW_VALUES as readonly number[]).includes(rawShow)
        ? (rawShow as SearchParams['show'])
        : 15;

    const rawSort = sp.get('sort');
    const sort = (SORT_VALUES as readonly string[]).includes(rawSort ?? '')
        ? (rawSort as SearchParams['sort'])
        : 'rel';

    return {
        search: cleanText(sp.get('search')),
        author: cleanText(sp.get('author')),
        page,
        show,
        sort,
        exclude: sp.getAll('exclude').filter((s) => s.length > 0),
        fuzzy: sp.get('fuzzy') === 'true',
        searchDesc: sp.get('searchDesc') === 'true',
        exactSearch: sp.get('exactSearch') === 'true'
    };
}
