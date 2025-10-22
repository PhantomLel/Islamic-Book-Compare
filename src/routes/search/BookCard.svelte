<script lang="ts">
    import type { Book } from "$lib";
    import TextPlaceholder from "flowbite-svelte/TextPlaceholder.svelte";
    import ImagePlaceholder from "flowbite-svelte/ImagePlaceholder.svelte";

    export let book: Book;
    export let loading = false;
    export let handleBookClick: (book: Book) => void;
</script>

{#if !loading}
    <a
    href={book.url}
    target="_blank"
    class="bg-gray-800 p-6 m-5 rounded-xl flex gap-3 sm:w-1/4 w-full cursor-pointer"
    on:click={() => handleBookClick(book)}>
        {#if book.image != null}
            <img
                src={book.image}
                alt="book"
                class="object-scale-down w-32 mb-2"
            />
        {:else}
            <ImagePlaceholder 

            imgOnly={true} divClass="w-32" />
        {/if}

        <div>
            <h1 class="text-md text-white font-semibold">
                {book.title.substring(0, 70) +
                    (book.title.length > 70 ? "..." : "")}
            </h1>
            <p class="sm:text-sm text-sm text-slate-300">
                {book.author == null ? "" : book.author.substring(0, 40)}
            </p>
            <p class="sm:text-sm
                    text-sm text-slate-500 font-semibold"
            >
                {book.publisher == null ? "" : book.publisher}
            </p>
            <p class="sm:text-sm text-sm mt-2 text-slate-500 font-semibold">
                {book.source}
            </p>
            <p
                class="sm:text-sm text-lg mt-2 text-white font-bold align-text-bottom"
            >
                ${ book.price == null ? "N/A" : parseFloat(book.price.toString()).toFixed(2) }
            </p>
            <p class="mt-4">
                {#if book.instock}
                    <span class=" text-sm text-green-500 font-semibold">In stock</span>
                {:else}
                    <span class="text-red-400 text-sm">Out of stock</span>
                {/if}
            </p>
        </div>
    </a>
{:else}
    <div class="bg-gray-800 p-6 m-5 rounded-xl flex gap-3">
        <ImagePlaceholder imgOnly divClass="w-32" />
        <div>
            <TextPlaceholder size="w-32 mt-6" />
        </div>
    </div>
{/if}

