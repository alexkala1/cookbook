import { buildStepNarrative, type SpeechStepInput } from '../utils/speech'

// Reads a cooking step aloud with the browser's speech synthesis. Narration is always user-initiated.
export function useKitchenSpeech() {
  const isSpeaking = ref(false)
  const isSupported = ref(false)
  const currentNarrative = ref('')

  const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

  function stop() {
    if (supported()) window.speechSynthesis.cancel()
    isSpeaking.value = false
  }

  function speakStep(step: SpeechStepInput, stepNumber?: number) {
    if (!supported()) return
    stop()
    const { text, lang } = buildStepNarrative(step, stepNumber)
    if (!text) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.95
    const voices = window.speechSynthesis.getVoices()
    const voice = voices.find(item => item.lang === lang) ?? voices.find(item => item.lang.startsWith(lang.slice(0, 2)))
    if (voice) utterance.voice = voice
    currentNarrative.value = text
    // A cancelled utterance can fire its end/error late; ignore events from a superseded one.
    const current = () => currentNarrative.value === text
    utterance.onstart = () => { if (current()) isSpeaking.value = true }
    utterance.onend = () => { if (current()) isSpeaking.value = false }
    utterance.onerror = () => { if (current()) isSpeaking.value = false }
    window.speechSynthesis.speak(utterance)
  }

  function toggle(step: SpeechStepInput, stepNumber?: number) {
    if (isSpeaking.value) stop()
    else speakStep(step, stepNumber)
  }

  onMounted(() => { isSupported.value = supported() })
  onBeforeUnmount(stop)

  return { isSpeaking, isSupported, currentNarrative, speakStep, stop, toggle }
}
