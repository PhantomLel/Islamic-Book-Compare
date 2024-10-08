<script lang="ts">
    import { Button, Search, Select, Label, Checkbox } from "flowbite-svelte";
    import FilterOutline  from "flowbite-svelte-icons/FilterOutline.svelte";
    import type { PageData } from "./$types";
    import BookCard from "./BookCard.svelte";
    import { page } from "$app/stores";
    import Pagination from "./Pagination.svelte";
    import { afterNavigate, beforeNavigate, goto, replaceState } from "$app/navigation";
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

    let show = parseInt($page.url.searchParams.get("show") ?? "15");
    let searchDesc = $page.url.searchParams.get("searchDesc") === "true" || $page.url.searchParams.get("searchDesc") === null; // Default to true

    let pageNum: number; //= parseInt($page.url.hash.replace("#", "")) || 1;

    $: {
        pageNum = parseInt($page.url.searchParams.get("page") ?? "1");

        if (
            pageNum < 1 ||
            pageNum > Math.ceil(data.props.total / show)
        ) {
            pageNum = Math.ceil(data.props.total / show);
            $page.url.searchParams.set("page", pageNum.toString());
        }
    }


    afterNavigate(() => {
        loading = false;
    });

    beforeNavigate(() => {
        loading = true;
    });

    // Function to update the search query with a debounce effect
    const updateSearch = (reload = true) => {
        clearTimeout(timer); // Clear any existing timer

        if (search === "") {
            loading = false;
            return;
        }

        loading = true; 
        timer = setTimeout(() => {
            loading = false; 

            let query = new URLSearchParams($page.url.searchParams.toString());
            query.set("search", search); 
            query.set("sort", sortByValue); 
            query.set("show", show.toString()); 
            query.set("instock", instock.toString()); 
            query.set("searchDesc", searchDesc.toString());
            query.set("page", "1"); 

            if (reload) {
                // Reload the page with the updated query parameters
                goto(`?${query.toString()}`, {
                    keepFocus: true, 
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
                id={"search"}
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
            <Checkbox bind:checked={searchDesc} on:change={() => updateSearch()}>
                Search Description
            </Checkbox>
            <Label>
                Show per page
                <Select
                    bind:value={show}
                    on:change={() => updateSearch()}
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
                    start: data.props.start,
                    end: data.props.end,
                    total: data.props.total,
                }}
            />
        {/if}
    </div>
    <!-- Render a BookCard for each result -->
    <div class="flex flex-wrap justify-center">
        {#each data.props.results as book}
            {#if (instock && book.instock) || !instock}
                <BookCard {book} {loading} />
            {/if}
        {/each}
    </div>
    {#if data.props.results.length > 10 || window.innerWidth < 768}
    <Pagination
        {pageNum}
        helper={{
            start: data.props.start,
            end: data.props.end,
            total: data.props.total,
        }}
    />
    {/if}
</div>

<!-- Include the FilterDrawer component and bind its hidden state -->
<FilterDrawer bind:hidden={filtersHidden} />
