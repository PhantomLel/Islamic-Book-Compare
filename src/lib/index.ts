// place files you want to import through the `$lib` alias in this folder.

export { default as SearchBar } from './SearchBar.svelte';

// One store's listing of a book. A search result groups listings of the same
// book; the cheapest is the top-level `Book`, the rest are `offers`.
export type Offer = { source: string; price: number | null; url: string; instock: boolean };

export type Book = {
    id: number;
    title: string;
    author: string; 
    publisher: string;
    image : string;
    price: number;
    url: string;
    source: string;
    instock: boolean;
    offers?: Offer[];
}
// A lightweight snapshot of a book saved into a collection. We persist enough
// to always render the card, even if the book later disappears from the catalog
// or the scraper changes its data. Live price/stock are refreshed by `url`,
// which is the only identifier that is stable across re-crawls (the Mongo `_id`
// is regenerated on every upload).
export type SavedBook = {
    url: string; // stable perma link / key
    title?: string;
    author?: string;
    image?: string;
    source?: string;
    price?: number | null;
    addedAt: number;
}

export type Collection = {
    id: string; // stable id so collections can be renamed safely
    name: string;
    books: SavedBook[];
    createdAt: number;
    updatedAt: number;
}



export { storeCountries, storeCountryLabel } from "./store-countries";