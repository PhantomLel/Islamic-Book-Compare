<script lang="ts">
    import { goto } from "$app/navigation";
    import Drawer from "flowbite-svelte/Drawer.svelte";
    import Search from "flowbite-svelte/Search.svelte";
    import Hr from "flowbite-svelte/Hr.svelte";
    import Checkbox from "flowbite-svelte/Checkbox.svelte";
    import Label from "flowbite-svelte/Label.svelte";
    import Select from "flowbite-svelte/Select.svelte";

    import { cubicOut } from "svelte/easing";
    import { page } from "$app/stores";

    export let hidden = true;
    export let show = 15;

    let filterSearch = "";

    let transitionParams = {
        y: 350,
        duration: 300,
        easing: cubicOut,
    };

    let fuzzy: boolean = $page.url.searchParams.get("fuzzy") === "true";
    let searchDesc: boolean = $page.url.searchParams.get("searchDesc") === "true";

    const updateSearch = () => {
        let query = new URLSearchParams($page.url.searchParams.toString());

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
        query.set("page", "1");
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

    <Hr />
</Drawer>
