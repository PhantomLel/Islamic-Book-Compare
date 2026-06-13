<script lang="ts">
    import Button from "flowbite-svelte/Button.svelte";
    import type { PageData } from "./$types";
    import GithubSolid from "flowbite-svelte-icons/GithubSolid.svelte";
    import CoffeeIcon from "./search/CoffeeIcon.svelte";
    import SearchBar from "$lib/SearchBar.svelte";
    import StoreMarquee from "$lib/landing/StoreMarquee.svelte";
    import ExampleSearches from "$lib/landing/ExampleSearches.svelte";
    import { storeCountries } from "$lib";

    export let data: PageData;

    const storeCount = Object.keys(storeCountries).length;
    const countryCount = new Set(Object.values(storeCountries)).size;

    $: formattedTotal = data.props.total
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
</script>

<title>Islamic Book Search</title>

<div class="hero" style="background-image: url('/landing.webp');">
    <div class="hero__overlay"></div>

    <!-- Top bar -->
    <header class="hero__topbar">
        <a
            href="https://www.buymeacoffee.com/aamohammedc"
            target="_blank"
            rel="noopener noreferrer"
        >
            <Button size="sm" class="hover:text-white transition-colors duration-200">
                <CoffeeIcon className="w-4 h-4 mr-2 text-white" />
                Support
            </Button>
        </a>
        <Button
            size="sm"
            class="hover:text-white transition-colors duration-200"
            href="https://github.com/PhantomLel/Islamic-Book-Compare"
            target="_blank"
            rel="noopener noreferrer"
        >
            <GithubSolid class="w-4 h-4 mr-2" />
            GitHub
        </Button>
    </header>

    <!-- Hero content -->
    <main class="hero__main">

        <h1 class="hero__title">Islamic Book Search</h1>

        <div class="ornament" aria-hidden="true"></div>

        <p class="hero__subtitle">
            Track down rare and hard&#8209;to&#8209;find Islamic books across
            <span class="hero__highlight">{formattedTotal}</span> titles, then
            compare prices from {storeCount} stores side by side.
        </p>

        <div class="hero__search">
            <SearchBar mode="hero" />
        </div>

        <ExampleSearches />
    </main>

    <!-- Stores marquee -->
    <footer class="hero__footer">
        <p class="footer__caption">
            {storeCount} bookstores &middot; {countryCount} countries
        </p>
        <StoreMarquee />
    </footer>
</div>

<style>
    .hero {
        position: relative;
        min-height: 100dvh;
        background-size: cover;
        background-position: center;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    /* Neutral darkening + edge vignette so the maze recedes and text stays
       legible. No coloured glow — let the navy speak for itself. */
    .hero__overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
            linear-gradient(
                180deg,
                rgba(13, 13, 24, 0.4) 0%,
                rgba(13, 13, 24, 0.28) 42%,
                rgba(13, 13, 24, 0.82) 100%
            ),
            radial-gradient(
                ellipse 120% 80% at 50% 45%,
                transparent 55%,
                rgba(8, 8, 16, 0.55) 100%
            );
    }

    .hero__topbar {
        position: relative;
        z-index: 10;
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding: 1.25rem 1.5rem 0;
    }

    .hero__main {
        position: relative;
        z-index: 10;
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 2rem 1.25rem;
    }

    .eyebrow {
        color: #8a86a0;
        font-size: 0.7rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.34em;
        margin-bottom: 1.35rem;
    }

    .hero__title {
        font-family: "Cormorant Garamond", Georgia, serif;
        font-weight: 500;
        font-size: clamp(2.5rem, 6vw, 4.25rem);
        line-height: 1.05;
        letter-spacing: 0.005em;
        color: #f3f1ec;
        margin: 0;
    }

    /* A single restrained hairline rule — no glow, no diamond. */
    .ornament {
        width: 3.5rem;
        height: 1px;
        margin: 1.4rem 0 1.6rem;
        background: rgba(243, 241, 236, 0.22);
    }

    .hero__subtitle {
        max-width: 38rem;
        color: #b4afc2;
        font-size: clamp(0.95rem, 2vw, 1.08rem);
        font-weight: 300;
        line-height: 1.7;
        margin: 0 auto 2.5rem;
    }

    .hero__highlight {
        color: #f3f1ec;
        font-weight: 500;
    }

    .hero__search {
        width: 100%;
    }

    .hero__footer {
        position: relative;
        z-index: 10;
        padding-bottom: 1.75rem;
    }

    .footer__caption {
        text-align: center;
        color: #6f6b82;
        font-size: 0.68rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        margin-bottom: 1.1rem;
    }
</style>
