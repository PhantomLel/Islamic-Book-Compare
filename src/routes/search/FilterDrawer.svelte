<script lang="ts">
    import { goto } from "$app/navigation";
    // import { Drawer, Search, Hr, Checkbox, Button, Label, Select } from "flowbite-svelte";
    import Drawer from "flowbite-svelte/Drawer.svelte";
    import Search from "flowbite-svelte/Search.svelte";
    import Hr from "flowbite-svelte/Hr.svelte";
    import Checkbox from "flowbite-svelte/Checkbox.svelte";
    import Button from "flowbite-svelte/Button.svelte";
    import Label from "flowbite-svelte/Label.svelte";
    import Select from "flowbite-svelte/Select.svelte";

    import { onMount } from "svelte";
    import { cubicOut } from "svelte/easing";
    import { page } from "$app/stores";

    export let hidden = true;
    export let stores: string[] = [];
    export let show = 15;


    let filterSearch = "";

    // Transition parameters for the Drawer component
    let transitionParams = {
        y: 350, 
        duration: 300,
        easing: cubicOut,
    };

    let storeExclude = new URLSearchParams($page.url.searchParams).getAll("exclude");
    let fuzzy : boolean = $page.url.searchParams.get("fuzzy") === "true";
    let searchDesc : boolean = $page.url.searchParams.get("searchDesc") === "true";

    let storeFilter = {
        label: "Store",
        options: stores.map((store) => ({ value: store, checked: true })),
    };

    // On component mount, update the filter options based on the URL parameters
    onMount(() => {
        storeFilter.options.forEach((option) => {
            storeExclude.forEach((exclude) => {
                if (exclude === option.value) {
                    option.checked = false; // Uncheck options that are in the "exclude" list
                }
            });
        });
    });

    // Update the URL search parameters based on the current filter state
    const updateSearch = () => {
        let query = new URLSearchParams($page.url.searchParams.toString());

        // Get the values of unchecked options to be excluded
        let exclude = storeFilter.options
            .filter((option) => !option.checked)
            .map((option) => option.value);
        
        query.delete("exclude"); 

        exclude.forEach((value) => {
            query.append("exclude", value);
        });


        if (fuzzy) {
            query.set("fuzzy", "true");
        } else {
            query.delete("fuzzy");
        }

        if (searchDesc) {
            query.set("searchDesc", "true");
        } else {
            query.delete("searchDesc");
        }

        query.set("show", show.toString());
        query.delete("page");
        // Update the URL without losing focus
        goto(`?${query.toString()}`, {
            keepFocus: true,
        });
    };
</script>

<Drawer
    divClass={"overflow-y-scroll max-h-[80vh] sm:max-h-3/4 z-50 p-4 bg-white dark:bg-gray-800 rounded-t-xl"}
    width={"w-full"}
    placement={"bottom"}
    transitionType="fly"
    {transitionParams}
    bind:hidden
    backdrop={true}
>
    <div class="sm:w-1/4 w-full">
        <Search
        bind:value={filterSearch}
        autocomplete={"off"}
        size={"md"}
            placeholder={"Search Filters"}
        />
    </div>

    {#if "show per page".includes(filterSearch.toLowerCase())}
    <div>
        <Label class="mt-3 ">
            Show per page
        <Select
            bind:value={show}
            on:change={() => updateSearch()}
            class="mt-2 w-auto"
            size={"md"}
            items={[
                { value: 15, name: "15" },
                { value: 45, name: "45" },
                { value: 75, name: "75" },
                ]}
            />
        </Label>
    </div>
    {/if}

    {#if "fuzzy search".includes(filterSearch.toLowerCase())}
    <div>
        <Checkbox
            class="mt-4 text-md"
            bind:checked={fuzzy}
            on:change={() => updateSearch()}
        >
            Use fuzzy search
        </Checkbox>
    </div>
    {/if}

    {#if "search description".includes(filterSearch.toLowerCase())}
    <div>
        <Checkbox
                class="mt-4 text-md"
                    bind:checked={searchDesc}
                    on:change={() => updateSearch()}
                >
                    Search Description
                </Checkbox>
    </div>
    {/if}

    <div class="mt-4">
        <h3 class=" text-xl text-white font-semibold">
            {storeFilter.label}
        </h3>

        <Button 
        on:click={() => {
            storeFilter.options.forEach((option) => {
                option.checked = true;
            });
            // force reactivity
            storeFilter.options = [...storeFilter.options];
            updateSearch();
        }}
        size="xs" class="my-4">
            Show All
        </Button>
        <Button 
        on:click={() => {
            storeFilter.options.forEach((option) => {
                option.checked = false;
            });
            storeFilter.options = [...storeFilter.options];
            updateSearch();
        }}
        size="xs" class="my-4">
            Hide All
        </Button>

        {#each storeFilter.options as filter}
            <div class=" max-h-56 overflow-y-scroll">
                <!-- Display filter options based on search input -->
                {#if filter.value
                    .toLowerCase()
                    .includes(filterSearch.toLowerCase())}
                    <div class="flex items-center m-2">
                        <Checkbox
                            on:change={updateSearch}
                            bind:checked={filter.checked}
                            value={filter.value}
                            class="text-slate-300"
                        >
                            {filter.value}
                        </Checkbox>
                    </div>
                {/if}
            </div>
        {/each}
    </div>
    <Hr />
</Drawer>
