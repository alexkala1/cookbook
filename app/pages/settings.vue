<script setup lang="ts">
import type { KitchenProfile } from '../../shared/types/recipe'
import { byokProviders } from '../composables/useByokSettings'
import { saltDensities, saltLabels } from '../utils/units'

useSeoMeta({ title: 'Your kitchen & keys — Heirloom' })
const { settings, ready, error: keyError, message: keyMessage, save: saveKeys, clear } = useByokSettings()
const { data: profile, error, refresh } = await useFetch<KitchenProfile>('/api/settings/kitchen')
const saving = ref(false)
const message = ref('')
const saveError = ref('')
const hardware = [
  { key: 'hasMicrowave', label: 'Microwave' }, { key: 'hasAirFryer', label: 'Air fryer' },
  { key: 'hasInstantPot', label: 'Instant Pot' }, { key: 'hasCastIron', label: 'Cast iron' },
  { key: 'hasClayGastra', label: 'Clay gastra' }
] as const
async function saveKitchen() {
  if (!profile.value) return
  saving.value = true
  message.value = ''
  saveError.value = ''
  try {
    const { id, ...body } = profile.value
    for (const item of hardware) body[item.key] = Boolean(body[item.key])
    body.preferredSaltType ??= 'table_salt'
    profile.value = await $fetch<KitchenProfile>('/api/settings/kitchen', { method: 'PUT', body })
    message.value = 'Kitchen profile saved.'
  } catch { saveError.value = 'Could not save your kitchen. Please try again.' }
  finally { saving.value = false }
}
</script>

<template>
  <section class="page-section max-w-4xl">
    <p class="eyebrow">Make yourself at home</p><h1 class="mt-3">Your kitchen & keys</h1>
    <section class="mt-12 border-t border-espresso/20 pt-8">
      <h2>Your AI providers</h2>
      <p class="mt-4 max-w-2xl">Keys are saved in this browser’s localStorage, without encryption. Anyone with access to this browser profile can read them. When you request AI help, the selected key travels in a request header to Heirloom and then to the selected provider; the server never saves or logs it. Source text is sent to that provider. Use HTTPS when accessing a remote server.</p>
      <p class="mt-3 text-sm">Enter a model ID supported by your provider. Without a key, imports use recipe metadata or a labeled deterministic draft. Ollama uses the server’s local service at 127.0.0.1:11434 when selected with a model; no key is required.</p>
      <form class="mt-6 space-y-5" @submit.prevent="saveKeys">
        <fieldset :disabled="!ready" class="space-y-5">
          <label v-for="provider in byokProviders" :key="provider" class="block capitalize">{{ provider }} API key <span v-if="provider === 'ollama'" class="normal-case">(optional for local models)</span>
            <input v-model="settings.keys[provider]" type="password" autocomplete="off" spellcheck="false" autocapitalize="none" class="field mt-2" :aria-label="provider + ' API key'">
          </label>
          <div class="form-grid">
            <label>Active provider<select v-model="settings.activeProvider" aria-label="Active provider" class="field mt-2"><option v-for="provider in byokProviders" :key="provider" :value="provider">{{ provider }}</option></select></label>
            <label>Active model<input v-model="settings.activeModel" class="field mt-2" placeholder="Model ID from your provider" maxlength="200"></label>
          </div>
          <div class="flex flex-wrap gap-3"><button type="submit" class="button-primary">Save keys & model</button><button type="button" class="button-secondary" @click="clear">Clear saved keys</button></div>
        </fieldset>
        <p v-if="keyError" role="alert" class="notice">{{ keyError }}</p>
        <p v-if="keyMessage" role="status">{{ keyMessage }}</p>
      </form>
    </section>
    <section class="mt-12 border-t border-espresso/20 pt-8">
      <h2>Your kitchen hardware</h2>
      <div v-if="error" role="alert" class="notice mt-4"><p>{{ error.statusCode === 409 ? 'Several legacy kitchen profiles were found. Consolidate them into one default profile in the database before editing. No settings were overwritten.' : 'Could not load your kitchen profile.' }}</p><button class="button-secondary mt-4" @click="refresh()">Try again</button></div>
      <form v-else-if="profile" class="mt-6 space-y-6" @submit.prevent="saveKitchen">
        <fieldset :disabled="saving" class="space-y-6">
          <div class="form-grid">
            <label>Stove type<select v-model="profile.stoveType" aria-label="Stove type" class="field mt-2"><option value="gas">Gas</option><option value="induction">Induction</option><option value="electric_radiant">Electric radiant</option></select></label>
            <label>Oven type<select v-model="profile.ovenType" aria-label="Oven type" class="field mt-2"><option value="convection_fan">Convection fan</option><option value="static_conventional">Static conventional</option></select></label>
          </div>
          <div class="grid gap-4 sm:grid-cols-2"><label v-for="item in hardware" :key="item.key" class="flex items-center gap-3"><input :checked="Boolean(profile[item.key])" type="checkbox" @change="profile[item.key] = ($event.target as HTMLInputElement).checked">{{ item.label }}</label></div>
          <label class="block">Preferred salt<select v-model="profile.preferredSaltType" aria-label="Preferred salt" class="field mt-2"><option v-for="(_, salt) in saltDensities" :key="salt" :value="salt">{{ saltLabels[salt] }}</option></select></label>
          <button class="button-primary" type="submit">{{ saving ? 'Saving…' : 'Save kitchen profile' }}</button>
        </fieldset>
        <p v-if="saveError" role="alert" class="notice">{{ saveError }}</p><p v-if="message" role="status">{{ message }}</p>
      </form>
    </section>
  </section>
</template>
