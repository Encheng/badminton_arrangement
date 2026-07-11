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
          <div v-if="a.pinned || isAdmin" class="ann__item-head">
            <div class="ann__badges">
              <span v-if="a.pinned" class="ann__badge ann__badge--pin">
                <Pin :size="11" :stroke-width="2.6" /> 置頂
              </span>
              <span v-if="isAdmin && isExpired(a)" class="ann__badge ann__badge--expired">已過期</span>
            </div>
            <div v-if="isAdmin" class="ann__actions">
              <button type="button" class="ann__action" @click="edit(a)">編輯</button>
              <button type="button" class="ann__action ann__action--danger" @click="remove(a)">刪除</button>
            </div>
          </div>

          <h3 class="ann__item-title">{{ a.title }}</h3>
          <p v-if="a.body" class="ann__body">{{ a.body }}</p>

          <div v-if="a.expires_at || safeLink(a.link_url)" class="ann__footer">
            <span v-if="a.expires_at" class="ann__expiry">
              <CalendarClock :size="13" :stroke-width="2" /> 有效至 {{ formatShortDate(a.expires_at) }}
            </span>
            <a
              v-if="safeLink(a.link_url)"
              :href="safeLink(a.link_url)"
              target="_blank"
              rel="noopener noreferrer"
              class="ann__link"
            >{{ a.link_label || '查看' }} <ExternalLink :size="14" :stroke-width="2.2" /></a>
          </div>
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
import { Megaphone, ChevronDown, Pin, CalendarClock, ExternalLink } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import { getTodayStr } from '../utils/date.js'
import AnnouncementAdminSheet from './AnnouncementAdminSheet.vue'

const store = useAppStore()

const list      = computed(() => store.isAdmin ? store.sortedAnnouncements : store.activeAnnouncements)
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

// '2026-07-11' → '7/11'（近期公告以短日期呈現，較好讀）
function formatShortDate(d) {
  const parts = String(d).split('-')
  if (parts.length !== 3) return d
  return `${Number(parts[1])}/${Number(parts[2])}`
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
  margin: 0 0 16px;
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
  transition: background 0.2s ease;
}
.ann__bar:hover { background: rgba(98, 0, 238, 0.04); }
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
  padding: 4px 12px 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ann__empty {
  font-size: 13px;
  color: var(--text-tertiary);
  padding: 4px 2px 6px;
}
.ann__item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 14px;
}
.ann__item--expired { opacity: 0.55; }
.ann__item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.ann__badges { display: flex; flex-wrap: wrap; gap: 6px; }
.ann__badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  line-height: 1.6;
}
.ann__badge--pin { color: var(--primary); background: var(--surface-tinted); }
.ann__badge--expired { color: var(--text-tertiary); background: rgba(0, 0, 0, 0.05); }
.ann__actions { display: flex; gap: 4px; flex-shrink: 0; margin-left: auto; }
.ann__action {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: background 0.2s ease;
}
.ann__action:hover { background: var(--surface-tinted); }
.ann__action--danger { color: var(--error); }
.ann__action--danger:hover { background: rgba(176, 0, 32, 0.08); }
.ann__item-title {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--text-primary);
  margin: 0;
  word-break: break-word;
}
.ann__body {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 6px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.ann__footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 12px;
}
.ann__expiry {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}
.ann__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.2s ease;
}
.ann__link:hover { opacity: 0.65; text-decoration: underline; }
.ann__add {
  width: 100%;
  margin-top: 2px;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  background: none;
  border: 1px dashed var(--primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.2s ease;
}
.ann__add:hover { background: var(--surface-tinted); }

@media (prefers-reduced-motion: reduce) {
  .ann__chevron,
  .ann__action,
  .ann__link,
  .ann__add { transition: none; }
}
</style>
