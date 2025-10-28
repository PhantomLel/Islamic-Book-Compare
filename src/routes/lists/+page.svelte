<script lang="ts">
    import Button from "flowbite-svelte/Button.svelte";
    import { goto } from "$app/navigation";
    import ArrowLeftOutline from "flowbite-svelte-icons/ArrowLeftOutline.svelte";
    import { collectionsStore } from "$lib/stores";
    import Collection from "./Collection.svelte";

    // get collections from store
    $: collections = $collectionsStore;
</script>

<title>Your Collections | Islamic Book Search</title>

<div
>   
    <Button on:click={() => goto("/search")} class="m-5 self-end px-3"> 
        <ArrowLeftOutline class="w-6 h-6" />
        Back To Search
    </Button>
    <div class="sm:mx-auto rounded-xl sm:w-3/4 flex flex-col items-center justify-center text-white">
        <h1 class="text-2xl font-bold text-white mb-6">Collections</h1>
        <div class="w-full">
            {#each collections as collection (collection.name)}
                <Collection collection={collection} />
            {/each}
        </div>
    </div>
</div>