const MAX_PHOTO_EDGE = 1600, MAX_PHOTO_CHARS = 1_400_000
export async function downsizePhoto(file: File) {
  if (file.size > 30 * 1024 * 1024) throw new Error('Photo is too large. Choose a photo smaller than 30 MB.')
  if (!file.type.startsWith('image/')) throw new Error('not an image')
  let bitmap: ImageBitmap
  try {
    bitmap = file.size > 1.5 * 1024 * 1024
      ? await createImageBitmap(file, { resizeWidth: 2000, resizeQuality: 'medium' })
      : await createImageBitmap(file)
  }
  catch (cause) {
    if (!(cause instanceof TypeError)) throw cause
    bitmap = await createImageBitmap(file)
  }
  let canvas: HTMLCanvasElement | undefined
  try {
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height))
    canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('no canvas')
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.82, 0.65, 0.5]) {
      const url = canvas.toDataURL('image/jpeg', quality)
      if (url.length <= MAX_PHOTO_CHARS) return url
    }
    throw new Error('too large')
  } finally {
    if (canvas) canvas.width = canvas.height = 0
    bitmap.close()
  }
}
