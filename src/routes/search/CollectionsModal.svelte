<script lang="ts">
    import Modal from "flowbite-svelte/Modal.svelte";
    import Button from "flowbite-svelte/Button.svelte";
    import Input from "flowbite-svelte/Input.svelte";
    import { onMount } from "svelte";
    import type { Book, Collection } from "$lib";
    import { collectionsStore, bookToSaved } from "$lib/stores";
    import { notifications } from "$lib/notifications";
    import BookmarkOutline from "flowbite-svelte-icons/BookmarkOutline.svelte";
    import BookmarkSolid from "flowbite-svelte-icons/BookmarkSolid.svelte";
    import PlusOutline from "flowbite-svelte-icons/PlusOutline.svelte";
    import InfoCircleOutline from "flowbite-svelte-icons/InfoCircleOutline.svelte";

    export let open = false;
    export let book: Book;

    $: collections = $collectionsStore;

    let creating = false;
    let newName = "";

    const isInCollection = (collection: Collection) =>
        collection.books.some((b) => b.url === book.url);

    function toggle(collection: Collection) {
        const action = collectionsStore.toggleBook(
            collection.id,
            bookToSaved(book),
        );
        if (action === "added") {
            notifications.success(`Added to ${collection.name}`);
        } else {
            notifications.info(`Removed from ${collection.name}`);
        }
    }

    function startCreating() {
        creating = true;
    }

    function createAndAdd() {
        const name = newName.trim();
        if (!name) {
            notifications.info("Please enter a collection name");
            return;
        }
        if (collections.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
            notifications.error("A collection with that name already exists");
            return;
        }
        collectionsStore.createCollection(name, bookToSaved(book));
        notifications.success(`Created "${name}" and added book`);
        newName = "";
        creating = false;
    }

    function cancelCreating() {
        creating = false;
        newName = "";
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Enter") createAndAdd();
        if (event.key === "Escape") cancelCreating();
    }

    onMount(() => {
        fetch("/api/send-message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageText: "Collection Modal Opened" }),
        }).catch(() => {});
    });
</script>

<Modal bind:open outsideclose>
    <div class="space-y-3 py-2">
        <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-white">Save to collection</h2>
            {#if !creating}
                <Button size="xs" class="px-2" on:click={startCreating}>
                    <PlusOutline class="h-4 w-4 mr-1" />
                    New
                </Button>
            {/if}
        </div>

        {#if creating}
            <div class="flex items-center gap-2">
                <Input
                    bind:value={newName}
                    placeholder="Collection name"
                    class="w-full"
                    on:keydown={handleKeydown}
                    autofocus
                />
                <Button size="sm" class="px-3" on:click={createAndAdd}>Create</Button>
                <Button
                    size="sm"
                    color="alternative"
                    class="px-3"
                    on:click={cancelCreating}>Cancel</Button
                >
            </div>
        {/if}

        {#each collections as collection (collection.id)}
            <button
                type="button"
                on:click={() => toggle(collection)}
                class="flex w-full flex-row items-center justify-between rounded bg-slate-700 px-4 py-3 text-left transition-colors hover:bg-slate-600"
            >
                <div class="min-w-0">
                    <p class="truncate font-medium text-white">{collection.name}</p>
                    <p class="text-sm text-slate-300">
                        {collection.books.length} book{collection.books.length !== 1
                            ? "s"
                            : ""}
                    </p>
                </div>
                {#if isInCollection(collection)}
                    <BookmarkSolid class="h-6 w-6 shrink-0 text-white" />
                {:else}
                    <BookmarkOutline class="h-6 w-6 shrink-0 text-slate-300" />
                {/if}
            </button>
        {:else}
            {#if !creating}
                <div class="py-6 text-center">
                    <p class="mb-3 text-gray-400">No collections yet</p>
                    <Button size="sm" on:click={startCreating}>
                        <PlusOutline class="h-4 w-4 mr-2" />
                        Create your first collection
                    </Button>
                </div>
            {/if}
        {/each}

        <div class="flex flex-row items-start gap-2 pt-1">
            <InfoCircleOutline class="h-5 w-5 shrink-0 text-slate-400" />
            <p class="text-sm text-slate-400">
                Collections are saved locally in your browser. Prices refresh
                automatically when you open a collection.
            </p>
        </div>
    </div>
</Modal>
