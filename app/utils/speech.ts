export interface SpeechStepInput {
  instruction: string
  durationMinutes?: number | null
  sensoryVisual?: string | null
  sensoryAudio?: string | null
  sensoryAroma?: string | null
  sensoryTexture?: string | null
  internalTempTargetC?: number | null
  failurePrevention?: string | null
  scienceWhy?: string | null
}

export function detectLanguage(text: string): 'el-GR' | 'en-US' {
  return /[\u0370-\u03ff\u1f00-\u1fff]/.test(text) ? 'el-GR' : 'en-US'
}

export function buildStepNarrative(step: SpeechStepInput, stepNumber?: number): { text: string; lang: 'el-GR' | 'en-US' } {
  const lang = detectLanguage(step.instruction)
  const greek = lang === 'el-GR'
  const parts: string[] = []
  const sentence = (text: string) => {
    const trimmed = text.trim().replace(/\s+/g, ' ')
    if (!trimmed) return ''
    return trimmed.replace(/[.!]+$/, '').trimEnd() + (trimmed.endsWith('!') ? '!' : '.')
  }
  if (stepNumber != null) parts.push(`${greek ? 'Βήμα' : 'Step'} ${stepNumber}.`)
  const instruction = sentence(step.instruction)
  if (instruction) parts.push(instruction)
  if (step.internalTempTargetC != null) {
    parts.push(greek
      ? `Εσωτερική θερμοκρασία: ${step.internalTempTargetC} βαθμοί Κελσίου.`
      : `Target internal temperature: ${step.internalTempTargetC} degrees Celsius.`)
  }
  if (step.failurePrevention?.trim()) parts.push(`${greek ? 'Προσοχή' : 'Watch out'}: ${sentence(step.failurePrevention)}`)
  return { text: parts.join(' '), lang }
}
