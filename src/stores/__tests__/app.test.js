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
    getVideos: vi.fn().mockResolvedValue([
      { video_id: 'v1', session_date: '2026-04-12', match_no: 1, title: '20260412 Peter 1', published_at: '2026-04-13T00:00:00Z' },
      { video_id: 'v2', session_date: '2026-04-12', match_no: 2, title: '20260412 Peter 2', published_at: '2026-04-13T00:00:00Z' },
      { video_id: 'v3', session_date: '2026-04-05', match_no: 1, title: '20260405 Peter 1', published_at: '2026-04-06T00:00:00Z' },
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

  it('loads videos on init', async () => {
    const store = useAppStore()
    await store.init()
    expect(store.videos).toHaveLength(3)
  })

  it('videosByDate groups videos by session_date', async () => {
    const store = useAppStore()
    await store.init()
    expect(store.videosByDate['2026-04-12']).toHaveLength(2)
    expect(store.videosByDate['2026-04-05']).toHaveLength(1)
    expect(store.videosByDate['2026-04-12'][0].match_no).toBe(1)
  })

  it('falls back to empty videos array when getVideos rejects', async () => {
    const { api } = await import('../../services/api.js')
    api.getVideos.mockRejectedValueOnce(new Error('RSS down'))
    const store = useAppStore()
    await store.init()
    expect(store.videos).toEqual([])
  })
})
