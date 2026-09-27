<script setup lang="ts">
if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not found' })
const states = ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'error', 'success'] as const
const classes = ['button-primary', 'button-secondary', 'filter-pill', 'kitchen-button', 'field']
const text = (state: string) => ({ loading: 'Saving…', error: 'Try again', success: 'Saved' }[state] || 'Save')
</script>
<template>
  <section class="page-section">
    <h1>Control states</h1>
    <section v-for="control in classes" :key="control" class="mt-8">
      <h2>{{ control }}</h2>
      <div class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" :class="control === 'kitchen-button' && 'bg-k-paper p-5 text-k-ink'">
        <label v-for="state in states" :key="state" class="grid gap-3"><span>{{ state }}</span>
          <input v-if="control === 'field'" :class="[control, 'is-' + state]" :data-state="state" :disabled="state === 'disabled'" :aria-invalid="state === 'error'" :aria-busy="state === 'loading'" :value="text(state)" readonly>
          <button v-else :class="[control, 'is-' + state]" :data-state="state" :disabled="state === 'disabled'" :aria-busy="state === 'loading'">{{ text(state) }}</button>
        </label>
      </div>
    </section>
  </section>
</template>
