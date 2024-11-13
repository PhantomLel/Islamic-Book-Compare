// place files you want to import through the `$lib` alias in this folder.
export const apiUrl = "http://127.0.0.1:8000/api/";

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
