<!-- src/views/SessionsView.vue -->
<template>
  <div class="view">
    <header class="hero hero--variant">
      <div class="status-bar" aria-hidden="true"></div>
      <div class="hero__content">
        <p class="hero__eyebrow">所有場次</p>
        <h1 class="hero__title">場次總覽</h1>
        <p class="hero__meta">共 {{ allSessions.length }} 場 · 平均 {{ avgAttendance }} 人</p>
      </div>
    </header>

    <main class="sheet">
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
            />
          </ol>
        </section>

        <!-- 歷史場次 -->
        <section v-if="pastSessions.length" class="section">
          <h2 class="section-heading">歷史記錄</h2>
          <ol class="list" aria-label="歷史場次">
            <SessionCard
              v-for="session in pastSessions"
              :key="session.session_id"
              :session="session"
            />
          </ol>
        </section>
      </template>

      <!-- 管理員：新增場次 FAB -->
      <button
        v-if="store.isAdmin"
        class="fab"
        aria-label="新增未來場次"
        @click="showAddModal = true"
      >
        +
      </button>

      <!-- 新增場次 Modal -->
      <Teleport to="body">
        <div v-if="showAddModal" class="modal-backdrop" @click.self="showAddModal = false">
          <div class="modal" role="dialog" aria-label="新增場次">
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

            <!-- 訪客 -->
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
              <div class="input-row">
                <input
                  v-model="newGuestInput"
                  class="guest-field"
                  type="text"
                  placeholder="輸入訪客姓名…"
                  autocomplete="off"
                  @keydown.enter.prevent="addNewGuest"
                >
                <button
                  type="button"
                  class="add-btn"
                  :disabled="!newGuestInput.trim()"
                  @click="addNewGuest"
                >
                  + 新增
                </button>
              </div>
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
          </div>
        </div>
      </Teleport>

      <!-- 刪除確認 Modal -->
      <Teleport to="body">
        <div v-if="deleteTarget" class="modal-backdrop" @click.self="cancelDelete">
          <div class="modal" role="alertdialog" aria-label="刪除場次確認">
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
          </div>
        </div>
      </Teleport>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app.js'
import { getTodayStr, getComingSaturday, getNextSaturdayAfter } from '../utils/date.js'
import { api } from '../services/api.js'
import SessionCard from '../components/SessionCard.vue'
import MemberCheckItem from '../components/MemberCheckItem.vue'

const store  = useAppStore()
const router = useRouter()

const todayStr = getTodayStr()

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

const avgAttendance = computed(() => {
  const withAttendance = allSessions.value.filter(s => s.attendances.length > 0)
  if (!withAttendance.length) return '0'
  const total = withAttendance.reduce((sum, s) => sum + s.attendances.length, 0)
  return (total / withAttendance.length).toFixed(1)
})

// --- 編輯場次 ---
function editSession(session) {
  router.push({ path: '/admin', query: { date: session.date } })
}

// --- 刪除場次 ---
const deleteTarget = ref(null)
const deleting     = ref(false)
const deleteError  = ref('')

const deleteTargetLabel = computed(() => {
  if (!deleteTarget.value) return ''
  const d = new Date(deleteTarget.value.date + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).format(d)
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
    await api.deleteSession(
      import.meta.env.VITE_ADMIN_TOKEN,
      deleteTarget.value.session_id
    )
    deleteTarget.value = null
    await store.init()
  } catch (err) {
    deleteError.value = `刪除失敗：${err.message}`
  } finally {
    deleting.value = false
  }
}

// --- 新增場次 modal ---
const showAddModal  = ref(false)
const savingNew     = ref(false)
const addError      = ref('')
const newGuestInput = ref('')
const newGuests     = ref([])

// 預設日期：下一個可用的週六
function calcNextSessionDate() {
  // 如果已有未來場次，預設往最後一場再加一週
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

function addNewGuest() {
  const name = newGuestInput.value.trim()
  if (!name) return
  const guest_key = `${name.toLowerCase().replace(/\s+/g, '_')}_${new Date().getFullYear()}`
  if (!newGuests.value.find(g => g.guest_key === guest_key)) {
    newGuests.value.push({ name, guest_key })
  }
  newGuestInput.value = ''
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
    await api.saveSession(
      import.meta.env.VITE_ADMIN_TOKEN,
      newSessionDate.value,
      attendances
    )
    await store.init()
    // 重置表單
    showAddModal.value  = false
    newCheckedIds.value = new Set()
    newGuests.value     = []
    newGuestInput.value = ''
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

.status-bar { height: 44px; }
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
.fab:active { transform: scale(0.92); }
@media (hover: hover) { .fab:hover { box-shadow: 0 6px 24px rgba(98, 0, 238, 0.45); } }

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
  animation: slideUp 0.25s ease;
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.modal__title {
  font-size: 20px; font-weight: 800;
  margin-bottom: 16px; color: var(--text-primary);
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

.input-row { display: flex; gap: 8px; margin: 10px 0 0; }
.guest-field {
  flex: 1; background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px; font-size: 15px; color: var(--text-primary);
  outline: none; transition: border-color 0.15s ease;
}
.guest-field:focus { border-color: var(--primary); }
.guest-field::placeholder { color: var(--text-tertiary); }
.add-btn {
  background: var(--secondary); color: var(--on-secondary);
  border: none; border-radius: var(--radius-sm);
  padding: 12px 16px; font-size: 14px; font-weight: 700;
  cursor: pointer; touch-action: manipulation;
  transition: opacity 0.15s ease;
}
.add-btn:disabled { opacity: 0.4; cursor: default; }

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

.error-msg { color: var(--error); font-size: 13px; margin-top: 12px; text-align: center; }
</style>
