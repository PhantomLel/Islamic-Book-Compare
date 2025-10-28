<script lang="ts">
    import { notifications } from "./notifications";
    import BookOutline from "flowbite-svelte-icons/BookOutline.svelte";
    $: notificationList = $notifications;
</script>

{#if notificationList.length > 0}
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {#each notificationList as notification (notification.id)}
            <div
                role="button"
                tabindex="0"
                class="flex items-center gap-3 bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg min-w-[300px] max-w-md animate-slide-in cursor-pointer"
                on:click={() => notifications.remove(notification.id)}
                on:keydown={(e) => e.key === 'Enter' && notifications.remove(notification.id)}
            >
                {#if notification.type === "success"}
                <BookOutline class="shrink-0 h-6 w-6 text-purple-500" />
                {:else if notification.type === "error"}
                    <svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                    </svg>
                {:else}
                    <svg class="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                    </svg>
                {/if}
                <p class="flex-1 text-sm">{notification.message}</p>
            </div>
        {/each}
    </div>
{/if}

<style>
    @keyframes slide-in {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .animate-slide-in {
        animation: slide-in 0.3s ease-out;
    }
</style>

