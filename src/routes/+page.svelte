<script lang="ts">
    import Button from "flowbite-svelte/Button.svelte";
    import type { PageData } from "./$types";
    import GithubSolid from "flowbite-svelte-icons/GithubSolid.svelte";
    import CoffeeIcon from "./search/CoffeeIcon.svelte";
    import SearchBar from "$lib/SearchBar.svelte";

    export let data: PageData;
</script>

<title>Islamic Book Search</title>

<div
    class="h-screen relative"
    style="background-image: url(https://cdn.modrinth.com/landing-new/landing.webp); background-size: cover; padding-bottom: 10rem;"
>
    <div class="flex justify-center items-center h-screen">
        <div class="text-center w-full">
            <h1 class="sm:text-6xl text-4xl font-bold text-white mb-6">
                Islamic Book Search
            </h1>
            <p class="text-slate-300 sm:text-lg text-md mb-8">
                Search from a collection of <span class="font-bold text-white"
                    >{data.props.total
                        .toString()
                        .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</span
                > Islamic books from popular bookstores.
            </p>
            
            <SearchBar mode="hero" />
        </div>
    </div>

    <!-- Bottom center: Support and GitHub buttons -->
    <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        <a
            href="https://www.buymeacoffee.com/aamohammedc"
            target="_blank"
            rel="noopener noreferrer"
        >
            <Button
                class="hover:text-white transition-colors duration-200"
            >
                <CoffeeIcon className="w-5 h-5 mr-2 text-white" />
                Support
            </Button>
        </a>
        <Button
            class="hover:text-white transition-colors duration-200"
            href="https://github.com/PhantomLel/Islamic-Book-Compare"
            target="_blank"
            rel="noopener noreferrer"
        >
            <GithubSolid class="w-5 h-5 mr-2" />
            GitHub
        </Button>
    </div>
</div>
