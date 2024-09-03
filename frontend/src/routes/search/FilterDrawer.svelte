<script lang="ts">
    import { goto } from "$app/navigation";
    import { Drawer, Button, Search, Hr, Checkbox } from "flowbite-svelte";
    import { onMount } from "svelte";
    import { sineIn } from "svelte/easing";

    export let hidden = true;

    let filterSearch = "";

    // Transition parameters for the Drawer component
    let transitionParams = {
        y: 350, // Vertical movement for the transition
        duration: 200, // Duration of the transition in milliseconds
        easing: sineIn, // Easing function for smooth animation
    };

    // Extract the "exclude" search parameters from the current URL
    let storeExclude = new URLSearchParams(location.search).getAll("exclude");

    // Define the store filter options and their default states
    let storeFilter = {
        label: "Store",
        options: [
            { value: "Islamic Bookstore", label: "Islamic Bookstore", checked: true },
        ],
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
        let query = new URLSearchParams(location.search);

        // Get the values of unchecked options to be excluded
        let exclude = storeFilter.options
            .filter((option) => !option.checked)
            .map((option) => option.value);

        // Remove existing "exclude" parameters and add the updated ones
        query.delete("exclude");
        exclude.forEach((value) => {
            query.append("exclude", value);
        });

        // Update the URL without losing focus
        goto(`?${query.toString()}`, {
            keepFocus: true,
        });
    };
</script>

<Drawer
    divClass={"overflow-y-scroll max-h-3/4 z-50 p-4 bg-white dark:bg-gray-800"}
    width={"w-full"}
    placement={"bottom"}
    transitionType="fly"
    {transitionParams}
    bind:hidden
>
    <div class="flex">
        <Search
            bind:value={filterSearch}
            autocomplete={"off"}
            size={"md"}
            placeholder={"Search Filters"}
        />
    </div>
    <div class="mt-4">
        <h3 class=" text-xl text-white font-semibold">
            {storeFilter.label}
        </h3>

        {#each storeFilter.options as filter}
            <div class=" max-h-56 overflow-y-scroll">
                <!-- Display filter options based on search input -->
                {#if filter.label
                    .toLowerCase()
                    .includes(filterSearch.toLowerCase())}
                    <div class="flex items-center m-2">
                        <Checkbox
                            on:change={updateSearch}
                            bind:checked={filter.checked}
                            label={filter.label}
                            value={filter.value}
                            class="text-slate-300"
                        >
                            {filter.label}
                        </Checkbox>
                    </div>
                {/if}
            </div>
        {/each}
    </div>
    <Hr />
</Drawer>
