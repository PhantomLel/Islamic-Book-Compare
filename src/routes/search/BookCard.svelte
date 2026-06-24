<script lang="ts">
    import type { Book } from "$lib";
    import TextPlaceholder from "flowbite-svelte/TextPlaceholder.svelte";
    import Button from "flowbite-svelte/Button.svelte";
    import BookmarkOutline from "flowbite-svelte-icons/BookmarkOutline.svelte";
    import BookmarkSolid from "flowbite-svelte-icons/BookmarkSolid.svelte";
    import UserOutline from "flowbite-svelte-icons/UserOutline.svelte";
    import BuildingOutline from "flowbite-svelte-icons/BuildingOutline.svelte";
    import StoreOutline from "flowbite-svelte-icons/StoreOutline.svelte";
    import BookOpenOutline from "flowbite-svelte-icons/BookOpenOutline.svelte";
    import { collectionsStore } from "$lib/stores";
    import CollectionsModal from "./CollectionsModal.svelte";
    import { displayImageUrl, proxiedImageUrl } from "$lib/image";

    let modalOpen = false;
    export let book: Book;
    export let loading = false;
    export let width = "sm:w-1/4 w-full";
    export let currency =  { value: "USD", name: "USD", rate: 1, symbol: "$"};

    let useProxy = false;
    let imageFailed = false;

    $: if (book.image) {
        useProxy = false;
        imageFailed = false;
    }

    $: directImageSrc = displayImageUrl(book.image);
    $: imageSrc =
        directImageSrc && !imageFailed
            ? useProxy
                ? proxiedImageUrl(directImageSrc)
                : directImageSrc
            : null;

    function handleImageError() {
        if (!useProxy && directImageSrc) {
            useProxy = true;
            return;
        }
        imageFailed = true;
    }


    $: isBookmarked = $collectionsStore.some((collection) =>
        collection.books.some((b) => b.url === book.url),
    );

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
        class="bg-gray-800 p-6 m-5 rounded-xl {width} cursor-pointer relative flex flex-row gap-3 items-start"
        role="button"
        tabindex="0"
        on:click={() => handleBookClick(book)}
        on:keydown={(e) => e.key === "Enter" && handleBookClick(book)}
    >
        <div class="cover-slot">
            {#if imageSrc}
                <img
                    src={imageSrc}
                    alt={book.title || "book cover"}
                    class="cover-slot__image"
                    referrerpolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    on:error={handleImageError}
                />
            {:else}
                <div class="cover-slot__fallback" aria-hidden="true">
                    <BookOpenOutline class="cover-slot__icon" />
                </div>
            {/if}
        </div>

        <div class="flex-1 min-w-0">
            <h1 class="text-sm font-bold text-white">
                {book.title.substring(0, 70) +
                    (book.title.length > 70 ? "..." : "")}
            </h1>
            {#if book.author}
                <p class="sm:text-md text-sm text-slate-300 flex items-center gap-1.5 mt-1">
                    <UserOutline class="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    {book.author.substring(0, 40)}
                </p>
            {/if}
            {#if book.publisher}
                <p class="sm:text-md text-sm text-slate-400 flex items-center gap-1.5 mt-1">
                    <BuildingOutline class="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    {book.publisher}
                </p>
            {/if}
            <p class="sm:text-sm text-sm mt-2 text-slate-500 font-semibold flex items-center gap-1.5">
                <StoreOutline class="h-3.5 w-3.5 text-slate-500 shrink-0" />
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
    <div class="bg-gray-800 p-6 m-5 rounded-xl flex gap-3 items-start {width}">
        <div class="cover-slot cover-slot--loading" aria-hidden="true"></div>
        <div class="flex-1 min-w-0">
            <TextPlaceholder size="w-32 mt-6" />
        </div>
    </div>
{/if}

{#if modalOpen}
    <CollectionsModal {book} bind:open={modalOpen} />
{/if}

<style>
    .cover-slot {
        width: 8rem;
        height: 11rem;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 0.375rem;
        background: rgb(55 65 81);
    }

    .cover-slot--loading {
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    .cover-slot__image {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }

    .cover-slot__fallback {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        color: rgb(107 114 128);
    }

    :global(.cover-slot__icon) {
        width: 2.5rem;
        height: 2.5rem;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.55;
        }
    }
</style>