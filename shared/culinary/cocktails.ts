export function evaluateCocktail(ingredients: { name: string }[], instructions = '') {
  const names = ingredients.map(row => row.name).join(' ').toLowerCase()
  if (/soda|tonic|sparkling|champagne|prosecco/.test(names)) return { technique: 'Built', dilutionPercent: [10, 20], temperatureDropC: [10, 20], glassware: 'Highball', note: 'Add carbonation last; never shake a sealed carbonated drink. Estimates depend on ice and starting temperature.' }
  const shaken = /lemon|lime|citrus|orange juice|pineapple|egg|cream|milk|λεμόν|λάιμ/.test(names)
  return {
    technique: shaken ? 'Shaken' : 'Stirred', dilutionPercent: shaken ? [30, 35] : [20, 25], temperatureDropC: [20, 25],
    glassware: /rocks|old fashioned|negroni/i.test(instructions) ? 'Rocks' : shaken ? 'Coupe' : 'Nick & Nora',
    note: 'Approximate added water as a percentage of initial drink volume, starting near room temperature with abundant ice. Actual dilution and temperature vary.'
  }
}
