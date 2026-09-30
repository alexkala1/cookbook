import { describe, expect, it } from 'vitest'
import { cookingSentences, heatLevelOf, splitInstructions, timedStep } from '../shared/culinary/method-steps'
import { extractHtml, extractJsonLd, fallbackRecipe } from '../server/utils/ai/normalize'
import { parseStructuredRecipe } from '../shared/culinary/structured-recipe'
import { chickenAdoboDescription } from './fixtures/chicken-adobo-description'

it('does not turn affiliate products or Adobo ingredient lines into steps', () => {
  expect(cookingSentences(chickenAdoboDescription)).toEqual([])
  expect(cookingSentences('1–2 tbsp brown sugar\nSalt, only if needed\n1/2 tsp salt\nHeat the pan.\nWhisk the sauce.'))
    .toEqual(['Heat the pan.', 'Whisk the sauce.'])
})

describe('splitInstructions', () => {
  it('splits inline 1-2-3 numbering', () => {
    expect(splitInstructions('1. Preheat the oven to 180°C. 2. Mix the flour and sugar. 3) Bake for 25 minutes.'))
      .toEqual(['Preheat the oven to 180°C.', 'Mix the flour and sugar.', 'Bake for 25 minutes.'])
    expect(splitInstructions('Step 1: Soak the beans. Step 2: Boil them for 10 minutes.')).toEqual(['Soak the beans.', 'Boil them for 10 minutes.'])
  })
  it('splits sentences but keeps explanations, abbreviations and decimals with their action', () => {
    expect(splitInstructions('Heat the oil over medium heat. Add the onions and cook for 5 minutes. This softens them without colour. Season with salt.'))
      .toEqual(['Heat the oil over medium heat.', 'Add the onions and cook for 5 minutes. This softens them without colour.', 'Season with salt.'])
    expect(splitInstructions('Add 1.5 tsp. salt and approx. 2 cups water. Stir well.')).toEqual(['Add 1.5 tsp. salt and approx. 2 cups water.', 'Stir well.'])
    expect(splitInstructions('Bake until golden. Enjoy!')).toEqual(['Bake until golden. Enjoy!'])
  })
  it('ignores numbers that do not run in order', () => {
    expect(splitInstructions('Roast at 200. 3 hours is plenty for the lamb')).toHaveLength(2)
    expect(splitInstructions('Step 2: Knead the dough well')).toEqual(['Step 2: Knead the dough well'])
    expect(splitInstructions('   ')).toEqual([])
  })
})

describe('timedStep', () => {
  it('sets duration, timer and heat from the instruction', () => {
    expect(timedStep('Simmer for 20–25 minutes.', 2)).toEqual({ stepNumber: 2, instruction: 'Simmer for 20–25 minutes.', durationMinutes: 20, timerRequired: true, heatLevel: 'low' })
    expect(timedStep('Bake for 1 hour 15 minutes.', 1)).toMatchObject({ durationMinutes: 75, timerRequired: true })
    expect(timedStep('Chop the onions.', 1)).toEqual({ stepNumber: 1, instruction: 'Chop the onions.', durationMinutes: null, timerRequired: false })
    expect(timedStep('Ψήνουμε για 40 λεπτά.', 1)).toMatchObject({ durationMinutes: 40, timerRequired: true })
  })
  it('reads heat cues', () => {
    expect(heatLevelOf('Bring the water to a rolling boil')).toBe('high')
    expect(heatLevelOf('Sear over medium-high heat')).toBe('medium-high')
    expect(heatLevelOf('Roast in the oven')).toBeNull()
  })
})

describe('cookingSentences', () => {
  it('keeps actions and timed sentences, drops narrative', () => {
    expect(cookingSentences('Grandma lemon chicken, roasted on Sundays')).toEqual([])
    expect(cookingSentences('My mother’s fasolada, the winter one. Soak the beans overnight. Boil them for 10 minutes, then drain. Simmer with tomato and oil for 1½ hours.'))
      .toEqual(['Soak the beans overnight.', 'Boil them for 10 minutes, then drain.', 'Simmer with tomato and oil for 1½ hours.'])
  })
})

describe('extractJsonLd method splitting', () => {
  const page = (instructions: unknown) => '<script type="application/ld+json">' + JSON.stringify({ '@type': 'Recipe', name: 'Cake', recipeIngredient: ['200 g flour'], recipeInstructions: instructions }) + '</script>'
  it('splits a single-string method into timed steps', () => {
    const recipe = extractJsonLd(page('Preheat the oven to 180°C. Mix the flour and sugar. Bake for 25 minutes until golden.'))!
    expect(recipe.steps!.map(step => [step.instruction, step.durationMinutes, step.timerRequired])).toEqual([
      ['Preheat the oven to 180°C.', null, false], ['Mix the flour and sugar.', null, false], ['Bake for 25 minutes until golden.', 25, true]
    ])
  })
  it('splits numbered HowToStep text and keeps sections in order', () => {
    const recipe = extractJsonLd(page([{ '@type': 'HowToSection', itemListElement: [{ '@type': 'HowToStep', text: '1. Cream the butter. 2. Beat in the eggs.' }] }, { '@type': 'HowToStep', text: 'Bake for 30 minutes over medium heat.' }]))!
    expect(recipe.steps!.map(step => step.instruction)).toEqual(['Cream the butter.', 'Beat in the eggs.', 'Bake for 30 minutes over medium heat.'])
    expect(recipe.steps![2]).toMatchObject({ stepNumber: 3, durationMinutes: 30, timerRequired: true, heatLevel: 'medium' })
  })
})

describe('extractHtml', () => {
  const html = `<html><head><title>Site</title></head><body><nav>Home Recipes</nav><header><h1>Blog</h1></header>
    <div class="sidebar">Subscribe to our newsletter for weekly recipes and tips from our kitchen to yours.</div>
    <div itemscope itemtype="https://schema.org/Recipe"><h2 itemprop="name">Lemon Potatoes</h2><p>Crispy and bright, a taverna side dish for four.</p>
      <h3>Ingredients</h3><ul><li itemprop="recipeIngredient">1 kg potatoes</li><li itemprop="recipeIngredient">80 ml olive oil</li><li itemprop="recipeIngredient">60 ml lemon juice</li></ul>
      <h3>Method</h3><ol><li>Peel the potatoes<br>and cut into wedges.</li><li>Toss with oil and lemon, then roast for 60 minutes.</li><li>Rest for 5 minutes.</li></ol></div>
    <footer>© Site</footer></body></html>`
  it('keeps block newlines, scopes to the recipe microdata and feeds the structured parser', () => {
    const { title, text } = extractHtml(html)
    expect(title).toBe('Lemon Potatoes')
    expect(text).not.toContain('Subscribe')
    expect(text).toContain('Ingredients\n\n1 kg potatoes')
    expect(text).toContain('Peel the potatoes\nand cut into wedges.')
    const parsed = parseStructuredRecipe(text)!
    expect(parsed.ingredients.map(row => row.name)).toEqual(['potatoes', 'olive oil', 'lemon juice'])
    expect(parsed.steps.map(step => [step.durationMinutes, step.timerRequired])).toEqual([[null, false], [60, true], [5, true]])
  })
  it('falls back to the page title and main content without a recipe container', () => {
    const plain = extractHtml('<html><head><title>Fava</title></head><body><main><p>Rinse the split peas well under cold water.</p><p>Simmer for 45 minutes, skimming the foam.</p></main></body></html>')
    expect(plain).toEqual({ title: 'Fava', text: 'Rinse the split peas well under cold water.\n\nSimmer for 45 minutes, skimming the foam.' })
  })
})

describe('fallbackRecipe', () => {
  it('builds timed steps from the source’s cooking sentences', () => {
    const recipe = fallbackRecipe('Yiayia’s chicken. Rub the chicken with lemon and oregano. Roast for 90 minutes, basting halfway. Rest for 10 minutes before carving.')
    expect(recipe.steps!.map(step => [step.stepNumber, step.durationMinutes, step.timerRequired])).toEqual([[1, null, false], [2, 90, true], [3, 10, true]])
    expect(recipe.cookTimeMinutes).toBe(100)
  })
  it('keeps the labelled one-step template when the source has no method', () => {
    const recipe = fallbackRecipe('Grandma lemon chicken, roasted on Sundays')
    expect(recipe.steps).toHaveLength(1)
    expect(recipe.steps![0]!.failurePrevention).toContain('suggested method')
  })
})
