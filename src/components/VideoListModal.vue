<!-- src/components/VideoListModal.vue -->
<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="show"
        key="video-backdrop"
        class="modal-backdrop"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="{ duration: 0.2 }"
        @click.self="$emit('update:show', false)"
      >
        <motion.div
          class="modal"
          role="dialog"
          aria-label="場次影片"
          :initial="{ y: '100%' }"
          :animate="{ y: dragOffset }"
          :exit="{ y: '100%' }"
          :transition="isDragging
            ? { duration: 0 }
            : { type: 'spring', stiffness: 300, damping: 30 }
          "
        >
          <div
            class="modal__header"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
          >
            <div class="modal__handle" aria-hidden="true"></div>
            <template v-if="activeVideoIndex !== null">
              <button class="modal__back" aria-label="返回列表" @click="goBack">
                <ArrowLeft :size="20" :stroke-width="2" />
              </button>
              <h2 class="modal__title">第 {{ activeVideo.match_no }} 局</h2>
            </template>
            <h2 v-else class="modal__title">{{ formattedDate }} 的影片</h2>
            <button
              class="modal__close"
              aria-label="關閉"
              @click="$emit('update:show', false)"
            >
              <X :size="20" :stroke-width="2" />
            </button>
          </div>

          <Transition :name="transitionDirection" mode="out-in">
            <ol v-if="activeVideoIndex === null" key="list" class="video-list" aria-label="影片清單">
              <li
                v-for="(v, index) in videos"
                :key="v.video_id"
                class="video-item"
              >
                <a
                  :href="`https://www.youtube.com/watch?v=${v.video_id}`"
                  class="video-item__link"
                  @click.prevent="playVideo(index)"
                >
                  <div class="video-item__thumb">
                    <img
                      :src="`https://i.ytimg.com/vi/${v.video_id}/mqdefault.jpg`"
                      :alt="`第 ${v.match_no} 局縮圖`"
                      loading="lazy"
                      @error="onThumbError"
                    >
                    <div class="video-item__thumb-fallback" aria-hidden="true">
                      <Play :size="20" :stroke-width="2" />
                    </div>
                  </div>
                  <div class="video-item__body">
                    <p class="video-item__match">第 {{ v.match_no }} 局</p>
                    <p class="video-item__names">{{ extractNames(v.title) }}</p>
                  </div>
                </a>
              </li>
            </ol>

            <div v-else :key="activeVideo.video_id" class="player-view">
              <div class="player-view__iframe-wrap">
                <iframe
                  :src="embedUrl"
                  class="player-view__iframe"
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowfullscreen
                ></iframe>
              </div>
              <div class="player-view__info">
                <p class="player-view__names">{{ extractNames(activeVideo.title) }}</p>
              </div>
              <div class="player-view__nav">
                <button
                  class="player-view__nav-btn"
                  :disabled="!hasPrev"
                  @click="prevVideo"
                >
                  <ChevronLeft :size="18" :stroke-width="2" />
                  上一局
                </button>
                <span class="player-view__counter">
                  {{ activeVideoIndex + 1 }} / {{ videos.length }}
                </span>
                <button
                  class="player-view__nav-btn"
                  :disabled="!hasNext"
                  @click="nextVideo"
                >
                  下一局
                  <ChevronRight :size="18" :stroke-width="2" />
                </button>
              </div>
            </div>
          </Transition>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, watch, ref } from 'vue'
import { motion, AnimatePresence } from 'motion-v'
import { X, Play, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import {
  trackVideoListOpened,
  trackVideoPlayClick,
  trackVideoPlayerNavigation,
  trackVideoPlayerBack,
  trackVideoModalClose,
} from '../utils/analytics'
import { parseVideoPlayers } from '../utils/videos.js'

const props = defineProps({
  show:        { type: Boolean, default: false },
  sessionDate: { type: String,  default: '' },
  videos:      { type: Array,   default: () => [] },
})

const emit = defineEmits(['update:show'])

// Player view state
const activeVideoIndex = ref(null)
const transitionDirection = ref('slide-left')

// Analytics tracking
const modalOpenedAt = ref(null)
const videoPlayStartedAt = ref(null)

const activeVideo = computed(() =>
  activeVideoIndex.value !== null ? props.videos[activeVideoIndex.value] : null
)
const hasPrev = computed(() =>
  activeVideoIndex.value !== null && activeVideoIndex.value > 0
)
const hasNext = computed(() =>
  activeVideoIndex.value !== null && activeVideoIndex.value < props.videos.length - 1
)
const embedUrl = computed(() => {
  if (!activeVideo.value) return ''
  return `https://www.youtube.com/embed/${activeVideo.value.video_id}?autoplay=1&playsinline=1&rel=0`
})

function playVideo(index) {
  transitionDirection.value = 'slide-left'
  activeVideoIndex.value = index
  videoPlayStartedAt.value = Date.now()

  // 追蹤：點擊播放影片
  const video = props.videos[index]
  trackVideoPlayClick({
    sessionDate: props.sessionDate,
    videoId: video.video_id,
    matchNo: video.match_no,
    videoIndex: index,
    totalVideos: props.videos.length,
  })
}

function goBack() {
  // 追蹤：返回影片列表
  if (activeVideo.value && videoPlayStartedAt.value) {
    const timeSpent = Math.round((Date.now() - videoPlayStartedAt.value) / 1000)
    trackVideoPlayerBack({
      sessionDate: props.sessionDate,
      matchNo: activeVideo.value.match_no,
      timeSpent,
    })
  }

  transitionDirection.value = 'slide-right'
  activeVideoIndex.value = null
  videoPlayStartedAt.value = null
}

function prevVideo() {
  if (!hasPrev.value) return

  const fromMatchNo = props.videos[activeVideoIndex.value].match_no
  const toMatchNo = props.videos[activeVideoIndex.value - 1].match_no

  activeVideoIndex.value--
  videoPlayStartedAt.value = Date.now()

  // 追蹤：導航到上一局
  trackVideoPlayerNavigation({
    direction: 'prev',
    fromMatchNo,
    toMatchNo,
    sessionDate: props.sessionDate,
  })
}

function nextVideo() {
  if (!hasNext.value) return

  const fromMatchNo = props.videos[activeVideoIndex.value].match_no
  const toMatchNo = props.videos[activeVideoIndex.value + 1].match_no

  activeVideoIndex.value++
  videoPlayStartedAt.value = Date.now()

  // 追蹤：導航到下一局
  trackVideoPlayerNavigation({
    direction: 'next',
    fromMatchNo,
    toMatchNo,
    sessionDate: props.sessionDate,
  })
}

// Scroll Lock: 阻止背景滾動 + Analytics
watch(() => props.show, (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden'
    modalOpenedAt.value = Date.now()

    // 追蹤：影片列表成功展開
    trackVideoListOpened({
      sessionDate: props.sessionDate,
      videoCount: props.videos.length,
    })
  } else {
    document.body.style.overflow = ''

    // 追蹤：關閉影片 modal
    if (modalOpenedAt.value) {
      const viewDuration = Math.round((Date.now() - modalOpenedAt.value) / 1000)
      trackVideoModalClose({
        sessionDate: props.sessionDate,
        videoCount: props.videos.length,
        wasPlaying: activeVideoIndex.value !== null,
        matchNo: activeVideo.value?.match_no,
        viewDuration,
      })
    }

    activeVideoIndex.value = null
    modalOpenedAt.value = null
    videoPlayStartedAt.value = null
  }
})

// Swipe Down to Close
const isDragging = ref(false)
const dragStartY = ref(0)
const dragOffset = ref(0)

function handleTouchStart(e) {
  dragStartY.value = e.touches[0].clientY
  isDragging.value = true
}

function handleTouchMove(e) {
  if (!isDragging.value) return

  const currentY = e.touches[0].clientY
  const deltaY = currentY - dragStartY.value

  // 只允許向下拖動
  if (deltaY > 0) {
    dragOffset.value = deltaY
    // 防止拖動時觸發內部滾動
    e.preventDefault()
  }
}

function handleTouchEnd() {
  if (!isDragging.value) return

  const threshold = 120 // 滑動超過 120px 就關閉

  if (dragOffset.value > threshold) {
    emit('update:show', false)
  }

  // 重置狀態
  isDragging.value = false
  dragOffset.value = 0
}

const formattedDate = computed(() => {
  if (!props.sessionDate) return ''
  const d = new Date(props.sessionDate + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).format(d)
})

function extractNames(title) {
  return parseVideoPlayers(title).join(' ')
}

function onThumbError(e) {
  e.target.style.display = 'none'
  const fallback = e.target.nextElementSibling
  if (fallback) fallback.style.display = 'flex'
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex; align-items: flex-end; justify-content: center;
}
.modal {
  background: var(--surface);
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.modal__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border);
  position: relative;
  cursor: grab;
  user-select: none;
}
.modal__header:active {
  cursor: grabbing;
}
.modal__handle {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
}
.modal__title {
  font-size: 16px; font-weight: 700; color: var(--text-primary);
  margin: 0;
  padding-top: 8px;
}
.modal__close {
  background: none; border: none; padding: 4px;
  color: var(--text-tertiary); cursor: pointer;
  display: flex; align-items: center;
  touch-action: manipulation;
  margin-top: 8px;
}
.video-list {
  list-style: none; margin: 0; padding: 8px 12px;
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 8px;
}
.video-item {
  list-style: none;
}
.video-item__link {
  display: flex; gap: 12px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s ease;
  text-decoration: none;
  color: inherit;
}
.video-item__link:active { background: var(--surface-tinted, #f5f0ff); }
@media (hover: hover) {
  .video-item__link:hover { background: var(--surface-tinted, #f5f0ff); }
}
.video-item__thumb {
  position: relative;
  flex: 0 0 120px;
  aspect-ratio: 16 / 9;
  border-radius: 6px;
  overflow: hidden;
  background: var(--border);
}
.video-item__thumb img {
  width: 100%; height: 100%; object-fit: cover;
  display: block;
}
.video-item__thumb-fallback {
  display: none;
  position: absolute; inset: 0;
  align-items: center; justify-content: center;
  color: var(--text-tertiary);
  background: var(--border);
}
.video-item__body {
  display: flex; flex-direction: column; justify-content: center;
  min-width: 0;
  flex: 1;
}
.video-item__match {
  font-size: 14px; font-weight: 700; color: var(--text-primary);
  margin: 0 0 2px 0;
}
.video-item__names {
  font-size: 12px; color: var(--text-secondary);
  margin: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Back button */
.modal__back {
  background: none; border: none; padding: 4px;
  color: var(--text-primary); cursor: pointer;
  display: flex; align-items: center;
  touch-action: manipulation;
  margin-top: 8px;
}

/* Player view */
.player-view {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.player-view__iframe-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}
.player-view__iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
}
.player-view__info {
  padding: 0 4px;
}
.player-view__names {
  font-size: 13px; color: var(--text-secondary);
  margin: 0;
}
.player-view__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px;
}
.player-view__nav-btn {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 14px;
  font-size: 13px; font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.player-view__nav-btn:disabled {
  opacity: 0.3; cursor: default;
}
.player-view__nav-btn:not(:disabled):active {
  background: var(--surface-tinted);
  border-color: var(--primary);
}
@media (hover: hover) {
  .player-view__nav-btn:not(:disabled):hover {
    border-color: var(--primary);
    color: var(--primary);
  }
}
.player-view__counter {
  font-size: 12px; font-weight: 600;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

/* View transition animations */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.slide-left-enter-from { transform: translateX(30px); opacity: 0; }
.slide-left-leave-to   { transform: translateX(-30px); opacity: 0; }
.slide-right-enter-from { transform: translateX(-30px); opacity: 0; }
.slide-right-leave-to   { transform: translateX(30px); opacity: 0; }
</style>
