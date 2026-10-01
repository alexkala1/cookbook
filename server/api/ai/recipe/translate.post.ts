import { createError, defineEventHandler, getHeader, readBody } from 'h3'
import { aiClient } from '../../../utils/ai/client'
import { enforceInvariants, translateRequest, translationLanguages } from '../../../utils/ai/translate'
import { recipeCreateSchema, validate } from '../../../utils/validation'

export default defineEventHandler(async event => {
  const { recipe, targetLanguage } = validate(translateRequest, await readBody(event))
  if ((getHeader(event, 'x-byok-provider') || '').toLowerCase() === 'gemini') throw createError({ statusCode: 400, statusMessage: 'Gemini is not supported for translation. Choose OpenAI, Anthropic, Groq or Ollama in Settings.' })
  const client = aiClient(event)
  const language = translationLanguages.find(item => item.code === targetLanguage)!
  let isTruncated = false
  const translated = await client.generate(recipeCreateSchema,
    `Translate every human-readable text field of this recipe into ${language.name} (${language.label}). Keep the JSON structure, array order and array lengths identical. Copy every number, amount, durationMinutes, timerRequired, heatLevel, internalTempTargetC, servings and time value EXACTLY; never convert units or rescale. Translate unit words only. Preserve all numbers embedded in prose.`,
    JSON.stringify(recipe), () => { throw createError({ statusCode: 400, statusMessage: 'Add an AI key (or choose Ollama) in Settings to translate recipes.' }) },
    undefined, undefined, () => { isTruncated = true })
  if (isTruncated) throw createError({ statusCode: 422, statusMessage: 'The recipe translation was cut off because it exceeded the model’s response limit. Try translating a shorter recipe or smaller section.' })
  return { ...enforceInvariants(recipe, translated), mode: client.mode, targetLanguage }
})
