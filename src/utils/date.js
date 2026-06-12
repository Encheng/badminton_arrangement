// src/utils/date.js

/**
 * 將 Date 物件轉為本地 YYYY-MM-DD 字串（避免 toISOString 的 UTC 時區問題）
 */
export function toLocalDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 取得今天的本地日期字串
 */
export function getTodayStr() {
  return toLocalDateStr(new Date())
}

/**
 * 取得最近的週六日期（含今天，若今天就是週六）
 */
export function getComingSaturday() {
  const d = new Date()
  const day = d.getDay() // 0=日, 1=一, ..., 6=六
  const diff = day === 6 ? 0 : (6 - day + 7) % 7
  d.setDate(d.getDate() + diff)
  return toLocalDateStr(d)
}

/**
 * 取得指定日期之後的下一個週六
 */
export function getNextSaturdayAfter(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 7)
  return toLocalDateStr(d)
}

/**
 * 計算兩個 YYYY-MM-DD 日期字串相差的整數天數（to - from）。
 */
export function daysBetween(fromDateStr, toDateStr) {
  const from = new Date(fromDateStr + 'T00:00:00')
  const to = new Date(toDateStr + 'T00:00:00')
  return Math.round((to - from) / 86400000)
}
