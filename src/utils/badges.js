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

function getBestMonthlyRatio(memberId, sessions) {
  const byMonth = {}
  for (const s of sessions) {
    const month = s.date.slice(0, 7)
    if (!byMonth[month]) byMonth[month] = { total: 0, attended: 0 }
    byMonth[month].total++
    if (s.attendances.some(a => a.member_id === memberId)) {
      byMonth[month].attended++
    }
  }
  let best = null
  for (const m of Object.values(byMonth)) {
    if (m.total >= 4) {
      if (!best || m.attended / m.total > best.attended / best.total) {
        best = m
      }
    }
  }
  return best
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

function getAnnualRankInfo(memberId, sessions, members) {
  const currentYear = new Date().getFullYear().toString()
  const yearSessions = sessions.filter(s => s.date.startsWith(currentYear))
  const counts = members.map(m => ({
    id: m.id,
    count: getAttendanceCount(m.id, yearSessions),
  })).sort((a, b) => b.count - a.count)
  const myCount = counts.find(c => c.id === memberId)?.count || 0
  const rank = counts.findIndex(c => c.id === memberId) + 1
  const topCount = counts[0]?.count || 0
  return { rank, myCount, topCount }
}

export const BADGE_DEFINITIONS = [
  {
    id: 'streak_5',
    icon: 'Flame',
    color: '#F97316',
    name: '連續 5 週',
    desc: '連續出席 5 週場次',
    check: (id, sessions) => getCurrentStreak(id, sessions) >= 5,
    progress: (id, sessions) => ({
      current: getCurrentStreak(id, sessions),
      target: 5,
      label: '連續週數',
    }),
  },
  {
    id: 'count_10',
    icon: 'Hash',
    color: '#6366F1',
    name: '出席 10 次',
    desc: '累計出席達 10 次',
    check: (id, sessions) => getAttendanceCount(id, sessions) >= 10,
    progress: (id, sessions) => ({
      current: getAttendanceCount(id, sessions),
      target: 10,
      label: '出席次數',
    }),
  },
  {
    id: 'count_20',
    icon: 'Star',
    color: '#EAB308',
    name: '出席 20 次',
    desc: '累計出席達 20 次',
    check: (id, sessions) => getAttendanceCount(id, sessions) >= 20,
    progress: (id, sessions) => ({
      current: getAttendanceCount(id, sessions),
      target: 20,
      label: '出席次數',
    }),
  },
  {
    id: 'count_50',
    icon: 'Gem',
    color: '#06B6D4',
    name: '出席 50 次',
    desc: '累計出席達 50 次',
    check: (id, sessions) => getAttendanceCount(id, sessions) >= 50,
    progress: (id, sessions) => ({
      current: getAttendanceCount(id, sessions),
      target: 50,
      label: '出席次數',
    }),
  },
  {
    id: 'streak_10',
    icon: 'Rocket',
    color: '#EC4899',
    name: '連續 10 週',
    desc: '連續出席 10 週場次',
    check: (id, sessions) => getCurrentStreak(id, sessions) >= 10,
    progress: (id, sessions) => ({
      current: getCurrentStreak(id, sessions),
      target: 10,
      label: '連續週數',
    }),
  },
  {
    id: 'monthly_4',
    icon: 'Target',
    color: '#EF4444',
    name: '全勤一個月',
    desc: '某個月份所有場次全部出席（至少 4 場）',
    check: (id, sessions) => hasMonthlyPerfectAttendance(id, sessions),
    progress: (id, sessions) => {
      const best = getBestMonthlyRatio(id, sessions)
      if (!best) return null
      return { current: best.attended, target: best.total, label: '最佳月份出席' }
    },
  },
  {
    id: 'annual_top',
    icon: 'Medal',
    color: '#FFD700',
    name: '最佳球員',
    desc: '本年度累計出席次數排名第一',
    check: (id, sessions, members) => isAnnualTop(id, sessions, members),
    progress: (id, sessions, members) => {
      const info = getAnnualRankInfo(id, sessions, members)
      if (info.topCount === 0) return null
      return { current: info.myCount, target: info.topCount, label: `目前排名第 ${info.rank}` }
    },
  },
  {
    id: 'week_champ',
    icon: 'Crown',
    color: '#A855F7',
    name: '週冠軍',
    desc: '累計出席最多，且有出席最近一次場次',
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
    progress: null,
  },
]

export function getBadges(memberId, sessions, members) {
  return BADGE_DEFINITIONS.map(def => ({
    id: def.id,
    icon: def.icon,
    color: def.color,
    name: def.name,
    desc: def.desc,
    unlocked: def.check(memberId, sessions, members),
    progress: def.progress ? def.progress(memberId, sessions, members) : null,
  }))
}
