// src/services/api.js

async function gasGet(action) {
  const GAS_URL = import.meta.env.VITE_GAS_URL
  const res = await fetch(`${GAS_URL}?action=${action}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.status === 'error') throw new Error(json.message)
  return json.data
}

async function gasPost(action, body) {
  const GAS_URL = import.meta.env.VITE_GAS_URL
  const res = await fetch(`${GAS_URL}?action=${action}`, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.status === 'error') throw new Error(json.message)
  return json.data
}

export const api = {
  getConfig:    ()                              => gasGet('getConfig'),
  getMembers:   ()                              => gasGet('getMembers'),
  getSessions:  ()                              => gasGet('getSessions'),
  saveSession:   (token, date, attendances)      => gasPost('saveSession',   { admin_token: token, date, attendances }),
  deleteSession: (token, session_id)             => gasPost('deleteSession', { admin_token: token, session_id }),
  saveMember:   (token, member)                 => gasPost('saveMember',   { admin_token: token, ...member }),
  promoteGuest: (token, guest_key, member_id)   => gasPost('promoteGuest', { admin_token: token, guest_key, member_id }),
  demoteMember: (token, member_id)              => gasPost('demoteMember', { admin_token: token, member_id }),
}
