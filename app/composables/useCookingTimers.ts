import { remainingSeconds, type CookingTimer } from '../utils/timers'

export function useCookingTimers() {
  const timers = ref<CookingTimer[]>([])
  const alerts = ref<string[]>([])
  const sound = ref('Sound not enabled')
  let audio: AudioContext | undefined, interval: ReturnType<typeof setInterval> | undefined, nextId = 0
  let disposed = false
  async function enableSound() {
    if (disposed) return
    try {
      audio ||= new AudioContext()
      await audio.resume()
      if (!disposed) sound.value = audio.state === 'running' ? 'Sound ready' : 'Sound unavailable — watch timer banners'
    } catch { if (!disposed) sound.value = 'Sound unavailable — watch timer banners' }
  }
  function chime() {
    if (!audio || audio.state !== 'running') return
    for (let i = 0; i < 3; i++) {
      const oscillator = audio.createOscillator(), gain = audio.createGain()
      const start = audio.currentTime + i * 0.3
      oscillator.frequency.value = i === 1 ? 880 : 660
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
      oscillator.connect(gain); gain.connect(audio.destination)
      oscillator.start(start); oscillator.stop(start + 0.28)
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    }
  }
  function tick() {
    for (const timer of timers.value) {
      if (timer.state !== 'running') continue
      timer.remaining = remainingSeconds(timer, Date.now())
      if (!timer.remaining) { timer.state = 'finished'; alerts.value.push(`${timer.name} finished`); chime() }
    }
  }
  function start(name: string, duration: number) {
    if (!Number.isFinite(duration) || duration <= 0 || duration > 604800 || timers.value.length >= 20) return
    void enableSound()
    timers.value.push({ id: ++nextId, name, duration, remaining: duration, deadline: Date.now() + duration * 1000, state: 'running' })
  }
  function toggle(timer: CookingTimer) {
    if (timer.state === 'running') { timer.remaining = remainingSeconds(timer, Date.now()); timer.state = 'paused' }
    else { void enableSound(); timer.remaining ||= timer.duration; timer.deadline = Date.now() + timer.remaining * 1000; timer.state = 'running' }
  }
  function reset(timer: CookingTimer) { timer.remaining = timer.duration; timer.state = 'idle' }
  onMounted(() => { interval = setInterval(tick, 250); document.addEventListener('visibilitychange', tick) })
  onBeforeUnmount(() => { disposed = true; clearInterval(interval); document.removeEventListener('visibilitychange', tick); void audio?.close().catch(() => {}) })
  return { timers, alerts, sound, start, toggle, reset, enableSound }
}
