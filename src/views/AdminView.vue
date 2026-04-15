<!-- src/views/AdminView.vue -->
<template>
  <div class="view">
    <!-- 未授權 -->
    <div v-if="!store.isAdmin" class="unauthorized">
      <p class="unauthorized__icon">🔒</p>
      <p class="unauthorized__title">需要管理員權限</p>
      <p class="unauthorized__sub">請使用含有 token 的管理員連結</p>
    </div>

    <!-- 管理畫面 -->
    <template v-else>
      <header class="hero hero--secondary">
        <div class="status-bar" aria-hidden="true"></div>
        <div class="hero__content">
          <p class="hero__eyebrow">管理模式</p>
          <h1 class="hero__title">編輯場次名單</h1>
          <p class="hero__meta">{{ sessionDateLabel }}</p>
        </div>
      </header>

      <main class="sheet">
        <form @submit.prevent="handleSave">
          <!-- 固定成員 -->
          <fieldset class="fieldset">
            <legend class="section-heading">固定成員</legend>
            <MemberCheckItem
              v-for="m in store.activeMembers"
              :key="m.id"
              :uid="m.id"
              :name="m.name"
              :checked="checkedIds.has(m.id)"
              :meta="streakLabel(m.id)"
              @update:checked="toggleMember(m.id, $event)"
            />
          </fieldset>

          <!-- 訪客 -->
          <fieldset class="fieldset" style="margin-top: 12px;">
            <legend class="section-heading">臨時成員</legend>
            <MemberCheckItem
              v-for="g in guests"
              :key="g.guest_key"
              :uid="g.guest_key"
              :name="g.name"
              :checked="true"
              :meta="'臨時'"
              :is-guest="true"
              @update:checked="removeGuest(g.guest_key)"
            />

            <div class="input-row">
              <label for="guest-input" class="sr-only">新增訪客姓名</label>
              <input
                id="guest-input"
                v-model="guestInput"
                class="guest-field"
                type="text"
                name="guest-name"
                placeholder="輸入訪客姓名…"
                autocomplete="off"
                spellcheck="false"
                inputmode="text"
                @keydown.enter.prevent="addGuest"
              >
              <button
                type="button"
                class="add-btn"
                aria-label="新增訪客"
                :disabled="!guestInput.trim()"
                @click="addGuest"
              >
                + 新增
              </button>
            </div>
          </fieldset>

          <button
            type="submit"
            class="save-btn"
            :disabled="saving"
            aria-label="儲存並發布本週名單"
          >
            {{ saving ? '儲存中…' : '儲存並發布 ✓' }}
          </button>

          <p v-if="saveError" class="error-msg" role="alert">{{ saveError }}</p>
          <p v-if="saveSuccess" class="success-msg" role="status">已成功發布！</p>
        </form>

        <button class="link-btn" @click="goToSessions">
          管理所有場次（新增未來場次）
        </button>
      </main>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app.js'
import { getCurrentStreak } from '../utils/stats.js'
import { getComingSaturday } from '../utils/date.js'
import { api } from '../services/api.js'
import MemberCheckItem from '../components/MemberCheckItem.vue'

const store  = useAppStore()
const route  = useRoute()
const router = useRouter()

// 支援從場次頁帶入 ?date=YYYY-MM-DD，否則預設本週六
const sessionDate = computed(() => {
  if (route.query.date) return route.query.date
  return getComingSaturday()
})

const sessionDateLabel = computed(() => {
  const d = new Date(sessionDate.value + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).format(d)
})

// 預填指定日期已存在的出席名單
const existingSession = computed(() =>
  store.sessions.find(s => s.date === sessionDate.value) ?? null
)

const checkedIds = ref(new Set(
  existingSession.value
    ?.attendances.filter(a => a.type === 'member').map(a => a.member_id) ?? []
))

const guests = ref(
  existingSession.value
    ?.attendances.filter(a => a.type === 'guest').map(a => ({
      name: a.name, guest_key: a.guest_key,
    })) ?? []
)

const guestInput = ref('')
const saving     = ref(false)
const saveError  = ref('')
const saveSuccess = ref(false)

function toggleMember(id, checked) {
  if (checked) checkedIds.value.add(id)
  else checkedIds.value.delete(id)
}

function addGuest() {
  const name = guestInput.value.trim()
  if (!name) return
  const guest_key = `${name.toLowerCase().replace(/\s+/g, '_')}_${new Date().getFullYear()}`
  if (!guests.value.find(g => g.guest_key === guest_key)) {
    guests.value.push({ name, guest_key })
  }
  guestInput.value = ''
}

function removeGuest(key) {
  guests.value = guests.value.filter(g => g.guest_key !== key)
}

function streakLabel(memberId) {
  const streak = getCurrentStreak(memberId, store.sessions)
  return streak > 1 ? `連 ${streak} 週` : ''
}

async function handleSave() {
  saving.value    = true
  saveError.value = ''
  saveSuccess.value = false
  try {
    const attendances = [
      ...store.activeMembers
        .filter(m => checkedIds.value.has(m.id))
        .map(m => ({ member_id: m.id, name: m.name, type: 'member', guest_key: null })),
      ...guests.value.map(g => ({
        member_id: null, name: g.name, type: 'guest', guest_key: g.guest_key,
      })),
    ]
    await api.saveSession(
      import.meta.env.VITE_ADMIN_TOKEN,
      sessionDate.value,
      attendances
    )
    await store.init() // 重新載入資料
    saveSuccess.value = true
  } catch (err) {
    saveError.value = `儲存失敗：${err.message}`
  } finally {
    saving.value = false
  }
}

function goToSessions() {
  router.push('/sessions')
}
</script>

<style scoped>
.view { min-height: 100dvh; display: flex; flex-direction: column; }

.unauthorized {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  min-height: 100dvh; text-align: center; padding: 32px;
}
.unauthorized__icon  { font-size: 64px; margin-bottom: 16px; }
.unauthorized__title { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
.unauthorized__sub   { font-size: 14px; color: var(--text-tertiary); }

.hero--secondary { background: var(--secondary); }
.status-bar { height: 44px; }
.hero__content { padding: 4px 22px 30px; color: var(--on-secondary); }
.hero__eyebrow {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 1.2px; opacity: 0.6; margin-bottom: 6px;
}
.hero__title {
  font-size: 28px; font-weight: 800;
  letter-spacing: -0.6px; line-height: 1.15; margin-bottom: 6px;
  text-wrap: balance; color: var(--on-secondary);
}
.hero__meta { font-size: 13px; opacity: 0.7; color: var(--on-secondary); }

.sheet {
  flex: 1;
  background: var(--background);
  border-radius: 24px 24px 0 0;
  padding: 20px 16px calc(32px + env(safe-area-inset-bottom, 0px));
  margin-top: -20px;
}

.fieldset { border: none; padding: 0; margin: 0; }
.section-heading {
  display: block;
  font-size: 12px; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;
}

.input-row { display: flex; gap: 8px; margin: 10px 0 0; }
.sr-only {
  position: absolute; width: 1px; height: 1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap;
}
.guest-field {
  flex: 1; background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px; font-size: 15px; color: var(--text-primary);
  touch-action: manipulation; outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.guest-field:focus-visible {
  border-color: var(--secondary-variant);
  box-shadow: 0 0 0 3px rgba(1, 135, 134, 0.2);
}
.guest-field::placeholder { color: var(--text-tertiary); }
.add-btn {
  background: var(--secondary); color: var(--on-secondary);
  border: none; border-radius: var(--radius-sm);
  padding: 12px 16px; font-size: 14px; font-weight: 700;
  cursor: pointer; touch-action: manipulation; outline: none;
  transition: opacity 0.15s ease, transform 0.1s ease;
}
.add-btn:focus-visible { box-shadow: 0 0 0 3px rgba(3, 218, 198, 0.4); }
.add-btn:disabled { opacity: 0.4; cursor: default; }
@media (hover: hover) { .add-btn:hover:not(:disabled) { opacity: 0.85; } }
.add-btn:active:not(:disabled) { transform: scale(0.96); }

.save-btn {
  display: block; width: 100%;
  background: var(--primary); color: var(--on-primary);
  border: none; border-radius: var(--radius-lg);
  padding: 16px; font-size: 16px; font-weight: 700;
  cursor: pointer; touch-action: manipulation; outline: none;
  box-shadow: 0 4px 18px rgba(98, 0, 238, 0.3);
  margin-top: 20px;
  transition: opacity 0.15s ease, transform 0.1s ease;
}
.save-btn:focus-visible { box-shadow: 0 0 0 3px rgba(98, 0, 238, 0.35); }
.save-btn:disabled { opacity: 0.6; cursor: default; }
@media (hover: hover) { .save-btn:hover:not(:disabled) { opacity: 0.9; } }
.save-btn:active:not(:disabled) { transform: scale(0.98); }

.error-msg   { color: var(--error);      font-size: 13px; margin-top: 12px; text-align: center; }
.success-msg { color: var(--secondary-variant); font-size: 13px; margin-top: 12px; text-align: center; font-weight: 600; }

.link-btn {
  display: block; width: 100%;
  background: none; border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px; margin-top: 16px;
  font-size: 14px; font-weight: 600;
  color: var(--primary); cursor: pointer;
  text-align: center; touch-action: manipulation;
  transition: background 0.15s ease;
}
.link-btn:active { background: var(--surface-tinted, #f5f0ff); }
</style>
