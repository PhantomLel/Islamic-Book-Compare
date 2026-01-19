<script lang="ts">
    import FloatingLabelInput from "flowbite-svelte/FloatingLabelInput.svelte";
    import Button from "flowbite-svelte/Button.svelte";
    import Select from "flowbite-svelte/Select.svelte";
    import Checkbox from "flowbite-svelte/Checkbox.svelte";
    import FilterOutline from "flowbite-svelte-icons/FilterOutline.svelte";
    import BookOutline from "flowbite-svelte-icons/BookOutline.svelte";
    import ArrowRightOutline from "flowbite-svelte-icons/ArrowRightOutline.svelte";
    import CoffeeIcon from "../routes/search/CoffeeIcon.svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { createEventDispatcher } from "svelte";
    import { storeCountries } from "$lib";

    /**
     * Mode of the search bar:
     * - "hero": Large centered version for home page (form submit navigates to search)
     * - "full": Full featured version for search results page (debounced search with filters)
     */
    export let mode: "hero" | "full" = "full";

    /** Initial search value */
    export let initialSearch: string = "";
    
    /** Initial author value */
    export let initialAuthor: string = "";
    
    /** Whether there are active filters (for showing indicator) */
    export let hasAnyActiveFilter: boolean = false;

    /** Current currency value */
    export let currency: string = "USD";

    const dispatch = createEventDispatcher();

    // State variables
    let search = initialSearch;
    let author = initialAuthor;
    let sortByValue = mode === "full" ? ($page.url.searchParams.get("sort") || "rel") : "rel";
    let instock = mode === "full" ? ($page.url.searchParams.get("instock") !== "false") : true;
    let exactSearch = mode === "full" ? ($page.url.searchParams.get("exactSearch") === "true") : false;
    let country = mode === "full" ? ($page.url.searchParams.get("country") || "all") : "all";

    let timer: ReturnType<typeof setTimeout>;
    let loading = false;

    const currencies = [
        { value: "USD", name: "USD", rate: 1, symbol: "$" },
        { value: "GBP", name: "GBP", rate: 0.75, symbol: "£" },
        { value: "EUR", name: "EUR", rate: 0.85, symbol: "€" },
        { value: "TRY", name: "TRY", rate: 42, symbol: "₺" },
        { value: "ZAR", name: "ZAR", rate: 18, symbol: "R" },
    ];

    // Hero mode: Handle form submission
    function handleHeroSubmit() {
        const trimmedSearch = search.trim();
        const trimmedAuthor = author.trim();

        if (trimmedSearch === "" && trimmedAuthor === "") {
            return;
        }

        let query = new URLSearchParams();
        if (trimmedSearch) query.set("search", trimmedSearch);
        if (trimmedAuthor) query.set("author", trimmedAuthor);

        goto(`/search?${query.toString()}`);
    }

    function handleCountryChange() {
        if (mode !== "full") return;

        let query = new URLSearchParams($page.url.searchParams.toString());
        
        // Remove any existing country-based excludes first
        query.delete("exclude");
        
        if (country !== "all") {
            // Get all stores that don't match the selected country and exclude them
            const storesToExclude = Object.entries(storeCountries)
                .filter(([_, storeCountry]) => storeCountry !== country)
                .map(([storeName, _]) => storeName);
            
            storesToExclude.forEach((store) => {
                query.append("exclude", store);
            });
        }
        
        // Update the country param in URL
        if (country === "all") {
            query.delete("country");
        } else {
            query.set("country", country);
        }
        
        query.set("page", "1");
        
        goto(`?${query.toString()}`, {
            keepFocus: true,
        });
    }

    // Full mode: Debounced search update
    function updateSearch() {
        if (mode !== "full") return;

        clearTimeout(timer);

        const trimmedSearch = search.trim();
        const trimmedAuthor = author.trim();

        if (trimmedSearch === "" && trimmedAuthor === "") {
            loading = false;
            return;
        }
        loading = true;
        dispatch("loading", true);

        timer = setTimeout(() => {
            let query = new URLSearchParams($page.url.searchParams.toString());

            query.set("search", trimmedSearch);
            query.set("author", trimmedAuthor);
            query.set("sort", sortByValue);
            
            if (!instock) {
                query.set("instock", instock.toString());
            } else {
                query.delete("instock");
            }

            if (exactSearch) {
                query.set("exactSearch", exactSearch.toString());
                query.set("page", "1");
            } else {
                query.delete("exactSearch");
                query.set("page", "1");
            }

            // If the query is the same as the current query, do not reload the page
            if (query.toString() === $page.url.searchParams.toString()) {
                loading = false;
                dispatch("loading", false);
                return;
            }

            goto(`?${query.toString()}`, {
                keepFocus: true,
            });
        }, 700);
    }

    function handleFiltersClick() {
        dispatch("toggleFilters");
    }

    function handleCurrencyChange() {
        window.location.hash = currency;
    }
</script>

{#if mode === "hero"}
    <!-- Hero mode: Large centered search bar for home page -->
    <form on:submit|preventDefault={handleHeroSubmit} class="flex flex-col items-center">
        <div class="flex flex-col sm:flex-row gap-3 w-10/12 max-w-4xl">
            <div class="flex-1">
                <FloatingLabelInput
                    id="search-hero"
                    bind:value={search}
                    autocomplete="off"
                    name="search"
                    style="filled"
                    class="bg-gray-700/80 border-gray-600"
                >
                    <span class="text-gray-300">Title</span>
                </FloatingLabelInput>
            </div>
            <div class="flex-1">
                <FloatingLabelInput
                    id="author-hero"
                    bind:value={author}
                    autocomplete="off"
                    name="author"
                    style="filled"
                    class="bg-gray-700/80 border-gray-600"
                >
                    <span class="text-gray-300">Author</span>
                </FloatingLabelInput>
            </div>
            <Button
                type="submit"
                class="px-6 h-[52px]  mx-auto sm:mx-0"
                size="sm"
            >
                Search  
                <ArrowRightOutline class="w-6 h-6 font-bold" />
            </Button>
        </div>
    </form>
{:else}
    <!-- Full mode: Complete search bar with filters for results page -->
    <div class="sm:mx-auto bg-gray-800 p-6 m-5 rounded-xl sm:w-1/2">
        <div class="gap-2 flex sm:flex-nowrap flex-wrap">
            <div class="sm:w-1/2 w-full">
                <FloatingLabelInput
                    id="search"
                    required
                    on:input={() => updateSearch()}
                    bind:value={search}
                    class="w-full"
                    autocomplete="off"
                    name="search"
                    style="filled"
                >
                    Title
                </FloatingLabelInput>
            </div>
            <div class="sm:w-1/2 w-full">
                <FloatingLabelInput
                    id="author"
                    bind:value={author}
                    on:input={() => updateSearch()}
                    autocomplete="off"
                    name="author"
                    style="filled"
                >
                    Author
                </FloatingLabelInput>
            </div>
        </div>
        <div class="flex gap-3 mt-3 flex-wrap items-center">

            <a href="https://www.buymeacoffee.com/aamohammedc" target="_blank" rel="noopener noreferrer">
                <Button
                    class="hover:text-white transition-colors duration-200 mt-3 self-end px-3"
                >
                    <CoffeeIcon className="w-5 h-5 mr-2 text-white" />
                    Support
                </Button>
            </a>

            <Button class="mt-1 self-end px-3" on:click={() => goto("/lists")}>
                <BookOutline class="h-4 w-4 mr-2" />
                Lists
            </Button>
            <Button
                on:click={handleFiltersClick}
                outline={false}
                class="mt-3 relative px-3"
            >
                <FilterOutline class="w-4 h-4 mr-1" />
                Filters
                {#if hasAnyActiveFilter}
                    <span class="absolute -top-1 -left-1 flex h-3 w-3">
                        <span
                            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-600 opacity-75"
                        ></span>
                        <span
                            class="relative inline-flex rounded-full h-3 w-3 bg-purple-600"
                        ></span>
                    </span>
                {/if}
            </Button>
            <div>
                <Select
                    on:change={() => updateSearch()}
                    class="mt-3 self-start"
                    size="md"
                    placeholder="Sort by"
                    bind:value={sortByValue}
                    items={[
                        { value: "low", name: "Lowest Price" },
                        { value: "high", name: "Highest Price" },
                        { value: "rel", name: "Relevance" },
                    ]}
                />
            </div>
            <div>
                <Select
                    on:change={handleCurrencyChange}
                    class="mt-3 self-start"
                    size="md"
                    placeholder="Currency"
                    bind:value={currency}
                    items={currencies.map((c) => ({
                        value: c.value,
                        name: c.name + " (" + c.symbol + ")",
                    }))}
                />
            </div>
            <div>
                <Select 
                    on:change={handleCountryChange}
                    class="mt-3 self-start"
                    size="md"
                    placeholder="Country"
                    bind:value={country}
                    items={[
                        { value: "all", name: "All" },
                        { value: "UK", name: "United Kingdom" },
                        { value: "NA", name: "North America" },
                        { value: "TUR", name: "Turkey" },
                    ]}
                />
            </div>
            <div class="flex flex-col gap-3">
                <Checkbox bind:checked={instock} on:change={() => updateSearch()}>
                    Hide Out of Stock
                </Checkbox>

                <Checkbox bind:checked={exactSearch} on:change={() => updateSearch()}>
                    Match Exact Search
                </Checkbox>
            </div>
        </div>
    </div>
{/if}

