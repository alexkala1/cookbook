<script setup lang="ts">
import { marked } from 'marked'
import guide from '../../docs/USER_GUIDE.md?raw'

useSeoMeta({ title: "Cook's Handbook — Heirloom", description: 'A practical guide to your cookbook, Kitchen Mode, dinner planning, pantry and guests.' })
// Only the reviewed, repository-owned handbook is rendered here; never user input.
const renderer = new marked.Renderer()
renderer.heading = function ({ depth, tokens, text }) {
  const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `<h${depth} id="${id}" tabindex="-1">${this.parser.parseInline(tokens)}</h${depth}>`
}
const handbook = marked.parse(guide, { async: false, renderer })
</script>

<template>
  <section class="page-section mx-auto max-w-4xl">
    <NuxtLink to="/settings" class="button-secondary mb-8">Back to Settings</NuxtLink>
    <article class="handbook" aria-label="Cook's Handbook" v-html="handbook" />
    <a href="#cook-s-handbook" class="button-secondary mt-10">Back to top</a>
  </section>
</template>

<style scoped>
.handbook { color: var(--color-ink); line-height: 1.75; overflow-wrap: anywhere; }
.handbook :deep(h1), .handbook :deep(h2), .handbook :deep(h3) { font-style: normal; scroll-margin-top: 5rem; }
.handbook :deep(h2) { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--color-rule); }
.handbook :deep(h3) { margin-top: 2rem; }
.handbook :deep(p), .handbook :deep(ul), .handbook :deep(ol), .handbook :deep(table), .handbook :deep(pre), .handbook :deep(blockquote) { margin-top: 1.25rem; }
.handbook :deep(ul), .handbook :deep(ol) { padding-left: 1.5rem; }
.handbook :deep(ul) { list-style: disc; }
.handbook :deep(ol) { list-style: decimal; }
.handbook :deep(li) { margin-top: .5rem; }
.handbook :deep(a) { display: inline-flex; align-items: center; min-height: 44px; color: var(--color-ink); text-decoration: underline; text-underline-offset: .2em; }
.handbook :deep(a:hover) { background: var(--color-paper-2); }
.handbook :deep(a:active) { background: var(--color-paper-3); }
.handbook :deep(em) { font-style: normal; font-weight: 600; }
.handbook :deep(blockquote) { border-left: 3px solid var(--color-sage-ink); padding: .25rem 1.25rem; background: var(--color-paper-2); }
.handbook :deep(table) { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: .9375rem; }
.handbook :deep(th), .handbook :deep(td) { border-bottom: 1px solid var(--color-rule); padding: .75rem .5rem; text-align: left; vertical-align: top; }
.handbook :deep(th) { background: var(--color-paper-2); font-weight: 600; }
.handbook :deep(pre) { padding: 1rem; background: var(--color-paper-2); border: 1px solid var(--color-rule); border-radius: .5rem; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .875rem; }
.handbook :deep(code) { font-size: .9em; }
@media (max-width: 480px) {
  .handbook :deep(table) { font-size: .8125rem; }
  .handbook :deep(th), .handbook :deep(td) { padding: .6rem .3rem; }
}
</style>
