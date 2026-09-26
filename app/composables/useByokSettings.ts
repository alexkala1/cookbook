export const byokProviders = ['openai', 'anthropic', 'gemini', 'groq', 'ollama'] as const
export type ByokProvider = typeof byokProviders[number]
const storageKey = 'heirloom.byok.v1'
const emptySettings = () => ({
  keys: Object.fromEntries(byokProviders.map(provider => [provider, ''])) as Record<ByokProvider, string>,
  activeProvider: 'openai' as ByokProvider,
  activeModel: ''
})

export function useByokSettings() {
  // Never read browser secrets during SSR or send them through an API.
  const settings = ref(emptySettings())
  const ready = ref(false)
  const error = ref('')
  const message = ref('')
  onMounted(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const value = JSON.parse(raw)
        if (!value || !byokProviders.includes(value.activeProvider) || typeof value.activeModel !== 'string' || !value.keys || !byokProviders.every(provider => typeof value.keys[provider] === 'string')) {
          throw new Error('Invalid saved settings')
        }
        settings.value = {
          keys: Object.fromEntries(byokProviders.map(provider => [provider, value.keys[provider]])) as Record<ByokProvider, string>,
          activeProvider: value.activeProvider,
          activeModel: value.activeModel
        }
      }
    } catch {
      error.value = 'Saved keys could not be read. Browser storage may be blocked or damaged. You can replace or clear them.'
    } finally {
      ready.value = true
    }
  })
  function save() {
    error.value = ''
    message.value = ''
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings.value))
      message.value = 'Keys and model saved on this browser.'
    } catch {
      error.value = 'Could not save keys. Check that browser storage is allowed.'
    }
  }
  function clear() {
    error.value = ''
    message.value = ''
    try {
      localStorage.removeItem(storageKey)
      settings.value = emptySettings()
      message.value = 'Saved keys and model cleared from this browser.'
    } catch {
      error.value = 'Could not clear saved keys. Check browser storage permissions.'
    }
  }
  return { settings, ready, error, message, save, clear }
}

