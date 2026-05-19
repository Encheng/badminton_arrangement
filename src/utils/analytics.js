// src/utils/analytics.js
/**
 * 分析追蹤工具
 *
 * 使用 Google Analytics 4 (GA4) 追蹤用戶行為
 * 需要在 .env 設定 VITE_GA_MEASUREMENT_ID
 */

/**
 * 追蹤影片相關事件
 * @param {string} eventName - 事件名稱
 * @param {object} params - 事件參數
 */
export function trackVideoEvent(eventName, params = {}) {
  // 檢查 gtag 是否可用
  if (typeof window.gtag !== 'function') {
    console.debug('[Analytics]', eventName, params)
    return
  }

  try {
    window.gtag('event', eventName, params)
  } catch (error) {
    console.error('[Analytics] 追蹤失敗:', error)
  }
}

/**
 * 追蹤：點擊「N 支影片」按鈕
 */
export function trackVideoButtonClick({ sessionDate, videoCount, source }) {
  trackVideoEvent('video_button_click', {
    session_date: sessionDate,
    video_count: videoCount,
    source, // 'history_card' 或 'session_card'
  })
}

/**
 * 追蹤：影片列表成功展開
 */
export function trackVideoListOpened({ sessionDate, videoCount }) {
  trackVideoEvent('video_list_opened', {
    session_date: sessionDate,
    video_count: videoCount,
  })
}

/**
 * 追蹤：點擊播放影片
 */
export function trackVideoPlayClick({ sessionDate, videoId, matchNo, videoIndex, totalVideos }) {
  trackVideoEvent('video_play_click', {
    session_date: sessionDate,
    video_id: videoId,
    match_no: matchNo,
    video_index: videoIndex + 1, // 1-based index
    total_videos: totalVideos,
  })
}

/**
 * 追蹤：使用上/下一局按鈕
 */
export function trackVideoPlayerNavigation({ direction, fromMatchNo, toMatchNo, sessionDate }) {
  trackVideoEvent('video_player_navigation', {
    direction, // 'prev' 或 'next'
    from_match_no: fromMatchNo,
    to_match_no: toMatchNo,
    session_date: sessionDate,
  })
}

/**
 * 追蹤：返回影片列表
 */
export function trackVideoPlayerBack({ sessionDate, matchNo, timeSpent }) {
  trackVideoEvent('video_player_back', {
    session_date: sessionDate,
    match_no: matchNo,
    time_spent_seconds: timeSpent, // 觀看時長（秒）
  })
}

/**
 * 追蹤：關閉影片 modal
 */
export function trackVideoModalClose({ sessionDate, videoCount, wasPlaying, matchNo, viewDuration }) {
  trackVideoEvent('video_modal_close', {
    session_date: sessionDate,
    video_count: videoCount,
    was_playing: wasPlaying, // 是否在播放狀態下關閉
    match_no: matchNo || null,
    view_duration_seconds: viewDuration, // modal 開啟總時長（秒）
  })
}
