// src/stores/__tests__/app.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppStore } from '../app.js'

vi.mock('../../services/api.js', () => ({
  api: {
    getConfig:  vi.fn().mockResolvedValue({ venue_name: '大安體育場', time_start: '09:00', time_end: '11:00', day_of_week: '六' }),
    getMembers: vi.fn().mockResolvedValue([
      { id: 'm1', name: 'Peter', active: true },
    ]),
    getSessions: vi.fn().mockResolvedValue([
      {
        session_id: 's1', date: '2026-04-12',
        attendances: [{ member_id: 'm1', name: 'Peter', type: 'member' }],
      },
    ]),
  },
}))

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useAppStore', () => {
  it('loads config, members, sessions on init', async () => {
    const store = useAppStore()
    await store.init()

    expect(store.config.venue_name).toBe('大安體育場')
    expect(store.members).toHaveLength(1)
    expect(store.sessions).toHaveLength(1)
  })

  it('isAdmin is true when token matches VITE_ADMIN_TOKEN', () => {
    import.meta.env.VITE_ADMIN_TOKEN = 'secret'
    const store = useAppStore()
    store.setAdminToken('secret')
    expect(store.isAdmin).toBe(true)
  })

  it('isAdmin is false when token is wrong', () => {
    import.meta.env.VITE_ADMIN_TOKEN = 'secret'
    const store = useAppStore()
    store.setAdminToken('wrong')
    expect(store.isAdmin).toBe(false)
  })

  it('activeMembers returns only active members', async () => {
    const store = useAppStore()
    await store.init()
    expect(store.activeMembers).toHaveLength(1)
    expect(store.activeMembers[0].id).toBe('m1')
  })
})
