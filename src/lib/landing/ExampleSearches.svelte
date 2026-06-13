<script lang="ts">
    import { goto } from "$app/navigation";

    type Example = { label: string; query: string; lang: "ar" | "en" };

    // A curated mix of celebrated and harder-to-find titles, in both scripts.
    const examples: Example[] = [
        { label: "فتح الباري", query: "فتح الباري", lang: "ar" },
        { label: "Bulugh al-Maram", query: "bulugh al-maram", lang: "en" },
        { label: "سير أعلام النبلاء", query: "سير أعلام النبلاء", lang: "ar" },
        { label: "Riyad as-Salihin", query: "riyad us-saliheen", lang: "en" },
        { label: "المحلى بالآثار", query: "المحلى بالآثار", lang: "ar" },
        { label: "Tafsir Ibn Kathir", query: "tafsir ibn kathir", lang: "en" },
        { label: "زاد المعاد", query: "زاد المعاد", lang: "ar" },
    ];

    function runSearch(query: string) {
        const params = new URLSearchParams({
            search: query,
            instock: "true",
            sort: "rel",
        });
        goto(`/search?${params.toString()}`);
    }
</script>

<div class="examples">
    <span class="examples__label">Start with</span>
    <div class="examples__chips">
        {#each examples as ex}
            <button
                type="button"
                class="chip"
                class:chip--ar={ex.lang === "ar"}
                dir={ex.lang === "ar" ? "rtl" : "ltr"}
                lang={ex.lang}
                on:click={() => runSearch(ex.query)}
            >
                {ex.label}
            </button>
        {/each}
    </div>
</div>

<style>
    .examples {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.85rem;
        margin-top: 1.75rem;
    }

    .examples__label {
        color: #7c7890;
        font-size: 0.68rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.22em;
    }

    .examples__chips {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.6rem;
        max-width: 46rem;
    }

    .chip {
        padding: 0.4rem 1.05rem;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        color: #cbc7d6;
        font-size: 0.88rem;
        font-weight: 500;
        cursor: pointer;
        backdrop-filter: blur(8px);
        transition: background 0.2s ease, border-color 0.2s ease,
            color 0.2s ease, transform 0.1s ease;
    }

    .chip--ar {
        font-family: "Amiri", serif;
        font-size: 1.1rem;
        line-height: 1;
    }

    .chip:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.22);
        color: #f3f1ec;
    }

    .chip:active {
        transform: translateY(1px);
    }

    .chip:focus-visible {
        outline: none;
        border-color: rgba(255, 255, 255, 0.4);
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.18);
    }
</style>
