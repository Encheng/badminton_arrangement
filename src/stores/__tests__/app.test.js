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

  it('videosByMember returns videos containing the member, newest session first', () => {
    const store = useAppStore()
    store.videos = [
      { video_id: 'a', session_date: '2026-04-05', match_no: 1, title: '20260405 Peter Sandy 1' },
      { video_id: 'b', session_date: '2026-04-12', match_no: 2, title: '20260412 Timo Peter 2' },
      { video_id: 'c', session_date: '2026-04-12', match_no: 1, title: '20260412 Ruby Sandy 1' },
    ]
    const result = store.videosByMember('Peter')
    expect(result.map(v => v.video_id)).toEqual(['b', 'a'])
  })

  it('videosByMember matches whole tokens only, not substrings', () => {
    const store = useAppStore()
    store.videos = [
      { video_id: 'a', session_date: '2026-04-05', match_no: 1, title: '20260405 Fang Peter 1' },
      { video_id: 'b', session_date: '2026-04-12', match_no: 1, title: '20260412 Fangirl Sandy 1' },
    ]
    expect(store.videosByMember('Fang').map(v => v.video_id)).toEqual(['a'])
  })

  it('videosByMember returns [] when member has no videos', () => {
    const store = useAppStore()
    store.videos = [
      { video_id: 'a', session_date: '2026-04-05', match_no: 1, title: '20260405 Peter Sandy 1' },
    ]
    expect(store.videosByMember('Nobody')).toEqual([])
  })

  it('videosByMember matches case-insensitively (member name registered in different case than title)', () => {
    const store = useAppStore()
    store.videos = [
      { video_id: 'a', session_date: '2026-04-05', match_no: 1, title: '20260405 Sandy Timo 1' },
    ]
    // member registered as lowercase 'sandy' must still match title token 'Sandy'
    expect(store.videosByMember('sandy').map(v => v.video_id)).toEqual(['a'])
    expect(store.videosByMember('timo').map(v => v.video_id)).toEqual(['a'])
  })

  it('videosByMember trims surrounding whitespace in member name before matching', () => {
    const store = useAppStore()
    store.videos = [
      { video_id: 'a', session_date: '2026-04-05', match_no: 1, title: '20260405 Peter Sandy 1' },
    ]
    expect(store.videosByMember('  Peter ').map(v => v.video_id)).toEqual(['a'])
  })
})
