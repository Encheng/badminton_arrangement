// src/utils/__tests__/badges.test.js
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getBadges } from '../badges.js'

function makeSession(date, memberIds) {
  return {
    session_id: `s-${date}`,
    date,
    attendances: memberIds.map(id => ({ member_id: id, name: id, type: 'member' })),
  }
}

const members = [
  { id: 'm1', name: 'Peter', active: true },
  { id: 'm2', name: 'Andy',  active: true },
]

describe('getBadges', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ignores future pre-arranged sessions when judging badges', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-20T12:00:00'))

    const sessions = [
      makeSession('2026-03-22', ['m1']),
      makeSession('2026-03-29', ['m1']),
      makeSession('2026-04-05', ['m1']),
      makeSession('2026-04-12', ['m1']),
      makeSession('2026-04-19', ['m1']),
      makeSession('2026-04-26', ['m2']), // 未來場次，m1 尚未被勾進名單
    ]
    const badges = getBadges('m1', sessions, members)
    // 連續 5 週不應被未來場次中斷
    expect(badges.find(b => b.id === 'streak_5').unlocked).toBe(true)
    // 出席次數也不應計入未來場次（m1 應為 5 次）
    expect(badges.find(b => b.id === 'count_10').progress.current).toBe(5)
  })

  it('unlocks count_10 when member attended 10+ times', () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession(`2026-0${Math.floor(i/4)+1}-${String((i%4)*7+1).padStart(2,'0')}`, ['m1'])
    )
    const badges = getBadges('m1', sessions, members)
    expect(badges.find(b => b.id === 'count_10').unlocked).toBe(true)
    expect(badges.find(b => b.id === 'count_20').unlocked).toBe(false)
  })

  it('unlocks streak_5 when member has 5 consecutive sessions', () => {
    const sessions = [
      makeSession('2026-03-22', ['m1']),
      makeSession('2026-03-29', ['m1']),
      makeSession('2026-04-05', ['m1']),
      makeSession('2026-04-12', ['m1']),
      makeSession('2026-04-19', ['m1']),
    ]
    const badges = getBadges('m1', sessions, members)
    expect(badges.find(b => b.id === 'streak_5').unlocked).toBe(true)
  })

  it('does not unlock streak_5 when streak is broken', () => {
    const sessions = [
      makeSession('2026-03-22', ['m1']),
      makeSession('2026-03-29', []),        // missed
      makeSession('2026-04-05', ['m1']),
      makeSession('2026-04-12', ['m1']),
      makeSession('2026-04-19', ['m1']),
    ]
    const badges = getBadges('m1', sessions, members)
    expect(badges.find(b => b.id === 'streak_5').unlocked).toBe(false)
  })

  it('unlocks annual_top for the member with most attendance this year', () => {
    const sessions = [
      makeSession('2026-04-05', ['m1', 'm2']),
      makeSession('2026-04-12', ['m1']),
      makeSession('2026-04-19', ['m1']),
    ]
    const m1Badges = getBadges('m1', sessions, members)
    const m2Badges = getBadges('m2', sessions, members)
    expect(m1Badges.find(b => b.id === 'annual_top').unlocked).toBe(true)
    expect(m2Badges.find(b => b.id === 'annual_top').unlocked).toBe(false)
  })

  it('returns all 8 badge definitions for any member', () => {
    const badges = getBadges('m1', [], members)
    expect(badges).toHaveLength(8)
  })

  it('every badge has a desc field', () => {
    const badges = getBadges('m1', [], members)
    for (const b of badges) {
      expect(b.desc).toBeDefined()
      expect(typeof b.desc).toBe('string')
      expect(b.desc.length).toBeGreaterThan(0)
    }
  })

  it('returns progress data for quantifiable badges', () => {
    const sessions = [
      makeSession('2026-04-05', ['m1']),
      makeSession('2026-04-12', ['m1']),
      makeSession('2026-04-19', ['m1']),
    ]
    const badges = getBadges('m1', sessions, members)

    const streak5 = badges.find(b => b.id === 'streak_5')
    expect(streak5.progress).toEqual({ current: 3, target: 5, label: '連續週數' })

    const count10 = badges.find(b => b.id === 'count_10')
    expect(count10.progress).toEqual({ current: 3, target: 10, label: '出席次數' })
  })

  it('returns null progress for week_champ', () => {
    const badges = getBadges('m1', [], members)
    const weekChamp = badges.find(b => b.id === 'week_champ')
    expect(weekChamp.progress).toBeNull()
  })
})
