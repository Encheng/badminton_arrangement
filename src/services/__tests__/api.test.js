// src/services/__tests__/api.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../api.js'

const FAKE_URL = 'https://fake-gas.example.com/exec'

beforeEach(() => {
  import.meta.env.VITE_GAS_URL = FAKE_URL
  vi.restoreAllMocks()
})

describe('api.getConfig', () => {
  it('calls GET with action=getConfig and returns data', async () => {
    const mockData = { venue_name: '大安體育場', time_start: '09:00' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', data: mockData }),
    })

    const result = await api.getConfig()

    expect(fetch).toHaveBeenCalledWith(`${FAKE_URL}?action=getConfig`)
    expect(result).toEqual(mockData)
  })

  it('throws when GAS returns error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'error', message: 'Sheet not found' }),
    })

    await expect(api.getConfig()).rejects.toThrow('Sheet not found')
  })
})

describe('api.saveSession', () => {
  it('calls POST with action=saveSession and admin_token in body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', data: { session_id: 's1' } }),
    })

    await api.saveSession('my-token', '2026-04-19', [
      { member_id: 'm1', name: 'Peter', type: 'member', guest_key: null },
    ])

    expect(fetch).toHaveBeenCalledWith(
      `${FAKE_URL}?action=saveSession`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          admin_token: 'my-token',
          date: '2026-04-19',
          attendances: [{ member_id: 'm1', name: 'Peter', type: 'member', guest_key: null }],
        }),
      })
    )
  })
})

describe('api.getVideos', () => {
  it('calls GET with action=getVideos and returns data', async () => {
    const mockData = [
      { video_id: 'abc123', session_date: '2026-04-18', match_no: 1, title: '20260418 ... 1', published_at: '2026-04-21T02:29:07Z' },
    ]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', data: mockData }),
    })

    const result = await api.getVideos()

    expect(fetch).toHaveBeenCalledWith(`${FAKE_URL}?action=getVideos`)
    expect(result).toEqual(mockData)
  })
})

describe('api.getAnnouncements', () => {
  it('calls GET with action=getAnnouncements and returns data', async () => {
    const mockData = [{ id: 'a1', title: 'x', pinned: false, expires_at: '', created_at: '2026-07-01T00:00:00Z' }]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', data: mockData }),
    })

    const result = await api.getAnnouncements()

    expect(fetch).toHaveBeenCalledWith(`${FAKE_URL}?action=getAnnouncements`)
    expect(result).toEqual(mockData)
  })
})

describe('api.saveAnnouncement', () => {
  it('POSTs with action=saveAnnouncement, admin_token and fields', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', data: { id: 'an1' } }),
    })

    await api.saveAnnouncement('tok', { title: 'Hi', body: '', link_url: '', link_label: '', pinned: true, expires_at: '2026-07-10' })

    expect(fetch).toHaveBeenCalledWith(
      `${FAKE_URL}?action=saveAnnouncement`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          admin_token: 'tok',
          title: 'Hi', body: '', link_url: '', link_label: '', pinned: true, expires_at: '2026-07-10',
        }),
      })
    )
  })
})

describe('api.deleteAnnouncement', () => {
  it('POSTs with action=deleteAnnouncement, admin_token and id', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', data: { deleted: 'a1' } }),
    })

    await api.deleteAnnouncement('tok', 'a1')

    expect(fetch).toHaveBeenCalledWith(
      `${FAKE_URL}?action=deleteAnnouncement`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ admin_token: 'tok', id: 'a1' }),
      })
    )
  })
})
