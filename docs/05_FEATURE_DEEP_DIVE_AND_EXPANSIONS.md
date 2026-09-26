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

## 11. Feature 11: Regional Smart Grocery & Multi-Course Shopping Engine

Planning a multi-course dinner (e.g., an **Appetizer, Main Course, and Dessert**) requires sophisticated shopping logistics. Heirloom turns individual recipe ingredients into a single, cohesive, market-aware shopping mission.

### 1. Multi-Course Consolidation & Ingredient Union
When you select an entire menu (e.g., *Appetizer: Kolokithokeftedes (Zucchini Fritters) + Main: Slow-Roasted Lamb with Lemon Potatoes + Dessert: Portokalopita (Orange Phyllo Cake)*):
- **Cross-Recipe Mathematical Merging:**
  - **Lemons:** 2 (appetizer dip) + 3 (main lamb marinade) + 1 (dessert orange-lemon syrup) -> **Total: 6 lemons (~700g)**.
  - **Eggs:** 1 (fritter binder) + 0 (main) + 4 (cake custard) -> **Total: 5 eggs**.
  - **Olive Oil:** 120ml (frying) + 80ml (roasting) + 50ml (cake) -> **Total: 250ml EVOO**.
  - **Fresh Herbs:** 1 bunch dill, 1 bunch mint (shared across zucchini fritters and roast marinade).
- **Per-Course Usage Badges:** Each item on the shopping list shows where it is going:
  - *Lemons (6 pcs)* -> `[Appetizer: 2] [Main: 3] [Dessert: 1]`

### 2. Regional Market Routing (Greek & Mediterranean Store Geographies)
Unlike generic US apps that assume a single big-box supermarket with numbered aisles, Mediterranean and Greek food shopping is often multi-stop or department-specialized. Heirloom organizes the list by authentic shopping destinations:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 📍 LAIKI AGORA / MANAVIS (Greengrocer & Produce)                       │
│ • 1.5kg Potatoes (Yukon Gold or Agria - ideal for roasting)           │
│ • 1kg Medium Zucchinis (firm, shiny skin)                              │
│ • 6 Lemons (unwaxed, thin skin for heavy juicing)                      │
│ • 4 Oranges (thick aromatic rind for Portokalopita zest)               │
│ • Fresh Herbs: 1 bunch Dill (άνηθος), 1 bunch Spearmint (δυόσμος)      │
│ • 1 head Garlic (σκορδο)                                              │
├────────────────────────────────────────────────────────────────────────┤
│ 🥩 CHASAPIS (Traditional Butcher Counter)                             │
│ • 1.4kg Lamb Shoulder (Αρνίσια Σπάλα)                                  │
│   🗣️ WHAT TO SAY: "1.4kg αρνίσια σπάλα με κόκκαλο, κομμένη σε μερίδες  │
│      για γάστρα/ταψί."                                                 │
├────────────────────────────────────────────────────────────────────────┤
│ 🥖 FOURNOS (Local Bakery)                                              │
│ • 1x 450g pack Traditional Phyllo (Φύλλο Κρούστας για γλυκά)          │
│ • 1 Loaf Sourdough Bread (Χωριάτικο προζυμένιο)                       │
├────────────────────────────────────────────────────────────────────────┤
│ 🛒 SUPERMARKET (Sklavenitis / AB / Masoutis)                           │
│ • 300g Feta PDO (barrel-aged / βαρελίσια)                             │
│ • 150g Graviera or Kefalotyri (for grating into fritters)             │
│ • 1x 10-pack Fresh Eggs (Large / 63-73g)                               │
│ • 1kg All-Purpose Flour (Αλεύρι για όλες τις χρήσεις)                  │
│ • Greek Dried Wild Oregano (Ρίγανη βουνού)                             │
│ • 1x 200g Greek Strained Yogurt 10% (for the garlic yogurt dip)       │
│ • Baking Powder (Μπέικιν Πάουντερ)                                     │
├────────────────────────────────────────────────────────────────────────┤
│ 🍷 KAVA / CELLAR (Beverage & Wine Pairings)                            │
│ • Starter/Appetizer: Crisp Assyrtiko (Santorini) or fresh Tsipouro    │
│ • Main Lamb: Agiorgitiko (Nemea) or Xinomavro (Naoussa)                │
│ • Dessert: Sweet Samos Vin Doux or chilled Masticha liquor             │
└────────────────────────────────────────────────────────────────────────┘
```

### 3. Commercial Pack-Size Rounding & Leftover Waste Prevention
Recipes call for exact culinary grams, but stores sell packaged goods:
- **Pack-Size Reality:**
  - Recipe needs **5 eggs** -> Supermarkets sell in 6 or 10-packs. The list says: *"Need: 5 eggs | Buy: 1x 6-pack (1 egg remaining)"*.
  - Recipe needs **350g phyllo** -> Sold in 450g boxes. The list says: *"Need: 350g | Buy: 1x 450g box (100g surplus)"*.
- **Leftover Waste Prevention Card:**
  - When surplus ingredients exist, Heirloom automatically generates a 1-tap leftover suggestion:
    - *"You will have 100g of phyllo leftover from the Portokalopita: Brush with leftover butter, dust with cinnamon-sugar, and bake for 8 mins for crispy coffee crisps!"*

### 4. Interactive In-Store Checklist
- Strike-through as you pick up items.
- Live pantry sync: items already in your kitchen are automatically marked "Already in Pantry" with a single tap to unhide.
- Offline-ready: Works seamlessly in underground supermarket basements with zero mobile signal.

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

---

## 13. Feature 13: Heat Source & Cookware Thermodynamics Adapter

A recipe stating "cook over medium-high heat for 6 minutes" produces completely different outcomes depending on the stove and pan:
- **Cooktop Thermodynamics:**
  - *Gas Flame:* Heat curls around the bottom and climbs up the sidewalls. Excellent for woks and Dutch ovens.
  - *Induction:* Extreme, instantaneous energy delivered exclusively to the pan base. Zero heat on pan sidewalls. Heats 3x faster than gas; high risk of burning garlic in 10 seconds. Heirloom adjusts instructions: *"On induction: use power level 6/10, not 8/10; do not leave pan empty on burner."*
  - *Electric Radiant / Ceramic:* High thermal inertia. Takes 3–5 minutes to cool down after turning knob from High to Low. Heirloom inserts: *"Move skillet to an unused cold burner to stop the sear immediately."*
- **Oven Convection vs Conventional Auto-Conversion:**
  - If a user has a fan-assisted (convection) oven, Heirloom automatically recalculates:
    - **Temperature:** Subtract 20°C (e.g. 200°C static $\rightarrow$ 180°C fan).
    - **Time:** Reduce duration by 10–15% to avoid drying out roasts.
- **Cookware Material Physics:**
  - *Stainless Steel:* Prompts the **Leidenfrost Water Droplet Test** (flick a drop of water; if it glides around like mercury, the pan is at 190°C+ and ready for oil, guaranteeing non-stick searing).
  - *Non-Stick (PTFE):* Proactive safety warning: *"Never preheat empty or use high flame; limits sear temperature."*
  - *Traditional Clay Gastra (Γάστρα):* Thermal shock warning: *"Place in cold or warm oven; never place on direct stovetop burner or into a 220°C oven when cold to prevent cracking."*

---

## 14. Feature 14: Contactless Air-Wave Gesture Navigation (Zero-Touch Kitchen Mode)

In a busy kitchen, two things are guaranteed:
1. **Loud ambient noise:** Range hood fan at max speed, sizzling oil, boiling water, and kitchen chatter drown out speech recognition.
2. **Dirty hands:** Flour, raw chicken, butter, or olive oil coat your fingers. You cannot touch your clean iPad or phone screen.

### The Solution: Vision Gesture Controls (MediaPipe Hands / WebAssembly)
- Runs 100% locally and privately in the browser via front-facing camera (zero video data sent to any cloud).
- **Kitchen Gestures:**
  - 👋 **Wave Left-to-Right:** Advance to Next Step.
  - 👋 **Wave Right-to-Left:** Return to Previous Step.
  - ✋ **Open Palm Hold (2 seconds):** Dismiss / Silence ringing timer alarm.
  - ☝️ **Index Finger Up:** Trigger audio read-out of current step.

---

## 15. Feature 15: Guest Dietary Collision & Allergen Shield

Hosting dinner guests shouldn't require playing Russian roulette with allergies:
- **Guest Profiles:** Save friends and family with their specific needs:
  - *Allergies & Intolerances:* Celiac/Gluten, Lactose, Tree Nuts, Shellfish, Eggs.
  - *Diets & Ethics:* Vegan, Vegetarian, Halal, Kosher, Low-FODMAP.
  - *Genetic Quirks:* OR6A2 cilantro soap-gene detector, bitter-compound sensitivity.
  - *Vulnerabilities:* Pregnancy (pasteurized dairy only, no rare meat, no raw eggs).
- **The Dinner Collision Audit:**
  - When you build a 3-course menu for 6 guests, Heirloom scans every single ingredient across the appetizer, main, and dessert.
  - Highlights collisions in red/amber and suggests **Surgical Micro-Adaptations**:
    - *"Collision detected: Nikos has Celiac Disease (Gluten). In the Main Course, substitute all-purpose flour in the lamb roux with 15g cornstarch or potato starch."*
    - *"Collision detected: Maria is Lactose Intolerant. Plate 1 portion of zucchini fritters without Feta/Graviera; substitute with olive-oil garlic dip."*

---

## 16. Feature 16: Seasonality & Peak Flavor Compensation Engine

Greek and Mediterranean cooking is profoundly seasonal. A tomato salad in August is heaven; in January it tastes like crunchy pink water.
- **Hemisphere & Regional Harvest Calendar:**
  - Detects current month and geographical region.
  - Flags ingredients that are currently out-of-season and would result in bland flavors.
- **Culinary Compensation Hacks (Food Chemistry Fixes):**
  - *Winter Tomatoes:* *"Fresh tomatoes lack summer sunshine sugars and natural glutamates. Fix: Add 1 tsp double-concentrated tomato paste, 1/4 tsp sugar, and 1 tsp red wine vinegar to restore umami balance."*
  - *Winter Strawberries / Stone Fruit:* *"Fruit is underripe and tart. Fix: Macerate in 2 tbsp orange juice and a splash of Greek Metaxa or honey for 30 minutes before assembling dessert."*
  - *Seasonal Green Foraging Guide:* Suggests which wild greens (*χόρτα: βλήτα, ραδίκια, σταμναγκάθι, ζοχοί*) are currently in peak season at the local Laiki Agora.

---

## 17. Feature 17: "Is it Done?" Vision AI Pan Inspector

Novice cooks are constantly plagued by self-doubt: *"Is my roux dark enough?" "Is my custard thickening or is it about to curdle?" "Are my onions caramelized or burnt?"*

### Instant Pan Triage via Camera Snapshot:
- User taps the camera icon in Kitchen Mode to photograph their pan, bowl, or baking sheet.
- Vision AI analyzes color temperature, surface bubbles, sheen, and viscosity:
  - **Pan Example (Roux):** *"Your roux is currently at the 'Peanut Butter / Blonde' stage. For a rich beef stew or gumbo, keep whisking over medium heat for 4 more minutes until it reaches 'Milk Chocolate' hue."*
  - **Sauce Example (Custard / Nappe):** *"Your custard has achieved the Nappe stage: a clear drag line remains on the back of your spoon. Pull pan off the heat immediately to prevent egg protein curdling!"*
  - **Baking Example (Bread):** *"Crust has reached golden amber, but ear expansion indicates under-steamed dough. Bake 5 more minutes at 200°C for proper hollow thumping sound."*


