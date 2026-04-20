<!-- src/views/SessionsView.vue -->
<template>
  <div class="view">
    <motion.header
      class="hero hero--variant"
      :initial="{ opacity: 0, y: 30 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.45, ease: 'easeOut' }"
    >
      <div class="status-bar" aria-hidden="true"></div>
      <div class="hero__content">
        <p class="hero__eyebrow">所有場次</p>
        <h1 class="hero__title">場次總覽</h1>
        <p class="hero__meta">共 {{ allSessions.length }} 場 · 平均 {{ avgAttendance }} 人</p>
      </div>
    </motion.header>

    <motion.main
      class="sheet"
      :initial="{ opacity: 0, y: 40 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.5, ease: 'easeOut', delay: 0.12 }"
    >
      <div v-if="!allSessions.length" class="empty-state">
        <p class="empty-state__icon">📋</p>
        <p class="empty-state__title">尚無場次記錄</p>
      </div>

      <template v-else>
        <!-- 未來場次 -->
        <section v-if="futureSessions.length" class="section">
          <h2 class="section-heading">即將到來</h2>
          <ol class="list" aria-label="未來場次">
            <SessionCard
              v-for="session in futureSessions"
              :key="session.session_id"
              :session="session"
              :is-future="!isCurrent(session)"
              :is-current="isCurrent(session)"
              :editable="store.isAdmin"
              @edit="editSession"
              @delete="confirmDeleteSession"
              @copy="copySession"
            />
          </ol>
        </section>

        <!-- 歷史場次 -->
        <section v-if="pastSessions.length" class="section">
          <div class="section-header">
            <h2 class="section-heading">歷史記錄</h2>
            <span class="section-count">{{ filteredPastSessions.length }} 筆</span>
          </div>

          <!-- 篩選列 -->
          <div class="filter-bar">
            <div class="filter-row">
              <div class="filter-pills">
                <button
                  class="pill"
                  :class="{ 'pill--active': filterYear === null }"
                  @click="clearFilter"
                >
                  全部
                </button>
                <button
                  v-for="year in availableYears"
                  :key="year"
                  class="pill"
                  :class="{ 'pill--active': filterYear === year }"
                  @click="setFilterYear(year)"
                >
                  {{ year }}
                </button>
              </div>
              <label class="filter-jump">
                <input
                  type="month"
                  class="filter-jump__input"
                  @change="jumpToMonth"
                >
              </label>
            </div>

            <div v-if="filterYear && availableMonths.length > 1" class="filter-pills">
              <button
                class="pill pill--sm"
                :class="{ 'pill--active': filterMonth === null }"
                @click="setFilterMonth(null)"
              >
                全部月份
              </button>
              <button
                v-for="m in availableMonths"
                :key="m"
                class="pill pill--sm"
                :class="{ 'pill--active': filterMonth === m }"
                @click="setFilterMonth(m)"
              >
                {{ m }}月
              </button>
            </div>
          </div>

          <!-- 無篩選結果 -->
          <div v-if="!filteredPastSessions.length" class="empty-filter">
            <p>此期間無場次記錄</p>
          </div>

          <!-- 歷史列表 -->
          <ol v-else class="list" aria-label="歷史場次">
            <SessionCard
              v-for="session in visiblePastSessions"
              :key="session.session_id"
              :session="session"
              :editable="store.isAdmin"
              @edit="editSession"
              @delete="confirmDeleteSession"
              @copy="copySession"
            />
          </ol>

          <!-- 無限捲動哨兵 -->
          <div v-if="hasMore" ref="sentinel" class="load-sentinel">
            <div class="spinner-sm"></div>
          </div>
          <p v-else-if="filteredPastSessions.length > 0" class="history-status">
            已顯示全部 {{ filteredPastSessions.length }} 筆
          </p>
        </section>
      </template>

    </motion.main>

    <!-- 管理員：新增場次 FAB（在 motion.main 外避免 transform 影響 fixed 定位）-->
    <motion.button
      v-if="store.isAdmin"
      class="fab"
      aria-label="新增未來場次"
      :initial="{ scale: 0, opacity: 0 }"
      :animate="{ scale: 1, opacity: 1 }"
      :transition="{ type: 'spring', stiffness: 400, damping: 20, delay: 0.3 }"
      :whileHover="{ scale: 1.1, boxShadow: '0 6px 24px rgba(98, 0, 238, 0.45)' }"
      :whilePress="{ scale: 0.9 }"
      @click="showAddModal = true"
    >
      +
    </motion.button>

    <!-- 新增場次 Modal -->
      <Teleport to="body">
        <AnimatePresence>
        <motion.div
          v-if="showAddModal"
          key="add-backdrop"
          class="modal-backdrop"
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :exit="{ opacity: 0 }"
          :transition="{ duration: 0.2 }"
          @click.self="showAddModal = false"
        >
          <motion.div
            class="modal"
            role="dialog"
            aria-label="新增場次"
            :initial="{ y: '100%' }"
            :animate="{ y: 0 }"
            :exit="{ y: '100%' }"
            :transition="{ type: 'spring', stiffness: 300, damping: 30 }"
          >
            <h2 class="modal__title">新增場次</h2>

            <label class="modal__label">
              日期
              <input
                v-model="newSessionDate"
                type="date"
                class="modal__input"
                :min="todayStr"
              >
            </label>

            <fieldset class="fieldset">
              <legend class="modal__label">出席成員</legend>
              <MemberCheckItem
                v-for="m in store.activeMembers"
                :key="m.id"
                :uid="m.id"
                :name="m.name"
                :checked="newCheckedIds.has(m.id)"
                @update:checked="toggleNewMember(m.id, $event)"
              />
            </fieldset>

            <fieldset class="fieldset">
              <legend class="modal__label">臨時成員</legend>
              <MemberCheckItem
                v-for="g in newGuests"
                :key="g.guest_key"
                :uid="g.guest_key"
                :name="g.name"
                :checked="true"
                :meta="'臨時'"
                :is-guest="true"
                @update:checked="removeNewGuest(g.guest_key)"
              />
              <GuestAutocomplete @add="addNewGuest" />
            </fieldset>

            <div class="modal__actions">
              <button class="modal__cancel" @click="showAddModal = false">取消</button>
              <button
                class="modal__save"
                :disabled="savingNew"
                @click="handleAddSession"
              >
                {{ savingNew ? '儲存中…' : '儲存' }}
              </button>
            </div>
            <p v-if="addError" class="error-msg">{{ addError }}</p>
          </motion.div>
        </motion.div>
        </AnimatePresence>
      </Teleport>

      <!-- 編輯場次 Modal -->
      <Teleport to="body">
        <AnimatePresence>
        <motion.div
          v-if="showEditModal"
          key="edit-backdrop"
          class="modal-backdrop"
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :exit="{ opacity: 0 }"
          :transition="{ duration: 0.2 }"
          @click.self="closeEditModal"
        >
          <motion.div
            class="modal"
            role="dialog"
            aria-label="編輯場次"
            :initial="{ y: '100%' }"
            :animate="{ y: 0 }"
            :exit="{ y: '100%' }"
            :transition="{ type: 'spring', stiffness: 300, damping: 30 }"
          >
            <h2 class="modal__title">編輯場次名單</h2>
            <p class="modal__date">{{ editDateLabel }}</p>

            <fieldset class="fieldset">
              <legend class="modal__label">固定成員</legend>
              <MemberCheckItem
                v-for="m in store.activeMembers"
                :key="m.id"
                :uid="'edit-' + m.id"
                :name="m.name"
                :checked="editCheckedIds.has(m.id)"
                :meta="streakLabel(m.id)"
                @update:checked="toggleEditMember(m.id, $event)"
              />
            </fieldset>

            <fieldset class="fieldset">
              <legend class="modal__label">臨時成員</legend>
              <MemberCheckItem
                v-for="g in editGuests"
                :key="g.guest_key"
                :uid="'edit-' + g.guest_key"
                :name="g.name"
                :checked="true"
                :meta="'臨時'"
                :is-guest="true"
                @update:checked="removeEditGuest(g.guest_key)"
              />
              <GuestAutocomplete @add="addEditGuest" />
            </fieldset>

            <div class="modal__actions">
              <button class="modal__cancel" @click="closeEditModal">取消</button>
              <button
                class="modal__save"
                :disabled="savingEdit"
                @click="handleEditSave"
              >
                {{ savingEdit ? '儲存中…' : '更新名單' }}
              </button>
            </div>
            <p v-if="editError" class="error-msg">{{ editError }}</p>
            <p v-if="editSuccess" class="success-msg">已成功更新！</p>
          </motion.div>
        </motion.div>
        </AnimatePresence>
      </Teleport>

      <!-- 刪除確認 Modal -->
      <Teleport to="body">
        <AnimatePresence>
        <motion.div
          v-if="deleteTarget"
          key="delete-backdrop"
          class="modal-backdrop"
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :exit="{ opacity: 0 }"
          :transition="{ duration: 0.2 }"
          @click.self="cancelDelete"
        >
          <motion.div
            class="modal"
            role="alertdialog"
            aria-label="刪除場次確認"
            :initial="{ y: '100%' }"
            :animate="{ y: 0 }"
            :exit="{ y: '100%' }"
            :transition="{ type: 'spring', stiffness: 300, damping: 30 }"
          >
            <h2 class="modal__title">確認刪除場次</h2>
            <p class="delete-info">
              確定要刪除 <strong>{{ deleteTargetLabel }}</strong> 的場次嗎？
            </p>
            <p class="delete-info delete-info--warn">
              該場次的 {{ deleteTarget.attendances.length }} 筆出席名單也會一併刪除，此操作無法復原。
            </p>
            <div class="modal__actions">
              <button class="modal__cancel" @click="cancelDelete">取消</button>
              <button
                class="modal__delete"
                :disabled="deleting"
                @click="handleDeleteSession"
              >
                {{ deleting ? '刪除中…' : '確認刪除' }}
              </button>
            </div>
            <p v-if="deleteError" class="error-msg">{{ deleteError }}</p>
          </motion.div>
        </motion.div>
        </AnimatePresence>
      </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { motion, AnimatePresence } from 'motion-v'
import { useAppStore } from '../stores/app.js'
import { getTodayStr, getComingSaturday, getNextSaturdayAfter } from '../utils/date.js'
import { getCurrentStreak } from '../utils/stats.js'
import { api } from '../services/api.js'
import SessionCard from '../components/SessionCard.vue'
import MemberCheckItem from '../components/MemberCheckItem.vue'
import GuestAutocomplete from '../components/GuestAutocomplete.vue'

const store = useAppStore()
const route = useRoute()

const todayStr = getTodayStr()

// --- helpers ---
function makeGuestKey(name) {
  return `${name.toLowerCase().replace(/\s+/g, '_')}_${new Date().getFullYear()}`
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).format(d)
}

function streakLabel(memberId) {
  const streak = getCurrentStreak(memberId, store.sessions)
  return streak > 1 ? `連 ${streak} 週` : ''
}

// --- 場次分類 ---
const allSessions = computed(() =>
  [...store.sessions].sort((a, b) => a.date.localeCompare(b.date))
)

const futureSessions = computed(() =>
  allSessions.value
    .filter(s => s.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
)

const pastSessions = computed(() =>
  allSessions.value
    .filter(s => s.date < todayStr)
    .sort((a, b) => b.date.localeCompare(a.date))
)

function isCurrent(session) {
  return futureSessions.value.length > 0 &&
         futureSessions.value[0].session_id === session.session_id
}

// --- 歷史篩選 & 無限捲動 ---
const PAGE_SIZE = 10
const filterYear  = ref(null)  // null = 全部
const filterMonth = ref(null)  // null = 全部
const visibleCount = ref(PAGE_SIZE)
const sentinel = ref(null)
let observer = null

const availableYears = computed(() => {
  const years = new Set(pastSessions.value.map(s => s.date.slice(0, 4)))
  return [...years].sort((a, b) => b.localeCompare(a))
})

const availableMonths = computed(() => {
  if (!filterYear.value) return []
  const months = new Set(
    pastSessions.value
      .filter(s => s.date.startsWith(filterYear.value))
      .map(s => parseInt(s.date.slice(5, 7), 10))
  )
  return [...months].sort((a, b) => a - b)
})

const filteredPastSessions = computed(() => {
  let list = pastSessions.value
  if (filterYear.value) {
    list = list.filter(s => s.date.startsWith(filterYear.value))
  }
  if (filterMonth.value !== null) {
    const mm = String(filterMonth.value).padStart(2, '0')
    list = list.filter(s => s.date.slice(5, 7) === mm)
  }
  return list
})

const visiblePastSessions = computed(() =>
  filteredPastSessions.value.slice(0, visibleCount.value)
)

const hasMore = computed(() =>
  visibleCount.value < filteredPastSessions.value.length
)

function setFilterYear(year) {
  filterYear.value = year
  filterMonth.value = null
  visibleCount.value = PAGE_SIZE
}

function setFilterMonth(month) {
  filterMonth.value = month
  visibleCount.value = PAGE_SIZE
}

function jumpToMonth(event) {
  const val = event.target.value  // "2026-03"
  if (!val) return
  const [y, m] = val.split('-')
  filterYear.value = y
  filterMonth.value = parseInt(m, 10)
  visibleCount.value = PAGE_SIZE
}

function clearFilter() {
  filterYear.value = null
  filterMonth.value = null
  visibleCount.value = PAGE_SIZE
}

function setupObserver() {
  if (observer) observer.disconnect()
  if (!sentinel.value) return
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && hasMore.value) {
      visibleCount.value += PAGE_SIZE
    }
  }, { rootMargin: '200px' })
  observer.observe(sentinel.value)
}

onMounted(() => {
  nextTick(setupObserver)
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})

watch(sentinel, () => nextTick(setupObserver))

const avgAttendance = computed(() => {
  const withAttendance = allSessions.value.filter(s => s.attendances.length > 0)
  if (!withAttendance.length) return '0'
  const total = withAttendance.reduce((sum, s) => sum + s.attendances.length, 0)
  return (total / withAttendance.length).toFixed(1)
})

// --- 編輯場次 (inline modal) ---
const showEditModal   = ref(false)
const editingSession  = ref(null)
const editCheckedIds  = ref(new Set())
const editGuests      = ref([])
const savingEdit      = ref(false)
const editError       = ref('')
const editSuccess     = ref(false)

const editDateLabel = computed(() =>
  editingSession.value ? formatDateLabel(editingSession.value.date) : ''
)

function editSession(session) {
  editingSession.value = session
  editCheckedIds.value = new Set(
    session.attendances.filter(a => a.type === 'member').map(a => a.member_id)
  )
  editGuests.value = session.attendances
    .filter(a => a.type === 'guest')
    .map(a => ({ name: a.name, guest_key: a.guest_key }))
  editError.value   = ''
  editSuccess.value = false
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value  = false
  editingSession.value = null
}

function toggleEditMember(id, checked) {
  if (checked) editCheckedIds.value.add(id)
  else editCheckedIds.value.delete(id)
}

function addEditGuest(name) {
  const trimmed = name.trim()
  if (!trimmed) return
  const guest_key = makeGuestKey(trimmed)
  if (!editGuests.value.find(g => g.guest_key === guest_key)) {
    editGuests.value.push({ name: trimmed, guest_key })
  }
}

function removeEditGuest(key) {
  editGuests.value = editGuests.value.filter(g => g.guest_key !== key)
}

async function handleEditSave() {
  savingEdit.value  = true
  editError.value   = ''
  editSuccess.value = false
  try {
    const attendances = [
      ...store.activeMembers
        .filter(m => editCheckedIds.value.has(m.id))
        .map(m => ({ member_id: m.id, name: m.name, type: 'member', guest_key: null })),
      ...editGuests.value.map(g => ({
        member_id: null, name: g.name, type: 'guest', guest_key: g.guest_key,
      })),
    ]
    await api.saveSession(store.adminToken, editingSession.value.date, attendances)
    await store.init()
    editSuccess.value = true
    setTimeout(() => { closeEditModal() }, 600)
  } catch (err) {
    editError.value = `儲存失敗：${err.message}`
  } finally {
    savingEdit.value = false
  }
}

// Auto-open edit modal from ?date= query param (e.g. redirected from old /admin?date=)
watch(() => store.loading, (isLoading) => {
  if (!isLoading && route.query.date && store.isAdmin) {
    const session = store.sessions.find(s => s.date === route.query.date)
    if (session) editSession(session)
  }
}, { immediate: true })

// --- 刪除場次 ---
const deleteTarget = ref(null)
const deleting     = ref(false)
const deleteError  = ref('')

const deleteTargetLabel = computed(() => {
  if (!deleteTarget.value) return ''
  return formatDateLabel(deleteTarget.value.date)
})

function confirmDeleteSession(session) {
  deleteTarget.value = session
  deleteError.value  = ''
}

function cancelDelete() {
  deleteTarget.value = null
  deleteError.value  = ''
}

async function handleDeleteSession() {
  deleting.value    = true
  deleteError.value = ''
  try {
    await api.deleteSession(store.adminToken, deleteTarget.value.session_id)
    deleteTarget.value = null
    await store.init()
  } catch (err) {
    deleteError.value = `刪除失敗：${err.message}`
  } finally {
    deleting.value = false
  }
}

// --- 複製場次 ---
function copySession(session) {
  // 預填成員
  const memberIds = session.attendances
    .filter(a => a.type === 'member')
    .map(a => a.member_id)
  newCheckedIds.value = new Set(memberIds)

  // 預填臨時成員
  newGuests.value = session.attendances
    .filter(a => a.type === 'guest')
    .map(a => ({ name: a.name, guest_key: a.guest_key }))

  // 自動計算下一個場次日期
  newSessionDate.value = calcNextSessionDate()

  addError.value = ''
  showAddModal.value = true
}

// --- 新增場次 modal ---
const showAddModal = ref(false)
const savingNew    = ref(false)
const addError     = ref('')
const newGuests    = ref([])

function calcNextSessionDate() {
  if (futureSessions.value.length > 0) {
    const lastFuture = futureSessions.value[futureSessions.value.length - 1]
    return getNextSaturdayAfter(lastFuture.date)
  }
  return getComingSaturday()
}

const newSessionDate = ref(calcNextSessionDate())
const newCheckedIds  = ref(new Set())

function toggleNewMember(id, checked) {
  if (checked) newCheckedIds.value.add(id)
  else newCheckedIds.value.delete(id)
}

function addNewGuest(name) {
  const trimmed = name.trim()
  if (!trimmed) return
  const guest_key = makeGuestKey(trimmed)
  if (!newGuests.value.find(g => g.guest_key === guest_key)) {
    newGuests.value.push({ name: trimmed, guest_key })
  }
}

function removeNewGuest(key) {
  newGuests.value = newGuests.value.filter(g => g.guest_key !== key)
}

async function handleAddSession() {
  savingNew.value = true
  addError.value  = ''
  try {
    const attendances = [
      ...store.activeMembers
        .filter(m => newCheckedIds.value.has(m.id))
        .map(m => ({ member_id: m.id, name: m.name, type: 'member', guest_key: null })),
      ...newGuests.value.map(g => ({
        member_id: null, name: g.name, type: 'guest', guest_key: g.guest_key,
      })),
    ]
    await api.saveSession(store.adminToken, newSessionDate.value, attendances)
    await store.init()
    showAddModal.value   = false
    newCheckedIds.value  = new Set()
    newGuests.value      = []
    newSessionDate.value = calcNextSessionDate()
  } catch (err) {
    addError.value = `儲存失敗：${err.message}`
  } finally {
    savingNew.value = false
  }
}
</script>

<style scoped>
.view { min-height: 100dvh; display: flex; flex-direction: column; }
.hero--variant { background: var(--primary-variant); }

.status-bar { height: var(--status-bar-height, env(safe-area-inset-top, 44px)); }
.hero__content { padding: 4px 22px 30px; color: var(--on-primary); }
.hero__eyebrow {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 1.2px; opacity: 0.75; margin-bottom: 6px;
}
.hero__title {
  font-size: 28px; font-weight: 800;
  letter-spacing: -0.6px; line-height: 1.15; margin-bottom: 6px;
  text-wrap: balance;
}
.hero__meta { font-size: 13px; opacity: 0.8; }

.sheet {
  flex: 1;
  background: var(--background);
  border-radius: 24px 24px 0 0;
  padding: 20px 16px calc(80px + env(safe-area-inset-bottom, 0px));
  margin-top: -20px;
  position: relative;
}

.section { margin-bottom: 20px; }
.section-heading {
  font-size: 12px; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;
}

.list { display: flex; flex-direction: column; gap: 10px; }

.empty-state { text-align: center; padding: 48px 16px; }
.empty-state__icon  { font-size: 48px; margin-bottom: 12px; }
.empty-state__title { font-size: 16px; font-weight: 600; }

/* FAB */
.fab {
  position: fixed;
  bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  right: max(16px, calc((100vw - 480px) / 2 + 16px));
  width: 56px; height: 56px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--on-primary);
  border: none;
  font-size: 28px; font-weight: 300;
  cursor: pointer;
  box-shadow: 0 4px 18px rgba(98, 0, 238, 0.35);
  touch-action: manipulation;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  z-index: 50;
  display: flex; align-items: center; justify-content: center;
}

/* Modal */
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 200;
  display: flex; align-items: flex-end; justify-content: center;
}
.modal {
  background: var(--background);
  border-radius: 24px 24px 0 0;
  padding: 24px 20px calc(24px + env(safe-area-inset-bottom, 0px));
  width: 100%; max-width: 480px;
  max-height: 85dvh;
  overflow-y: auto;
}
.modal__title {
  font-size: 20px; font-weight: 800;
  margin-bottom: 4px; color: var(--text-primary);
}
.modal__date {
  font-size: 13px; color: var(--text-secondary);
  margin-bottom: 16px;
}
.modal__label {
  display: block;
  font-size: 12px; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;
  border: none; padding: 0;
}
.modal__input {
  display: block; width: 100%;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px; font-size: 15px; color: var(--text-primary);
  margin-bottom: 16px; outline: none;
  transition: border-color 0.15s ease;
}
.modal__input:focus { border-color: var(--primary); }

.fieldset { border: none; padding: 0; margin: 0 0 16px; }

.modal__actions {
  display: flex; gap: 10px; margin-top: 20px;
}
.modal__cancel {
  flex: 1;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 14px; font-size: 15px; font-weight: 600;
  color: var(--text-secondary); cursor: pointer;
}
.modal__save {
  flex: 2;
  background: var(--primary); color: var(--on-primary);
  border: none; border-radius: var(--radius-lg);
  padding: 14px; font-size: 15px; font-weight: 700;
  cursor: pointer; box-shadow: 0 4px 18px rgba(98, 0, 238, 0.3);
  transition: opacity 0.15s ease;
}
.modal__save:disabled { opacity: 0.6; cursor: default; }

.delete-info {
  font-size: 14px; color: var(--text-primary); line-height: 1.5;
  margin-bottom: 8px;
}
.delete-info--warn {
  font-size: 13px; color: var(--error, #cf6679); font-weight: 600;
}

.modal__delete {
  flex: 2;
  background: var(--error, #cf6679); color: #fff;
  border: none; border-radius: var(--radius-lg);
  padding: 14px; font-size: 15px; font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.modal__delete:disabled { opacity: 0.6; cursor: default; }

/* Filter bar */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.section-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.filter-bar {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.filter-pills {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  flex: 1;
  min-width: 0;
  max-width: 100%;
}
.filter-pills::-webkit-scrollbar { display: none; }

.pill {
  flex-shrink: 0;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  touch-action: manipulation;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.pill--sm { padding: 4px 12px; font-size: 12px; }
.pill--active {
  background: var(--primary);
  color: var(--on-primary);
  border-color: var(--primary);
}
@media (hover: hover) {
  .pill:not(.pill--active):hover {
    border-color: var(--primary);
    color: var(--primary);
  }
}

.filter-jump {
  flex-shrink: 0;
}
.filter-jump__input {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 20px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  width: 36px;
  max-width: 40px;
  opacity: 0.7;
  transition: opacity 0.15s ease;
  -webkit-appearance: none;
  appearance: none;
}
.filter-jump__input:focus,
.filter-jump__input:hover { opacity: 1; border-color: var(--primary); }

.empty-filter {
  text-align: center;
  padding: 32px 16px;
  font-size: 14px;
  color: var(--text-tertiary);
}

/* Infinite scroll sentinel */
.load-sentinel {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}
.spinner-sm {
  width: 24px;
  height: 24px;
  border: 2.5px solid rgba(98, 0, 238, 0.15);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.history-status {
  text-align: center;
  padding: 16px 0;
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 600;
}

.error-msg   { color: var(--error); font-size: 13px; margin-top: 12px; text-align: center; }
.success-msg { color: var(--secondary-variant); font-size: 13px; margin-top: 12px; text-align: center; font-weight: 600; }
</style>
