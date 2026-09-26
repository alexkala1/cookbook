import { detectSwipe, motionCentroid } from '../utils/motion'

export function useAirSwipe(onSwipe: (direction: 'next' | 'previous') => void) {
  const video = ref<HTMLVideoElement>(), active = ref(false), pending = ref(false), message = ref('Camera off'), motion = ref(false)
  let stream: MediaStream | undefined, frame = 0, epoch = 0, disposed = false, previous: Uint8ClampedArray | undefined
  let samples: { x: number, time: number }[] = [], lastFrame = 0, cooldown = 0
  function stop() {
    epoch++; cancelAnimationFrame(frame); stream?.getTracks().forEach(track => track.stop()); stream = undefined
    if (video.value) video.value.srcObject = null
    active.value = false; pending.value = false; motion.value = false; previous = undefined; samples = []; message.value = 'Camera off'
  }
  async function start() {
    if (pending.value || active.value || disposed) return
    const token = ++epoch
    pending.value = true; message.value = 'Waiting for camera permission…'
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 }, audio: false })
      if (disposed || token !== epoch) { acquired.getTracks().forEach(track => track.stop()); return }
      stream = acquired
      stream.getTracks().forEach(track => track.addEventListener('ended', stop, { once: true }))
      if (!video.value) throw new Error('Preview unavailable')
      video.value.srcObject = stream; await video.value.play()
      if (disposed || token !== epoch) return
      const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 72
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Motion detection unavailable')
      active.value = true; message.value = 'Wave left for next, right for previous. Keep the camera still.'
      function scan(now: number) {
        if (!active.value || !video.value) return
        if (now - lastFrame > 65 && video.value.readyState >= 2) {
          lastFrame = now
          // Mirror the pixels to match the selfie preview and the user's direction.
          let pixels: Uint8ClampedArray
          try {
            context!.setTransform(-1, 0, 0, 1, 96, 0); context!.drawImage(video.value, 0, 0, 96, 72)
            pixels = context!.getImageData(0, 0, 96, 72).data
          } catch { stop(); message.value = 'Camera frames unavailable. Use buttons or arrow keys.'; return }
          const x = previous ? motionCentroid(previous, pixels, 96) : null
          previous = pixels; motion.value = x !== null
          samples = samples.filter(sample => now - sample.time < 900)
          if (x !== null && now > cooldown) {
            samples.push({ x, time: now })
            const direction = detectSwipe(samples, now)
            if (direction) { onSwipe(direction); samples = []; cooldown = now + 1600 }
          }
        }
        frame = requestAnimationFrame(scan)
      }
      frame = requestAnimationFrame(scan)
    } catch {
      if (token === epoch) { stop(); message.value = 'Camera unavailable or permission denied. Use buttons or arrow keys.' }
    } finally { if (token === epoch) pending.value = false }
  }
  function visibility() { if (document.hidden) stop() }
  onMounted(() => document.addEventListener('visibilitychange', visibility))
  onBeforeUnmount(() => { disposed = true; stop(); document.removeEventListener('visibilitychange', visibility) })
  return { video, active, pending, message, motion, start, stop }
}
