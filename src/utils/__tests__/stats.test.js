// src/utils/__tests__/stats.test.js
import { describe, it, expect } from 'vitest'
import { buildLeaderboard, getAttendanceCount, getCurrentStreak } from '../stats.js'

const sessions = [
  {
    session_id: 's1', date: '2026-04-05',
    attendances: [
      { member_id: 'm1', name: 'Peter', type: 'member' },
      { member_id: 'm2', name: 'Andy',  type: 'member' },
    ],
  },
  {
    session_id: 's2', date: '2026-04-12',
    attendances: [
      { member_id: 'm1', name: 'Peter', type: 'member' },
      { member_id: null, name: '訪客 John', type: 'guest' },
    ],
  },
  {
    session_id: 's3', date: '2026-04-19',
    attendances: [
      { member_id: 'm1', name: 'Peter', type: 'member' },
      { member_id: 'm2', name: 'Andy',  type: 'member' },
    ],
  },
]

const members = [
  { id: 'm1', name: 'Peter', active: true },
  { id: 'm2', name: 'Andy',  active: true },
  { id: 'm3', name: 'Lisa',  active: true },
]

describe('getAttendanceCount', () => {
  it('counts sessions where member attended', () => {
    expect(getAttendanceCount('m1', sessions)).toBe(3)
    expect(getAttendanceCount('m2', sessions)).toBe(2)
    expect(getAttendanceCount('m3', sessions)).toBe(0)
  })
})

describe('getCurrentStreak', () => {
  it('returns consecutive streak from most recent session', () => {
    // m1 attended s3, s2, s1 — streak 3
    expect(getCurrentStreak('m1', sessions)).toBe(3)
    // m2 attended s3, s1 (missed s2) — streak 1
    expect(getCurrentStreak('m2', sessions)).toBe(1)
    // m3 never attended — streak 0
    expect(getCurrentStreak('m3', sessions)).toBe(0)
  })
})

describe('buildLeaderboard', () => {
  it('returns members sorted by attendance count descending', () => {
    const board = buildLeaderboard(members, sessions)
    expect(board[0]).toMatchObject({ member: { id: 'm1' }, count: 3 })
    expect(board[1]).toMatchObject({ member: { id: 'm2' }, count: 2 })
    expect(board[2]).toMatchObject({ member: { id: 'm3' }, count: 0 })
  })

  it('includes inactive members who have attendance records', () => {
    const withInactive = [
      ...members,
      { id: 'm4', name: 'Tom', active: false },
    ]
    const sessionsWithTom = [
      ...sessions,
      {
        session_id: 's4', date: '2026-03-29',
        attendances: [{ member_id: 'm4', name: 'Tom', type: 'member' }],
      },
    ]
    const board = buildLeaderboard(withInactive, sessionsWithTom)
    expect(board.some(e => e.member.id === 'm4')).toBe(true)
  })
})
