import { describe, expect, it } from 'vitest'

import {
  aspectSize,
  centerRect,
  checkMinSize,
  clampRect,
  containRect,
  downscale,
  planBatch,
} from './geometry'
import { filePath, filesOf, newImageFolder, publicUrl, randomUuid, smallOf } from './paths'

describe('checkMinSize', () => {
  it('cover needs 1200 px width (and 400 px height)', () => {
    expect(checkMinSize('cover', 1600, 900)).toBeNull()
    expect(checkMinSize('cover', 800, 600)).toEqual({ key: 'tooSmallCover', w: 800, h: 600 })
    expect(checkMinSize('cover', 1300, 300)).toEqual({ key: 'tooSmallCover', w: 1300, h: 300 })
  })
  it('barber + service photos need 400 × 400', () => {
    expect(checkMinSize('staff', 400, 400)).toBeNull()
    expect(checkMinSize('services', 300, 300)).toEqual({
      key: 'tooSmall',
      w: 300,
      h: 300,
      min: 400,
    })
  })
  it('logo: only the LONG side must be 400 (wide text logos are fine)', () => {
    expect(checkMinSize('logo', 600, 120)).toBeNull()
    expect(checkMinSize('logo', 300, 100)).toEqual({ key: 'tooSmallLogo', w: 300, h: 100 })
  })
  it('gallery: the SHORT side must be 400', () => {
    expect(checkMinSize('gallery', 2000, 400)).toBeNull()
    expect(checkMinSize('gallery', 2000, 399)?.key).toBe('tooSmall')
  })
})

describe('shapes', () => {
  it('centerRect takes the middle', () => {
    expect(centerRect(1000, 600, 1)).toEqual({ x: 200, y: 0, w: 600, h: 600 })
    expect(centerRect(600, 1000, 1)).toEqual({ x: 0, y: 200, w: 600, h: 600 })
    expect(centerRect(1200, 1200, 3)).toEqual({ x: 0, y: 400, w: 1200, h: 400 })
  })
  it('downscale never makes a photo bigger', () => {
    expect(downscale({ w: 3000, h: 1000 }, { w: 1600, h: 533 })).toEqual({ w: 1599, h: 533 })
    expect(downscale({ w: 400, h: 400 }, { w: 480, h: 480 })).toEqual({ w: 400, h: 400 })
    expect(downscale({ w: 4000, h: 3000 }, { w: 1600, h: 1600 })).toEqual({ w: 1600, h: 1200 })
  })
  it('aspectSize: exact cover 1600×533 / 800×267, squares, no upscaling', () => {
    expect(aspectSize({ w: 3000, h: 1000 }, 1600, 3)).toEqual({ w: 1600, h: 533 })
    expect(aspectSize({ w: 3000, h: 1000 }, 800, 3)).toEqual({ w: 800, h: 267 })
    expect(aspectSize({ w: 1300, h: 433 }, 1600, 3)).toEqual({ w: 1300, h: 433 })
    expect(aspectSize({ w: 420, h: 420 }, 480, 1)).toEqual({ w: 420, h: 420 })
  })
  it('containRect fits a wide logo whole, centred, with padding', () => {
    // 3:1 logo in a 512 square with 8% padding → 430 wide
    expect(containRect(900, 300, 512, 0.08)).toEqual({ x: 41, y: 185, w: 430, h: 143 })
    // square logo → fills the inner square
    expect(containRect(400, 400, 100, 0.1)).toEqual({ x: 10, y: 10, w: 80, h: 80 })
  })
  it('clampRect keeps a crop area inside the image', () => {
    expect(clampRect({ x: -3.4, y: 10.6, w: 500, h: 200 }, 400, 300)).toEqual({
      x: 0,
      y: 11,
      w: 400,
      h: 200,
    })
    expect(clampRect({ x: 390, y: 290, w: 50, h: 50 }, 400, 300)).toEqual({
      x: 390,
      y: 290,
      w: 10,
      h: 10,
    })
  })
})

describe('planBatch («Ishlarimiz» limit 12)', () => {
  it('takes what fits and counts the rest', () => {
    expect(planBatch([1, 2, 3, 4, 5, 6, 7, 8], 7, 12)).toEqual({
      take: [1, 2, 3, 4, 5],
      skipped: 3,
    })
    expect(planBatch([1, 2], 3, 12)).toEqual({ take: [1, 2], skipped: 0 })
    expect(planBatch([1], 12, 12)).toEqual({ take: [], skipped: 1 })
  })
})

describe('paths', () => {
  const biz = '10000000-0000-0000-0000-00000000000a'
  const id = '00000001-0000-4000-8000-000000000000'
  it('builds the layout the Storage rules expect', () => {
    const folder = newImageFolder(biz, 'cover', id)
    expect(filePath(folder, 'lg', 'webp')).toBe(`${biz}/cover/${id}/lg.webp`)
    expect(smallOf(`${biz}/cover/${id}/lg.jpg`)).toBe(`${biz}/cover/${id}/sm.jpg`)
    expect(filesOf(`${biz}/staff/${id}/lg.webp`)).toEqual([
      `${biz}/staff/${id}/lg.webp`,
      `${biz}/staff/${id}/sm.webp`,
    ])
  })
  it('makes a public link', () => {
    expect(publicUrl('https://x.supabase.co/', `${biz}/logo/${id}/lg.png`)).toBe(
      `https://x.supabase.co/storage/v1/object/public/salon-images/${biz}/logo/${id}/lg.png`,
    )
  })
  it('a new folder gets a fresh random id each time', () => {
    expect(newImageFolder(biz, 'gallery')).not.toBe(newImageFolder(biz, 'gallery'))
  })
  it('random ids are valid v4 UUIDs (the Storage rule checks the format) — no randomUUID needed', () => {
    const original = crypto.randomUUID
    // simulate plain-http (not a "secure context"): randomUUID is missing there
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      for (let i = 0; i < 50; i++) {
        expect(randomUuid()).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        )
      }
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true })
    }
  })
})
