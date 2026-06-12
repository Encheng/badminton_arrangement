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

/**
 * 建立排行榜。同分使用標準競賽排名（1, 2, 2, 4），
 * 同分者之間以姓名排序確保顯示順序穩定。
 * 回傳 [{ member, count, rank }]。
 */
export function buildLeaderboard(members, sessions, todayStr = getTodayStr()) {
  const counts = {}
  for (const session of excludeFutureSessions(sessions, todayStr)) {
    for (const att of session.attendances) {
      if (att.member_id) {
        counts[att.member_id] = (counts[att.member_id] || 0) + 1
      }
    }
  }
  const entries = members
    .filter(m => m.active || counts[m.id])
    .map(m => ({ member: m, count: counts[m.id] || 0 }))
    .sort((a, b) =>
      b.count - a.count ||
      a.member.name.localeCompare(b.member.name, 'zh-TW')
    )

  // 標準競賽排名：同分同名次，下一個不同分數跳至實際名次
  let prevCount = null
  let prevRank = 0
  entries.forEach((entry, i) => {
    if (entry.count !== prevCount) {
      prevRank = i + 1
      prevCount = entry.count
    }
    entry.rank = prevRank
  })
  return entries
}

/**
 * 取得某成員在 beforeDate 之前（不含當日）最近一次出席的場次。
 * 以 name 比對，固定成員與臨時成員（member_id 為 null）皆適用。
 * 查無紀錄回傳 null。
 */
export function getLastAttendance(sessions, name, beforeDate) {
  const past = sessions
    .filter(s => s.date < beforeDate && s.attendances.some(a => a.name === name))
    .sort((a, b) => b.date.localeCompare(a.date))
  return past[0] ?? null
}
