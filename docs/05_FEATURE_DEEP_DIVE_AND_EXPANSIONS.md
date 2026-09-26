# Heirloom: Feature Deep Dive & Functional Capabilities

## 1. Feature 1: The "Culinary Science & Gap-Filler" Engine

```
┌────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Sear the Ribeye Steaks                                         │
│ Heat a heavy cast-iron skillet over high heat until smoking lightly.   │
│ Lay the patted-dry steaks away from you. Sear for 2.5 minutes undisturbed.│
├────────────────────────────────────────────────────────────────────────┤
│ 💡 WHY WE DO THIS (The Science):                                      │
│ Patting the steak completely dry removes surface moisture. Water boiling│
│ absorbs immense latent heat (100°C limit); dry meat reaches 150°C+     │
│ immediately, triggering the Maillard reaction (reducing sugars binding │
│ to amino acids) to create deep savory umami crust.                     │
├────────────────────────────────────────────────────────────────────────┤
│ 👁️ SENSORY MILESTONES:                                                 │
│ • Audio: A violent, continuous hiss (if it sputters quietly, pan is cold)│
│ • Visual: Deep mahogany crust; meat releases easily from the pan       │
│ • Target Temp: Pull at 52°C (125°F) for medium-rare (carries to 55°C)  │
├────────────────────────────────────────────────────────────────────────┤
│ ⚠️ MISTAKE PREVENTION:                                                 │
│ Do NOT move or press down on the steak during the first 2 minutes.    │
│ Moving it cools the pan contact zone and prevents crust crystallization.│
└────────────────────────────────────────────────────────────────────────┘
```

- **Interactive Science Tooltips:** Users can click or tap "Why?" on any step to learn the food science principle (emulsions, gelatinization, caramelization, denaturation, rest periods).
- **Sensory Milestones:** Clear benchmarks replacing ambiguous timers.

---

## 2. Feature 2: Smart Measurement, Scaling & Pan-Size Physics

### True Scaling (Not Just Blind Multiplication):
- Scaling a recipe from 2 to 8 servings is not always simple math:
  - **Salt & Spices:** Scaling linearly can over-season; scaling algorithms apply dampening curves for intense aromatics (clove, star anise, hot chilies).
  - **Evaporation & Surface Area:** A stew for 8 in a wider pot loses liquid at a different rate than a small saucepan for 2.
  - **Pan Size Compensation:** If a baking recipe calls for an 8-inch round cake pan (area: ~50 sq inches) and the user only has a 9x13 inch rectangular pan (area: 117 sq inches), the app calculates the volume ratio (2.34x) and adjusts baking time downwards to account for shallower depth.
- **Metric Primary, Imperial On-Demand:**
  - One-tap switch between Grams/Milliliters and US Cups/Ounces.

---

## 3. Feature 3: Kitchen Mode & Hands-Free Interaction

- **Distraction-Free Cooking View:**
  - Isolates one step at a time in large, readable font (36px+).
  - High contrast designed for bright kitchen lights and viewing from 2 meters away.
- **Screen Wake-Lock:**
  - Utilizes `@vueuse/core` `useWakeLock` to keep the device active without user touch.
- **Embedded Step Timers:**
  - Any step containing duration metadata displays a quick "Start Timer" button.
  - Multiple timers can run simultaneously with unique audio chimes and names.
- **Voice Control (Speech Recognition):**
  - Hands coated in flour or raw meat? Just say:
    - *"Next"* -> advances to step 4.
    - *"What did step 3 say?"* -> reads aloud step 3.
    - *"Start timer for 8 minutes"* -> activates countdown.

---

## 4. Feature 4: Smart Pantry & Intelligent Molecular Substitution

- **Virtual Pantry Inventory:**
  - Track staple ingredients on hand (flours, vinegars, oils, spices, dairy).
  - "Cook with What I Have" generator: Filter cookbook or generate custom dinner based on expiring pantry items.
- **Food Science Substitution Matrix:**
  - When substituting an ingredient, the AI evaluates 3 dimensions:
    1. **Flavor Profile:** Sweetness, acidity, umami, bitterness.
    2. **Moisture Content:** Liquid vs fat vs solid ratio.
    3. **Structural Chemistry:** Gluten content, leavening power, melting point.
  - *Example:* "I don't have heavy cream, can I use milk?"
    - *AI Response:* "Milk has 3.5% fat while heavy cream has 36% fat. If you use milk directly in this pan sauce, it will separate and taste watery. **Fix:** Whisk 180ml whole milk with 60g melted unsalted butter to restore the necessary fat emulsion."

---

## 5. Feature 5: The Multi-Course Dinner Party Conductor

Hosting a dinner party requires executive chef project management. Heirloom automates this:

### The Scenario:
- Serving a 3-course dinner for 6 guests at **20:00**:
  - *Starter:* Seared Scallops with Pea Puree.
  - *Main:* Roast Rack of Lamb with Fondant Potatoes & Glazed Carrots.
  - *Dessert:* Warm Molten Chocolate Lava Cakes.

### The Synchronized Backwards Schedule:
```
15:00 - Prep pea puree and chill. Mix chocolate cake batter and pour into ramekins; refrigerate.
18:30 - Peel and shape fondant potatoes. Brown in pan; pour in stock.
19:00 - Preheat oven to 200°C (395°F).
19:15 - Place fondant potatoes into oven (needs 45 mins).
19:35 - Sear rack of lamb in hot skillet; slide into oven alongside potatoes (needs 20 mins to reach 54°C).
19:55 - PULL LAMB FROM OVEN TO REST (resting 15 mins for carryover heat). Pull potatoes; keep warm.
20:00 - [GUESTS SEATED] Sear scallops (2 mins total); plate with warm pea puree. Serve Course 1!
20:25 - Carve lamb, plate with fondant potatoes and glazed carrots. Serve Main Course!
20:45 - Slide chocolate lava cakes into oven (12 mins bake time).
21:00 - Unmold warm lava cakes; dust with powdered sugar. Serve Dessert!
```

The system identifies bottlenecks (e.g. only 1 oven, 4 burners) and organizes the cooking sequence to avoid conflicts.

---

## 6. Feature 6: Nutritional Analysis & Dietary Safety

- Automatic calculation of calories, protein, carbohydrates, fats, and fiber per serving.
- Allergen tagging (Gluten, Dairy, Peanuts, Tree Nuts, Shellfish, Soy, Eggs, Sesame).
- Dietary filters: Keto, Low-FODMAP, Mediterranean, Vegan, Vegetarian, Diabetic-friendly.

---

## 7. Feature 7: Digital Heirloom Heritage & Keepsake

- **Family Tasting Notes & Logs:**
  - "Cooked this for dad's 60th birthday: reduced sugar to 150g, added orange zest. Perfect."
  - Rate every cook session (1-5 stars) with photos.
- **Recipe Versioning (Forking):**
  - Keep the original canonical recipe, but create family variations (e.g. "Grandma's Original" vs "Alex's Spicy Variation").
- **Physical Keepsake Export:**
  - One-click print-to-PDF designed like classic vintage typography cards, ready to be printed and added to a physical kitchen binder.

---

## 8. Feature 8: "Rescue My Dish" Live Emergency Troubleshooter

In the heat of cooking, mistakes happen fast. A dedicated floating **"🚨 Rescue"** button in Kitchen Mode provides instant, stress-free triage:
- **Common Emergencies Solved by Culinary Science:**
  - *Broken Sauce / Emulsion:* "My Hollandaise or Vinaigrette split!" -> *Fix:* Whisk 1 tsp of warm water (or an egg yolk) in a clean bowl, then slowly stream the broken sauce into it while whisking vigorously to re-establish the emulsion.
  - *Oversalted Soup / Stew:* "I dumped too much salt!" -> *Fix:* Myth-bust potato tricks (potatoes don't absorb salt preferentially). Dilute with unsalted liquid or balance with acid (lemon juice/vinegar) and fat/dairy (cream/butter) to mask perception of saltiness.
  - *Bottom of the Pot Scorching:* "I smell burning on the bottom of my chili/stew!" -> *Fix:* Do NOT scrape! Immediately pour the unburned top layer into a clean pot and discard the bottom 2 inches. Add 1/2 tsp of smoked paprika or cocoa powder to harmonize with any faint smoke aroma.
  - *Soggy Stir-Fry / Steaming Meat:* "Water is pooling in my pan instead of searing!" -> *Fix:* Pan was overcrowded and heat dropped below 100°C. Remove meat immediately with tongs, let pan reheat until smoking, boil off excess liquid, then return meat in batches.

---

## 9. Feature 9: "Mise en Place" Pre-Flight & Equipment Checklist

Before turning on a burner or preheating the oven, Heirloom walks the cook through a 60-second prep check:
- **Equipment Inventory:** Flags non-standard tools (e.g., "This recipe requires an immersion blender or high-speed blender; 12-inch cast-iron skillet; digital meat probe"). Suggests workarounds if a tool is missing.
- **Advance Prep Alerts:**
  - *"Softened Butter"* -> Warns user 1 hour prior.
  - *"Pat Meat Dry"* -> Reminds user to salt and air-dry steaks on a wire rack in the fridge for optimal crust formation.
  - *"Chilled Ingredients"* -> Reminds user to keep butter cubes ice-cold for flaky pie crust or biscuits.

---

## 10. Feature 10: Drink, Mixology & Beverage Craft

Cooking isn't just solid food. Heirloom treats cocktails, mocktails, coffee, and wine pairings as first-class citizens:
- **Cocktail Physics & Dilution Engine:**
  - Understands the scientific difference between **Shaking** (rapid chilling, high dilution ~20-25%, aeration, micro-bubbles for citrus drinks) and **Stirring** (gentle chilling, controlled dilution ~15-20%, crystal-clear silky texture for spirit-forward drinks like Manhattans and Martinis).
  - Calculates Brix sugar levels to balance tartness vs sweetness.
- **Specialty Coffee Ratio Calculator:**
  - Pour-over (V60, Chemex, Aeropress): calculates exact coffee-to-water brew ratios (e.g. 1:16 = 20g coffee to 320g water at 93°C) with timed bloom and pulse pour alerts.
- **Course Pairing Sommelier:**
  - Suggests wine, craft beer, or zero-proof mocktail pairings tailored to the dominant flavor notes of any meal.

---

## 11. Feature 11: Smart Grocery Shopping List with Aisle Consolidation & Pantry Deduplication

- **Cross-Recipe Ingredient Merging:**
  - Planning 3 recipes for the week? Heirloom combines ingredients into a single shopping list:
    - Recipe A needs 200g onions; Recipe B needs 400g onions -> Shopping list: 600g (approx 3 medium) yellow onions.
- **Pantry Deduplication:**
  - If your virtual pantry already has 1kg of flour and 500ml olive oil, Heirloom automatically strikes them from the shopping list.
- **Aisle-by-Aisle Organization:**
  - Sorts list according to physical grocery store geography:
    1. Produce & Herbs
    2. Meat & Seafood
    3. Dairy & Refrigerated
    4. Bakery
    5. Dry Pantry, Canned Goods & Pasta
    6. Spices, Oils & Vinegars
    7. Frozen Foods

---

## 12. Feature 12: Safe Food Storage & Texture-Preserving Reheating

Good cooking doesn't end when the meal is plated:
- **Food Safety Guidelines:**
  - Safe refrigeration shelf-life based on USDA / EFSA standards (e.g., cooked poultry: 3-4 days; seafood: 2 days).
  - Freezer longevity and vacuum-seal recommendations.
- **Texture-Preserving Reheating:**
  - Prevents the dreaded "rubbery microwave syndrome":
    - *Crispy items (pizza, fried chicken, pastries):* "Reheat at 190°C in an oven or air fryer for 5-7 minutes. Do not microwave."
    - *Stews and braises:* "Reheat gently on stovetop with 2 tbsp of water/broth to loosen gelatin."
    - *Pasta:* "Reheat in a skillet with a splash of water and a dab of butter to re-emulsify the sauce."

