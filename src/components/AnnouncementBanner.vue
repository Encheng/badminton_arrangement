<!-- src/components/AnnouncementBanner.vue -->
<template>
  <div v-if="visible" class="ann">
    <button class="ann__bar" type="button" @click="toggle">
      <Megaphone :size="18" :stroke-width="2.2" class="ann__icon" />
      <span class="ann__title">{{ latest ? latest.title : '公告' }}</span>
      <span v-if="count > 1" class="ann__count">{{ count }} 則</span>
      <span v-if="hasUnread" class="ann__dot" aria-label="未讀公告"></span>
      <ChevronDown
        :size="18"
        :stroke-width="2.2"
        class="ann__chevron"
        :class="{ 'ann__chevron--open': expanded }"
      />
    </button>

    <AnimatePresence>
      <motion.div
        v-if="expanded"
        class="ann__list"
        :initial="{ opacity: 0, height: 0 }"
        :animate="{ opacity: 1, height: 'auto' }"
        :exit="{ opacity: 0, height: 0 }"
        :transition="{ duration: 0.22, ease: 'easeOut' }"
      >
        <p v-if="!list.length" class="ann__empty">目前沒有公告</p>

        <article v-for="a in list" :key="a.id" class="ann__item" :class="{ 'ann__item--expired': isExpired(a) }">
          <div class="ann__item-head">
            <Pin v-if="a.pinned" :size="14" :stroke-width="2.4" class="ann__pin" />
            <h3 class="ann__item-title">{{ a.title }}</h3>
            <div v-if="isAdmin" class="ann__actions">
              <button type="button" class="ann__action" @click="edit(a)">編輯</button>
              <button type="button" class="ann__action ann__action--danger" @click="remove(a)">刪除</button>
            </div>
          </div>
          <p v-if="a.body" class="ann__body">{{ a.body }}</p>
          <p v-if="a.expires_at" class="ann__expiry">有效至 {{ a.expires_at }}</p>
          <a
            v-if="safeLink(a.link_url)"
            :href="safeLink(a.link_url)"
            target="_blank"
            rel="noopener noreferrer"
            class="ann__link"
          >{{ a.link_label || '查看' }}</a>
        </article>

        <button v-if="isAdmin" type="button" class="ann__add" @click="add">＋ 新增公告</button>
      </motion.div>
    </AnimatePresence>

    <AnnouncementAdminSheet v-model:show="sheetOpen" :editing="editing" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { motion, AnimatePresence } from 'motion-v'
import { Megaphone, ChevronDown, Pin } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import { getTodayStr } from '../utils/date.js'
import AnnouncementAdminSheet from './AnnouncementAdminSheet.vue'

const store = useAppStore()

const list      = computed(() => store.isAdmin ? store.announcements : store.activeAnnouncements)
const count     = computed(() => store.activeAnnouncements.length)
const latest    = computed(() => store.latestAnnouncement)
const hasUnread = computed(() => store.hasUnreadAnnouncements)
const isAdmin   = computed(() => store.isAdmin)
// 有有效公告，或身分為 admin（讓 admin 在無公告時也能新增）
const visible   = computed(() => count.value > 0 || isAdmin.value)

const expanded  = ref(false)
const sheetOpen = ref(false)
const editing   = ref(null)

function toggle() {
  expanded.value = !expanded.value
  if (expanded.value) store.markAnnouncementsSeen()
}

function isExpired(a) {
  return !!a.expires_at && a.expires_at < getTodayStr()
}

function add() {
  editing.value = null
  sheetOpen.value = true
}

function edit(a) {
  editing.value = { ...a }
  sheetOpen.value = true
}

function safeLink(url) {
  if (!url) return null
  return /^(https?:\/\/|\/)/i.test(url.trim()) ? url : null
}

async function remove(a) {
  if (!window.confirm(`確定刪除公告「${a.title}」？`)) return
  try {
    await store.deleteAnnouncementOptimistic(a.id)
    store.showToast('公告已刪除', 'success')
  } catch (err) {
    store.showToast(`刪除失敗：${err.message}`, 'error', 4000)
  }
}
</script>

<style scoped>
.ann {
  margin: 0 16px 12px;
  background: var(--surface-tinted);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.ann__bar {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}
.ann__icon { color: var(--primary); flex-shrink: 0; }
.ann__title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ann__count {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.ann__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--error);
  flex-shrink: 0;
}
.ann__chevron {
  color: var(--text-tertiary);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}
.ann__chevron--open { transform: rotate(180deg); }

.ann__list {
  padding: 0 14px 12px;
  overflow: hidden;
}
.ann__empty {
  font-size: 13px;
  color: var(--text-tertiary);
  padding: 4px 0 8px;
}
.ann__item {
  padding: 10px 0;
  border-top: 1px solid var(--border);
}
.ann__item--expired { opacity: 0.5; }
.ann__item-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ann__pin { color: var(--primary); flex-shrink: 0; }
.ann__item-title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}
.ann__actions { display: flex; gap: 8px; flex-shrink: 0; }
.ann__action {
  font-size: 12px;
  color: var(--primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
}
.ann__action--danger { color: var(--error); }
.ann__body {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 4px 0 0;
  white-space: pre-wrap;
}
.ann__expiry {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 4px 0 0;
}
.ann__link {
  display: inline-block;
  margin-top: 8px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--on-primary);
  background: var(--primary);
  border-radius: var(--radius-sm);
  text-decoration: none;
}
.ann__add {
  width: 100%;
  margin-top: 10px;
  padding: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  background: none;
  border: 1px dashed var(--primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
</style>
