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

