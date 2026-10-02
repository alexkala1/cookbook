import { remainingSeconds, restoreTimers, type CookingTimer } from '../utils/timers'

export function useCookingTimers(recipeId: string) {
  const timers = ref<CookingTimer[]>([])
  const runningCount = computed(() => timers.value.filter(timer => timer.state === 'running').length)
  const activeTimers = computed(() => timers.value.filter(timer => timer.state === 'running' || timer.state === 'paused'))
  const alerts = ref<string[]>([])
  const sound = ref('Sound not enabled')
  let audio: AudioContext | undefined
  let interval: ReturnType<typeof setInterval> | undefined
  let titleInterval: ReturnType<typeof setInterval> | undefined
  let originalTitle: string | undefined
  let nextId = 0
  let disposed = false
  let hydrated = false
  const storageKey = 'heirloom:timers:v1:' + recipeId
  const persistence = ref('Timers survive reloads in this tab.')

  function persist() {
    if (!hydrated) return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, timers: timers.value }))
    } catch {
      persistence.value = 'Session storage unavailable: timers cannot survive reload.'
    }
  }

  async function enableSound() {
    if (disposed) return
    try {
      audio ||= new AudioContext()
      await audio.resume()
      if (!disposed) sound.value = audio.state === 'running' ? 'Sound ready' : 'Sound unavailable — watch timer banners'
    } catch {
      if (!disposed) sound.value = 'Sound unavailable — watch timer banners'
    }
  }

  function chime() {
    if (!audio || audio.state !== 'running') return
    for (let i = 0; i < 3; i++) {
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      const start = audio.currentTime + i * 0.3
      oscillator.frequency.value = i === 1 ? 880 : 660
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
      oscillator.connect(gain)
      gain.connect(audio.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.28)
      oscillator.onended = () => {
        oscillator.disconnect()
        gain.disconnect()
      }
    }
  }

  function restoreTitle() {
    clearInterval(titleInterval)
    titleInterval = undefined
    if (originalTitle !== undefined) document.title = originalTitle
    originalTitle = undefined
  }

  function alertFinished(timer: CookingTimer) {
    alerts.value.push(`${timer.name} finished`)
    chime()
    try {
      if (typeof navigator !== 'undefined') navigator.vibrate?.([300, 150, 300, 150, 300])
    } catch { /* Some browsers deny vibration in background tabs. */ }
    if (document.hidden && titleInterval === undefined) {
      originalTitle = document.title
      document.title = '⏰ Timer finished!'
      titleInterval = setInterval(() => {
        document.title = document.title === '⏰ Timer finished!' ? originalTitle! : '⏰ Timer finished!'
      }, 1000)
    }
  }

  function visibilityChanged() {
    if (!document.hidden) {
      restoreTitle()
      void audio?.resume().catch(() => {})
    }
    tick()
  }

  function tick() {
    let stateChanged = false
    for (const timer of timers.value) {
      if (timer.state !== 'running') continue
      timer.remaining = remainingSeconds(timer, Date.now())
      timer.remainingMs = Math.max(0, timer.deadline - Date.now())
      if (!timer.remaining) {
        timer.state = 'finished'
        stateChanged = true
        alertFinished(timer)
      }
    }

    if (stateChanged) persist()
  }

  function start(name: string, duration: number) {
    if (!Number.isFinite(duration) || duration <= 0 || duration > 604800 || timers.value.length >= 20) return
    void enableSound()
    timers.value.push({
      id: ++nextId,
      name,
      duration,
      remaining: duration,
      remainingMs: duration * 1000,
      deadline: Date.now() + duration * 1000,
      state: 'running'
    })

    persist()
  }

  function startPreset(label: string, seconds: number) {
    start(label, seconds)
  }

  function startCustom(name: string, minutes: number) {
    start(name, minutes * 60)
  }

  function toggle(timer: CookingTimer) {
    if (timer.state === 'running') {
      // A throttled interval may not have reported this deadline yet.
      tick()
      if (timer.state !== 'running') return
      timer.state = 'paused'
    } else {
      void enableSound()
      timer.remainingMs = (timer.remainingMs ?? timer.remaining * 1000) || timer.duration * 1000
      timer.remaining = Math.ceil(timer.remainingMs / 1000)
      timer.deadline = Date.now() + timer.remainingMs
      timer.state = 'running'
    }

    persist()
  }

  function reset(timer: CookingTimer) {
    timer.remaining = timer.duration
    timer.remainingMs = timer.duration * 1000
    timer.state = 'idle'
    persist()
  }

  function remove(timer: CookingTimer) {
    timers.value = timers.value.filter(row => row.id !== timer.id)
    persist()
  }

  function restore(timer: CookingTimer) {
    if (timers.value.some(row => row.id === timer.id) || timers.value.length >= 20) return
    const restored = { ...timer }
    if (restored.state === 'running') {
      restored.remaining = remainingSeconds(restored, Date.now())
      restored.remainingMs = Math.max(0, restored.deadline - Date.now())
      if (!restored.remaining) {
        restored.state = 'finished'
        alertFinished(restored)
      }
    }

    timers.value.push(restored)
    timers.value.sort((a, b) => a.id - b.id)
    nextId = Math.max(nextId, restored.id)
    persist()
  }

  onMounted(() => {
    try {
      timers.value = restoreTimers(sessionStorage.getItem(storageKey))
    } catch {
      persistence.value = 'Session storage unavailable: timers cannot survive reload.'
    }

    nextId = Math.max(0, ...timers.value.map(timer => timer.id))
    hydrated = true
    tick()
    persist()
    interval = setInterval(tick, 250)
    document.addEventListener('visibilitychange', visibilityChanged)
    window.addEventListener('pagehide', persist)
  })

  onBeforeUnmount(() => {
    persist()
    disposed = true
    clearInterval(interval)
    document.removeEventListener('visibilitychange', visibilityChanged)
    restoreTitle()
    window.removeEventListener('pagehide', persist)
    void audio?.close().catch(() => {})
  })

  return { timers, runningCount, activeTimers, alerts, sound, persistence, start, startPreset, startCustom, toggle, reset, remove, restore, enableSound }
}
