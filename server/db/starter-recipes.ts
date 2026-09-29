import type { RecipeInput } from '../utils/validation'

/** Original starter recipes, written for this cookbook; quantities use fine Greek sea salt. */
export const starterRecipes: RecipeInput[] = [
  {
    title: 'Arni me Patates', recipeType: 'food', cuisine: 'Greek', sourceType: 'manual',
    description: 'Main · Sunday lamb shoulder with lemon, oregano and potatoes roasted in the pan juices.',
    servings: 6, prepTimeMinutes: 25, cookTimeMinutes: 180, difficulty: 'easy', originalSaltType: 'greek_fine_sea_salt',
    heirloomNotes: 'Passed down from Yiayia Eleni (Chios, Sunday family ritual since 1968). Bring the heavy roasting pan straight to the wooden table with crusty sourdough to soak up the lemony olive oil juices.',
    storageReheating: 'Refrigerate leftovers promptly in shallow containers; reheat covered with a splash of water.',
    ingredients: [
      { name: 'Lamb shoulder', amount: 1800, unit: 'g', category: 'meat' },
      { name: 'Potatoes', amount: 1200, unit: 'g', category: 'produce', notes: 'Cut into thick wedges' },
      { name: 'Lemon juice', amount: 100, unit: 'ml', category: 'produce' },
      { name: 'Olive oil', amount: 80, unit: 'ml' }, { name: 'Garlic', amount: 6, unit: 'clove' },
      { name: 'Dried oregano', amount: 2, unit: 'tsp' }, { name: 'Greek fine sea salt', amount: 2, unit: 'tsp' },
      { name: 'Black pepper', amount: 0.5, unit: 'tsp' }, { name: 'Water', amount: 300, unit: 'ml' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Heat the conventional oven to 190°C. Rub the lamb with olive oil, crushed garlic, oregano, salt and pepper. Arrange potatoes around it; pour lemon juice and water into the pan.', durationMinutes: 15, sensoryAroma: 'Bright lemon and resinous oregano.' },
      { stepNumber: 2, instruction: 'Cover tightly and roast for 150 minutes at 190°C. Check after 90 minutes and add hot water if the pan is drying. Check the thickest meat away from bone with a thermometer: reach at least 74°C, then continue until fork-tender.', durationMinutes: 150, timerRequired: true, internalTempTargetC: 74, scienceWhy: 'Prolonged moist heat softens collagen in shoulder; temperature alone does not guarantee tenderness.', sensoryTexture: 'A fork enters easily and the meat begins to separate.', failurePrevention: 'Keep liquid in the pan; a dry pan scorches lemon and garlic.' },
      { stepNumber: 3, instruction: 'Uncover and roast for 30 minutes, turning the potatoes once, until golden. Rest the lamb for 15 minutes before serving with the pan juices.', durationMinutes: 30, timerRequired: true, sensoryVisual: 'Golden potato edges and browned lamb.', sensoryAudio: 'Gentle sizzling in the pan.', scienceWhy: 'Uncovering permits evaporation and surface browning; resting makes carving easier.' }
    ],
    equipment: [{ name: 'Deep roasting pan with lid', substituteTool: 'Roasting tin tightly covered with foil' }, { name: 'Probe thermometer' }]
  },
  {
    title: 'Traditional Spanakopita', recipeType: 'baking', cuisine: 'Greek', sourceType: 'manual',
    description: 'Appetizer · Hand-rolled phyllo filled with spinach, leeks, dill and barrel-aged feta.',
    servings: 8, prepTimeMinutes: 75, cookTimeMinutes: 50, difficulty: 'advanced', originalSaltType: 'greek_fine_sea_salt',
    heirloomNotes: 'Handwritten on a flour-dusted index card in 1974. The secret is rolling the phyllo paper-thin with olive oil and wild mountain greens. Squeeze the greens completely dry so the bottom stays crisp as glass.',
    storageReheating: 'Refrigerate cooled slices and reheat uncovered in an oven to restore crispness.',
    ingredients: [
      { name: 'Spinach', amount: 1000, unit: 'g', category: 'produce' }, { name: 'Barrel-aged feta', amount: 300, unit: 'g', category: 'dairy' },
      { name: 'Leeks', amount: 250, unit: 'g', category: 'produce' }, { name: 'Dill', amount: 25, unit: 'g' },
      { name: 'Wheat flour', amount: 500, unit: 'g', notes: 'Plus a little for rolling homemade phyllo' },
      { name: 'Water', amount: 250, unit: 'ml' }, { name: 'Olive oil', amount: 120, unit: 'ml', notes: '40 ml dough, 30 ml filling, 50 ml brushing' },
      { name: 'Wine vinegar', amount: 1, unit: 'tbsp' }, { name: 'Greek fine sea salt', amount: 0.5, unit: 'tsp' }, { name: 'Black pepper', amount: 0.5, unit: 'tsp' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Mix flour, salt, water, vinegar and 40 ml oil. Knead until smooth, divide into six balls and rest covered for 30 minutes.', durationMinutes: 30, timerRequired: true, sensoryTexture: 'Supple dough that stretches without tearing.', scienceWhy: 'Resting relaxes gluten, making thin phyllo easier to roll.' },
      { stepNumber: 2, instruction: 'Slice leeks and soften in 30 ml oil over medium-low heat for 10 minutes. Add spinach in batches and wilt. Cool, squeeze out excess liquid, then fold in crumbled feta, chopped dill and pepper.', durationMinutes: 15, heatLevel: 'medium-low', sensoryVisual: 'Dark green leaves with no puddles of liquid.', failurePrevention: 'Cool and drain the filling before assembly to avoid a soggy bottom.' },
      { stepNumber: 3, instruction: 'Heat the conventional oven to 180°C. Roll each dough ball into a thin sheet. Brush a 30 cm pan with oil, layer three sheets with oil between, add filling and cover with three more oiled sheets. Tuck edges and score the top into portions.', durationMinutes: 25, sensoryTexture: 'Thin, flexible sheets; small tears can be overlapped.' },
      { stepNumber: 4, instruction: 'Bake for 50 minutes at 180°C until deeply golden. Rest for 15 minutes before cutting through the scored portions.', durationMinutes: 50, timerRequired: true, sensoryVisual: 'Golden, visibly separated layers.', sensoryAudio: 'The pastry crackles when cut.', scienceWhy: 'Oil separates the sheets while steam lifts the layers; moisture must escape for crispness.' }
    ],
    equipment: [{ name: 'Rolling pin' }, { name: '30 cm baking pan' }, { name: 'Large frying pan' }]
  },
  {
    title: 'Santorini Fava', recipeType: 'food', cuisine: 'Greek', sourceType: 'manual',
    description: 'Side · Silky yellow split-pea purée with red onion, capers and a generous finish of olive oil.',
    servings: 6, prepTimeMinutes: 10, cookTimeMinutes: 50, difficulty: 'easy', originalSaltType: 'greek_fine_sea_salt',
    heirloomNotes: 'From the volcanic terraces of Santorini. Not broad beans, but yellow split peas simmered until they collapse into velvety silk. Serve lukewarm with sweet red onion and capers on a warm summer evening.',
    storageReheating: 'Refrigerate promptly. Loosen with hot water when reheating; the purée thickens as it cools.',
    ingredients: [
      { name: 'Yellow split peas', amount: 300, unit: 'g' }, { name: 'Red onions', amount: 200, unit: 'g', notes: 'Half for cooking, half finely sliced for serving' },
      { name: 'Water', amount: 1000, unit: 'ml' }, { name: 'Olive oil', amount: 80, unit: 'ml' },
      { name: 'Capers', amount: 30, unit: 'g', notes: 'Rinsed and drained' }, { name: 'Lemon juice', amount: 30, unit: 'ml' },
      { name: 'Greek fine sea salt', amount: 0.5, unit: 'tsp' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Rinse the split peas. Place in a pot with water and half the onion, roughly chopped. Bring to a boil and skim the foam.', durationMinutes: 10, heatLevel: 'high', sensoryVisual: 'Pale foam rises to the surface.' },
      { stepNumber: 2, instruction: 'Lower the heat and simmer for 40 minutes, stirring more often as the peas soften. Add hot water if needed to keep the mixture loose.', durationMinutes: 40, timerRequired: true, heatLevel: 'low', sensoryTexture: 'Peas collapse easily against the spoon.', sensoryAudio: 'Slow, soft bubbles rather than a rolling boil.', scienceWhy: 'Hydrated starch and softened cell walls give the purée its body.', failurePrevention: 'Stir along the base to prevent the thickening peas from catching.' },
      { stepNumber: 3, instruction: 'Blend until smooth with salt and half the olive oil. Adjust to a soft spoonable consistency with hot water. Serve with the remaining sliced onion, capers, lemon juice and oil.', durationMinutes: 5, sensoryTexture: 'Velvety and spoonable, never stiff or dry.', sensoryAroma: 'Fruity olive oil and fresh onion.' }
    ],
    equipment: [{ name: 'Heavy saucepan' }, { name: 'Immersion blender', substituteTool: 'Food mill' }]
  },
  {
    title: 'Classic Fasolada', recipeType: 'food', cuisine: 'Greek', sourceType: 'manual',
    description: 'Main · White bean soup with celery, carrots, tomato passata and olive oil. Start the beans the night before.',
    servings: 6, prepTimeMinutes: 20, cookTimeMinutes: 100, totalTimeMinutes: 840, difficulty: 'easy', originalSaltType: 'greek_fine_sea_salt',
    heirloomNotes: 'The national comfort dish of Greece, cooked every winter Monday in our family home. The beans must soak slowly overnight; take your time simmering until the olive oil emulsions form a rich, golden-rust broth.',
    storageReheating: 'Cool in shallow containers and refrigerate promptly. Reheat with extra water as the beans absorb broth.',
    ingredients: [
      { name: 'Dried white beans', amount: 500, unit: 'g' }, { name: 'Celery', amount: 150, unit: 'g' },
      { name: 'Carrots', amount: 250, unit: 'g' }, { name: 'Onion', amount: 200, unit: 'g' },
      { name: 'Tomato passata', amount: 400, unit: 'ml' }, { name: 'Olive oil', amount: 100, unit: 'ml' },
      { name: 'Water', amount: 1800, unit: 'ml', notes: 'Fresh cooking water, plus water for soaking' },
      { name: 'Greek fine sea salt', amount: 1, unit: 'tsp' }, { name: 'Black pepper', amount: 0.5, unit: 'tsp' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Soak the white beans overnight for 12 hours in plenty of cold water in the refrigerator. Drain and rinse before cooking.', durationMinutes: 720, scienceWhy: 'Soaking hydrates the beans more evenly before cooking.' },
      { stepNumber: 2, instruction: 'Cover beans with the fresh cooking water, bring to a full boil and boil for 10 minutes. Reduce heat, add chopped celery, carrots and onion, then simmer for 60 minutes or until the beans are nearly tender.', durationMinutes: 70, timerRequired: true, heatLevel: 'low', sensoryTexture: 'A bean yields when pressed; its centre is no longer chalky.', failurePrevention: 'Do not judge doneness by the clock alone; older beans need more time.' },
      { stepNumber: 3, instruction: 'Add passata, olive oil, salt and pepper. Simmer for 30 minutes until the beans are completely tender and the broth thickens. Add hot water if needed.', durationMinutes: 30, timerRequired: true, heatLevel: 'low', sensoryVisual: 'Rust-red broth lightly coats a spoon.', sensoryAroma: 'Sweet tomato and celery.', scienceWhy: 'Adding acidic tomato after the beans soften avoids slowing their softening early in cooking.' }
    ],
    equipment: [{ name: 'Large soup pot' }, { name: 'Colander' }]
  },
  {
    title: 'Revani with Citrus Syrup', recipeType: 'dessert', cuisine: 'Greek', sourceType: 'manual',
    description: 'Dessert · Golden semolina and yogurt cake scented with orange, soaked with cooled citrus syrup.',
    servings: 12, prepTimeMinutes: 25, cookTimeMinutes: 40, difficulty: 'intermediate', originalSaltType: 'greek_fine_sea_salt',
    heirloomNotes: 'A celebration cake from Veroia, baked for name days and Sunday afternoons. Ladle the cool orange syrup slowly over the piping hot semolina cake and let it rest until every grain glistens.',
    storageReheating: 'Cover and refrigerate after cooling. Bring individual portions toward room temperature before serving.',
    ingredients: [
      { name: 'Fine semolina', amount: 200, unit: 'g', notes: 'Wheat semolina' }, { name: 'Wheat flour', amount: 100, unit: 'g' },
      { name: 'Greek yogurt', amount: 200, unit: 'g', category: 'dairy' }, { name: 'Eggs', amount: 3, unit: 'piece' },
      { name: 'Sugar', amount: 450, unit: 'g', notes: '150 g cake, 300 g syrup' }, { name: 'Olive oil', amount: 100, unit: 'ml' },
      { name: 'Orange zest', amount: 2, unit: 'tsp' }, { name: 'Orange juice', amount: 100, unit: 'ml' },
      { name: 'Water', amount: 300, unit: 'ml' }, { name: 'Lemon juice', amount: 1, unit: 'tbsp' },
      { name: 'Baking powder', amount: 2, unit: 'tsp' }, { name: 'Greek fine sea salt', amount: 0.25, unit: 'tsp' }
    ],
    steps: [
      { stepNumber: 1, instruction: 'Combine 300 g sugar, water, orange juice and lemon juice. Bring to a boil, then simmer for 5 minutes. Remove from the heat and let the syrup cool to room temperature.', durationMinutes: 5, timerRequired: true, heatLevel: 'medium', sensoryVisual: 'Clear, fluid syrup; not caramel.', scienceWhy: 'A brief simmer dissolves sugar without concentrating the syrup into a thick candy stage.', failurePrevention: 'Do not reduce to a sticky thread; thick syrup soaks unevenly.' },
      { stepNumber: 2, instruction: 'Heat the conventional oven to 170°C and oil a 24 cm cake pan. Beat eggs with the remaining 150 g sugar until pale. Fold in yogurt, oil and zest, then semolina, flour, baking powder and salt.', durationMinutes: 15, sensoryTexture: 'A thick, pourable batter.', scienceWhy: 'Gentle mixing after flour is added limits gluten development.' },
      { stepNumber: 3, instruction: 'Bake for 35 minutes at 170°C, until golden and a skewer comes out clean. Cut the hot cake into squares while still in the pan.', durationMinutes: 35, timerRequired: true, sensoryVisual: 'Golden top with edges pulling slightly from the pan.', sensoryAroma: 'Warm orange and toasted semolina.' },
      { stepNumber: 4, instruction: 'Slowly ladle the cooled syrup over the hot cake in several passes. Allow each addition to soak in. Rest for at least 120 minutes before serving.', durationMinutes: 120, timerRequired: true, sensoryTexture: 'Moist, tender grains that hold together when sliced.', scienceWhy: 'The porous crumb draws in fluid syrup; applying cooled syrup to hot cake controls further cooking and lets absorption proceed gradually.', failurePrevention: 'Avoid pouring boiling syrup over a fragile hot cake; add gradually to prevent pooling and collapse.' }
    ],
    equipment: [{ name: '24 cm cake pan' }, { name: 'Small saucepan' }, { name: 'Whisk', substituteTool: 'Hand mixer' }]
  }
]
