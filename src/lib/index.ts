// place files you want to import through the `$lib` alias in this folder.

export { default as SearchBar } from './SearchBar.svelte';

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



const storeCountries: Record<string, string> = {
    "Dar Al-Muttaqin": "UK",
    "Maktabah Al-Hidayah": "NA",
    "Ismaeel Books": "UK",
    "Al-Badr": "UK",
    "Al-Balagh": "NA",
    "Al-Kunuz": "UK",
    "Qurtuba": "UK",
    "Sifatu Safwa": "UK",
    "Zakariyya Books": "UK",
    "Salafi Books": "UK",
    "UmmahSpot": "NA",
    "Al-Hidayaah": "UK",
    "Buraq Books": "UK",
    "Kastntinya": "TUR",
    "Maktabah Abu Hanifah": "UK",
    "Irfan Books": "NA",
    "JQU Bookstore": "NA",
    "Irsad": "TUR",
    "Darul Hikmah Bookstore": "NA",
    "Darul Iman Books" : "NA",
    "Kunuz" : "UK",
    "Osman Books" : "UK",
    "Tahsil Yayinevi" : "TUR",
    "Anadolu Kitabevi" : "TUR",
}

export { storeCountries };