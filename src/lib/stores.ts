import { writable } from "svelte/store";
import { browser } from "$app/environment";
import type { Collection } from "./index";

// Create the initial collections from localStorage
const initialCollections: Collection[] = browser
    ? JSON.parse(localStorage.getItem("collections") || "[]")
    : [];

// Create the writable store
function createCollectionsStore() {
    const { subscribe, set, update } = writable<Collection[]>(initialCollections);
    
    // Internal function to update the store
    const updateStore = (fn: (collections: Collection[]) => Collection[]) => {
        update((collections) => {
            const updated = fn(collections);
            console.log("Updating collections", updated);
            if (browser) {
                localStorage.setItem("collections", JSON.stringify(updated));
            }
            return updated;
        });
    };

    return {
        subscribe,
        set: (collections: Collection[]) => {
            if (browser) {
                localStorage.setItem("collections", JSON.stringify(collections));
            }
            set(collections);
        },
        update: updateStore,
        // Helper method to add a book to a collection
        addBookToCollection: (collectionName: string, bookUrl: string) => {
            updateStore((collections) => {
                const collection = collections.find((c) => c.name === collectionName);
                if (collection && !collection.books.includes(bookUrl)) {
                    collection.books.push(bookUrl);
                }
                return collections;
            });
        },
        // Helper method to remove a book from a collection
        removeBookFromCollection: (collectionName: string, bookUrl: string) => {
            updateStore((collections) => {
                const collection = collections.find((c) => c.name === collectionName);
                if (collection) {
                    collection.books = collection.books.filter((url) => url !== bookUrl);
                }
                return collections;
            });
        },
        // Helper method to toggle a book in a collection
        toggleBookInCollection: (collectionName: string, bookUrl: string, notifyCallback?: (message: string, type: 'success' | 'error' | 'info') => void) => {
            updateStore((collections) => {
                const collection = collections.find((c) => c.name === collectionName);
                if (collection) {
                    const index = collection.books.indexOf(bookUrl);
                    if (index > -1) {
                        collection.books = collection.books.filter((url) => url !== bookUrl);
                        if (notifyCallback) {
                            notifyCallback(`Removed from ${collectionName}`, 'info');
                        }
                    } else {
                        collection.books.push(bookUrl);
                        if (notifyCallback) {
                            notifyCallback(`Added to ${collectionName}`, 'success');
                        }
                    }
                }
                return collections;
            });
        },
        // Helper method to create a new collection
        createCollection: (collectionName: string, bookUrl?: string) => {
            updateStore((collections) => {
                if (!collections.find((c) => c.name === collectionName)) {
                    collections.push({
                        name: collectionName,
                        books: bookUrl ? [bookUrl] : [],
                    });
                }
                return collections;
            });
        },
        // Helper method to delete a collection
        deleteCollection: (collectionName: string) => {
            updateStore((collections) => {
                return collections.filter((c) => c.name !== collectionName);
            });
        },
    };
}

export const collectionsStore = createCollectionsStore();

