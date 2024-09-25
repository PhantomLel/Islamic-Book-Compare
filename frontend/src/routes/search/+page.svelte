<script lang="ts">
    import { Button, Search, Select, Label, Checkbox } from "flowbite-svelte";
    import { FilterOutline } from "flowbite-svelte-icons";
    import type { PageData } from "./$types";
    import BookCard from "./BookCard.svelte";
    import { page } from "$app/stores";
    import Pagination from "./Pagination.svelte";
    import { goto, replaceState } from "$app/navigation";
    import FilterDrawer from "./FilterDrawer.svelte";

    // The data prop is provided by the parent component
    export let data: PageData;

    // Initialize the search term from the provided data
    let search = $page.url.searchParams.get("search") || "";

    // State variables for sorting and filtering
    let sortByValue = $page.url.searchParams.get("sort") || "low"; // Default sort option
    let instock = $page.url.searchParams.get("instock") === "true"; // Default instock filter

    let timer: number; // Timer for debouncing search input
    let loading = false; // Flag to indicate loading state
    let filtersHidden = true; // Flag to control the visibility of the filter drawer

    let show = parseInt($page.url.searchParams.get("show") ?? "15") // Number of results to show per page

    let pageNum: number; //= parseInt($page.url.hash.replace("#", "")) || 1;

    $: {
        pageNum = parseInt($page.url.hash.replace("#", "")) || 1;

        if (
            pageNum < 1 ||
            pageNum > Math.ceil(data.props.results.length / show)
        ) {
            pageNum = Math.ceil(data.props.results.length / show);
            window.location.hash = pageNum.toString();
        }
    }

    let range: number[];
    $: range = [
        (pageNum - 1) * show,
        pageNum * show > data.props.results.length
            ? data.props.results.length
            : pageNum * show,
    ];

    $: trimmed = data.props.results.slice(range[0], range[1]);

    // Function to update the search query with a debounce effect
    const updateSearch = (reload = true) => {
        clearTimeout(timer); // Clear any existing timer

        if (search === "") {
            // If the search term is empty, reset the timer and return
            loading = false;
            return;
        }

        loading = true; // Show loading indicator
        timer = setTimeout(() => {
            loading = false; // Hide loading indicator

            let query = new URLSearchParams($page.url.searchParams.toString());
            query.set("search", search); // Update the search query parameter
            query.set("sort", sortByValue); // Update the sort query parameter
            query.set("show", show.toString()); // Update the show query parameter
            query.set("instock", instock.toString()); // Update the instock query parameter

            if (reload) {
                // Reload the page with the updated query parameters
                goto(`?${query.toString()}`, {
                    keepFocus: true, // Keep focus on the input field
                });
            } else {
                replaceState(`?${query.toString()}`, $page.state);
            }
        }, 400);
    };
</script>

<div class="pb-12">
    <div class=" sm:mx-auto bg-gray-800 p-6 m-5 rounded-xl sm:w-3/4">
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
            <Button
                on:click={() => (filtersHidden = !filtersHidden)}
                outline={!filtersHidden}
                class="mt-3"
            >
                <FilterOutline class="w-3 h-3 mr-1" />
                Filters
            </Button>
            <Select
                on:change={() => updateSearch()}
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
        <div class="flex gap-6 mt-3">
            <Checkbox bind:checked={instock} on:change={() => updateSearch()}>
                Hide Out of Stock
            </Checkbox>
            <Label>
                Show per page
                <Select
                    bind:value={show}
                    on:change={() => updateSearch(false)}
                    class="mt-3"
                    size={"md"}
                    items={[
                        { value: 15, name: "15" },
                        { value: 45, name: "45" },
                        { value: 75, name: "75" },
                    ]}
                />
            </Label>
        </div>
    </div>

    <div class="flex justify-center">
        <!-- Display a message if no search results are found -->
        {#if data.props.results.length === 0}
            <h1 class="text-2xl ml-5 mb-3 text-white mt-12 font-bold">
                No results found
            </h1>
        {:else}
            <Pagination
                {pageNum}
                helper={{
                    start: range[0] + 1,
                    end: range[1],
                    total: data.props.results.length,
                }}
            />
        {/if}
    </div>
    <!-- Render a BookCard for each result -->
    <div class="flex flex-wrap justify-center">
        {#each trimmed as book}
            {#if (instock && book.instock) || !instock}
                <BookCard {book} {loading} />
            {/if}
        {/each}
    </div>
    {#if data.props.results.length > 0}
    <Pagination
        {pageNum}
        helper={{
            start: range[0] + 1,
            end: range[1],
            total: data.props.results.length,
        }}
    />
    {/if}
</div>

<!-- Include the FilterDrawer component and bind its hidden state -->
<FilterDrawer bind:hidden={filtersHidden} />
