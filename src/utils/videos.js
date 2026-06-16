// src/utils/videos.js

// 影片標題格式：YYYYMMDD <球員名單> <局號>
// 範例：20260516 千惠 二馬 阿芝 Timo Ruby Fang Peter Sandy 3
const TITLE_RE = /^\d{8}\s+(.+?)\s+\d+$/

/**
 * 從影片標題解析出球員名陣列。
 * 標題格式不合規時回傳空陣列。
 * @param {string} title
 * @returns {string[]}
 */
export function parseVideoPlayers(title) {
  if (typeof title !== 'string') return []
  const m = title.match(TITLE_RE)
  if (!m) return []
  return m[1].split(/\s+/).filter(Boolean)
}
