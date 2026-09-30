import type { Offer } from '../../index';
import { normalizeText } from './normalize';
import type { SearchParams } from './params';
import type { RankedBook } from './rank';
import { priceOf } from './types';

export type GroupedBook = RankedBook & { offers?: Offer[] };

/**
 * Title + author identity. Deliberately NOT `book-scraper/title_key.py`: that
 * strips volume/edition markers, which would merge Vol. 1 with Vol. 2.
 */
function groupKey(book: RankedBook): string {
    const title = normalizeText(String(book.title ?? ''));
    // Nothing to compare on: never merge, or unrelated books with blank titles would collapse.
    if (!title) return `unique\n${book.source}\n${book.url}`;
    const author = normalizeText(String(book.author || book.authorArabic || ''));
    return `${title}|${author}`;
}

function comparePriceAsc(a: number | null, b: number | null): number {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
}

/** Cheapest first (missing prices last), then best relevance rank. */
function compareOffers(a: RankedBook, b: RankedBook): number {
    return comparePriceAsc(priceOf(a), priceOf(b)) || a._rank - b._rank;
}

function toOffer(book: RankedBook): Offer {
    return {
        source: book.source,
        price: priceOf(book),
        url: book.url,
        instock: Boolean(book.instock)
    };
}

/**
 * Collapse listings of the same book (same title + author) into one result.
 * Call after ranking and before pagination.
 *
 *  - Primary offer: the cheapest member (ties -> best rank). The result's
 *    top-level fields are the primary member's, so `Book` consumers keep working.
 *  - `offers`: the other members, cheapest first.
 *  - Order: best member rank for `rel`; the primary (cheapest) price for both
 *    price sorts, missing prices last.
 */
export function groupListings(ranked: RankedBook[], sort: SearchParams['sort']): GroupedBook[] {
    const groups = new Map<string, RankedBook[]>();
    for (const book of ranked) {
        const key = groupKey(book);
        const members = groups.get(key);
        if (members) members.push(book);
        else groups.set(key, [book]);
    }

    const out: GroupedBook[] = [];
    for (const members of groups.values()) {
        const sorted = [...members].sort(compareOffers);
        const [primary, ...others] = sorted;

        const grouped: GroupedBook = {
            ...primary,
            _rank: Math.min(...members.map((m) => m._rank)),
            _tier: Math.min(...members.map((m) => m._tier)) as RankedBook['_tier']
        };
        if (others.length > 0) grouped.offers = others.map(toOffer);
        out.push(grouped);
    }

    if (sort === 'low' || sort === 'high') {
        out.sort((a, b) => {
            const pa = priceOf(a);
            const pb = priceOf(b);
            let byPrice: number;
            if (pa === pb) byPrice = 0;
            else if (pa === null) byPrice = 1;
            else if (pb === null) byPrice = -1;
            else byPrice = sort === 'low' ? pa - pb : pb - pa;
            return byPrice || a._rank - b._rank;
        });
    } else {
        out.sort((a, b) => a._rank - b._rank);
    }
    return out;
}
