<script lang="ts">
    import BookCard from "../routes/search/BookCard.svelte";
    import type { Book } from "$lib";

    export let count = 15;

    const placeholderBook: Book = {
        id: 0,
        title: "",
        author: "",
        publisher: "",
        image: "",
        price: 0,
        url: "",
        source: "",
        instock: true,
    };

    const currency = { value: "USD", name: "USD", rate: 1, symbol: "$" };
</script>

<div class="flex flex-wrap justify-center">
    {#each Array.from({ length: count }) as _, i (i)}
        <BookCard
            book={placeholderBook}
            loading={true}
            {currency}
        />
    {/each}
</div>
