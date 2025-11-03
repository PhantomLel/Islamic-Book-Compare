<script lang="ts">
    import CoffeeIcon from "./CoffeeIcon.svelte";
    import Button from "flowbite-svelte/Button.svelte";
    import Select from "flowbite-svelte/Select.svelte";
    import Checkbox from "flowbite-svelte/Checkbox.svelte";
    import FloatingLabelInput from "flowbite-svelte/FloatingLabelInput.svelte";
    import Spinner from "flowbite-svelte/Spinner.svelte";
    import Modal from "flowbite-svelte/Modal.svelte";
    import Label from "flowbite-svelte/Label.svelte";
    import Input from "flowbite-svelte/Input.svelte";
    import FilterOutline from "flowbite-svelte-icons/FilterOutline.svelte";
    import InfoCircleOutline from "flowbite-svelte-icons/InfoCircleOutline.svelte";
    import SearchOutline from "flowbite-svelte-icons/SearchOutline.svelte";
    import BookOpenOutline from "flowbite-svelte-icons/BookOpenOutline.svelte";
    import BookOutline from "flowbite-svelte-icons/BookOutline.svelte";
    import type { PageData } from "./$types";
    import BookCard from "./BookCard.svelte";
    import { page } from "$app/stores";
    import Pagination from "./Pagination.svelte";
    import { afterNavigate, beforeNavigate, goto } from "$app/navigation";
    import { onMount } from "svelte";
    import FilterDrawer from "./FilterDrawer.svelte";
    import type { Book } from "$lib";
    import GithubSolid from "flowbite-svelte-icons/GithubSolid.svelte";
    import CodeOutline from "flowbite-svelte-icons/CodeOutline.svelte";
    // The data prop is provided by the parent component
    export let data: PageData;

    let innerWidth: number;

    onMount(() => {
        innerWidth = window.innerWidth;
    });

    let clickOutsideModal = false;
    // Initialize the search term from the provided data
    let search = $page.url.searchParams.get("search") || "";
    let author = $page.url.searchParams.get("author") || "";

    // State variables for sorting and filtering
    let sortByValue = $page.url.searchParams.get("sort") || "low"; // Default sort option
    let instock = $page.url.searchParams.get("instock") !== "false"; // Default instock filter
    let exactSearch = $page.url.searchParams.get("exactSearch") === "true"; // Default exact search filter

    // Check if filters are active (non-default values)
    $: hasActiveFilters = {
        hasExcludedStores: $page.url.searchParams.getAll("exclude").length > 0,
        hasFuzzySearch: $page.url.searchParams.get("fuzzy") === "true",
        notDefaultShow:
            $page.url.searchParams.get("show") &&
            $page.url.searchParams.get("show") !== "15",
    };

    $: hasAnyActiveFilter =
        hasActiveFilters.hasExcludedStores ||
        hasActiveFilters.hasFuzzySearch ||
        hasActiveFilters.notDefaultShow;

    let timer: ReturnType<typeof setTimeout>;

    let loading = false;
    let feedBackSent = 1;
    let filtersHidden = true;

    let show = parseInt($page.url.searchParams.get("show") ?? "15");

    let pageNum: number;

    const currencies = [
        { value: "USD", name: "USD", rate: 1, symbol: "$"},
        { value: "GBP", name: "GBP", rate: 0.75, symbol: "£"},
        { value: "EUR", name: "EUR", rate: 0.85, symbol: "€"},
        { value: "TRY", name: "TRY", rate: 42, symbol: "₺"},
        {value: "ZAR", name: "ZAR", rate: 18, symbol: "R"},
    ];

    let currency = $page.url.hash.split("#")[1] || "USD";

    $: {
        pageNum = parseInt($page.url.searchParams.get("page") ?? "1");

        if (pageNum < 1 || pageNum > Math.ceil(data.props.total / show)) {
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

    const handleFeedback = async (event: {
        currentTarget: EventTarget & HTMLFormElement;
    }) => {
        const formData = new FormData(event.currentTarget);
        const feedback = formData.get("feedback");
        const email = formData.get("email");

        // add warning on page leave
        window.addEventListener("beforeunload", () => {
            return "Are you sure you want to leave this page? Your feedback will not be submitted.";
        });

        feedBackSent = 2;

        fetch("https://formsubmit.co/ajax/aamohammed4556@gmail.com", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            mode: "cors",
            body: JSON.stringify({
                feedback: feedback,
                email: email,
            }),
        })
            .then((response) => response.json())
            .then((data) => {
                feedBackSent = 3;
                window.removeEventListener("beforeunload", () => {});
            })
            .catch((error) => {
                feedBackSent = 1;
                window.removeEventListener("beforeunload", () => {});
            });
    };

    // Function to update the search query with a debounce effect
    const updateSearch = () => {
        clearTimeout(timer); // Clear any existing timer

        const trimmedSearch = search.trim();
        const trimmedAuthor = author.trim();

        if (trimmedSearch === "" && trimmedAuthor === "") {
            loading = false;
            return;
        }
        loading = true;

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

            // if the query is the same as the current query, do not reload the page
            if (query.toString() === $page.url.searchParams.toString()) {
                loading = false;
                return;
            }

            // Reload the page with the updated query parameters
            goto(`?${query.toString()}`, {
                keepFocus: true,
            });
        }, 700);
    };
</script>

<title>
    {search ? search : author ? author : "Search"} | Islamic Book Search
</title>
<div class="pb-12">
    <div class=" sm:mx-auto bg-gray-800 p-6 m-5 rounded-xl sm:w-1/2">
        <div class="gap-2 flex sm:flex-nowrap flex-wrap">
            <div class="sm:w-1/2 w-full">
                <FloatingLabelInput
                    id={"search"}
                    required
                    on:input={(e) => {
                        updateSearch(); // Call updateSearch on input change
                    }}
                    bind:value={search}
                    class="w-full"
                    autocomplete={"off"}
                    name={"search"}
                    style={"filled"}
                >
                    Title
                </FloatingLabelInput>
            </div>
            <div class="sm:w-1/2 w-full">
                <FloatingLabelInput
                    id={"author"}
                    bind:value={author}
                    on:input={(e) => {
                        // if space is pressed, do not update the search
                        updateSearch(); // Call updateSearch on input change
                    }}
                    autocomplete={"off"}
                    name={"author"}
                    style={"filled"}
                >
                    Author
                </FloatingLabelInput>
            </div>
        </div>
        <div class="flex gap-3 mt-3 flex-wrap items-center">
            <Button class="mt-1 self-end px-3" on:click={() => goto("/lists")}>
                <BookOutline class=" h-4 w-4 mr-2 " />
                Lists
            </Button>
            <Button
                on:click={() => (filtersHidden = !filtersHidden)}
                outline={!filtersHidden}
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
                    size={"md"}
                    placeholder={"Sort by"}
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
                    on:change={() => {
                        window.location.hash = currency;
                    }}
                    class="mt-3 self-start"
                    size={"md"}
                    placeholder={"Currency"}
                    bind:value={currency}
                    items={currencies.map((currency) => ({ value: currency.value, name: currency.name + " (" + currency.symbol + ")" }))}
                />
            </div>

            <div class="flex flex-col gap-3">
                <Checkbox
                    bind:checked={instock}
                    on:change={() => updateSearch()}
                >
                    Hide Out of Stock
                </Checkbox>

                <Checkbox
                    bind:checked={exactSearch}
                    on:change={() => updateSearch()}
                >
                    Match Exact Search
                </Checkbox>
            </div>
        </div>
    </div>

    <div class="flex justify-center">
        {#if data.props.results.length === 0}
            <div
                class="flex flex-col items-center justify-center min-h-[400px] px-4"
            >
                {#if loading}
                    <div class="flex flex-col items-center">
                        <Spinner color="purple" class="h-24 w-24 mb-4" />
                        <p class="text-lg text-gray-300">
                            Searching for books...
                        </p>
                    </div>
                {:else}
                    <div class="max-w-lg w-full">
                        <!-- Main Alert Card -->
                        <div
                            class="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl p-8 border dark:border-slate-800 shadow-lg"
                        >
                            <div class="text-center">
                                <!-- Icon -->
                                <div
                                    class="mx-auto w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6"
                                >
                                    <SearchOutline
                                        class="w-8 h-8 text-indigo-600 dark:text-indigo-400"
                                    />
                                </div>

                                <!-- Title -->
                                <h3
                                    class="text-2xl font-bold text-gray-900 dark:text-white mb-3"
                                >
                                    No Books Found
                                </h3>

                                <!-- Description -->
                                <p
                                    class="text-gray-600 dark:text-gray-300 text-lg mb-8 leading-relaxed"
                                >
                                    We couldn't find any books matching your
                                    search criteria. Try adjusting your search
                                    terms or filters.
                                </p>

                                <!-- Help Button -->
                                <Button
                                    on:click={() => (clickOutsideModal = true)}
                                    size="lg"
                                    class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                                >
                                    <InfoCircleOutline class="w-5 h-5 mr-2" />
                                    Get Help & Tips
                                </Button>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
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
                <BookCard {book} {loading} currency={currencies.find((c) => c.value === currency)} />
            {/if}
        {/each}
    </div>
    {#if (data.props.results.length > 1 || innerWidth < 768) && !loading}
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

<!-- Sticky Info Button -->
<div class="fixed bottom-6 right-6 z-50">
    <Button
        on:click={() => (clickOutsideModal = true)}
        class="!p-3 rounded-full shadow-lg hover:shadow-xl transition-shadow"
        size="lg"
    >
        <InfoCircleOutline class="w-6 h-6 mr-2" />
        Info
    </Button>
</div>

<!-- Include the FilterDrawer component and bind its hidden state -->
<FilterDrawer bind:hidden={filtersHidden} bind:stores={data.stores} bind:show />

<Modal title="More Info" bind:open={clickOutsideModal} outsideclose>
    <div class="space-y-6">
        <!-- Search Tips Section -->
        <div
            class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
        >
            <div class="flex items-center mb-3">
                <BookOpenOutline
                    class="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400"
                />
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                    Search Tips
                </h3>
            </div>
            <ul class="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li class="flex items-start">
                    <span
                        class="text-purple-600 dark:text-purple-400 mr-2 font-bold"
                        >•</span
                    >
                    Try searching in both English and Arabic
                </li>
                <li class="flex items-start">
                    <span
                        class="text-purple-600 dark:text-purple-400 mr-2 font-bold"
                        >•</span
                    >
                    Use the author's name in the title field if needed
                </li>
                <li class="flex items-start">
                    <span
                        class="text-purple-600 dark:text-purple-400 mr-2 font-bold"
                        >•</span
                    >
                    Enable "Search Description" to broaden results
                </li>
                <li class="flex items-start">
                    <span
                        class="text-purple-600 dark:text-purple-400 mr-2 font-bold"
                        >•</span
                    >
                    Uncheck "Hide Out of Stock" to see all books
                </li>
            </ul>
        </div>
        <!-- project info section -->
        <div
            class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
        >
            <div class="flex items-center mb-3">
                <CodeOutline
                    class="w-6 h-6 mr-2 text-purple-600 dark:text-purple-400"
                />
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                    Project Info
                </h3>
            </div>
            <ul class="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li class="flex items-start">
                    <span
                        class="text-purple-600 dark:text-purple-400 mr-2 font-bold"
                        >•</span
                    >
                    Contributors are always welcome!
                </li>
                <li class="flex items-start">
                    <span
                        class="text-purple-600 dark:text-purple-400 mr-2 font-bold"
                        >•</span
                    >
                    Contact me at aamohammed4556@gmail.com if you would like to contribute.
                </li>
            </ul>
            <a
                href="https://github.com/PhantomLel/Islamic-Book-Compare"
                target="_blank"
                rel="noopener noreferrer"
            >
                <Button
                    class="mt-4 mr-2 hover:text-white transition-colors duration-200"
                >
                    <GithubSolid class="w-5 h-5 mr-2" />
                    GitHub
                </Button>
            </a>
            <a
                href="https://www.buymeacoffee.com/aamohammedc"
                target="_blank"
                rel="noopener noreferrer"
            >
                <Button
                    class=" hover:text-white transition-colors duration-200"
                >
                    <CoffeeIcon className="w-5 h-5 mr-2 text-white" />
                    Support the Site!
                </Button>
            </a>
        </div>
    </div>

    <hr class="my-6" />
    <h1 class="text-lg font-bold">Feedback</h1>

    <form
        action="https://formsubmit.co/aamohammed4556@gmail.com"
        method="POST"
        class="flex flex-col space-y-6"
        on:submit|preventDefault={handleFeedback}
    >
        {#if feedBackSent === 2}
            <Spinner color="purple" class="h-16 w-16" />
        {:else if feedBackSent === 3}
            <h1 class="text-lg font-bold">Thank you for your feedback!</h1>
        {:else}
            <Label class="space-y-2">
                <span>Email (optional)</span>
                <Input
                    type="email"
                    name="email"
                    placeholder="name@company.com"
                />
            </Label>
            <Label class="space-y-2">
                <span>Feedback</span>
                <Input
                    placeholder="Super important feedback"
                    type="text"
                    name="feedback"
                    required
                />
            </Label>
            <Button
                class="self-start sm:w-auto w-full"
                type="submit"
                size={"sm"}>Submit</Button
            >
        {/if}
    </form>

    <svelte:fragment slot="footer">
        <Button outline={true} on:click={() => (clickOutsideModal = false)}
            >Close</Button
        >
    </svelte:fragment>
</Modal>
