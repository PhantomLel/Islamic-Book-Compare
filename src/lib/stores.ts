import { writable } from "svelte/store";
import { browser } from "$app/environment";
import type { Book, Collection, SavedBook } from "./index";

const STORAGE_KEY = "collections";
const STORAGE_VERSION = 2;

function uid(): string {
    if (browser && typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Turn a (possibly partial) Book into the snapshot we store in a collection.
 * Only `url` is required; everything else is best-effort so the card can still
 * render if the catalog later changes.
 */
export function bookToSaved(book: Partial<Book> & { url: string }): SavedBook {
    return {
        url: book.url,
        title: book.title ?? undefined,
        author: book.author ?? undefined,
        image: book.image ?? undefined,
        source: book.source ?? undefined,
        price: book.price ?? null,
        addedAt: Date.now(),
    };
}

function normalizeSavedBook(input: unknown): SavedBook | null {
    // Legacy shape: books were stored as a bare url string.
    if (typeof input === "string") {
        return input ? { url: input, addedAt: Date.now() } : null;
    }
    if (!input || typeof input !== "object") return null;
    const b = input as Record<string, unknown>;
    if (typeof b.url !== "string" || !b.url) return null;
    return {
        url: b.url,
        title: typeof b.title === "string" ? b.title : undefined,
        author: typeof b.author === "string" ? b.author : undefined,
        image: typeof b.image === "string" ? b.image : undefined,
        source: typeof b.source === "string" ? b.source : undefined,
        price: typeof b.price === "number" ? b.price : null,
        addedAt: typeof b.addedAt === "number" ? b.addedAt : Date.now(),
    };
}

function normalizeCollection(input: unknown): Collection | null {
    if (!input || typeof input !== "object") return null;
    const c = input as Record<string, unknown>;
    const now = Date.now();
    const books = Array.isArray(c.books)
        ? (c.books.map(normalizeSavedBook).filter(Boolean) as SavedBook[])
        : [];
    // De-dupe by url, keeping the first occurrence.
    const seen = new Set<string>();
    const deduped = books.filter((b) => {
        if (seen.has(b.url)) return false;
        seen.add(b.url);
        return true;
    });
    return {
        id: typeof c.id === "string" && c.id ? c.id : uid(),
        name: typeof c.name === "string" && c.name.trim() ? c.name : "Untitled",
        books: deduped,
        createdAt: typeof c.createdAt === "number" ? c.createdAt : now,
        updatedAt: typeof c.updatedAt === "number" ? c.updatedAt : now,
    };
}

/** Read collections from localStorage, migrating any legacy shapes. */
function load(): Collection[] {
    if (!browser) return [];
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
    } catch {
        return [];
    }
    if (!raw) return [];

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        console.warn("collections: could not parse localStorage, starting fresh");
        return [];
    }

    // Current shape: { version, collections: Collection[] }
    if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        Array.isArray((parsed as Record<string, unknown>).collections)
    ) {
        return (
            (parsed as { collections: unknown[] }).collections
                .map(normalizeCollection)
                .filter(Boolean) as Collection[]
        );
    }

    // Legacy shape: a bare array of { name, books: string[] }.
    if (Array.isArray(parsed)) {
        return parsed.map(normalizeCollection).filter(Boolean) as Collection[];
    }

    return [];
}

function persist(collections: Collection[]) {
    if (!browser) return;
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ version: STORAGE_VERSION, collections }),
        );
    } catch (e) {
        console.error("collections: failed to persist", e);
    }
}

function createCollectionsStore() {
    const { subscribe, set, update } = writable<Collection[]>(load());

    const mutate = (fn: (cols: Collection[]) => Collection[]) => {
        update((cols) => {
            const next = fn(cols);
            persist(next);
            return next;
        });
    };

    // Keep collections in sync if the user has multiple tabs open.
    if (browser) {
        window.addEventListener("storage", (e) => {
            if (e.key === STORAGE_KEY) set(load());
        });
    }

    return {
        subscribe,

        set(cols: Collection[]) {
            persist(cols);
            set(cols);
        },

        /** Create a collection and return its id. */
        createCollection(name: string, firstBook?: SavedBook): string {
            const id = uid();
            const now = Date.now();
            mutate((cols) => [
                ...cols,
                {
                    id,
                    name: name.trim() || "Untitled",
                    books: firstBook ? [firstBook] : [],
                    createdAt: now,
                    updatedAt: now,
                },
            ]);
            return id;
        },

        renameCollection(id: string, name: string) {
            const trimmed = name.trim();
            mutate((cols) =>
                cols.map((c) =>
                    c.id === id
                        ? { ...c, name: trimmed || c.name, updatedAt: Date.now() }
                        : c,
                ),
            );
        },

        deleteCollection(id: string) {
            mutate((cols) => cols.filter((c) => c.id !== id));
        },

        addBook(id: string, book: SavedBook) {
            mutate((cols) =>
                cols.map((c) => {
                    if (c.id !== id) return c;
                    if (c.books.some((b) => b.url === book.url)) return c;
                    return { ...c, books: [...c.books, book], updatedAt: Date.now() };
                }),
            );
        },

        removeBook(id: string, url: string) {
            mutate((cols) =>
                cols.map((c) =>
                    c.id === id
                        ? {
                              ...c,
                              books: c.books.filter((b) => b.url !== url),
                              updatedAt: Date.now(),
                          }
                        : c,
                ),
            );
        },

        /** Add or remove a book from a collection. Returns the action taken. */
        toggleBook(id: string, book: SavedBook): "added" | "removed" {
            let action: "added" | "removed" = "added";
            mutate((cols) =>
                cols.map((c) => {
                    if (c.id !== id) return c;
                    const exists = c.books.some((b) => b.url === book.url);
                    action = exists ? "removed" : "added";
                    return {
                        ...c,
                        books: exists
                            ? c.books.filter((b) => b.url !== book.url)
                            : [...c.books, book],
                        updatedAt: Date.now(),
                    };
                }),
            );
            return action;
        },

        /**
         * Refresh stored snapshots from freshly-fetched live books. This keeps the
         * locally-cached title/image/price in step with the catalog so the list
         * keeps rendering correctly even after the scraper updates a book.
         */
        refreshSnapshots(fresh: Book[]) {
            if (!fresh || fresh.length === 0) return;
            const byUrl = new Map(
                fresh.filter((b) => b && b.url).map((b) => [b.url, b]),
            );
            mutate((cols) =>
                cols.map((c) => {
                    let changed = false;
                    const books = c.books.map((b) => {
                        const live = byUrl.get(b.url);
                        if (!live) return b;
                        changed = true;
                        return {
                            ...b,
                            title: live.title ?? b.title,
                            author: live.author ?? b.author,
                            image: live.image ?? b.image,
                            source: live.source ?? b.source,
                            price: live.price ?? b.price ?? null,
                        };
                    });
                    return changed ? { ...c, books } : c;
                }),
            );
        },
    };
}

export const collectionsStore = createCollectionsStore();
