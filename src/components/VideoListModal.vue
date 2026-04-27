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
          :animate="{ y: 0 }"
          :exit="{ y: '100%' }"
          :transition="{ type: 'spring', stiffness: 300, damping: 30 }"
        >
          <div class="modal__header">
            <h2 class="modal__title">{{ formattedDate }} 的影片</h2>
            <button
              class="modal__close"
              aria-label="關閉"
              @click="$emit('update:show', false)"
            >
              <X :size="20" :stroke-width="2" />
            </button>
          </div>

          <ol class="video-list" aria-label="影片清單">
            <li
              v-for="v in videos"
              :key="v.video_id"
              class="video-item"
            >
              <a
                :href="`https://www.youtube.com/watch?v=${v.video_id}`"
                target="_blank"
                rel="noopener noreferrer"
                class="video-item__link"
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { motion, AnimatePresence } from 'motion-v'
import { X, Play } from 'lucide-vue-next'

const props = defineProps({
  show:        { type: Boolean, default: false },
  sessionDate: { type: String,  default: '' },
  videos:      { type: Array,   default: () => [] },
})

defineEmits(['update:show'])

const formattedDate = computed(() => {
  if (!props.sessionDate) return ''
  const d = new Date(props.sessionDate + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).format(d)
})

function extractNames(title) {
  return title.replace(/^\d{8}\s/, '').replace(/\s\d+$/, '')
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
}
.modal__title {
  font-size: 16px; font-weight: 700; color: var(--text-primary);
  margin: 0;
}
.modal__close {
  background: none; border: none; padding: 4px;
  color: var(--text-tertiary); cursor: pointer;
  display: flex; align-items: center;
  touch-action: manipulation;
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
</style>
