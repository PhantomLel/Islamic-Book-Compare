<script lang="ts">
    import type { Book } from "$lib";
    import TextPlaceholder from "flowbite-svelte/TextPlaceholder.svelte";
    import ImagePlaceholder from "flowbite-svelte/ImagePlaceholder.svelte";
    import Button from "flowbite-svelte/Button.svelte";
    import BookmarkOutline from "flowbite-svelte-icons/BookmarkOutline.svelte";
    import BookmarkSolid from "flowbite-svelte-icons/BookmarkSolid.svelte";
    import { collectionsStore } from "$lib/stores";
    import CollectionsModal from "./CollectionsModal.svelte";

    let modalOpen = false;
    export let book: Book;
    export let loading = false;
    export let width = "sm:w-1/4 w-full";
    export let currency =  { value: "USD", name: "USD", rate: 1, symbol: "$"};


    $: isBookmarked = $collectionsStore.some((collection) => collection.books.includes(book.url));

    const handleBookClick = (book: Book) => {
        fetch("/api/book-clicked", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                bookTitle: book.title,
                bookAuthor: book.author,
                bookUrl: book.url,
                bookPrice: book.price,
                bookSource: book.source,
            }),
        })
            .then((response) => response.json())
            .then((data) => {
                console.log("Book click tracked:", data);
            })
            .catch((error) => {
                console.error("Failed to track book click:", error);
            });

        // open the book in a new tab
        window.open(book.url, "_blank");
    };


</script>

{#if !loading}
    <div
        class="bg-gray-800 p-6 m-5  rounded-xl {width} cursor-pointer relative flex flex-row gap-3"
        role="button"
        tabindex="0"
        on:click={() => handleBookClick(book)}
        on:keydown={(e) => e.key === "Enter" && handleBookClick(book)}
    >
        {#if book.image != null}
            <img
                src={book.image}
                alt="book"
                class="object-scale-down w-32 mb-2"
            />
        {:else}
            <ImagePlaceholder imgOnly={true} divClass="w-32" />
        {/if}

        <div class=" w-1/2">
            <h1 class="text-sm font-bold text-white">
                {book.title.substring(0, 70) +
                    (book.title.length > 70 ? "..." : "")}
            </h1>
            <p class="sm:text-md text-sm text-slate-300">
                {book.author == null ? "" : book.author.substring(0, 40)}
            </p>
            <p
                class="sm:text-md
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
                { currency.value !== "USD" ? "~" : "" }{currency.symbol}{book.price == null
                    ? "N/A"
                    : (parseFloat(book.price.toString()) * currency.rate).toFixed(2)}
            </p>
            <p class="mt-4">
                {#if book.instock}
                    <span class=" text-sm text-green-500 font-semibold"
                        >In stock</span
                    >
                {:else}
                    <span class="text-red-400 text-sm">Out of stock</span>
                {/if}
            </p>
        </div>
        <Button
            on:click={(e) => { e.stopPropagation(); modalOpen = !modalOpen; }}
            class="absolute top-4 right-4 px-2"
            outline={!isBookmarked}
        >
            {#if isBookmarked}
                <BookmarkSolid class=" h-5 w-5" />
            {:else}
                <BookmarkOutline class=" h-5 w-5" />
            {/if}
        </Button>
        <!-- <Button
            on:click={() => handleBookClick(book)}
            on:keydown={(e) => e.key === "Enter" && handleBookClick(book)}
            class="absolute top-[4.3rem] right-4 px-2"
            outline={true}
        >
            <ArrowUpRightFromSquareOutline class=" h-5 w-5"/>
        </Button> -->
    </div>
{:else}
    <div class="bg-gray-800 p-6 m-5 rounded-xl flex gap-3">
        <ImagePlaceholder imgOnly divClass="w-32" />
        <div>
            <TextPlaceholder size="w-32 mt-6" />
        </div>
    </div>
{/if}

{#if modalOpen}
    <CollectionsModal bookUrl={book.url} bind:open={modalOpen} />
{/if}