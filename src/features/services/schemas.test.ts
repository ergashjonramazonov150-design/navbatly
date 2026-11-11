import { describe, expect, it } from 'vitest'

import { serviceSchema } from './schemas'

const valid = {
  name: 'Soch olish',
  description: 'Yuvish va ukladka bilan',
  duration: '30',
  price: '80000',
  isActive: true,
}
const errorsOf = (input: object) => {
  const r = serviceSchema.safeParse({ ...valid, ...input })
  return r.success ? [] : r.error.issues.map((i) => `${String(i.path[0])}:${i.message}`)
}

describe('serviceSchema', () => {
  it('accepts a valid service and converts numbers', () => {
    expect(serviceSchema.parse(valid)).toEqual({
      name: 'Soch olish',
      description: 'Yuvish va ukladka bilan',
      duration: 30,
      price: 80000,
      isActive: true,
    })
  })

  it('trims the name and description', () => {
    const v = serviceSchema.parse({ ...valid, name: '  Soqol  ', description: '  ' })
    expect(v.name).toBe('Soqol')
    expect(v.description).toBe('')
  })

  it('mirrors the database limits', () => {
    expect(errorsOf({ name: 'A' })).toEqual(['name:validation.nameMin'])
    expect(errorsOf({ name: 'x'.repeat(81) })).toEqual(['name:validation.nameMax'])
    expect(errorsOf({ description: 'x'.repeat(301) })).toEqual([
      'description:validation.descriptionMax',
    ])
    expect(errorsOf({ duration: '4' })).toEqual(['duration:validation.durationInvalid'])
    expect(errorsOf({ duration: '481' })).toEqual(['duration:validation.durationInvalid'])
  })

  it('price: digits only, 0 allowed (free service), empty rejected', () => {
    expect(serviceSchema.parse({ ...valid, price: '0' }).price).toBe(0)
    expect(errorsOf({ price: '' })).toEqual(['price:validation.priceRequired'])
    expect(errorsOf({ price: '80 000' })).toEqual(['price:validation.priceRequired'])
    expect(errorsOf({ price: '-5' })).toEqual(['price:validation.priceRequired'])
  })
})
