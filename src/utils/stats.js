// src/utils/stats.js

export function getAttendanceCount(memberId, sessions) {
  return sessions.filter(s =>
    s.attendances.some(a => a.member_id === memberId)
  ).length
}

export function getCurrentStreak(memberId, sessions) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  let streak = 0
  for (const session of sorted) {
    if (session.attendances.some(a => a.member_id === memberId)) {
      streak++
    } else {
      break
    }
  }
  return streak
}

export function buildLeaderboard(members, sessions) {
  const counts = {}
  for (const session of sessions) {
    for (const att of session.attendances) {
      if (att.member_id) {
        counts[att.member_id] = (counts[att.member_id] || 0) + 1
      }
    }
  }
  return members
    .filter(m => m.active || counts[m.id])
    .map(m => ({ member: m, count: counts[m.id] || 0 }))
    .sort((a, b) => b.count - a.count)
}
