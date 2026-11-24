<script setup lang="ts">
const emit = defineEmits<{
  dismiss: []
  openElemen: []
  startDuct: []
}>()
</script>

<template>
  <section
    id="empty-hint"
    data-testid="onboarding-hint"
    aria-label="Mulai menggambar"
    class="absolute top-3 left-3 z-17 w-[min(22rem,calc(100%-1.5rem))] bg-panel text-ink rounded-xl shadow-[0_20px_50px_-15px_rgb(0_0_0/0.55),0_0_0_1px_rgb(0_0_0/0.06)] p-4"
    @pointerdown.stop
    @contextmenu.stop
  >
    <button
      type="button"
      data-testid="hint-close"
      class="absolute top-2 right-2 size-7 grid place-items-center rounded-md text-muted hover:text-ink hover:bg-hover-tint focus-visible:outline-2 focus-visible:outline-hazard"
      aria-label="Tutup petunjuk"
      @click="emit('dismiss')"
    >
      <UIcon
        name="i-lucide-x"
        class="size-4"
        aria-hidden="true"
      />
    </button>

    <div class="field-label">
      Mulai menggambar
    </div>

    <ol class="mt-2 space-y-2.5 text-[13px] leading-snug">
      <li class="flex gap-3">
        <span class="shrink-0 grid place-items-center size-6 rounded-full bg-hazard text-ink font-bold text-xs">1</span>
        <span>Buka menu <strong>Elemen</strong> di kiri untuk memilih komponen ruangan, unit FCU, atau fitting.</span>
      </li>
      <li class="flex gap-3">
        <span class="shrink-0 grid place-items-center size-6 rounded-full bg-hazard text-ink font-bold text-xs">2</span>
        <span>Tekan <UKbd value="D" /> atau ketik <UKbd value="L" /> di baris perintah untuk mulai jalur duct.</span>
      </li>
      <li class="flex gap-3">
        <span class="shrink-0 grid place-items-center size-6 rounded-full bg-hazard text-ink font-bold text-xs">3</span>
        <span>Tekan <UKbd value="?" /> kapan saja untuk melihat seluruh pintasan keyboard.</span>
      </li>
    </ol>

    <div class="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        class="btn-primary"
        @click="emit('openElemen')"
      >
        Buka Elemen
      </button>
      <button
        type="button"
        class="btn-ghost"
        @click="emit('startDuct')"
      >
        Alat duct (D)
      </button>
    </div>
  </section>
</template>
