/**
 * A raw `books` document as it comes out of Mongo (embedding fields already
 * projected away). Only the fields the search pipeline relies on are typed;
 * everything else rides along untouched so `Book` consumers keep working.
 */
export type BookDoc = {
    source: string;
    url: string;
    title?: string | null;
    author?: string | null;
    authorArabic?: string | null;
    titleNormalized?: string | null;
    authorNormalized?: string | null;
    authorArabicNormalized?: string | null;
    price?: number | string | null;
    instock?: boolean;
    [key: string]: unknown;
};

/** A vector hit: a full book doc plus its Atlas `vectorSearchScore`. */
export type VectorHit = BookDoc & { score: number };

/** Numeric price, or `null` when missing / not a finite number. */
export function priceOf(doc: Pick<BookDoc, 'price'>): number | null {
    const p = doc.price;
    if (typeof p === 'number') return Number.isFinite(p) ? p : null;
    if (typeof p === 'string' && p.trim() !== '') {
        const n = Number.parseFloat(p);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

/** Stable identity of one store listing. */
export function listingKey(doc: Pick<BookDoc, 'source' | 'url'>): string {
    return `${doc.source}\n${doc.url}`;
}
