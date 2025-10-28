<script lang="ts">
    import type { Collection } from "$lib";
    import Button from "flowbite-svelte/Button.svelte";
    import AngleDownOutline from "flowbite-svelte-icons/AngleDownOutline.svelte";
    import type { Book } from "$lib";
    import BookCard from "../search/BookCard.svelte";
    import Spinner from "flowbite-svelte/Spinner.svelte";
    import { slide } from "svelte/transition";

    export let collection: Collection;

    let expanded = false;
    let bookData: Book[] = [];
    let loading = false;

    // when exanded, fetch the data for every book in the collection
    $: if (expanded && bookData.length === 0 && !loading) {
        loading = true;
        fetch("/api/collections/", {
            method: "POST",
            body: JSON.stringify({ books: collection.books }),
        })
            .then((res) => res.json())
            .then((data) => {
                bookData = data;
                console.log(bookData);
            })
            .catch((err) => {
                console.error(err);
            })
            .finally(() => {
                loading = false;
            });
    }
</script>

<div class="bg-slate-700 py-3 px-4 rounded w-full">
    <div class="flex flex-row items-center justify-between">
        <p class=" font-medium">{collection.name}</p>
        <p class="text-sm">
            {collection.books.length} book{collection.books.length !== 1
                ? "s"
                : ""}
        </p>
        <Button on:click={() => (expanded = !expanded)} class="px-3">
            <AngleDownOutline
                class="mr-2 h-6 w-6 transition-transform duration-300 {expanded
                    ? 'rotate-180'
                    : ''}"
            />
            {#if expanded}
                <p class="text-sm">Collapse</p>
            {:else}
                <p class="text-sm">Expand</p>
            {/if}
        </Button>
    </div>
    {#if expanded}
        <div transition:slide={{ duration: 300 }}>
            {#if loading}
                <div class="flex flex-col items-center justify-center w-full">
                    <Spinner color="purple" class="h-24 w-24 mb-4" />
                    <p class="text-lg text-gray-300">Loading</p>
                </div>
            {:else}
                <div class="w-full">
                    {#each bookData as book}
                    <div class="w-full my-5">    
                        <BookCard {book} width="w-full !m-0" />
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</div>
