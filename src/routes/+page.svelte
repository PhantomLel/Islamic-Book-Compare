<script lang="ts">
    import Card from "flowbite-svelte/components/Card.svelte";
    import Search from "flowbite-svelte/components/Search.svelte";
    import Button from "flowbite-svelte/components/Button.svelte";
    import type { PageData } from "./$types";
    import { enhance } from "$app/forms";

    export let data: PageData;
</script>

<title>Islamic Book Search</title>
<div
    class="h-screen"
    style="background-image: url(https://cdn.modrinth.com/landing-new/landing.webp); background-size: cover; padding-bottom: 10rem;"
>
    <div class=" flex justify-center items-center h-screen">
        <div class="text-center sm:w-1/2 w-10/12 ">
            <h1 class=" sm:text-6xl text-4xl font-bold text-white mb-6">
                Islamic Book Search
            </h1>
            <p class="text-slate-300 sm:text-lg text-md mb-8">
                Search from a collection of <span class="font-bold text-white">{data.props.total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</span> Islamic books from popular bookstores.
            </p>
            <form method="POST" use:enhance>
                <Search
                    required
                    autofocus
                    autocomplete={"off"}
                    name={"search"}
                    size={"lg"}
                    placeholder={"Search for a book"}
                    class="font-semibold"
                />
                <Button
                    type={"submit"}
                    autocomplete={"off"}
                    color={"purple"}
                    class={"mt-6"}
                    size={"lg"}>Search</Button
                >
            </form>
            <!-- <h1 class="text-3xl text-white mt-12 font-bold">Featured Books</h1> -->
        </div>
    </div>
    <div class="flex justify-center items-center flex-wrap mt-8 gap-x-4"></div>
    <!-- <div class="flex justify-center items-center flex-wrap mt-8 gap-x-4">
        {#each data.props.featured as book}
            <Card class="sm:min-w-1/6 sm:w-64 sm:h-96 h-72 w-5/12 mt-4">
                <img
                    src={book.img}
                    alt="book"
                    class="object-scale-down sm:h-64 h-40 mb-2"
                />
                <div class="">
                    <h1 class="sm:text-sm text-xs font-semibold">
                        {book.title.substring(0, 65) +
                            (book.title.length > 50 ? "..." : "")}
                    </h1>
                    <p class="sm:text-sm text-xs text-slate-300">
                        {book.author.substring(0, 15)}
                    </p>
                </div>
            </Card>
        {/each}
    </div> -->
</div>
