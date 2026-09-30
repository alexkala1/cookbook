export const translationLanguageOptions = [
  { code: 'el', label: 'Ελληνικά' }, { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' }, { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' }, { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' }, { code: 'tr', label: 'Türkçe' }
] as const
const key = 'heirloom.translate.lang.v1'
export function readTranslateLang(): string {
  try {
    const code = localStorage.getItem(key)
    return translationLanguageOptions.find(language => language.code === code)?.code || 'el'
  } catch { return 'el' }
}
export function writeTranslateLang(code: string): void {
  if (!translationLanguageOptions.some(language => language.code === code)) return
  try { localStorage.setItem(key, code) } catch {}
}
