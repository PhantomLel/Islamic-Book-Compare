<script lang="ts">
    import { Button, Search, Select, Label } from "flowbite-svelte";
    import { FilterOutline } from "flowbite-svelte-icons";
    import type { PageData } from "./$types";
    import BookCard from "./BookCard.svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import FilterDrawer from "./FilterDrawer.svelte";

    // The data prop is provided by the parent component
    export let data: PageData;

    // Initialize the search term from the provided data
    let search = data.props.search;

    // State variables for sorting and filtering
    let sortByValue = "low"; // Default sort option
    let timer: number; // Timer for debouncing search input
    let loading = false; // Flag to indicate loading state
    let filtersHidden = true; // Flag to control the visibility of the filter drawer

    // Function to update the search query with a debounce effect
    const updateSearch = () => {
        loading = true; // Show loading indicator
        clearTimeout(timer); // Clear any existing timer
        timer = setTimeout(() => {
            console.log(search); // Log the current search term for debugging
            let query = new URLSearchParams($page.url.searchParams.toString());
            query.set("search", search); // Update the search query parameter
            loading = false; // Hide loading indicator
            goto(`?${query.toString()}`, {
                keepFocus: true, // Keep focus on the input field
            });
        }, 400); // Wait 400 milliseconds before updating the URL
    };
</script>

<div class="h-screen justify-center">
    <div class="bg-gray-800 p-6 m-5 rounded-xl">
        <div class="gap-2 flex">
            <Search
                required
                on:input={(e) => {
                    updateSearch(); // Call updateSearch on input change
                }}
                bind:value={search} 
                autocomplete={"off"}
                name={"search"}
                size={"md"}
                placeholder={"Search for a book"}
                class="font-semibold"
            />
        </div>
        <div class="flex justify-between gap-2">
            <Button on:click={() => filtersHidden = !filtersHidden} outline={!filtersHidden} class="mt-3">
                <FilterOutline class="w-3 h-3 mr-1" />
                Filters
            </Button>
            <Select
                class="mt-3"
                size={"md"}
                placeholder={"Sort by"}
                bind:value={sortByValue} 
                items={[
                    { value: "low", name: "Lowest Price" },
                    { value: "high", name: "Highest Price" },
                    { value: "popularity", name: "Popularity" },
                ]}
            />
        </div>
        <div class="flex gap-3 mt-3">
            <Label>
                Show per page
                <Select
                    class="mt-3"
                    size={"md"}
                    placeholder={"10"}
                    items={[
                        { value: "10", name: "10" },
                        { value: "20", name: "20" },
                        { value: "50", name: "50" },
                    ]}
                />
            </Label>
        </div>
    </div>

    <!-- Display a message if no search results are found -->
    {#if data.props.results.length === 0}
        <h1 class="text-2xl ml-5 mb-3 text-white mt-12 font-bold">
            No results found
        </h1>
    {:else}
        <!-- Display the number of search results -->
        <h1 class="text-xl ml-5 mb-3 text-white mt-12 font-bold">
            Search Result{data.props.results.length > 1 ? "s" : ""}: {data.props.results.length}
        </h1>
    {/if}
    <!-- Render a BookCard for each result -->
    {#each data.props.results as book}
        <BookCard {book} {loading} />
    {/each}
</div>

<!-- Include the FilterDrawer component and bind its hidden state -->
<FilterDrawer bind:hidden={filtersHidden} />
