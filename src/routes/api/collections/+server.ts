import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import getDb from "$lib/server/db";
import type { Book } from "$lib";

/**
 * Look up the live data for a set of saved books by their url. Missing books
 * (e.g. removed from the catalog or whose url changed) are simply omitted from
 * the response instead of returning `null`s, so the client never has to render
 * a broken card. The client keeps a local snapshot for anything not returned.
 */
export const POST: RequestHandler = async ({ request }) => {
    const body = await request.json().catch(() => ({}));

    // Accept the new `urls` key, and fall back to the legacy `books` key which
    // could be either a list of urls or a list of saved-book objects.
    const raw = body?.urls ?? body?.books ?? [];
    const urls: string[] = Array.isArray(raw)
        ? raw
              .map((item: unknown) =>
                  typeof item === "string"
                      ? item
                      : (item as { url?: string })?.url,
              )
              .filter((u: unknown): u is string => typeof u === "string" && !!u)
        : [];

    if (urls.length === 0) return json([] as Book[]);

    const db = await getDb();
    const docs = await db
        .collection("books")
        .find({ url: { $in: urls } })
        .toArray();

    // Preserve the order the client asked for.
    const byUrl = new Map(docs.map((d) => [d.url as string, d]));
    const ordered = urls
        .map((u) => byUrl.get(u))
        .filter((d): d is NonNullable<typeof d> => !!d);

    return json(ordered);
};
