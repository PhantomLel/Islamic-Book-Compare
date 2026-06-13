<script lang="ts">
    import Pagination from "flowbite-svelte/Pagination.svelte";
    import { page } from '$app/stores';
    import ArrowLeftOutline from 'flowbite-svelte-icons/ArrowLeftOutline.svelte';
    import ArrowRightOutline from 'flowbite-svelte-icons/ArrowRightOutline.svelte';
    import { goto } from '$app/navigation';

    export let helper: {
        start: number;
        end: number;
        total: number;
    };

    export let pageNum: number;
    export let show: number = 15;

    const setPage = (p: number) => {
        let query = new URLSearchParams($page.url.searchParams.toString());
        query.set("page", p.toString());
        goto(`?${query.toString()}`, { keepFocus: true });
    };

    const setShow = (value: number) => {
        let query = new URLSearchParams($page.url.searchParams.toString());
        query.set("show", value.toString());
        query.set("page", "1");
        goto(`?${query.toString()}`, { keepFocus: true });
    };
</script>

<div class="flex flex-col items-center justify-center gap-2">
    <div class="text-sm text-gray-400">
        Showing <span class="font-semibold text-white">{helper.start}</span>
        to
        <span class="font-semibold text-white">{helper.end}</span>
        of
        <span class="font-semibold text-white">{helper.total}</span>
        Entries
    </div>

    <div class="flex items-center gap-2">
        <Pagination table large>
            <button
                disabled={pageNum === 1}
                on:click={() => setPage(pageNum - 1 < 1 ? 1 : pageNum - 1)}
                slot="prev"
                class="flex items-center gap-2 text-white bg-gray-800"
            >
                <ArrowLeftOutline class="w-3.5 h-3.5 me-2" />
                Prev
            </button>
            <button
                disabled={helper.end === helper.total}
                on:click={() => setPage(pageNum + 1 > helper.end ? pageNum : pageNum + 1)}
                slot="next"
                class="flex items-center gap-2 text-white bg-gray-800"
            >
                Next
                <ArrowRightOutline class="w-6 h-6 me-2" />
            </button>
        </Pagination>

        <select
            value={show}
            on:change={(e) => setShow(parseInt(e.currentTarget.value))}
            class="text-base text-white bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            title="Results per page"
        >
            <option value={15}>15</option>
            <option value={45}>45</option>
            <option value={75}>75</option>
        </select>
    </div>
</div>