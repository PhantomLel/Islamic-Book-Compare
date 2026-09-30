import { describe, expect, it } from 'vitest';
import { groupListings } from './group';
import type { RankedBook } from './rank';

let rank = 0;
function listing(
    title: string,
    source: string,
    price: number | null,
    extra: Partial<RankedBook> = {}
): RankedBook {
    return {
        source,
        url: `https://${source.toLowerCase().replace(/\W/g, '')}.example/${encodeURIComponent(title)}`,
        title,
        author: 'Imam al-Bukhari',
        price,
        instock: true,
        _tier: 1,
        _rank: rank++,
        ...extra
    } as RankedBook;
}

describe('groupListings', () => {
    it('collapses three stores into one group: cheapest primary, others sorted in offers', () => {
        rank = 0;
        const out = groupListings(
            [
                listing('Sahih al-Bukhari', 'Store A', 30),
                listing('Sahih al-Bukhari', 'Store B', 12),
                listing('Sahih al-Bukhari', 'Store C', 20)
            ],
            'rel'
        );
        expect(out).toHaveLength(1);
        expect(out[0].source).toBe('Store B');
        expect(out[0].price).toBe(12);
        expect(out[0].offers).toEqual([
            { source: 'Store C', price: 20, url: expect.any(String), instock: true },
            { source: 'Store A', price: 30, url: expect.any(String), instock: true }
        ]);
    });

    it('uses the primary offer fields for the top-level book and omits offers for singletons', () => {
        rank = 0;
        const out = groupListings(
            [listing('Only One', 'Store A', 5, { image: 'img.png' } as Partial<RankedBook>)],
            'rel'
        );
        expect(out[0].image).toBe('img.png');
        expect('offers' in out[0]).toBe(false);
    });

    it('merges across case, diacritics and punctuation differences', () => {
        rank = 0;
        const out = groupListings(
            [
                listing('Ṣaḥīḥ al-Bukhārī', 'Store A', 10),
                listing('SAHIH AL BUKHARI', 'Store B', 11)
            ],
            'rel'
        );
        expect(out).toHaveLength(1);
        expect(out[0].offers).toHaveLength(1);
    });

    it('keeps Vol. 1 and Vol. 2 separate', () => {
        rank = 0;
        const out = groupListings(
            [
                listing('Sahih al-Bukhari Vol. 1', 'Store A', 10),
                listing('Sahih al-Bukhari Vol. 2', 'Store A', 10),
                listing('Sahih al-Bukhari Vol. 1', 'Store B', 9)
            ],
            'rel'
        );
        expect(out).toHaveLength(2);
        expect(out.map((g) => g.title)).toEqual([
            'Sahih al-Bukhari Vol. 1',
            'Sahih al-Bukhari Vol. 2'
        ]);
        expect(out[0].source).toBe('Store B');
    });

    it('keeps different authors separate, and falls back to the Arabic author', () => {
        rank = 0;
        const out = groupListings(
            [
                listing('Tafsir', 'Store A', 10, { author: 'Ibn Kathir' }),
                listing('Tafsir', 'Store B', 10, { author: 'Al-Tabari' }),
                listing('Hadith', 'Store A', 10, { author: null, authorArabic: 'البخاري' }),
                listing('Hadith', 'Store B', 10, { author: '', authorArabic: 'البخاري' })
            ],
            'rel'
        );
        expect(out).toHaveLength(3);
    });

    it('never merges listings whose title normalizes to nothing', () => {
        rank = 0;
        const out = groupListings(
            [listing('???', 'Store A', 10), listing('???', 'Store B', 10)],
            'rel'
        );
        expect(out).toHaveLength(2);
    });

    it('orders groups by their best member rank', () => {
        rank = 0;
        const out = groupListings(
            [
                listing('First Book', 'Store A', 50), // rank 0
                listing('Second Book', 'Store A', 5), // rank 1
                listing('Third Book', 'Store A', 1), // rank 2
                listing('Second Book', 'Store B', 4) // rank 3
            ],
            'rel'
        );
        expect(out.map((g) => g.title)).toEqual(['First Book', 'Second Book', 'Third Book']);
        expect(out[1]._rank).toBe(1);
        expect(out[1].source).toBe('Store B'); // cheapest is the primary offer
    });

    it('breaks primary-offer price ties by best rank', () => {
        rank = 0;
        const out = groupListings(
            [listing('Same', 'Store A', 10), listing('Same', 'Store B', 10)],
            'rel'
        );
        expect(out[0].source).toBe('Store A');
        expect(out[0].offers?.map((o) => o.source)).toEqual(['Store B']);
    });

    it('sinks missing prices: never primary over a priced offer, listed last in offers', () => {
        rank = 0;
        const out = groupListings(
            [
                listing('Same', 'Store A', null),
                listing('Same', 'Store B', 15),
                listing('Same', 'Store C', 9)
            ],
            'rel'
        );
        expect(out[0].source).toBe('Store C');
        expect(out[0].offers?.map((o) => [o.source, o.price])).toEqual([
            ['Store B', 15],
            ['Store A', null]
        ]);
    });

    it('orders price sorts by the primary (cheapest) price, missing last', () => {
        rank = 0;
        const listings = [
            listing('Alpha', 'Store A', 30),
            listing('Beta', 'Store A', 10),
            listing('Beta', 'Store B', 40),
            listing('Gamma', 'Store A', null),
            listing('Delta', 'Store A', 20)
        ];
        expect(groupListings(listings, 'low').map((g) => g.title)).toEqual([
            'Beta',
            'Delta',
            'Alpha',
            'Gamma'
        ]);
        expect(groupListings(listings, 'high').map((g) => g.title)).toEqual([
            'Alpha',
            'Delta',
            'Beta',
            'Gamma'
        ]);
    });

    it('reports the best tier of the group', () => {
        rank = 0;
        const out = groupListings(
            [
                listing('Same', 'Store A', 10, { _tier: 3 }),
                listing('Same', 'Store B', 20, { _tier: 1 })
            ],
            'rel'
        );
        expect(out[0]._tier).toBe(1);
    });
});
