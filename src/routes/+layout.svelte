<script lang="ts">
    import "../app.css";
    import ToastNotifications from "$lib/ToastNotifications.svelte";

    import { onMount, onDestroy } from "svelte";

    const BOOK_EMOJIS = ["📖", "📚", "📕", "📗", "📘", "📙"];
    let confettiContainer: HTMLDivElement;
    let pendingConfetti = false;

    function spawnConfetti() {
        if (!confettiContainer) return;

        const count = 60 + Math.floor(Math.random() * 15);

        for (let i = 0; i < count; i++) {
            const el = document.createElement("span");
            el.className = "confetti-book";
            el.textContent = BOOK_EMOJIS[Math.floor(Math.random() * BOOK_EMOJIS.length)];

            const x = Math.random() * 100;
            const drift = (Math.random() - 0.5) * 180;
            const duration = 1.8 + Math.random() * 1.4;
            const delay = Math.random() * 0.4;
            const spin = (Math.random() ) * 1080;
            const size = 0.8 + Math.random();

            el.style.left = `${x}%`;
            el.style.setProperty("--drift", `${drift}px`);
            el.style.setProperty("--spin", `${spin}deg`);
            el.style.animationDuration = `${duration}s`;
            el.style.animationDelay = `${delay}s`;
            el.style.fontSize = `${size}rem`;

            confettiContainer.appendChild(el);
            setTimeout(() => el.remove(), (duration + delay) * 1000 + 100);
        }
    }

    function handleLinkClick() {
        pendingConfetti = true;
    }

    function handleVisibilityChange() {
        if (document.visibilityState === "visible" && pendingConfetti) {
            pendingConfetti = false;
            spawnConfetti();
        }
    }

    onMount(() => {
        document.addEventListener("visibilitychange", handleVisibilityChange);
    });

</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="support-banner" on:click={spawnConfetti}>
    <div class="confetti-layer" bind:this={confettiContainer}></div>
    <p>
        <span class="banner-text">Have we helped you find a book? Please help us support future development, more books, more features, and to keep us ad-free.</span>
        <a
            href="https://www.buymeacoffee.com/aamohammedc"
            target="_blank"
            rel="noopener noreferrer"
            class="support-link"
            on:click|stopPropagation={handleLinkClick}
        >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="book-icon"><path d="M6.5 2A2.5 2.5 0 0 0 4 4.5v15A2.5 2.5 0 0 0 6.5 22h13a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5H6.5a.5.5 0 0 1 0-1H19a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H6.5Z"/></svg>
            Buy us a book
        </a>
    </p>
</div>

<slot style=""></slot>
<ToastNotifications />

<style>
    .support-banner {
        background: linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #3730a3 60%, #4338ca 100%);
        padding: 0.6rem 1.25rem;
        text-align: center;
        border-bottom: 1px solid rgba(139, 92, 246, 0.3);
        position: relative;
        overflow: visible;
        cursor: pointer;
        user-select: none;
    }

    .confetti-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: visible;
        z-index: 50;
    }

    :global(.confetti-book) {
        position: absolute;
        top: 0;
        pointer-events: none;
        opacity: 0;
        animation: book-fall linear forwards;
    }

    @keyframes -global-book-fall {
        0% {
            opacity: 1;
            transform: translateY(0) translateX(0) rotate(0deg) scale(1);
        }
        75% {
            opacity: 1;
        }
        100% {
            opacity: 0;
            transform: translateY(calc(100vh - 60px)) translateX(var(--drift)) rotate(var(--spin)) scale(0.5);
        }
    }

    .support-banner p {
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 0.5rem;
        line-height: 1.6;
    }

    .banner-text {
        color: #c4b5fd;
        font-size: 0.85rem;
        font-weight: 500;
    }

    .support-link {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.25rem 0.85rem;
        background: linear-gradient(135deg, #7c3aed, #6d28d9);
        color: #ede9fe;
        font-weight: 700;
        font-size: 0.8rem;
        border-radius: 9999px;
        text-decoration: none;
        transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
        white-space: nowrap;
        box-shadow: 0 0 8px rgba(139, 92, 246, 0.3);
    }

    .support-link:hover {
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        transform: translateY(-1px);
        box-shadow: 0 0 14px rgba(139, 92, 246, 0.5);
        color: #ffffff;
    }

    :global(.book-icon) {
        width: 0.9rem;
        height: 0.9rem;
    }
</style>
