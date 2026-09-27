<script setup lang="ts">
import { allergyOptions, dietaryOptions, type Guest, type DietaryAudit } from '#shared/culinary/dietary'
import type { Recipe } from '#shared/types/recipe'
const { data: guests, error: guestError, refresh } = await useFetch<Guest[]>('/api/guests')
const { data: recipes, error: recipeError, refresh: refreshRecipes } = await useFetch<Recipe[]>('/api/recipes')
const form = reactive({ id: '', name: '', allergies: [] as string[], dietaryRestrictions: [] as string[], dislikes: '', notes: '', otherAllergies: '', otherRestrictions: '' })
const busy = ref(false), error = ref(''), notice = ref(''), deleting = ref(''), nameInput = ref<HTMLInputElement>()
const { state, label } = useActionFeedback(busy, error)
let noticeTimer: ReturnType<typeof setTimeout> | undefined
watch(notice, () => { clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.value = '' }, 2000) })
onBeforeUnmount(() => clearTimeout(noticeTimer))
const selectedGuests = ref<string[]>([]), selectedRecipes = ref<string[]>([]), audit = ref<DietaryAudit | null>(null)
watch([selectedGuests, selectedRecipes], () => { audit.value = null }, { deep: true })
function words(value: string) { return value.split(',').map(item => item.trim()).filter(Boolean) }
function reset() { Object.assign(form, { id: '', name: '', allergies: [], dietaryRestrictions: [], dislikes: '', notes: '', otherAllergies: '', otherRestrictions: '' }) }
async function edit(guest: Guest) {
  Object.assign(form, { id: guest.id, name: guest.name, allergies: guest.allergies.filter(item => (allergyOptions as readonly string[]).includes(item)), dietaryRestrictions: guest.dietaryRestrictions.filter(item => (dietaryOptions as readonly string[]).includes(item)), dislikes: guest.dislikes.join(', '), notes: guest.notes ?? '', otherAllergies: guest.allergies.filter(item => !(allergyOptions as readonly string[]).includes(item)).join(', '), otherRestrictions: guest.dietaryRestrictions.filter(item => !(dietaryOptions as readonly string[]).includes(item)).join(', ') })
  await nextTick(); nameInput.value?.focus()
}
async function act(task: () => Promise<void>) {
  busy.value = true; error.value = ''; notice.value = ''
  try { await task() } catch (cause) { error.value = (cause as { data?: { statusMessage?: string } }).data?.statusMessage || 'Could not complete this action. Try again.' } finally { busy.value = false }
}
function save() { void act(async () => {
  await $fetch('/api/guests', { method: 'POST', body: { ...(form.id ? { id: form.id } : {}), name: form.name, allergies: [...form.allergies, ...words(form.otherAllergies)], dietaryRestrictions: [...form.dietaryRestrictions, ...words(form.otherRestrictions)], dislikes: words(form.dislikes), notes: form.notes } })
  reset(); audit.value = null; await refresh(); notice.value = 'Guest profile saved.'
}) }
function remove(id: string) { void act(async () => { await $fetch('/api/guests/' + id, { method: 'DELETE' }); selectedGuests.value = selectedGuests.value.filter(value => value !== id); audit.value = null; deleting.value = ''; if (form.id === id) reset(); await refresh() }) }
function check() { void act(async () => { audit.value = null; audit.value = await $fetch<DietaryAudit>('/api/meal-plan/dietary-audit', { method: 'POST', body: { recipeIds: selectedRecipes.value, guestIds: selectedGuests.value } }) }) }
useSeoMeta({ title: 'Guests & dietary checks — Heirloom' })
</script>
<template>
  <section class="page-section">
    <h1 class="mt-3">Guests & dietary checks</h1><p class="mt-4 max-w-2xl">Remember preferences, flag ingredient conflicts, and plan with care.</p>
    <p v-if="error" role="alert" class="notice mt-4">{{ error }}</p><p v-if="notice" role="status" class="notice mt-4">{{ notice }}</p>
    <form class="row-panel my-8 space-y-5" aria-label="Guest profile" @submit.prevent="save">
      <h2>{{ form.id ? 'Edit guest' : 'Add a guest' }}</h2><label class="block">Name<input ref="nameInput" v-model="form.name" class="field" required maxlength="200"></label>
      <fieldset><legend class="font-semibold">Allergies</legend><div class="mt-3 flex flex-wrap gap-x-6 gap-y-3"><label v-for="allergy in allergyOptions" :key="allergy" class="flex items-center gap-2 capitalize"><input v-model="form.allergies" type="checkbox" :value="allergy">{{ allergy }}</label></div><label class="mt-3 block">Other allergies (comma separated)<input v-model="form.otherAllergies" class="field" maxlength="1000"></label></fieldset>
      <fieldset><legend class="font-semibold">Dietary requirements</legend><div class="mt-3 flex flex-wrap gap-x-6 gap-y-3"><label v-for="diet in dietaryOptions" :key="diet" class="flex items-center gap-2 capitalize"><input v-model="form.dietaryRestrictions" type="checkbox" :value="diet">{{ diet }}</label></div><label class="mt-3 block">Other requirements (comma separated)<input v-model="form.otherRestrictions" class="field" maxlength="1000"></label></fieldset>
      <label class="block">Dislikes (comma separated)<input v-model="form.dislikes" class="field" maxlength="1000" placeholder="cilantro, liver, okra"></label><label class="block">Notes<textarea v-model="form.notes" class="field" rows="3" maxlength="5000" /></label>
      <div class="flex flex-wrap gap-3"><button class="button-primary" v-stable-action="state" :data-state="state" :aria-busy="busy" :disabled="busy">{{ label(form.id ? 'Save changes' : 'Save guest', 'Saving…') }}</button><button v-if="form.id" type="button" class="button-secondary" :disabled="busy" @click="reset">Cancel edit</button></div>
    </form>
    <p v-if="guestError" role="alert" class="notice">Guest profiles unavailable. <button class="text-action" @click="refresh()">Retry guests</button></p>
    <p v-else-if="!guests?.length" class="empty-state">Add someone you love cooking for.</p>
    <div class="grid gap-4 sm:grid-cols-2">
      <article v-for="guest in guests" :key="guest.id" class="row-panel min-w-0 break-words">
        <h2>{{ guest.name }}</h2><div class="my-3 flex flex-wrap gap-2"><span v-for="allergy in guest.allergies" :key="allergy" class="rounded border border-terracotta px-2 py-1 text-sm">Allergy · {{ allergy }}</span><span v-for="diet in guest.dietaryRestrictions" :key="diet" class="rounded border border-sage px-2 py-1 text-sm">{{ diet }}</span></div>
        <p v-if="guest.dislikes.length">Avoids: {{ guest.dislikes.join(', ') }}</p><p v-if="guest.notes" class="mt-2 whitespace-pre-line">{{ guest.notes }}</p><p v-for="warning in guest.profileWarnings" :key="warning" class="notice mt-2">{{ warning }}</p>
        <div class="mt-4 flex flex-wrap gap-4"><button class="text-action" :disabled="busy" :aria-label="'Edit ' + guest.name" @click="edit(guest)">Edit</button><button class="text-action" :disabled="busy" :aria-label="'Delete ' + guest.name" @click="deleting = guest.id">Delete</button></div>
        <div v-if="deleting === guest.id" class="notice mt-3"><p>Delete this guest profile?</p><button class="text-action mr-5" :disabled="busy" @click="remove(guest.id)">Confirm delete</button><button class="text-action" @click="deleting = ''">Keep guest</button></div>
      </article>
    </div>
    <section class="mt-12 border-t border-espresso/20 pt-8" aria-label="Dietary audit">
      <h2>Check a meal for your guests</h2><p class="my-4">Choose up to 20 guests and 20 recipes. This ingredient-name check cannot certify a meal as safe.</p>
      <p v-if="recipeError" role="alert" class="notice">Recipes unavailable. <button class="text-action" @click="refreshRecipes()">Retry recipes</button></p>
      <form class="space-y-5" @submit.prevent="check"><fieldset class="row-panel"><legend>Guests attending</legend><label v-for="guest in guests" :key="guest.id" class="my-2 flex items-start gap-3"><input v-model="selectedGuests" type="checkbox" :value="guest.id" :disabled="busy">{{ guest.name }}</label></fieldset>
        <fieldset class="row-panel"><legend>Planned recipes</legend><p v-if="!recipes?.length">Save a recipe in your cookbook first.</p><label v-for="recipe in recipes" :key="recipe.id" class="my-2 flex items-start gap-3"><input v-model="selectedRecipes" type="checkbox" :value="recipe.id" :disabled="busy">{{ recipe.title }}</label></fieldset>
        <button class="button-primary" v-stable-action="state" :data-state="state" :aria-busy="busy" :disabled="busy || !selectedGuests.length || !selectedRecipes.length || selectedGuests.length > 20 || selectedRecipes.length > 20">{{ label('Audit meal') }}</button>
      </form>
      <section v-if="audit" class="mt-6" aria-live="polite"><p class="notice">{{ audit.notice }}</p><h3 class="my-4 font-serif text-2xl">{{ audit.conflicts.length ? audit.conflicts.length + ' conflicts to review' : 'No ingredient conflicts detected — manual checks still required' }}</h3>
        <ul v-if="audit.reviewWarnings.length" class="notice mb-4"><li v-for="warning in audit.reviewWarnings" :key="warning">{{ warning }}</li></ul>
        <article v-for="(conflict, i) in audit.conflicts" :key="i" class="row-panel mb-4 break-words"><p class="meta-label">{{ conflict.type.replaceAll('_', ' ') }}</p><h4 class="mt-2 font-serif text-2xl">{{ conflict.guestName }} · {{ conflict.recipeTitle }}</h4><p class="mt-3"><strong>{{ conflict.ingredient }}:</strong> {{ conflict.message }}</p><p v-if="conflict.crossContaminationWarning" class="mt-3 font-semibold">{{ conflict.crossContaminationWarning }}</p><ul class="mt-3 list-disc space-y-2 pl-5"><li v-for="suggestion in conflict.substitutions" :key="suggestion">{{ suggestion }}</li></ul><p v-if="!conflict.substitutions.length" class="mt-3">No suitable suggestion found. Plan a different dish with the guest.</p></article>
      </section>
    </section>
  </section>
</template>
