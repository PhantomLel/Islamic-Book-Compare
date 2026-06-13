<script lang="ts">
    import Button from "flowbite-svelte/Button.svelte";
    import Modal from "flowbite-svelte/Modal.svelte";
    import Input from "flowbite-svelte/Input.svelte";
    import { goto } from "$app/navigation";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import ArrowLeftOutline from "flowbite-svelte-icons/ArrowLeftOutline.svelte";
    import PlusOutline from "flowbite-svelte-icons/PlusOutline.svelte";
    import { collectionsStore } from "$lib/stores";
    import { notifications } from "$lib/notifications";
    import Collection from "./Collection.svelte";

    $: collections = $collectionsStore;

    let showModal = false;
    let newCollectionName = "";

    function navigateBack() {
        if (browser && window.history.length > 1) {
            window.history.back();
        } else {
            goto("/search");
        }
    }

    function openModal() {
        newCollectionName = "";
        showModal = true;
    }

    function handleCreateCollection() {
        const name = newCollectionName.trim();
        if (!name) {
            notifications.info("Please enter a collection name");
            return;
        }
        if (collections.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
            notifications.error("A collection with that name already exists");
            return;
        }
        collectionsStore.createCollection(name);
        notifications.success(`Created "${name}"`);
        newCollectionName = "";
        showModal = false;
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Enter") handleCreateCollection();
    }

    onMount(() => {
        fetch("/api/send-message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageText: "Lists Page Opened" }),
        }).catch(() => {});
    });
</script>

<title>Your Collections | Islamic Book Search</title>

<div class="min-h-screen px-4 py-5">
    <Button on:click={navigateBack} class="px-3">
        <ArrowLeftOutline class="mr-2 h-5 w-5" />
        Back To Search
    </Button>

    <div class="mx-auto mt-4 w-full max-w-4xl text-white">
        <div class="mb-6 flex items-center justify-between">
            <h1 class="text-2xl font-bold text-white">Collections</h1>
            <Button on:click={openModal} class="px-3">
                <PlusOutline class="mr-2 h-5 w-5" />
                New Collection
            </Button>
        </div>

        {#if collections.length === 0}
            <div
                class="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-16 text-center"
            >
                <h2 class="mb-2 text-xl font-semibold text-white">
                    No collections yet
                </h2>
                <p class="mb-6 max-w-md text-slate-400">
                    Create a collection to organize the books you want to track.
                    You can also bookmark books straight from search.
                </p>
                <Button on:click={openModal} class="px-4">
                    <PlusOutline class="mr-2 h-5 w-5" />
                    Create your first collection
                </Button>
            </div>
        {:else}
            <div class="space-y-4">
                {#each collections as collection (collection.id)}
                    <Collection {collection} />
                {/each}
            </div>
        {/if}
    </div>
</div>

<Modal bind:open={showModal} outsideclose>
    <div class="flex flex-col gap-4">
        <h2 class="text-xl font-bold text-white">Create New Collection</h2>
        <Input
            bind:value={newCollectionName}
            placeholder="Enter collection name"
            class="w-full"
            on:keydown={handleKeydown}
            autofocus
        />
        <div class="flex justify-end gap-2">
            <Button
                color="alternative"
                on:click={() => {
                    showModal = false;
                    newCollectionName = "";
                }}
            >
                Cancel
            </Button>
            <Button on:click={handleCreateCollection}>Create</Button>
        </div>
    </div>
</Modal>
