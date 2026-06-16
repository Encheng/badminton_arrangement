import { describe, it, expect } from 'vitest'
import { parseVideoPlayers } from '../videos.js'

describe('parseVideoPlayers', () => {
  it('extracts player tokens from a well-formed title', () => {
    const title = '20260516 千惠 二馬 阿芝 Timo Ruby Fang Peter Sandy 3'
    expect(parseVideoPlayers(title)).toEqual(
      ['千惠', '二馬', '阿芝', 'Timo', 'Ruby', 'Fang', 'Peter', 'Sandy']
    )
  })

  it('handles a single player', () => {
    expect(parseVideoPlayers('20260412 Peter 1')).toEqual(['Peter'])
  })

  it('collapses multiple spaces between tokens', () => {
    expect(parseVideoPlayers('20260412 Peter   Sandy 2')).toEqual(['Peter', 'Sandy'])
  })

  it('returns [] for a title missing the trailing match number', () => {
    expect(parseVideoPlayers('20260412 Peter Sandy')).toEqual([])
  })

  it('returns [] for a title missing the leading date', () => {
    expect(parseVideoPlayers('Peter Sandy 2')).toEqual([])
  })

  it('returns [] for non-string input', () => {
    expect(parseVideoPlayers(null)).toEqual([])
    expect(parseVideoPlayers(undefined)).toEqual([])
  })
})
