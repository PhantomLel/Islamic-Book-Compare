<script lang="ts">
    import { Pagination } from 'flowbite-svelte';
    import { page } from '$app/stores';
    import ArrowLeftOutline from 'flowbite-svelte-icons/ArrowLeftOutline.svelte';
    import ArrowRightOutline from 'flowbite-svelte-icons/ArrowRightOutline.svelte';
    import { goto } from '$app/navigation';
    import { createEventDispatcher } from 'svelte';

    export let helper: {
        start: number;
        end: number;
        total: number;
    };

    export let pageNum: number;


    const setPage = (page: number) => {
      let query = new URLSearchParams($page.url.searchParams.toString());
      query.set("page", page.toString());

      goto(`?${query.toString()}`, {
          keepFocus: true, // Keep focus on the input field
      });
    }

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
  
    <Pagination table large>
      <button
        disabled={pageNum === 1}
        on:click={() => setPage(pageNum- 1 < 1 ? 1 : (pageNum-1))  } slot="prev" class="flex items-center gap-2 text-white bg-gray-800 ">
        <ArrowLeftOutline class="w-3.5 h-3.5 me-2" />
        Prev
      </button>
      <button 
        disabled={helper.end === helper.total}
        on:click={() => setPage(pageNum + 1 > helper.end ? pageNum : (pageNum + 1))} slot="next" class="flex items-center gap-2 text-white bg-gray-800">
        Next
        <ArrowRightOutline class="w-6 h-6 me-2" />
      </button>
    </Pagination>
  </div>