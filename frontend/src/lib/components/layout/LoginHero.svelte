<script lang="ts">
  import { browser } from '$app/environment';
  import { cubicOut } from 'svelte/easing';
  import { fade, fly } from 'svelte/transition';
  import type { LoginLibraryItem, LoginPrinciple } from '$lib/auth/login-view';
  import { attachHeroEnhancement } from '$lib/utils/motion-adapter';

  interface Props {
    principles: readonly LoginPrinciple[];
    animationLibraries: readonly LoginLibraryItem[];
  }

  const MOTION = {
    base: 180,
    stagger: 40,
  } as const;

  const prefersReducedMotion =
    browser && typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  const motionDuration = prefersReducedMotion ? 0 : MOTION.base;

  let { principles, animationLibraries }: Props = $props();
</script>

<aside
  class="hero-panel"
  use:attachHeroEnhancement={{ enabled: false }}
  in:fly={{ y: 10, duration: motionDuration, easing: cubicOut }}
>
  <div class="hero-content">
    <p class="eyebrow">Effinsty Frontend</p>
    <h1>Animated Svelte login tuned for 2026 standards.</h1>
    <p class="hero-copy">
      Svelte 5 with Runes keeps motion lightweight and responsive. This screen uses subtle interaction
      patterns focused on clarity, speed, and accessibility.
    </p>

    <div class="principle-grid" aria-label="Motion principles">
      {#each principles as principle, index (index)}
        <span class="chip" in:fade={{ duration: motionDuration, delay: MOTION.stagger * index, easing: cubicOut }}>
          {principle}
        </span>
      {/each}
    </div>

    <ul class="library-list" aria-label="Animation libraries">
      {#each animationLibraries as item, index (item.name)}
        <li
          class="library-card"
          in:fly={{
            y: 8,
            duration: motionDuration,
            delay: MOTION.stagger * (index + 1),
            easing: cubicOut,
          }}
        >
          <a href={item.href} target="_blank" rel="noopener noreferrer">{item.name}</a>
          <p>{item.summary}</p>
        </li>
      {/each}
    </ul>
  </div>
</aside>

<style>
  .hero-panel {
    position: relative;
    overflow: hidden;
    border-bottom: 1px solid hsl(var(--border));
    background: linear-gradient(145deg, hsl(var(--card)), hsl(var(--card) / 0.88));
  }

  .hero-panel::before {
    content: "";
    position: absolute;
    width: 24rem;
    height: 24rem;
    right: -7rem;
    bottom: -8rem;
    border-radius: 999px;
    background: radial-gradient(circle, hsl(var(--primary) / 0.2), transparent 70%);
    filter: blur(10px);
    animation: pulseGlow 6s var(--motion-ease-standard) infinite;
    pointer-events: none;
  }

  .hero-content {
    position: relative;
    display: grid;
    gap: 1rem;
    padding: clamp(1.2rem, 4vw, 2.4rem);
  }

  @keyframes pulseGlow {
    0%,
    100% {
      opacity: 0.6;
      transform: scale(1);
    }

    50% {
      opacity: 1;
      transform: scale(1.05);
    }
  }

  .eyebrow {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: hsl(var(--foreground) / 0.7);
  }

  h1 {
    margin: 0;
    line-height: 1.2;
    letter-spacing: -0.02em;
    font-size: clamp(1.35rem, 4vw, 2.2rem);
  }

  .hero-copy {
    margin: 0;
    color: hsl(var(--foreground) / 0.8);
    line-height: 1.5;
  }

  .principle-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .chip {
    border-radius: 999px;
    border: 1px solid hsl(var(--border));
    padding: 0.38rem 0.66rem;
    font-size: 0.78rem;
    background: hsl(var(--card) / 0.95);
  }

  .library-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.72rem;
  }

  .library-card {
    border: 1px solid hsl(var(--border));
    border-radius: calc(var(--radius) - 2px);
    padding: 0.75rem;
    background: hsl(var(--card) / 0.96);
    box-shadow: var(--shadow-sm);
    transition:
      transform var(--motion-fast) var(--motion-ease-standard),
      box-shadow var(--motion-fast) var(--motion-ease-standard);
  }

  .library-card:hover,
  .library-card:focus-within {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .library-card a {
    color: hsl(var(--primary));
    font-weight: 700;
    text-decoration: none;
  }

  .library-card a:hover,
  .library-card a:focus-visible {
    text-decoration: underline;
  }

  .library-card p {
    margin: 0.35rem 0 0;
    font-size: 0.9rem;
    line-height: 1.4;
    color: hsl(var(--foreground) / 0.78);
  }

  @media (min-width: 1024px) {
    .hero-panel {
      border-bottom: none;
      border-right: 1px solid hsl(var(--border));
    }

    .hero-content {
      max-width: 44rem;
      margin-inline: auto;
      align-content: center;
      min-height: 100vh;
      padding-inline: clamp(2rem, 5vw, 4rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-panel::before {
      animation: none;
    }

    .library-card {
      transition: none;
    }
  }
</style>
