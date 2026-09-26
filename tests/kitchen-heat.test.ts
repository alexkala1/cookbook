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
