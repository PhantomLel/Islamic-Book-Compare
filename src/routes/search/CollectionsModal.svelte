<script lang="ts">
    import Modal from "flowbite-svelte/Modal.svelte";
    import Button from "flowbite-svelte/Button.svelte";
    import { onMount } from "svelte";
    import type { Collection } from "$lib";
    import { collectionsStore } from "$lib/stores";
    import { notifications } from "$lib/notifications";
    import BookmarkOutline from "flowbite-svelte-icons/BookmarkOutline.svelte";
    import BookmarkSolid from "flowbite-svelte-icons/BookmarkSolid.svelte";
    import InfoCircleOutline from "flowbite-svelte-icons/InfoCircleOutline.svelte";

    export let open = false;
    export let bookUrl: string;

    let collections: Collection[] = [];

    $: collections = $collectionsStore;
    
    $: if (collections.length === 0 && open) {
        collectionsStore.createCollection("Main Collection", bookUrl);
    }


    $: isBookInCollection = (collection: Collection) => {
        return collection.books.includes(bookUrl);
    };

    const handleToggle = (collectionName: string) => {
        const isInCollection = isBookInCollection(collections.find(c => c.name === collectionName)!);
        collectionsStore.toggleBookInCollection(collectionName, bookUrl, (message, type) => {
            if (type === 'success') {
                notifications.success(message);
            } else if (type === 'info') {
                notifications.info(message);
            }
        });
    };

    onMount(() => {
        if (!collections.some((collection) => collection.books.includes(bookUrl))) {
            collectionsStore.addBookToCollection("Main Collection", bookUrl);
            notifications.success("Book added to Main Collection");
        }
    });

</script>

<Modal bind:open={open} outsideclose>
    <div class="space-y-2 py-4">
        {#each collections as collection (collection.name)}
        <div class = "flex flex-row items-center justify-between bg-slate-700 py-3 px-4 rounded">
            <p class="text-white font-medium">{collection.name}</p>
            <p class="text-sm">{collection.books.length} book{collection.books.length !== 1 ? 's' : ''}</p>
            <Button on:click={() => handleToggle(collection.name)} outline={!isBookInCollection(collection)} class="px-2 text-white">
                {#if isBookInCollection(collection)}
                    <BookmarkSolid class="h-6 w-6" />
                {:else}
                    <BookmarkOutline class="h-6 w-6" />
                {/if}
            </Button>
        </div>
        {:else}
            <p class="text-gray-400 text-center py-4">No collections yet</p>
        {/each}
        <div class="flex flex-row items-center gap-2"> 
        <InfoCircleOutline class="h-6 w-6 " /> 
        <p class="text-sm ">Collections are saved locally in your browser.</p>
        </div>
    </div>

</Modal>
