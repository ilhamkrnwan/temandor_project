<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const isNotFound = computed(() => props.error?.statusCode === 404)
const customMessage = computed(() => {
  const msg = props.error?.message?.trim()
  if (!msg || msg.startsWith('Page not found')) return null
  return msg
})

useHead(() => ({
  htmlAttrs: { lang: 'id' },
  title: isNotFound.value ? 'Halaman tidak ditemukan · Temandor' : 'Terjadi kesalahan · Temandor',
  meta: [
    {
      name: 'description',
      content: 'Halaman yang diminta tidak ditemukan atau terjadi gangguan sementara di Temandor.',
    },
  ],
}))

function goTo(path: string) {
  clearError({ redirect: path })
}
</script>

<template>
  <div class="min-h-dvh flex flex-col bg-cad-ground text-card font-sans text-[15px]">
    <div class="tape h-[3px] w-full shrink-0" />
    <main class="flex-1 grid place-items-center px-6 py-16">
      <div class="max-w-md w-full">
        <svg
          viewBox="0 0 240 120"
          width="240"
          height="120"
          class="w-60 h-30 text-card/75"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path
            d="M8 40h120M8 80h120"
            stroke="#4ea1ff"
          />
          <path
            d="M128 40v40"
            stroke="#4ea1ff"
            stroke-dasharray="4 4"
          />
          <circle
            cx="170"
            cy="60"
            r="16"
            stroke="#f87171"
          />
          <path
            d="M170 50v12M170 68v1"
            stroke="#f87171"
            stroke-width="2.5"
            stroke-linecap="round"
          />
          <text
            x="8"
            y="108"
            fill="currentColor"
            stroke="none"
            font-size="12"
            font-family="JetBrains Mono, monospace"
          >
            UJUNG TERBUKA
          </text>
        </svg>

        <h1 class="mt-8 font-cond font-bold text-4xl sm:text-5xl leading-none text-card">
          {{ isNotFound ? 'Jalurnya putus di sini' : 'Terjadi kesalahan' }}
        </h1>
        <p class="mt-3 text-card/80 leading-relaxed">
          {{ customMessage
            ?? (isNotFound
              ? 'Halaman yang kamu cari tidak ada atau sudah dipindah. Proyekmu tetap aman di browser ini.'
              : 'Aplikasi mengalami kendala saat membuka halaman ini. Proyekmu tetap aman di browser ini.') }}
        </p>

        <div class="mt-8 flex flex-wrap gap-2.5">
          <a
            href="/proyek"
            class="btn-primary h-10! px-5! max-sm:min-h-11"
            @click.prevent="goTo('/proyek')"
          >
            Ke daftar proyek
          </a>
          <a
            href="/docs"
            class="btn-ghost h-10! px-5! max-sm:min-h-11 text-card! shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)]! hover:bg-white/10!"
            @click.prevent="goTo('/docs')"
          >
            Buka dokumentasi
          </a>
        </div>
      </div>
    </main>
  </div>
</template>
