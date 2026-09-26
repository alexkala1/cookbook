import { expect, it } from 'vitest'
import { burnerAdvice, convertOven, ovenTemperature } from '../shared/culinary/heat'
it('converts temperature in either direction without changing time', () => {
  expect(convertOven(200, 30, 'static_conventional', 'convection_fan')).toEqual({ temperature: 180, minutes: 30 })
  expect(convertOven(180, 30, 'convection_fan', 'static_conventional')).toEqual({ temperature: 200, minutes: 30 })
  expect(convertOven(400, 30, 'static_conventional', 'convection_fan', 'F')).toEqual({ temperature: 375, minutes: 30 })
  expect(convertOven(375, 30, 'convection_fan', 'static_conventional', 'F')).toEqual({ temperature: 400, minutes: 30 })
})
it('uses reversible 20% time reduction instead of changing temperature', () => {
  expect(convertOven(200, 30, 'static_conventional', 'convection_fan', 'C', 'time')).toEqual({ temperature: 200, minutes: 24 })
  expect(convertOven(200, 24, 'convection_fan', 'static_conventional', 'C', 'time')).toEqual({ temperature: 200, minutes: 30 })
  expect(convertOven(180, 30, 'convection_fan', 'convection_fan')).toEqual({ temperature: 180, minutes: 30 })
  expect(() => convertOven(NaN, 30, 'convection_fan', 'static_conventional')).toThrow()
})
it('extracts oven settings without converting a food thermometer target', () => {
  expect(ovenTemperature('Preheat to 200°C, roast until internal temperature 74°C.')).toEqual({ temperature: 200, unit: 'C' })
  expect(ovenTemperature('Roast until internal temperature 74°C.')).toBeNull()
  expect(ovenTemperature('Roast until internal temperature reaches 165 degrees F.')).toBeNull()
  expect(ovenTemperature('Roast in the oven until it reaches 74°C.')).toBeNull()
  expect(ovenTemperature('Bake at 375 F')).toEqual({ temperature: 375, unit: 'F' })
})
it('adapts guidance to each burner without inventing numeric power equivalence', () => {
  expect(burnerAdvice('gas', 'medium')).toContain('flame')
  expect(burnerAdvice('induction', 'high')).toContain('below boost')
  expect(burnerAdvice('electric_radiant', 'low')).toContain('cool burner')
})
it('never lowers low-temperature oven settings into the danger zone', () => {
  expect(convertOven(70, 240, 'static_conventional', 'convection_fan')).toMatchObject({ temperature: 70, minutes: 240, note: expect.stringContaining('120 °C') })
  expect(convertOven(119, 60, 'static_conventional', 'convection_fan')).toMatchObject({ temperature: 119, note: expect.any(String) })
  expect(convertOven(150, 480, 'static_conventional', 'convection_fan', 'F')).toMatchObject({ temperature: 150, note: expect.any(String) })
  expect(convertOven(120, 60, 'static_conventional', 'convection_fan')).toEqual({ temperature: 100, minutes: 60 })
  expect(convertOven(250, 60, 'static_conventional', 'convection_fan', 'F')).toEqual({ temperature: 225, minutes: 60 })
  // Fan to conventional only raises the setting, which never enters the danger zone.
  expect(convertOven(100, 60, 'convection_fan', 'static_conventional')).toEqual({ temperature: 120, minutes: 60 })
})
it('reads Greek oven settings and clause-bounded until phrases', () => {
  expect(ovenTemperature('Ψήστε στους 180 βαθμούς')).toEqual({ temperature: 180, unit: 'C' })
  expect(ovenTemperature('Προθερμάνετε τον φούρνο στους 200° και ψήστε')).toEqual({ temperature: 200, unit: 'C' })
  expect(ovenTemperature('Ψήστε στους 350 βαθμούς Φαρενάιτ')).toEqual({ temperature: 350, unit: 'F' })
  expect(ovenTemperature('Ψήστε μέχρι το θερμόμετρο να δείξει 75 βαθμούς')).toBeNull()
  expect(ovenTemperature('Roast until thermometer reads 74C, oven 200C')).toEqual({ temperature: 200, unit: 'C' })
  expect(ovenTemperature('Cook until it reaches 74C and rest')).toBeNull()
  expect(ovenTemperature('Bake at 180° for 20 minutes')).toBeNull()
  expect(ovenTemperature('Add 12 cups of stock')).toBeNull()
})
