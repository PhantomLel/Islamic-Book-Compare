import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import getDb from "$lib/server/db";
import type { Book } from "$lib";

export const POST: RequestHandler = async ({ request }) => {
    const db = await getDb();
    const { books } = await request.json();
    const bookData: Book[] = await Promise.all(books.map(async (book: string) => {
        const bookData = await db.collection("books").findOne({ url: book });
        return bookData;
    }));
    return json(bookData);
}