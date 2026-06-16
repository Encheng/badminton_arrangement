<!-- src/components/MemberBadgeSheet.vue -->
<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="show"
        key="member-badge-backdrop"
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
          :aria-label="`${memberName} 的成就徽章`"
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
            <h2 class="modal__title">{{ memberName }}</h2>
            <button
              class="modal__close"
              aria-label="關閉"
              @click="$emit('update:show', false)"
            >
              <X :size="20" :stroke-width="2" />
            </button>
          </div>

          <div class="modal__body">
            <AttendanceHeatmap v-if="memberId" :member-id="memberId" />
            <BadgeGrid v-if="memberId" :member-id="memberId" />

            <section v-if="memberVideos.length" class="member-videos">
              <h3 class="member-videos__title">比賽影片 ({{ memberVideos.length }})</h3>
              <ul class="member-videos__list">
                <li
                  v-for="(v, index) in memberVideos"
                  :key="v.video_id"
                  class="member-videos__item"
                >
                  <button class="member-videos__btn" @click="openVideos(index)">
                    <img
                      :src="`https://i.ytimg.com/vi/${v.video_id}/mqdefault.jpg`"
                      :alt="`播放第 ${v.match_no} 局影片`"
                      class="member-videos__thumb"
                      loading="lazy"
                      @error="e => e.target.style.visibility = 'hidden'"
                    >
                  </button>
                </li>
              </ul>
            </section>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </Teleport>

  <VideoListModal
    v-model:show="showVideoModal"
    :videos="memberVideos"
    :heading="`${memberName} 的比賽`"
    :show-item-date="true"
    source="member_sheet"
    :start-index="videoStartIndex"
  />
</template>

<script setup>
import { watch, ref, computed } from 'vue'
import { motion, AnimatePresence } from 'motion-v'
import { X } from 'lucide-vue-next'
import BadgeGrid from './BadgeGrid.vue'
import AttendanceHeatmap from './AttendanceHeatmap.vue'
import { useAppStore } from '../stores/app.js'
import VideoListModal from './VideoListModal.vue'

const props = defineProps({
  show:       { type: Boolean, default: false },
  memberId:   { type: String,  default: null },
  memberName: { type: String,  default: '' },
})

const emit = defineEmits(['update:show'])

const store = useAppStore()

const memberVideos = computed(() =>
  props.memberName ? store.videosByMember(props.memberName) : []
)

const showVideoModal = ref(false)
const videoStartIndex = ref(0)

function openVideos(index) {
  videoStartIndex.value = index
  showVideoModal.value = true
}

// Scroll lock
watch(() => props.show, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
})

// 影片播放器關閉時，若成員 sheet 仍開著，重新鎖定背景捲動
watch(showVideoModal, (isVideoOpen) => {
  if (!isVideoOpen && props.show) {
    document.body.style.overflow = 'hidden'
  }
})

// Swipe down to close
const isDragging = ref(false)
const dragStartY = ref(0)
const dragOffset = ref(0)

function handleTouchStart(e) {
  dragStartY.value = e.touches[0].clientY
  isDragging.value = true
}

function handleTouchMove(e) {
  if (!isDragging.value) return
  const deltaY = e.touches[0].clientY - dragStartY.value
  if (deltaY > 0) {
    dragOffset.value = deltaY
    e.preventDefault()
  }
}

function handleTouchEnd() {
  if (!isDragging.value) return
  if (dragOffset.value > 120) {
    emit('update:show', false)
  }
  isDragging.value = false
  dragOffset.value = 0
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
.modal__header:active { cursor: grabbing; }
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
.modal__body {
  padding: 4px 16px 20px;
  max-height: 70dvh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
.member-videos { margin-top: 16px; }
.member-videos__title {
  font-size: 14px; font-weight: 700; color: var(--text-primary);
  margin: 0 0 10px;
}
.member-videos__list {
  display: flex; gap: 10px; overflow-x: auto;
  list-style: none; margin: 0; padding: 0 0 4px;
  -webkit-overflow-scrolling: touch;
}
.member-videos__item { flex: 0 0 auto; }
.member-videos__btn {
  border: none; padding: 0; background: none; cursor: pointer;
  border-radius: 8px; overflow: hidden; display: block;
  touch-action: manipulation;
}
.member-videos__thumb {
  width: 120px; height: 67px; object-fit: cover; display: block;
  border-radius: 8px;
}
</style>
