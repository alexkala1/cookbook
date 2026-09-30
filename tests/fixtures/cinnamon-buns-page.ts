// Representative DOM and source quantities: metadata-only JSON-LD, separate ingredient
// article, and four ordered lists whose numbering restarts for each method section.
const sections = [
  ['Dough', ['Whisk milk, yeast and egg; add sugar, cardamom and salt.', 'Add flour gradually and mix in butter for 4 minutes.', 'Knead for 8–10 minutes, cover and proof for 45–60 minutes until doubled.']],
  ['Filling', ['Beat the butter, dark sugar, salt and spices, then add light brown sugar.']],
  ['Shaping', ['Roll to a 56 × 38 cm rectangle.', 'Spread filling, leaving a 1.3 cm border.', 'Fold into thirds and roll gently.', 'Rotate and roll to 61 × 20 cm; cut 24 strips.', 'Stretch each strip to 46 cm, twist and wrap into a knot.']],
  ['Proof and Bake', ['Butter the tins, sprinkle sugar and proof the buns for 45–60 minutes.', 'Whisk egg and milk; brush on the egg wash.', 'Bake at 190°C for 18–20 minutes; cool in the tin for 2–3 minutes and on a rack for 5–10 minutes.']]
] as const
const ingredients = [
  ['Dough', ['1 cup + 2 tsp (250g) whole milk', '1 Tbsp + 2 tsp (12g) active dry yeast', '1 large egg', '¼ cup + 1 Tbsp (65g) granulated sugar', '2 tsp (7g) ground cardamom', '1 Tbsp + ½ tsp (12g) fine sea salt', '4⅓ cups (650g) bread flour', '¾ cup + 1 Tbsp (190g) unsalted butter', 'Unsalted butter, for greasing', 'Light brown sugar, for sprinkling']],
  ['Filling', ['¾ cup + 2 Tbsp (200g) unsalted butter', '¼ cup (50g) dark brown sugar', '1.5 tsp (5g) fine sea salt', '1 Tbsp (10g) ground cinnamon', '1 tsp (3g) ground cardamom', '1 cup (200g) light brown sugar']],
  ['Proof and Bake', ['Unsalted butter, for greasing', 'Light brown sugar, for sprinkling', '1 large egg', '2 Tbsp (30mL) whole milk', 'Swedish pearl sugar, optional']]
] as const
export const cinnamonBunsPage = `<html><head><script type="application/ld+json">${JSON.stringify({
  '@type': 'Recipe', name: 'Scandinavian cinnamon buns', description: 'A source recipe.',
  recipeYield: '24', prepTime: '20 min', cookTime: '1 hr', totalTime: '3 hrs'
})}</script></head><body><h1>Scandinavian cinnamon buns</h1>
<div class="recipe-card-recommendations"><h3>Other recipes</h3><p>A list of related snacks, main dishes and breads to try on another day, unrelated to this recipe.</p></div>
<main><p>Prep:</p><p>20 min</p><p>Cook:</p><p>1 hr</p><p>Serves:</p><p>24</p>
<div><h2>Ingredients</h2><article class="ingredients-list">${ingredients.map(([section, rows]) => `<p><strong>${section}:</strong></p><ul>${rows.map(row => `<li>${row}</li>`).join('')}</ul>`).join('')}</article></div>
<div><h2>Directions</h2>${sections.map(([section, rows]) => `<p><strong>${section}:</strong></p><ol>${rows.map(row => `<li>${row}</li>`).join('')}</ol>`).join('')}<p>*Notes:</p><ul><li>A baking sheet may be used instead.</li></ul><h2>Comments and ratings</h2><p>A related recipe takes 12 hours.</p></div></main></body></html>`
