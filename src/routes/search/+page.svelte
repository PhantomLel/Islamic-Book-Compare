<script lang="ts">
    import Button from "flowbite-svelte/Button.svelte";
    import Select from "flowbite-svelte/Select.svelte";
    import Checkbox from "flowbite-svelte/Checkbox.svelte";
    import FloatingLabelInput from "flowbite-svelte/FloatingLabelInput.svelte";
    import Spinner from "flowbite-svelte/Spinner.svelte";
    import Modal from "flowbite-svelte/Modal.svelte";
    import Label from "flowbite-svelte/Label.svelte";
    import Input from "flowbite-svelte/Input.svelte";
    import FilterOutline  from "flowbite-svelte-icons/FilterOutline.svelte";
    import InfoCircleOutline from "flowbite-svelte-icons/InfoCircleOutline.svelte";
    import type { PageData } from "./$types";
    import BookCard from "./BookCard.svelte";
    import { page } from "$app/stores";
    import Pagination from "./Pagination.svelte";
    import { afterNavigate, beforeNavigate, goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { enhance } from "$app/forms";
    import FilterDrawer from "./FilterDrawer.svelte";

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
    let instock = $page.url.searchParams.get("instock") === "true"; // Default instock filter

    let timer: ReturnType<typeof setTimeout>; 

    let loading = false; 
    let feedBackSent= 1; 
    let filtersHidden = true; 

    let show = parseInt($page.url.searchParams.get("show") ?? "15");
    let searchDesc = $page.url.searchParams.get("searchDesc") === "true" 

    let pageNum: number; 

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

    const handleBookClick = (book: any) => {
        // Create a hidden form and submit it to trigger the action
        console.log(book);
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '?/bookClicked';
        
        // Add book data as hidden inputs
        const fields = {
            bookTitle: book.title,
            bookAuthor: book.author,
            bookUrl: book.url,
            bookPrice: book.price,
            bookSource: book.source
        };
        
        Object.entries(fields).forEach(([key, value]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value || '';
            form.appendChild(input);
        });
        
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    }

    const handleFeedback = async (event: { currentTarget: EventTarget & HTMLFormElement }) => {
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
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            mode: 'cors',
            body: JSON.stringify({
                feedback: feedback,
                email: email
            })
        })
        .then(response => response.json())
        .then(data => {
            feedBackSent = 3;
            window.removeEventListener("beforeunload", () => {
            });
        })
        .catch(error => {
            feedBackSent = 1;
            window.removeEventListener("beforeunload", () => {
            });
        });
    }

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
            query.set("instock", instock.toString()); 
            query.set("searchDesc", searchDesc.toString());
            query.set("page", "1"); 

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

<title> {search ? search : author ? author : "Search"} | Islamic Book Search </title>
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
            <Button on:click={() => clickOutsideModal = true}  class="mt-1 self-end !p-2">
                <InfoCircleOutline class="w-6 h-6" />
            </Button>
            <Button
                on:click={() => (filtersHidden = !filtersHidden)}
                outline={!filtersHidden}
                class="mt-3"
            >
                <FilterOutline class="w-3 h-3 mr-1" />
                Filters
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
           <Checkbox bind:checked={instock} on:change={() => updateSearch()}>
                Hide Out of Stock
            </Checkbox>
            <Checkbox bind:checked={searchDesc} on:change={() => updateSearch()}>
                Search Description
            </Checkbox>

        </div>
    </div>

    <div class="flex justify-center">

        {#if data.props.results.length === 0}
        <div class="flex flex-col items-center">
            {#if loading}
                <Spinner color="purple" class="h-24 w-24 mt-24"/>
            {:else}
                <h1 class="text-2xl ml-5 mb-3 text-white mt-12 font-bold">
                    No results found
                </h1>
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
                        <BookCard {book} {loading} handleBookClick={() => handleBookClick(book)} />
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

<!-- Include the FilterDrawer component and bind its hidden state -->
<FilterDrawer bind:hidden={filtersHidden} bind:stores={data.stores} bind:show={show}/>


<Modal title="How to use" bind:open={clickOutsideModal} outsideclose>
    <p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">You can search books in both English and Arabic. Some books are only searchable in Arabic.</p>
    <p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">If you try searching by author and get no results, try putting the author's name in the title field as some books are only searchable by title. Try using the search description option as well to broaden your search.</p>
    <p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">Try using the fuzzy search option to search for similar words, and also try unchecking the hide out of stock option.</p>
    <p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">Jazakallah Khair for using this site! Please let me know if you have any stores to add or feedback.</p>
    <hr class="my-6" />
    <h1 class="text-lg font-bold">Feedback</h1>

    <form action="https://formsubmit.co/aamohammed4556@gmail.com" method="POST" class="flex flex-col space-y-6" on:submit|preventDefault={handleFeedback} >
        {#if feedBackSent === 2}    
            <Spinner color="purple" class="h-16 w-16" />
        {:else if feedBackSent === 3}
            <h1 class="text-lg font-bold">Thank you for your feedback!</h1>
        {:else}
        <Label class="space-y-2">
            <span>Email (optional)</span>
            <Input type="email" name="email" placeholder="name@company.com"/>
        </Label>
        <Label class="space-y-2">
            <span>Feedback</span>
            <Input placeholder="Super important feedback" type="text" name="feedback" required />
            </Label>
            <Button class="self-start sm:w-auto w-full" type="submit" size={"sm"}>Submit</Button>
        {/if}
    </form>

    <svelte:fragment slot="footer">
      <Button outline={true} on:click={() => clickOutsideModal = false}>Close</Button>
    </svelte:fragment>
  </Modal>
