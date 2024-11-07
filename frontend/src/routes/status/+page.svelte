<script lang="ts">
    import type { PageData } from "./$types";

    export let data: PageData;
    const { status, ...props } = data.props;

    function timeSince(ts: string): string {
        const diff = Date.now() - new Date(ts + 'Z').getTime();
        return `${Math.floor(diff / 3.6e6)}:${Math.floor((diff % 3.6e6) / 6e4).toString().padStart(2, '0')}`;
    }


</script>

<div class="flex flex-col items-center dark:text-white">
    <h1 class="m-6 text-2xl font-bold dark:text-white">Scraper Status: {status}</h1>
</div>

<div class="flex flex-wrap dark:text-white mx-auto w-2/3">
    {#each Object.entries(props) as [key, value]}
        <div class="m-6 w-1/4 bg-gray-800 p-4 rounded-lg">
            <h1 class="text-lg font-bold">{key}</h1>
            <p class="text-sm mt-2">Error: <span class={value.error ? 'text-red-500 font-bold' : 'text-green-500 font-bold'}>{value.error}</span></p>
            <p class="text-sm mt-2">Last updated: <span class="">{timeSince(value.last_crawled)} ago</span></p>
            <p class="text-sm mt-2">Total books: <span class="">{value.total_books}</span></p>
        </div>
    {/each}

</div>

