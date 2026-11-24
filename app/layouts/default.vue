<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <div class="min-h-dvh flex flex-col bg-paper text-ink">
    <header class="relative bg-panel border-b border-line">
      <div class="tape h-[3px] w-full" />
      <div class="max-w-6xl mx-auto px-4 py-2.5 sm:h-14 sm:py-0 flex flex-wrap items-center gap-3">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 rounded-[6px] focus-visible:outline-2 focus-visible:outline-hazard focus-visible:outline-offset-2"
        >
          <span
            class="grid place-items-center size-8 rounded-[6px] bg-ink shrink-0"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              class="size-5"
              fill="none"
              stroke="#f2c200"
              stroke-width="2.2"
            >
              <path d="M3 6h7a8 8 0 0 1 8 8v7M3 12h7a2 2 0 0 1 2 2v7" />
            </svg>
          </span>
          <span class="font-cond font-bold text-xl tracking-wide leading-none">TEMANDOR</span>
        </NuxtLink>

        <span class="hidden sm:block text-muted text-sm border-l border-line pl-3">
          Sketsa ducting &amp; ventilasi
        </span>

        <nav
          aria-label="Navigasi utama"
          class="ml-auto flex items-center gap-2"
        >
          <NuxtLink
            to="/proyek"
            class="btn-ghost max-sm:min-h-11"
            :aria-current="route.path === '/proyek' ? 'page' : undefined"
          >
            Proyek
          </NuxtLink>
          <NuxtLink
            to="/docs"
            class="btn-ghost max-sm:min-h-11"
            :aria-current="route.path === '/docs' ? 'page' : undefined"
          >
            Docs
          </NuxtLink>
        </nav>
      </div>
    </header>

    <main class="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-10">
      <slot />
    </main>

    <footer class="border-t border-line">
      <div class="max-w-6xl mx-auto px-4 py-3 text-xs text-muted flex flex-wrap items-center justify-between gap-2">
        <span>Temandor · Sketsa bantu 2D jalur ducting, data tersimpan lokal di browser.</span>
        <NuxtLink
          to="/docs"
          class="underline underline-offset-2 text-ink"
        >
          Dokumentasi
        </NuxtLink>
      </div>
    </footer>
  </div>
</template>
