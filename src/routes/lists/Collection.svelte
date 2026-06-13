<script lang="ts">
    import type { Collection, Book, SavedBook } from "$lib";
    import { collectionsStore } from "$lib/stores";
    import { notifications } from "$lib/notifications";
    import Button from "flowbite-svelte/Button.svelte";
    import Input from "flowbite-svelte/Input.svelte";
    import Spinner from "flowbite-svelte/Spinner.svelte";
    import BookCard from "../search/BookCard.svelte";
    import AngleDownOutline from "flowbite-svelte-icons/AngleDownOutline.svelte";
    import EditOutline from "flowbite-svelte-icons/EditOutline.svelte";
    import TrashBinOutline from "flowbite-svelte-icons/TrashBinOutline.svelte";
    import CheckOutline from "flowbite-svelte-icons/CheckOutline.svelte";
    import CloseOutline from "flowbite-svelte-icons/CloseOutline.svelte";
    import { slide } from "svelte/transition";

    export let collection: Collection;
    export let currency = { value: "USD", name: "USD", rate: 1, symbol: "$" };

    let expanded = false;
    let loading = false;
    let fetched = false;
    let liveByUrl: Record<string, Book> = {};

    let editing = false;
    let draftName = collection.name;

    let confirmingDelete = false;

    async function loadBooks() {
        if (fetched || collection.books.length === 0) {
            fetched = true;
            return;
        }
        loading = true;
        try {
            const res = await fetch("/api/collections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    urls: collection.books.map((b) => b.url),
                }),
            });
            const data: Book[] = await res.json();
            const map: Record<string, Book> = {};
            for (const b of data) if (b && b.url) map[b.url] = b;
            liveByUrl = map;
            // Keep local snapshots fresh so the list survives future catalog changes.
            collectionsStore.refreshSnapshots(data);
        } catch (err) {
            console.error(err);
            notifications.error("Couldn't refresh prices. Showing saved info.");
        } finally {
            loading = false;
            fetched = true;
        }
    }

    $: if (expanded) loadBooks();

    // Live data wins; the saved snapshot fills any gaps so the card always renders.
    function displayBook(saved: SavedBook): Book {
        const live = liveByUrl[saved.url];
        return {
            id: live?.id ?? 0,
            title: live?.title ?? saved.title ?? saved.url,
            author: live?.author ?? saved.author ?? "",
            publisher: live?.publisher ?? "",
            image: live?.image ?? saved.image ?? (null as unknown as string),
            price: live?.price ?? saved.price ?? (null as unknown as number),
            url: saved.url,
            source: live?.source ?? saved.source ?? "",
            instock: live?.instock ?? false,
        };
    }

    $: isUnavailable = (url: string) => fetched && !liveByUrl[url];

    function startEditing() {
        draftName = collection.name;
        editing = true;
    }

    function saveName() {
        const name = draftName.trim();
        if (!name) {
            notifications.info("Collection name can't be empty");
            return;
        }
        collectionsStore.renameCollection(collection.id, name);
        editing = false;
        notifications.success("Collection renamed");
    }

    function cancelEditing() {
        editing = false;
        draftName = collection.name;
    }

    function handleNameKeydown(event: KeyboardEvent) {
        if (event.key === "Enter") saveName();
        if (event.key === "Escape") cancelEditing();
    }

    function deleteCollection() {
        collectionsStore.deleteCollection(collection.id);
        notifications.info(`Deleted "${collection.name}"`);
    }

    function removeBook(event: MouseEvent, url: string) {
        event.stopPropagation();
        collectionsStore.removeBook(collection.id, url);
        notifications.info("Removed from collection");
    }
</script>

<div class="w-full rounded-lg bg-slate-700 px-4 py-3">
    <div class="flex flex-row items-center gap-3">
        {#if editing}
            <Input
                bind:value={draftName}
                class="w-full"
                on:keydown={handleNameKeydown}
                autofocus
            />
            <Button size="xs" class="px-2" on:click={saveName} title="Save">
                <CheckOutline class="h-5 w-5" />
            </Button>
            <Button
                size="xs"
                color="alternative"
                class="px-2"
                on:click={cancelEditing}
                title="Cancel"
            >
                <CloseOutline class="h-5 w-5" />
            </Button>
        {:else}
            <p class="min-w-0 flex-1 truncate font-medium text-white">
                {collection.name}
            </p>
            <p class="shrink-0 text-sm text-slate-300">
                {collection.books.length} book{collection.books.length !== 1
                    ? "s"
                    : ""}
            </p>
            <Button
                size="xs"
                color="alternative"
                class="px-2"
                on:click={startEditing}
                title="Rename"
            >
                <EditOutline class="h-5 w-5" />
            </Button>
            <Button
                size="xs"
                color="red"
                class="px-2"
                on:click={() => (confirmingDelete = true)}
                title="Delete"
            >
                <TrashBinOutline class="h-5 w-5" />
            </Button>
            <Button
                size="xs"
                class="px-2"
                on:click={() => (expanded = !expanded)}
                title={expanded ? "Collapse" : "Expand"}
            >
                <AngleDownOutline
                    class="h-5 w-5 transition-transform duration-300 {expanded
                        ? 'rotate-180'
                        : ''}"
                />
            </Button>
        {/if}
    </div>

    {#if confirmingDelete}
        <div
            class="mt-3 flex flex-col gap-3 rounded-md bg-slate-800 p-3 sm:flex-row sm:items-center sm:justify-between"
            transition:slide={{ duration: 200 }}
        >
            <p class="text-sm text-slate-200">
                Delete “{collection.name}”? This can't be undone.
            </p>
            <div class="flex gap-2">
                <Button
                    size="xs"
                    color="alternative"
                    on:click={() => (confirmingDelete = false)}>Cancel</Button
                >
                <Button size="xs" color="red" on:click={deleteCollection}>
                    Delete
                </Button>
            </div>
        </div>
    {/if}

    {#if expanded}
        <div transition:slide={{ duration: 300 }}>
            {#if loading}
                <div class="flex flex-col items-center justify-center py-10">
                    <Spinner color="purple" class="mb-4 h-16 w-16" />
                    <p class="text-gray-300">Loading prices…</p>
                </div>
            {:else if collection.books.length === 0}
                <p class="py-8 text-center text-slate-400">
                    No books in this collection yet. Bookmark books from search to
                    add them here.
                </p>
            {:else}
                <div class="w-full">
                    {#each collection.books as saved (saved.url)}
                        <div class="relative my-4 w-full">
                            {#if isUnavailable(saved.url)}
                                <p
                                    class="mb-1 ml-1 text-xs text-amber-400"
                                >
                                    This book is no longer listed — showing your
                                    saved info.
                                </p>
                            {/if}
                            <BookCard
                                book={displayBook(saved)}
                                {currency}
                                width="w-full !m-0"
                            />
                            <Button
                                size="xs"
                                color="red"
                                class="absolute bottom-3 right-3 px-2"
                                on:click={(e) => removeBook(e, saved.url)}
                                title="Remove from collection"
                            >
                                <TrashBinOutline class="h-4 w-4" />
                            </Button>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</div>
