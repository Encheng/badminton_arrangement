<!-- src/views/MembersView.vue -->
<template>
  <div class="view">
    <!-- 未授權 — 管理員登入 -->
    <div v-if="!store.isAdmin" class="unauthorized">
      <p class="unauthorized__icon">🔒</p>
      <p class="unauthorized__title">管理員登入</p>
      <p class="unauthorized__sub">請輸入管理員密碼以使用管理功能</p>

      <form class="login-form" @submit.prevent="handleLogin">
        <input
          v-model="loginToken"
          class="login-input"
          type="password"
          placeholder="管理員密碼…"
          autocomplete="current-password"
          spellcheck="false"
          inputmode="text"
        />
        <button
          class="login-btn"
          type="submit"
          :disabled="!loginToken.trim()"
        >
          登入
        </button>
        <p v-if="loginError" class="login-error">密碼錯誤，請重新輸入</p>
      </form>
    </div>

    <!-- 管理畫面 -->
    <template v-else>
      <motion.header
        class="hero hero--secondary"
        :initial="{ opacity: 0, y: 30 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.45, ease: 'easeOut' }"
      >
        <div class="status-bar" aria-hidden="true"></div>
        <div class="hero__content">
          <p class="hero__eyebrow">管理模式</p>
          <h1 class="hero__title">成員管理</h1>
          <p class="hero__meta">{{ activeMembers.length }} 位固定成員</p>
        </div>
      </motion.header>

      <motion.main
        class="sheet"
        :initial="{ opacity: 0, y: 40 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.5, ease: 'easeOut', delay: 0.12 }"
      >
        <!-- 固定成員 -->
        <section class="section">
          <h2 class="section-heading">固定成員</h2>
          <div v-if="!activeMembers.length" class="empty-hint">尚無固定成員</div>
          <div
            v-for="m in activeMembers"
            :key="m.id"
            class="member-row"
          >
            <span class="member-row__name">{{ m.name }}</span>
            <button
              class="member-row__btn member-row__btn--danger"
              :disabled="saving.has(m.id)"
              @click="toggleMemberActive(m)"
            >
              {{ saving.has(m.id) ? '處理中…' : '停用' }}
            </button>
          </div>
        </section>

        <!-- 新增成員 -->
        <section class="section">
          <h2 class="section-heading">新增固定成員</h2>
          <div class="input-row">
            <input
              v-model="newMemberName"
              class="text-field"
              type="text"
              placeholder="輸入成員姓名…"
              autocomplete="off"
              spellcheck="false"
              @keydown.enter.prevent="addNewMember"
            >
            <button
              class="action-btn"
              :disabled="!newMemberName.trim() || addingMember"
              @click="addNewMember"
            >
              {{ addingMember ? '新增中…' : '+ 新增' }}
            </button>
          </div>
          <p v-if="addError" class="error-msg">{{ addError }}</p>
        </section>

        <!-- 已停用成員 -->
        <section v-if="inactiveMembers.length" class="section">
          <h2 class="section-heading">已停用成員</h2>
          <div
            v-for="m in inactiveMembers"
            :key="m.id"
            class="member-row member-row--inactive"
          >
            <span class="member-row__name member-row__name--inactive">{{ m.name }}</span>
            <button
              class="member-row__btn member-row__btn--restore"
              :disabled="saving.has(m.id)"
              @click="toggleMemberActive(m)"
            >
              {{ saving.has(m.id) ? '處理中…' : '重新啟用' }}
            </button>
          </div>
        </section>

        <!-- 歷史訪客（可升級為固定成員） -->
        <section v-if="promotableGuests.length" class="section">
          <h2 class="section-heading">歷史訪客</h2>
          <p class="section-hint">曾參加過的訪客，可將其升級為固定成員</p>
          <div
            v-for="g in promotableGuests"
            :key="g.guest_key"
            class="member-row member-row--guest"
          >
            <span class="member-row__name member-row__name--guest">{{ g.name }}</span>
            <button
              class="member-row__btn member-row__btn--promote"
              :disabled="saving.has(g.guest_key)"
              @click="promoteGuest(g)"
            >
              {{ saving.has(g.guest_key) ? '處理中…' : '升級為固定成員' }}
            </button>
          </div>
        </section>
      </motion.main>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { motion } from 'motion-v'
import { useAppStore } from '../stores/app.js'
import { api } from '../services/api.js'

const store = useAppStore()
const saving = ref(new Set())
const newMemberName = ref('')
const addingMember = ref(false)
const addError = ref('')
const loginToken = ref('')
const loginError = ref(false)

function handleLogin() {
  const token = loginToken.value.trim()
  if (!token) return
  store.setAdminToken(token)
  if (!store.isAdmin) {
    loginError.value = true
    store.clearAdminToken()
    loginToken.value = ''
  } else {
    loginError.value = false
  }
}

const activeMembers = computed(() => store.members.filter(m => m.active))
const inactiveMembers = computed(() => store.members.filter(m => !m.active))

const promotableGuests = computed(() => {
  const memberNames = new Set(store.members.map(m => m.name.toLowerCase()))
  return store.allUniqueGuests.filter(g => !memberNames.has(g.name.toLowerCase()))
})

async function toggleMemberActive(member) {
  saving.value = new Set([...saving.value, member.id])
  try {
    await api.saveMember(store.adminToken, { id: member.id, active: !member.active })
    await store.init()
  } finally {
    const next = new Set(saving.value)
    next.delete(member.id)
    saving.value = next
  }
}

async function addNewMember() {
  const name = newMemberName.value.trim()
  if (!name) return
  addingMember.value = true
  addError.value = ''
  try {
    await api.saveMember(store.adminToken, { name, active: true })
    await store.init()
    newMemberName.value = ''
  } catch (err) {
    addError.value = `新增失敗：${err.message}`
  } finally {
    addingMember.value = false
  }
}

async function promoteGuest(guest) {
  saving.value = new Set([...saving.value, guest.guest_key])
  try {
    const result = await api.saveMember(store.adminToken, { name: guest.name, active: true })
    await api.promoteGuest(store.adminToken, guest.guest_key, result.id)
    await store.init()
  } catch (err) {
    addError.value = `升級失敗：${err.message}`
  } finally {
    const next = new Set(saving.value)
    next.delete(guest.guest_key)
    saving.value = next
  }
}
</script>

<style scoped>
.view { min-height: 100dvh; display: flex; flex-direction: column; }

.unauthorized {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  min-height: 100dvh; text-align: center;
  padding: calc(32px + env(safe-area-inset-top, 0px)) 32px 32px;
}
.unauthorized__icon  { font-size: 64px; margin-bottom: 16px; }
.unauthorized__title { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
.unauthorized__sub   { font-size: 14px; color: var(--text-tertiary); }

.login-form {
  margin-top: 24px;
  width: 100%;
  max-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.login-input {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 14px 16px;
  font-size: 16px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  text-align: center;
}
.login-input:focus-visible {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(98, 0, 238, 0.15);
}
.login-input::placeholder { color: var(--text-tertiary); }
.login-btn {
  background: var(--primary);
  color: var(--on-primary);
  border: none;
  border-radius: var(--radius-lg);
  padding: 14px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  transition: opacity 0.15s ease, transform 0.1s ease;
  box-shadow: 0 4px 18px rgba(98, 0, 238, 0.3);
}
.login-btn:disabled { opacity: 0.4; cursor: default; }
.login-btn:active:not(:disabled) { transform: scale(0.96); }
.login-error {
  color: var(--error);
  font-size: 13px;
  text-align: center;
  font-weight: 600;
}

.hero--secondary { background: var(--secondary); }
.status-bar { height: var(--status-bar-height, env(safe-area-inset-top, 44px)); }
.hero__content { padding: 4px 22px 30px; color: var(--on-secondary); }
.hero__eyebrow {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 1.2px; opacity: 0.6; margin-bottom: 6px;
}
.hero__title {
  font-size: 28px; font-weight: 800;
  letter-spacing: -0.6px; line-height: 1.15; margin-bottom: 6px;
  color: var(--on-secondary);
}
.hero__meta { font-size: 13px; opacity: 0.7; color: var(--on-secondary); }

.sheet {
  flex: 1;
  background: var(--background);
  border-radius: 24px 24px 0 0;
  padding: 20px 16px calc(80px + env(safe-area-inset-bottom, 0px));
  margin-top: -20px;
}

.section { margin-bottom: 24px; }
.section-heading {
  display: block;
  font-size: 12px; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;
}
.section-hint {
  font-size: 12px; color: var(--text-tertiary); margin-bottom: 8px;
}

.empty-hint {
  font-size: 14px; color: var(--text-tertiary);
  padding: 12px 0;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  margin-bottom: 8px;
  box-shadow: var(--shadow-sm);
}
.member-row--inactive {
  background: var(--surface);
  opacity: 0.7;
}
.member-row--guest {
  background: #f0fdfc;
  border-color: rgba(3, 218, 198, 0.2);
}

.member-row__name {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}
.member-row__name--inactive {
  text-decoration: line-through;
  color: var(--text-tertiary);
}
.member-row__name--guest {
  color: var(--secondary-variant, #018786);
}

.member-row__btn {
  border: none;
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  transition: opacity 0.15s ease, transform 0.1s ease;
  white-space: nowrap;
}
.member-row__btn:disabled { opacity: 0.5; cursor: default; }
.member-row__btn:active:not(:disabled) { transform: scale(0.96); }

.member-row__btn--danger {
  background: rgba(176, 0, 32, 0.08);
  color: var(--error);
}
.member-row__btn--restore {
  background: rgba(3, 218, 198, 0.1);
  color: var(--secondary-variant, #018786);
}
.member-row__btn--promote {
  background: var(--secondary);
  color: var(--on-secondary);
}

.input-row { display: flex; gap: 8px; }
.text-field {
  flex: 1;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  font-size: 15px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.text-field:focus-visible {
  border-color: var(--secondary-variant);
  box-shadow: 0 0 0 3px rgba(1, 135, 134, 0.2);
}
.text-field::placeholder { color: var(--text-tertiary); }

.action-btn {
  background: var(--secondary);
  color: var(--on-secondary);
  border: none;
  border-radius: var(--radius-sm);
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  transition: opacity 0.15s ease, transform 0.1s ease;
  white-space: nowrap;
}
.action-btn:disabled { opacity: 0.4; cursor: default; }
.action-btn:active:not(:disabled) { transform: scale(0.96); }

.error-msg { color: var(--error); font-size: 13px; margin-top: 8px; }
</style>
