// src/utils/stats.js
import { getTodayStr } from './date.js'

/**
 * 統計只計入「今天（含）以前」的場次。
 * 未來場次是管理員預排的名單，尚未實際發生，
 * 不應計入出席次數，也不應因「沒被勾進下週名單」而中斷連續週數。
 */
export function excludeFutureSessions(sessions, todayStr = getTodayStr()) {
  return sessions.filter(s => s.date <= todayStr)
}

export function getAttendanceCount(memberId, sessions, todayStr = getTodayStr()) {
  return excludeFutureSessions(sessions, todayStr).filter(s =>
    s.attendances.some(a => a.member_id === memberId)
  ).length
}

export function getCurrentStreak(memberId, sessions, todayStr = getTodayStr()) {
  const past = excludeFutureSessions(sessions, todayStr)
  const sorted = [...past].sort((a, b) => b.date.localeCompare(a.date))
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

export function buildLeaderboard(members, sessions, todayStr = getTodayStr()) {
  const counts = {}
  for (const session of excludeFutureSessions(sessions, todayStr)) {
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
