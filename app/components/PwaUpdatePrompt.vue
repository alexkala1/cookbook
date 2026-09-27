<script setup lang="ts">
const { $pwa } = useNuxtApp()
const route = useRoute()
// Keep update actions out of Kitchen Mode; explicit reload is offered after exiting.
const cooking = computed(() => /^\/recipes\/[^/]+\/cook\/?$/.test(route.path))
</script>
<template>
  <div v-if="$pwa?.needRefresh && !cooking" class="pwa-update flex flex-wrap items-center justify-center gap-3 border-b border-rule bg-paper px-4 text-ink" role="status">
    <span>A new version is ready</span><button class="text-action" @click="$pwa.updateServiceWorker()">Reload</button><button class="text-action" @click="$pwa.cancelPrompt()">Later</button>
  </div>
</template>
<style scoped>
@media print { .pwa-update { display: none; } }
</style>
