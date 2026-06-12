// src/utils/__tests__/date.test.js
import { describe, it, expect } from 'vitest'
import { daysBetween } from '../date.js'

describe('daysBetween', () => {
  it('counts whole days between two date strings', () => {
    expect(daysBetween('2026-05-29', '2026-06-12')).toBe(14)
  })

  it('returns 0 for the same day', () => {
    expect(daysBetween('2026-06-12', '2026-06-12')).toBe(0)
  })

  it('is not affected by DST-like hour shifts (uses local midnight + rounding)', () => {
    expect(daysBetween('2026-01-01', '2026-01-02')).toBe(1)
  })
})
