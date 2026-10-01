import { expect, it } from 'vitest'
import { inferStorageReheating, isStorageReheatingApplicable, type StorageReheatingCategory } from '../shared/culinary/storage-reheating'

it.each<[string, StorageReheatingCategory]>([
  ['Spanakopita', 'crispy'], ['Τυρόπιτα', 'crispy'], ['ΣΠΑΝΑΚΟΠΙΤΑ', 'crispy'], ['Phyllo pie', 'crispy'], ['Fried chicken', 'crispy'], ['Roast potatoes', 'crispy'], ['Pastries', 'crispy'], ['Πατάτες φούρνου', 'crispy'],
  ['Kokkinisto', 'braise_stew'], ['Στιφάδο', 'braise_stew'], ['Giouvetsi with orzo', 'braise_stew'], ['Γιουβέτσι', 'braise_stew'], ['Braised lamb', 'braise_stew'], ['Braised beef', 'braise_stew'], ['Bean stew', 'braise_stew'], ['Fasolada', 'braise_stew'], ['Φασολάδα', 'braise_stew'], ['Γίγαντες', 'braise_stew'],
  ['Pasta', 'pasta_starch'], ['Pastitsio', 'pasta_starch'], ['Παστίτσιο', 'pasta_starch'], ['Orzo', 'pasta_starch'], ['Κριθαράκι', 'pasta_starch'],
  ['Pilaf', 'rice_grains'], ['Σπανακόρυζο', 'rice_grains'], ['Spanakorizo', 'rice_grains'], ['Gemista filling', 'rice_grains'], ['Γέμιση για γεμιστά', 'rice_grains'], ['Fried rice', 'rice_grains'], ['Quinoa grains', 'rice_grains'],
  ['Chicken soup', 'soup_broth'], ['Avgolemono', 'soup_broth'], ['Αυγολέμονο', 'soup_broth'], ['Ψαρόσουπα', 'soup_broth'], ['Κοτόσουπα', 'soup_broth'], ['Vegetable broth', 'soup_broth'],
  ['Briam', 'vegetable_ladera'], ['Μπριάμ', 'vegetable_ladera'], ['Fasolakia', 'vegetable_ladera'], ['Φασολάκια', 'vegetable_ladera'], ['Gemista', 'vegetable_ladera'], ['Γεμιστά', 'vegetable_ladera'], ['Stuffed vegetables', 'vegetable_ladera']
])('classifies %s as %s', (title, category) => {
  expect(inferStorageReheating({ title }).category).toBe(category)
})

it.each([
  [{ title: 'Braised lamb' }, 3], [{ title: 'Chicken soup' }, 3], [{ title: 'Fish soup' }, 2], [{ title: 'Ψαρόσουπα' }, 2],
  [{ title: 'Briam' }, 4], [{ title: 'Pasta' }, 4], [{ title: 'Quinoa grains' }, 4], [{ title: 'Pilaf' }, 1],
  [{ title: 'Gemista', ingredients: [{ name: 'Rice' }, { name: 'Beef' }] }, 1],
  [{ title: 'Pasta', ingredients: [{ name: 'Shrimp' }, { name: 'Chicken' }] }, 2],
  [{ title: 'Briam', ingredients: [{ name: 'Μοσχάρι' }] }, 3],
  [{ title: 'Briam', ingredients: [{ name: 'Beefsteak tomatoes' }] }, 4],
  [{ title: 'Pasta', ingredients: [{ name: 'Rice flour' }, { name: 'Rice vinegar' }] }, 4],
  [{ title: 'Gemista', ingredients: [{ name: 'Rice' }, { name: 'Flour' }] }, 1]
])('uses the shortest cooked-ingredient storage limit for %j', (recipe, expected) => {
  expect(inferStorageReheating(recipe).fridgeLifeDays).toBe(expected)
})

it('keeps a recognized title ahead of side-dish descriptions and method mentions', () => {
  expect(inferStorageReheating({ title: 'Briam', description: 'Serve with roast potatoes or chicken soup.', steps: [{ instruction: 'Serve with crispy bread.' }] })).toMatchObject({ category: 'vegetable_ladera', fridgeLifeDays: 4 })
  expect(inferStorageReheating({ title: 'Giouvetsi', ingredients: [{ name: 'Orzo' }], tags: ['pasta'] }).category).toBe('braise_stew')
})
it('uses tags, description and method when title provides no category evidence', () => {
  expect(inferStorageReheating({ title: 'Family supper', tags: ['braise_stew'] }).category).toBe('braise_stew')
  expect(inferStorageReheating({ title: 'Family supper', description: 'A phyllo pie.' }).category).toBe('crispy')
  expect(inferStorageReheating({ title: 'Family supper', steps: [{ instruction: 'Simmer the soup gently.' }] }).category).toBe('soup_broth')
  expect(inferStorageReheating({ title: 'Family supper', ingredients: [{ name: 'Potatoes' }] }).category).toBe('general')
  expect(inferStorageReheating({ title: 'Family supper', description: 'A fish soup.' }).fridgeLifeDays).toBe(2)
  expect(inferStorageReheating({ title: 'Family supper', tags: ['pasta', 'seafood'] }).fridgeLifeDays).toBe(2)
  expect(inferStorageReheating({ title: 'Quinoa', tags: ['rice_grains'] }).fridgeLifeDays).toBe(4)
})
it.each(['Greek salad', 'Χωριάτικη σαλάτα', 'Fruit smoothie'])('omits cooked reheating advice for %s', title => {
  expect(isStorageReheatingApplicable({ title })).toBe(false)
})
it('omits drink/cocktail guidance but retains cooked foods', () => {
  expect(isStorageReheatingApplicable({ title: 'Cinnamon tea', recipeType: 'drink' })).toBe(false)
  expect(isStorageReheatingApplicable({ title: 'Aegean fizz', recipeType: 'cocktail' })).toBe(false)
  expect(isStorageReheatingApplicable({ title: 'Briam', recipeType: 'food' })).toBe(true)
})
it('keeps crispy food dry and distinguishes appliance temperature from the safe centre temperature', () => {
  const advice = inferStorageReheating({ title: 'Tiropita' })
  expect(advice.reheating).toMatchObject({ appliance: 'oven', targetTempC: 190, durationMinutes: 8, doNotMicrowave: true })
  expect(advice.reheating.instructions).toMatch(/uncovered.*190°C.*5–8 minutes/)
  expect(advice.reheating.instructions).toContain('74°C')
  expect(advice.reheating.chemistryNote).toMatch(/moisture|steam/)
})
it('loosens gelatin in braises gently with broth', () => {
  const advice = inferStorageReheating({ title: 'Kokkinisto' })
  expect(advice.reheating.appliance).toBe('stovetop')
  expect(advice.reheating.instructions).toContain('2–3 tbsp')
  expect(advice.reheating.chemistryNote).toContain('gelatin')
  expect(inferStorageReheating({ title: 'Fasolada' }).reheating.chemistryNote).toContain('starch-thickened')
})
it('re-emulsifies pasta sauce or uses the covered 175°C oven alternative', () => {
  const advice = inferStorageReheating({ title: 'Pastitsio' })
  expect(advice.reheating.appliance).toBe('skillet')
  expect(advice.reheating.instructions).toMatch(/water.*butter.*covered oven at 175°C/)
  expect(advice.reheating.chemistryNote).toContain('re-emulsify')
})
it('protects rice moisture without suggesting microwave foil or unsafe long storage', () => {
  const advice = inferStorageReheating({ title: 'Spanakorizo' })
  expect(advice).toMatchObject({ fridgeLifeDays: 1, reheating: { appliance: 'microwave' } })
  expect(advice.reheating.instructions).toMatch(/1–2 tbsp.*damp paper towel.*Never put foil in the microwave/)
  expect(advice.storageTips.join(' ')).toMatch(/within 1 hour.*within 24 hours.*only once/)
  expect(advice.reheating.chemistryNote).toContain('toxins')
})
it('protects egg-lemon soup from splitting and flags poor freezing texture', () => {
  for (const recipe of [{ title: 'Avgolemono' }, { title: 'Chicken soup', ingredients: [{ name: 'Eggs' }, { name: 'Lemon' }] }]) {
    const advice = inferStorageReheating(recipe)
    expect(advice).toMatchObject({ freezerFriendly: false, freezerLifeMonths: null, reheating: { appliance: 'stovetop' } })
    expect(advice.reheating.instructions).toMatch(/Avoid aggressive boiling.*74°C/)
    expect(advice.reheating.chemistryNote).toContain('Egg proteins')
  }
  expect(inferStorageReheating({ title: 'Vegetable soup' }).reheating.instructions).toContain('gentle simmer')
})
it('warms ladera at 160°C with olive oil while limiting room-temperature serving', () => {
  const advice = inferStorageReheating({ title: 'Fasolakia' })
  expect(advice.reheating).toMatchObject({ appliance: 'oven', targetTempC: 160 })
  expect(advice.reheating.instructions).toMatch(/under 2 hours.*1 hour above 32°C.*olive oil.*74°C/)
})
it.each(['Spanakopita', 'Stifado', 'Pasta', 'Pilaf', 'Vegetable soup', 'Briam', 'Unknown supper'])('returns fresh, safe storage guidance for %s', title => {
  const first = inferStorageReheating({ title })
  expect(first.storageTips.join(' ')).toMatch(/shallow.*refrigerate promptly.*4°C.*within 2 hours.*within 1 hour/)
  expect(first.reheating.instructions).toContain('74°C')
  expect(first.freezerFriendly).toBe(true)
  expect(first.freezerLifeMonths).toBeGreaterThan(0)
  first.storageTips.push('mutated')
  first.reheating.instructions = 'mutated'
  expect(inferStorageReheating({ title }).storageTips).not.toContain('mutated')
  expect(inferStorageReheating({ title }).reheating.instructions).not.toBe('mutated')
})
it('rejects custard freezing for texture, ignores malformed metadata, and leaves caller data untouched', () => {
  expect(inferStorageReheating({ title: 'Bougatsa' })).toMatchObject({ freezerFriendly: false, freezerLifeMonths: null })
  const recipe = Object.freeze({ title: 'Briam', description: null, cuisine: null, ingredients: Object.freeze([null, 3, {}, { name: 'Potatoes' }]), steps: Object.freeze([null, { instruction: 4 }]) })
  expect(inferStorageReheating(recipe)).toMatchObject({ category: 'vegetable_ladera', fridgeLifeDays: 4 })
})
