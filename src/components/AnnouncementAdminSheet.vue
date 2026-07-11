<!-- src/components/AnnouncementAdminSheet.vue -->
<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="show"
        key="ann-admin-backdrop"
        class="ann-sheet__backdrop"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="{ duration: 0.2 }"
        @click.self="close"
      >
        <motion.div
          class="ann-sheet"
          role="dialog"
          :aria-label="isEdit ? '編輯公告' : '新增公告'"
          :initial="{ y: '100%' }"
          :animate="{ y: 0 }"
          :exit="{ y: '100%' }"
          :transition="{ type: 'spring', stiffness: 300, damping: 30 }"
        >
          <div class="ann-sheet__header">
            <div class="ann-sheet__handle" aria-hidden="true"></div>
            <h2 class="ann-sheet__title">{{ isEdit ? '編輯公告' : '新增公告' }}</h2>
            <button class="ann-sheet__close" aria-label="關閉" @click="close">
              <X :size="20" :stroke-width="2" />
            </button>
          </div>

          <form class="ann-sheet__body" @submit.prevent="submit">
            <label class="ann-field">
              <span class="ann-field__label">標題 *</span>
              <input v-model.trim="form.title" class="ann-field__input" type="text" placeholder="公告標題" />
            </label>

            <label class="ann-field">
              <span class="ann-field__label">內文</span>
              <textarea v-model.trim="form.body" class="ann-field__input" rows="3" placeholder="公告內容（可留空）"></textarea>
            </label>

            <label class="ann-field">
              <span class="ann-field__label">連結網址</span>
              <input v-model.trim="form.link_url" class="ann-field__input" type="url" placeholder="https://…（可留空）" />
            </label>

            <label class="ann-field">
              <span class="ann-field__label">按鈕文字</span>
              <input v-model.trim="form.link_label" class="ann-field__input" type="text" placeholder="預設「查看」" />
            </label>

            <label class="ann-field">
              <span class="ann-field__label">到期日</span>
              <div class="ann-field__row">
                <input v-model="form.expires_at" class="ann-field__input" type="date" />
                <button
                  type="button"
                  class="ann-quick"
                  @click="form.expires_at = comingSaturday"
                >本週場次 {{ comingSaturdayLabel }}</button>
              </div>
              <span class="ann-field__hint">留空＝永久顯示；設日期則當天仍顯示、隔天自動隱藏</span>
            </label>

            <label class="ann-check">
              <input v-model="form.pinned" type="checkbox" />
              <span>釘選／標為重要</span>
            </label>

            <button class="ann-sheet__submit" type="submit" :disabled="!form.title || saving">
              {{ saving ? '儲存中…' : '儲存' }}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { motion, AnimatePresence } from 'motion-v'
import { X } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import { getComingSaturday } from '../utils/date.js'

const props = defineProps({
  show:    { type: Boolean, default: false },
  editing: { type: Object,  default: null },
})
const emit = defineEmits(['update:show'])

const store  = useAppStore()
const saving = ref(false)
const isEdit = computed(() => !!(props.editing && props.editing.id))

// 到期日快速鈕：本週場次（本週六）。開啟表單時重算，避免跨週後過期。
const comingSaturday = ref(getComingSaturday())
const comingSaturdayLabel = computed(() => {
  const [, m, d] = comingSaturday.value.split('-')
  return `${Number(m)}/${Number(d)}`
})

const form = reactive({
  id: null, title: '', body: '', link_url: '', link_label: '', expires_at: '', pinned: false,
})

// 開啟時依 editing 帶入或清空表單
watch(() => props.show, (open) => {
  if (!open) return
  comingSaturday.value = getComingSaturday()
  const e = props.editing
  form.id         = e?.id ?? null
  form.title      = e?.title ?? ''
  form.body       = e?.body ?? ''
  form.link_url   = e?.link_url ?? ''
  form.link_label = e?.link_label ?? ''
  form.expires_at = e?.expires_at ?? ''
  form.pinned     = e?.pinned ?? false
})

function close() {
  emit('update:show', false)
}

async function submit() {
  if (!form.title || saving.value) return
  saving.value = true
  const payload = {
    title: form.title,
    body: form.body,
    link_url: form.link_url,
    link_label: form.link_label,
    expires_at: form.expires_at,
    pinned: form.pinned,
  }
  if (form.id && !String(form.id).startsWith('temp-')) payload.id = form.id
  try {
    await store.saveAnnouncementOptimistic(payload)
    store.showToast(isEdit.value ? '公告已更新' : '公告已新增', 'success')
    close()
  } catch (err) {
    store.showToast(`儲存失敗：${err.message}`, 'error', 4000)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.ann-sheet__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
}
.ann-sheet {
  width: 100%;
  max-width: 480px;
  background: var(--surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
}
.ann-sheet__header {
  position: relative;
  padding: 10px 16px 8px;
  border-bottom: 1px solid var(--border);
}
.ann-sheet__handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  margin: 0 auto 8px;
}
.ann-sheet__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  text-align: center;
}
.ann-sheet__close {
  position: absolute;
  top: 8px;
  right: 12px;
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
}
.ann-sheet__body {
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ann-field { display: flex; flex-direction: column; gap: 6px; }
.ann-field__label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.ann-field__input {
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  box-sizing: border-box;
}
.ann-field__row { display: flex; gap: 8px; align-items: stretch; }
.ann-field__row .ann-field__input { flex: 1; }
.ann-quick {
  flex-shrink: 0;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--primary);
  background: var(--surface-tinted);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.ann-field__hint { font-size: 12px; color: var(--text-tertiary); line-height: 1.4; }
.ann-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary);
}
.ann-sheet__submit {
  margin-top: 4px;
  padding: 12px;
  font-size: 15px;
  font-weight: 700;
  color: var(--on-primary);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.ann-sheet__submit:disabled { opacity: 0.5; cursor: default; }
</style>
