<script lang="ts">
    import Search from "flowbite-svelte/Search.svelte";
    import Button from "flowbite-svelte/Button.svelte";
    import type { PageData } from "./$types";
    import { enhance } from "$app/forms";
    import GithubSolid from "flowbite-svelte-icons/GithubSolid.svelte";
    import ArrowRightOutline from "flowbite-svelte-icons/ArrowRightOutline.svelte";

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
            <form method="POST" use:enhance class="flex flex-col items-center">
                <div class="flex w-full max-w-4xl">
                    <Search
                        required
                        autofocus
                        autocomplete={"off"}
                        name={"search"}
                        size={"lg"}
                        placeholder={"Search in English or Arabic "}
                        class="font-semibold flex-1"
                    />
                    <Button
                        type={"submit"}
                        autocomplete={"off"}
                        color={"purple"}
                        class={"ml-2 px-3"}
                        size={"lg"}
                    >
                        <ArrowRightOutline class="w-6 h-6 font-bold" />
                    </Button>
                </div>
                <Button 
                    class="mt-4 hover:text-white transition-colors duration-200" 
                    href="https://github.com/PhantomLel/Islamic-Book-Compare" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                >
                    <GithubSolid class="w-5 h-5 mr-2" />
                    GitHub
                </Button>
                    <div class="flex flex-wrap gap-4 mt-8 w-full">
                        <div class="bg-slate-800/70 backdrop-blur-lg p-4 rounded-xl sm:w-1/3 w-1/2 border border-slate-700/50 shadow-lg hover:shadow-sm hover:shadow-purple-500/20 hover:border-purple-500/50 hover:bg-slate-800/90 transition-all duration-300 transform " >
                            <a href="https://ummahspot.com" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center justify-center gap-3">
                                <img src="/ummahspot.png" alt="Ummah Spot" class="w-2/3 h-auto transition-transform duration-300 hover:scale-105">
                                <p class="text-sm text-slate-300 font-medium mt-2 hover:text-white transition-colors duration-300">Unearth the Rarest Arabic Books</p>
                            </a>
                        </div>
                    </div>
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
