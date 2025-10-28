<script lang="ts">
    import Button from "flowbite-svelte/Button.svelte";
    import { goto } from "$app/navigation";
    import ArrowLeftOutline from "flowbite-svelte-icons/ArrowLeftOutline.svelte";
    import PlusOutline from "flowbite-svelte-icons/PlusOutline.svelte";
    import { collectionsStore } from "$lib/stores";
    import Collection from "./Collection.svelte";
    import Modal from "flowbite-svelte/Modal.svelte";
    import Input from "flowbite-svelte/Input.svelte";
    import { notifications } from "$lib/notifications";

    // get collections from store
    $: collections = $collectionsStore;
    
    let showModal = false;
    let newCollectionName = "";

    function handleCreateCollection() {
        if (!newCollectionName.trim()) {
            notifications.info("Please enter a collection name");
            return;
        }

        const trimmedName = newCollectionName.trim();
        
        // Check if collection already exists
        if (collections.find((c) => c.name === trimmedName)) {
            notifications.error("Collection already exists");
            return;
        }

        collectionsStore.createCollection(trimmedName);
        notifications.success(`Created collection: ${trimmedName}`);
        newCollectionName = "";
        showModal = false;
    }

    function openModal() {
        showModal = true;
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            handleCreateCollection();
        }
    }
</script>

<title>Your Collections | Islamic Book Search</title>

<div
>   
    <Button on:click={() => goto("/search")} class="m-5 self-end px-3"> 
        <ArrowLeftOutline class="w-6 h-6" />
        Back To Search
    </Button>
    <div class="sm:mx-auto rounded-xl sm:w-3/4 flex flex-col items-center justify-center text-white">
        <div class="flex items-center justify-between w-full mb-6">
            <h1 class="text-2xl ml-5 font-bold text-white">Collections</h1>
            <Button on:click={openModal} class="px-3">
                <PlusOutline class="h-5 w-5 mr-2" />
                New Collection
            </Button>
        </div>
        <div class="w-full space-y-4">
            {#each collections as collection (collection.name)}
                <Collection collection={collection} />
            {/each}
        </div>
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
        <div class="flex gap-2 justify-end">
            <Button color="alternative" on:click={() => { showModal = false; newCollectionName = ""; }}>
                Cancel
            </Button>
            <Button on:click={handleCreateCollection}>
                Create
            </Button>
        </div>
    </div>
</Modal>