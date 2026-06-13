<script lang="ts">
    import { storeCountries } from "$lib";

    const countryLabels: Record<string, string> = {
        UK: "United Kingdom",
        NA: "North America",
        TUR: "Türkiye",
    };

    type Store = { name: string; label: string };

    const stores: Store[] = Object.entries(storeCountries).map(([name, code]) => ({
        name,
        label: countryLabels[code] ?? code,
    }));

    // Split into two rows that scroll in opposite directions for depth.
    const mid = Math.ceil(stores.length / 2);
    const rowOne = stores.slice(0, mid);
    const rowTwo = stores.slice(mid);
</script>

<div class="marquee">
    <div class="marquee__row">
        <div class="marquee__track marquee__track--left">
            {#each [...rowOne, ...rowOne] as store, i}
                <span class="pill" aria-hidden={i >= rowOne.length}>
                    <span class="pill__name">{store.name}</span>
                    <span class="pill__country">{store.label}</span>
                </span>
            {/each}
        </div>
    </div>

    <div class="marquee__row">
        <div class="marquee__track marquee__track--right">
            {#each [...rowTwo, ...rowTwo] as store, i}
                <span class="pill" aria-hidden={i >= rowTwo.length}>
                    <span class="pill__name">{store.name}</span>
                    <span class="pill__country">{store.label}</span>
                </span>
            {/each}
        </div>
    </div>
</div>

<style>
    .marquee {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        width: 100%;
        /* fade the edges so pills dissolve into the background */
        -webkit-mask-image: linear-gradient(
            to right,
            transparent,
            #000 8%,
            #000 92%,
            transparent
        );
        mask-image: linear-gradient(
            to right,
            transparent,
            #000 8%,
            #000 92%,
            transparent
        );
    }

    .marquee__row {
        overflow: hidden;
        width: 100%;
    }

    .marquee__track {
        display: flex;
        gap: 0.75rem;
        width: max-content;
        will-change: transform;
    }

    .marquee__track--left {
        animation: scroll-left 60s linear infinite;
    }

    .marquee__track--right {
        animation: scroll-right 60s linear infinite;
    }

    .marquee:hover .marquee__track {
        animation-play-state: paused;
    }

    .pill {
        display: inline-flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.5rem 1.05rem;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(8px);
        white-space: nowrap;
        transition: border-color 0.25s ease, background 0.25s ease;
    }

    .pill:hover {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.16);
    }

    .pill__name {
        color: #dcd9e4;
        font-size: 0.82rem;
        font-weight: 500;
        letter-spacing: 0.01em;
    }

    .pill__country {
        color: #807c92;
        font-size: 0.66rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.09em;
        padding-left: 0.6rem;
        border-left: 1px solid rgba(255, 255, 255, 0.1);
    }

    @keyframes scroll-left {
        from {
            transform: translateX(0);
        }
        to {
            transform: translateX(-50%);
        }
    }

    @keyframes scroll-right {
        from {
            transform: translateX(-50%);
        }
        to {
            transform: translateX(0);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .marquee__track {
            animation-duration: 180s;
        }
    }
</style>
