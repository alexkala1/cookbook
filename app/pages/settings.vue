<script setup lang="ts">
import type { KitchenProfile } from '../../shared/types/recipe'
import { byokProviders } from '../composables/useByokSettings'
import { saltDensities, saltLabels } from '../utils/units'

const recommendedModels: Record<(typeof byokProviders)[number], string[]> = {
  gemini: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.5-flash'],
  openai: ['gpt-4o-mini', 'gpt-4o'],
  anthropic: ['claude-3-5-haiku-20241022', 'claude-3-7-sonnet-20250219'],
  groq: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'],
  ollama: ['llama3.2', 'mistral', 'qwen2.5']
}

useSeoMeta({ title: 'Your kitchen & keys — Heirloom' })
const { settings, ready, error: keyError, message: keyMessage, save: saveKeys, clear } = useByokSettings()
const { data: profile, error, refresh } = await useFetch<KitchenProfile>('/api/settings/kitchen')
const saving = ref(false)
const message = ref('')
const saveError = ref('')
const { state: kitchenState, label: kitchenLabel } = useActionFeedback(saving, saveError)
const keySaving = ref(false)
const { state: keyState, label: keyLabel } = useActionFeedback(keySaving, keyError)
async function storeKeys() { keySaving.value = true; try { saveKeys() } finally { keySaving.value = false } }
let messageTimer: ReturnType<typeof setTimeout> | undefined
watch([message, keyMessage], () => { clearTimeout(messageTimer); messageTimer = setTimeout(() => { message.value = ''; keyMessage.value = '' }, 2000) })
onBeforeUnmount(() => clearTimeout(messageTimer))
const hardware = [
  { key: 'hasMicrowave', label: 'Microwave' }, { key: 'hasAirFryer', label: 'Air fryer' },
  { key: 'hasInstantPot', label: 'Instant Pot' }, { key: 'hasCastIron', label: 'Cast iron' },
  { key: 'hasClayGastra', label: 'Clay gastra' }
] as const
// Backup & restore: one JSON file downloaded from /api/backup/export and restored through /api/backup/import.
const exporting = ref(false), exportError = ref('')
const { state: exportState, label: exportLabel } = useActionFeedback(exporting, exportError)
const restoring = ref(false), restoreError = ref(''), restoreMessage = ref('')
const { state: restoreState } = useActionFeedback(restoring, restoreError)
const backupInput = ref<HTMLInputElement>()
async function downloadBackup() {
  exporting.value = true; exportError.value = ''
  try {
    const file = await $fetch<unknown>('/api/backup/export')
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: `heirloom-backup-${new Date().toISOString().slice(0, 10)}.json` })
    document.body.append(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  } catch { exportError.value = 'We couldn’t create the backup. Please try again.' }
  finally { exporting.value = false }
}
async function restoreBackup(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  if (!file) return
  restoring.value = true; restoreError.value = ''; restoreMessage.value = ''
  try {
    let body: Record<string, unknown>
    try { body = JSON.parse(await file.text()) } catch { throw new Error('That file isn’t a readable Heirloom backup (.json).') }
    await $fetch('/api/backup/import', { method: 'POST', body })
    await Promise.all([refreshNuxtData(), refresh()])
    restoreMessage.value = 'Welcome back. Your backup has been restored, and your recipes and pantry are up to date.'
  } catch (cause) {
    restoreError.value = (cause as { data?: { statusMessage?: string } }).data?.statusMessage || (cause instanceof Error ? cause.message : '') || 'We couldn’t restore that backup. Nothing was changed.'
  } finally { restoring.value = false; input.value = '' }
}

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
    <h1 class="mt-3">Your kitchen & keys</h1>
    <div class="mt-6 flex flex-wrap items-center gap-4">
      <NuxtLink to="/handbook" class="button-secondary">Cook's Handbook</NuxtLink>
      <p class="max-w-xl text-ink">Practical help for your first recipe, tonight’s dinner and the next family gathering.</p>
    </div>
    <section class="mt-12 border-t border-espresso/20 pt-8">
      <h2>Your AI providers</h2>
      <p class="mt-4 max-w-2xl">Keys are saved in this browser’s localStorage, without encryption. Anyone with access to this browser profile can read them. When you request AI help, the selected key travels in a request header to Heirloom and then to the selected provider; the server never saves or logs it. Source text is sent to that provider. Use HTTPS when accessing a remote server.</p>
      <p class="mt-3 text-sm">Enter a model ID supported by your provider. Without a key, imports use recipe metadata or a labeled deterministic draft. Ollama uses the server’s local service at 127.0.0.1:11434 when selected with a model; no key is required.</p>
      <form class="mt-6 space-y-5" @submit.prevent="storeKeys">
        <fieldset :disabled="!ready" class="space-y-5">
          <label v-for="provider in byokProviders" :key="provider" class="block capitalize">{{ provider }} API key <span v-if="provider === 'ollama'" class="normal-case">(optional for local models)</span>
            <input v-model="settings.keys[provider]" type="password" autocomplete="off" spellcheck="false" autocapitalize="none" class="field mt-2" :aria-label="provider + ' API key'">
          </label>
          <div class="form-grid">
            <label>Active provider<select v-model="settings.activeProvider" aria-label="Active provider" class="field mt-2"><option v-for="provider in byokProviders" :key="provider" :value="provider">{{ provider }}</option></select></label>
            <div>
              <label>Active model
                <input v-model="settings.activeModel" list="model-presets" class="field mt-2" placeholder="Model ID from your provider" maxlength="200">
                <datalist id="model-presets">
                  <option v-for="m in recommendedModels[settings.activeProvider]" :key="m" :value="m" />
                </datalist>
              </label>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span class="text-ink/70">Recommended:</span>
                <button
                  v-for="m in recommendedModels[settings.activeProvider]"
                  :key="m"
                  type="button"
                  class="font-mono text-action underline hover:opacity-80"
                  @click="settings.activeModel = m"
                >
                  {{ m }}
                </button>
              </div>
            </div>
          </div>
          <div class="flex flex-wrap gap-3"><button type="submit" class="button-primary" v-stable-action="keyState" :data-state="keyState" :aria-busy="keySaving">{{ keyLabel('Save keys & model', 'Saving…') }}</button><button type="button" class="button-secondary" @click="clear">Clear saved keys</button></div>
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
          <button class="button-primary" type="submit" v-stable-action="kitchenState" :data-state="kitchenState" :aria-busy="saving">{{ kitchenLabel('Save kitchen profile', 'Saving…') }}</button>
        </fieldset>
        <p v-if="saveError" role="alert" class="notice">{{ saveError }}</p><p v-if="message" role="status">{{ message }}</p>
      </form>
    </section>
    <section class="mt-12 border-t border-espresso/20 pt-8" aria-labelledby="backup-heading">
      <h2 id="backup-heading">Cookbook Backup &amp; Portability</h2>
      <p class="mt-4 max-w-2xl">Keep a copy of your recipes, family notes and pantry in one file, or move them to another Heirloom. AI keys, kitchen hardware and timers are not included.</p>
      <div class="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" class="button-primary" :disabled="exporting || restoring" v-stable-action="exportState" :data-state="exportState" :aria-busy="exporting" @click="downloadBackup"><UIcon name="i-lucide-download" aria-hidden="true" /> {{ exportLabel('Download Backup (.json)', 'Preparing…') }}</button>
        <input ref="backupInput" type="file" accept="application/json,.json" class="sr-only" tabindex="-1" aria-label="Restore Backup file" :disabled="restoring || exporting" @change="restoreBackup">
        <button type="button" class="button-secondary" :disabled="restoring || exporting" :data-state="restoreState" :aria-busy="restoring" @click="backupInput?.click()"><UIcon name="i-lucide-upload" aria-hidden="true" /> {{ restoring ? 'Restoring…' : 'Restore Backup' }}</button>
      </div>
      <p class="mt-3 text-sm text-muted">Restore a file made by Download Backup. If anything in the file is wrong, nothing is changed.</p>
      <p v-if="exportError" role="alert" class="notice mt-4">{{ exportError }}</p>
      <p v-if="restoreError" role="alert" class="notice mt-4">{{ restoreError }}</p>
      <p v-if="restoreMessage" role="status" class="mt-4">{{ restoreMessage }}</p>
    </section>
  </section>
</template>
