<script lang="ts">
    import CloseButton from "flowbite-svelte/CloseButton.svelte";
    import Input from "flowbite-svelte/Input.svelte";
    import { twMerge } from "tailwind-merge";
    import { createEventDispatcher } from "svelte";

    type Item = { value: string; name: string; country?: string };

    export let items: Item[] = [];
    export let value: string[] = [];
    export let size: "sm" | "md" | "lg" = "md";
    export let placeholder = "Stores";
    export let disabled = false;

    const dispatch = createEventDispatcher<{ change: string[] }>();

    let search = "";
    let show = false;
    let root: HTMLDivElement;

    // Local mirror of `value` so the UI updates instantly on user interaction,
    // while still re-syncing whenever the parent passes a new `value` (e.g.
    // after navigation / back-forward).
    let selected: string[] = [];
    $: selected = value.slice();

    function emitChange(next: string[]) {
        selected = next;
        dispatch("change", next.slice());
    }

    /** Close when focus leaves the control; allow focus to move to the search field inside the dropdown. */
    function handleFocusOut() {
        if (disabled) return;
        setTimeout(() => {
            if (!root?.contains(document.activeElement)) show = false;
        }, 0);
    }

    $: searchLower = search.trim().toLowerCase();
    $: visibleItems = items.filter(
        (item) =>
            item.name.toLowerCase().includes(searchLower) ||
            (item.country && item.country.toLowerCase().includes(searchLower)),
    );

    $: selectedSet = new Set(selected);
    $: selectedCount = selectedSet.size;
    $: allStoresSelected =
        items.length > 0 && selectedCount === items.length;

    const sizes = {
        sm: "px-2 py-1 min-h-[2.4rem]",
        md: "px-3 py-1 min-h-[2.7rem]",
        lg: "px-4 py-2 min-h-[3.2rem]",
    };

    const multiSelectClass =
        "relative border border-gray-300 flex items-center rounded-lg gap-2 dark:border-gray-600 ring-primary-500 dark:ring-primary-500 focus-visible:outline-none";

    $: multiSelectDropdown = twMerge(
        "absolute z-50 p-3 flex flex-col gap-1 max-h-72 bg-white border border-gray-300 dark:bg-gray-700 dark:border-gray-600 start-0 top-[calc(100%+1rem)] rounded-lg cursor-pointer overflow-y-auto w-full min-w-[min(100vw-2rem,22rem)]",
    );

    const itemsClass =
        "py-2 px-3 rounded-lg text-gray-600 hover:text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-600";
    const itemsSelectClass =
        "bg-gray-100 text-black font-semibold hover:text-black dark:text-white dark:bg-gray-600 dark:hover:text-white";

    function selectOption(select: Item) {
        if (disabled) return;
        const next = selectedSet.has(select.value)
            ? selected.filter((o) => o !== select.value)
            : [...selected, select.value];
        emitChange(next);
    }

    function clearAll(e: MouseEvent) {
        if (disabled) return;
        e.stopPropagation();
        emitChange([]);
    }

    function selectAll() {
        if (disabled) return;
        emitChange(items.map((i) => i.value));
    }

    function selectNone() {
        if (disabled) return;
        emitChange([]);
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (disabled) return;
        if (event.key === "Escape" && show) {
            show = false;
            event.stopPropagation();
            event.preventDefault();
        }
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
    bind:this={root}
    on:click={() => !disabled && (show = !show)}
    on:focusout={handleFocusOut}
    on:keydown={handleKeyDown}
    tabindex="0"
    role="listbox"
    class={twMerge(
        multiSelectClass,
        sizes[size],
        $$props.class,
        !disabled &&
            "focus-within:ring-1 focus-within:border-primary-500 dark:focus-within:border-primary-500",
        disabled && "opacity-50 cursor-not-allowed",
    )}
>
    <span
        class="flex-1 min-w-0 truncate text-left text-sm text-gray-700 dark:text-gray-200"
    >
        {#if selectedCount === 0}
            <span class="text-gray-400">{placeholder}</span>
        {:else if allStoresSelected}
            All stores
        {:else}
            {selectedCount} store{selectedCount === 1 ? "" : "s"}
        {/if}
    </span>
    <div class="flex ms-auto gap-2 items-center shrink-0">
        {#if selectedCount > 0}
            <CloseButton
                {size}
                on:click={clearAll}
                color="none"
                class={twMerge(
                    "p-0 focus:ring-gray-400 dark:text-white",
                    disabled && "cursor-not-allowed",
                )}
                {disabled}
            />
        {/if}
        <div class="w-[1px] bg-gray-300 dark:bg-gray-600"></div>
        <svg
            class={twMerge(
                "cursor-pointer h-3 w-3 ms-1 text-gray-800 dark:text-white",
                disabled && "cursor-not-allowed",
            )}
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 10 6"
        >
            <path
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d={show ? "m1 5 4-4 4 4" : "m9 1-4 4-4-4"}
            />
        </svg>
    </div>

    {#if show}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div on:click|stopPropagation role="presentation" class={multiSelectDropdown}>
            <div class="flex gap-2 mb-2 sticky top-0 bg-white dark:bg-gray-700 pb-2 z-10">
                <Input
                    type="text"
                    size="sm"
                    class="flex-1"
                    placeholder="Search stores…"
                    bind:value={search}
                    autocomplete="off"
                />
                <button
                    type="button"
                    class="text-xs text-primary-600 dark:text-primary-400 whitespace-nowrap px-1"
                    on:click|stopPropagation={selectAll}
                >
                    All
                </button>
                <button
                    type="button"
                    class="text-xs text-primary-600 dark:text-primary-400 whitespace-nowrap px-1"
                    on:click|stopPropagation={selectNone}
                >
                    None
                </button>
            </div>
            {#each visibleItems as item (item.value)}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <div
                    on:click={() => selectOption(item)}
                    role="presentation"
                    class={twMerge(
                        itemsClass,
                        selectedSet.has(item.value) && itemsSelectClass,
                        disabled && "pointer-events-none",
                    )}
                >
                    {item.name}
                    {#if item.country}
                        <span class="text-xs text-gray-500 dark:text-gray-400">
                            ({item.country})</span
                        >
                    {/if}
                </div>
            {/each}
            {#if visibleItems.length === 0}
                <div class="py-2 px-3 text-sm text-gray-500">No matches</div>
            {/if}
        </div>
    {/if}
</div>
