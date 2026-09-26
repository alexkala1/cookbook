export function evaluateCocktail(ingredients: { name: string }[], instructions = '') {
  const names = ingredients.filter(row => !/\b(?:twists?|peels?|wheels?|zest|wedges?|garnish(?:es)?)\b/i.test(row.name)).map(row => row.name).join(' ').toLowerCase()
  const citrus = /lemon|lime|citrus|orange juice|pineapple|λεμόν|λάιμ/.test(names)
  const sparkling = /soda|tonic|sparkling|champagne|prosecco/.test(names)
  if (citrus && sparkling) return {
    technique: 'Shaken, topped with sparkling', dilutionPercent: [50, 60], temperatureDropC: [20, 25], glassware: 'Flute',
    note: 'Shake the still base with ice, strain, then top with sparkling. Never shake carbonation. Estimates apply to the base before topping.'
  }
  if (sparkling) return { technique: 'Built', dilutionPercent: [10, 20], temperatureDropC: [10, 20], glassware: 'Highball', note: 'Add carbonation last; never shake a sealed carbonated drink. Estimates depend on ice and starting temperature.' }
  const shaken = citrus || /egg|cream|milk/.test(names)
  return {
    technique: shaken ? 'Shaken' : 'Stirred', dilutionPercent: shaken ? [50, 60] : [40, 45], temperatureDropC: shaken ? [20, 25] : [15, 20],
    glassware: /rocks|old fashioned|negroni/i.test(instructions) ? 'Rocks' : shaken ? 'Coupe' : 'Nick & Nora',
    note: 'Approximate added water as a percentage of initial drink volume, starting near room temperature with abundant ice. Actual dilution and temperature vary.'
  }
}
