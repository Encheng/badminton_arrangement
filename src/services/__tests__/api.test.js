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
