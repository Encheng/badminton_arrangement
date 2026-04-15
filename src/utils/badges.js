// src/utils/badges.js
import { getAttendanceCount, getCurrentStreak } from './stats.js'

function hasMonthlyPerfectAttendance(memberId, sessions) {
  const byMonth = {}
  for (const s of sessions) {
    const month = s.date.slice(0, 7) // 'YYYY-MM'
    if (!byMonth[month]) byMonth[month] = { total: 0, attended: 0 }
    byMonth[month].total++
    if (s.attendances.some(a => a.member_id === memberId)) {
      byMonth[month].attended++
    }
  }
  return Object.values(byMonth).some(m => m.total >= 4 && m.attended === m.total)
}

function isAnnualTop(memberId, sessions, members) {
  const currentYear = new Date().getFullYear().toString()
  const yearSessions = sessions.filter(s => s.date.startsWith(currentYear))
  const counts = members.map(m => ({
    id: m.id,
    count: getAttendanceCount(m.id, yearSessions),
  }))
  const max = Math.max(...counts.map(c => c.count))
  if (max === 0) return false
  const topId = counts.find(c => c.count === max)?.id
  return topId === memberId
}

export const BADGE_DEFINITIONS = [
  {
    id: 'streak_5',
    icon: '🔥',
    name: '連續 5 週',
    check: (id, sessions) => getCurrentStreak(id, sessions) >= 5,
  },
  {
    id: 'count_10',
    icon: '💯',
    name: '出席 10 次',
    check: (id, sessions) => getAttendanceCount(id, sessions) >= 10,
  },
  {
    id: 'count_20',
    icon: '⭐',
    name: '出席 20 次',
    check: (id, sessions) => getAttendanceCount(id, sessions) >= 20,
  },
  {
    id: 'count_50',
    icon: '💎',
    name: '出席 50 次',
    check: (id, sessions) => getAttendanceCount(id, sessions) >= 50,
  },
  {
    id: 'streak_10',
    icon: '🚀',
    name: '連續 10 週',
    check: (id, sessions) => getCurrentStreak(id, sessions) >= 10,
  },
  {
    id: 'monthly_4',
    icon: '🎯',
    name: '全勤一個月',
    check: (id, sessions) => hasMonthlyPerfectAttendance(id, sessions),
  },
  {
    id: 'annual_top',
    icon: '🏅',
    name: '最佳球員',
    check: (id, sessions, members) => isAnnualTop(id, sessions, members),
  },
  {
    id: 'week_champ',
    icon: '👑',
    name: '週冠軍',
    check: (id, sessions, members) => {
      if (!sessions.length) return false
      const latest = [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0]
      const counts = members.map(m => ({
        id: m.id,
        count: getAttendanceCount(m.id, sessions),
      }))
      const max = Math.max(...counts.map(c => c.count))
      if (max === 0) return false
      const topId = counts.find(c => c.count === max)?.id
      return topId === id && latest.attendances.some(a => a.member_id === id)
    },
  },
]

export function getBadges(memberId, sessions, members) {
  return BADGE_DEFINITIONS.map(def => ({
    id: def.id,
    icon: def.icon,
    name: def.name,
    unlocked: def.check(memberId, sessions, members),
  }))
}
