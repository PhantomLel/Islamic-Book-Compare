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
export type Collection = {
    name: string;
    books: string[]; // book perma links
}



const storeCountries: Record<string, string> = {
    "Dar Al-Muttaqin": "UK",
    "Maktabah Al-Hidayah": "US",
    "Ismaeel Books": "UK",
    "Al-Badr": "UK",
    "Al-Balagh": "US",
    "Al-Kunuz": "UK",
    "Qurtuba": "UK",
    "Sifatu Safwa": "UK",
    "Zakariyya Books": "UK",
    "Salafi Books": "UK",
    "UmmahSpot": "US",
    "Al-Hidayaah": "UK",
    "Buraq Books": "UK",
    "Kastntinya": "TUR",
    "Maktabah Abu Hanifah": "UK"
}

export { storeCountries };