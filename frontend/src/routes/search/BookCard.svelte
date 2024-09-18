<script lang="ts">
    import type { Book } from "$lib";
    import { TextPlaceholder, ImagePlaceholder } from "flowbite-svelte";

    export let book: Book;
    export let loading = false;

</script>

{#if !loading}
    <div class="bg-gray-800 p-6 m-5 rounded-xl flex gap-3 sm:w-1/4">
        {#if  book.image }
            <img
                on:click={() => {
                    // open book.link
                    window.open(book.url, "_blank");
                }}
                src={ book.image}
                alt="book"
                class="object-scale-down w-32 mb-2"
            />
        {:else}
            <ImagePlaceholder imgOnly={true} class="w-32" />
        {/if}

        <div>
            <h1 class="text-sm text-white font-semibold">
                {book.title.substring(0, 70) +
                    (book.title.length > 70 ? "..." : "")}
            </h1>
            <p class="sm:text-sm text-sm text-slate-300">
                {book.author === undefined ? "" : book.author.substring(0, 15)}
            </p>
            {#if book.publisher}
                <p class="sm:text-sm
                    text-sm text-slate-500 font-semibold"
                >
                    {book.publisher}
                </p>
            {/if}
            <p class="sm:text-sm text-sm mt-2 text-slate-500 font-semibold">
                {book.source}
            </p>
            <p
                class="sm:text-sm text-lg mt-2 text-white font-bold align-text-bottom"
            >
                ${ book.price ? book.price.toFixed(2) : "N/A" }
            </p>
            <p class="mt-4">
                {#if book.instock}
                    <span class=" text-sm text-green-500 font-semibold">In stock</span>
                {:else}
                    <span class="text-red-400 text-sm">Out of stock</span>
                {/if}
            </p>
        </div>
    </div>
{:else}
    <div class="bg-gray-800 p-6 m-5 rounded-xl flex gap-3">
        <ImagePlaceholder imgOnly class="w-32" />
        <div>
            <TextPlaceholder class="w-32 mt-6" />
        </div>
    </div>
{/if}

