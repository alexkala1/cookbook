<template>
  <div class="kitchen-shell min-h-screen bg-stone-950 text-stone-50">
    <header class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6">
      <span class="font-serif text-2xl">Heirloom / Kitchen</span>
      <NuxtLink :to="'/recipes/' + $route.params.id" class="rounded border border-stone-500 px-5 py-3 text-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
        Exit kitchen
      </NuxtLink>
    </header>
    <main id="main-content" tabindex="-1" class="mx-auto max-w-5xl px-6 py-10 text-2xl leading-relaxed sm:text-3xl">
      <slot />
    </main>
  </div>
</template>

<style>
.kitchen-shell { overflow-wrap: anywhere; }
.kitchen-step { font-size: clamp(2rem, 4vw, 3rem); line-height: 1.5; overflow-wrap: anywhere; }
.kitchen-panel { margin-top: 2rem; border-top: 1px solid #57534e; padding-top: 1.5rem; }
.kitchen-button { min-height: 48px; border: 1px solid #a8a29e; border-radius: .65rem; padding: .65rem 1rem; background: #292524; color: #fafaf9; font-size: 1.125rem; line-height: 1.5; cursor: pointer; }
.kitchen-button:disabled { opacity: .45; cursor: default; }
.kitchen-button:focus-visible, .kitchen-input:focus-visible, .rescue-trigger:focus-visible { outline: 3px solid #fde68a; outline-offset: 3px; }
.kitchen-input { display: block; width: 100%; border: 1px solid #a8a29e; border-radius: .5rem; background: #292524; color: white; padding: .65rem; font-size: 1.125rem; }
.rescue-trigger { position: fixed; bottom: 1.25rem; right: 1.25rem; z-index: 20; border: 2px solid #fecaca; border-radius: 1rem; background: #991b1b; color: white; padding: .85rem 1.2rem; font-size: 1.25rem; font-weight: 700; box-shadow: 0 3px 15px #0008; }
.rescue-drawer { position: fixed; inset: 0 0 0 auto; margin: 0; width: min(100%, 42rem); height: 100dvh; max-height: 100dvh; max-width: 100%; padding: 1.5rem; overflow-y: auto; background: #1c1917; color: #fafaf9; }
.rescue-drawer::backdrop { background: #000b; }
</style>
