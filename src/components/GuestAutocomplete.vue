<!-- src/components/GuestAutocomplete.vue -->
<template>
  <div class="autocomplete-row">
    <div class="autocomplete-wrapper" ref="wrapperRef">
      <input
        v-model="inputValue"
        class="guest-field"
        type="text"
        :placeholder="placeholder"
        autocomplete="off"
        spellcheck="false"
        inputmode="text"
        @input="onInput"
        @focus="showDropdown = true"
        @keydown.enter.prevent="handleAdd"
        @keydown.escape="showDropdown = false"
        @keydown.down.prevent="highlightNext"
        @keydown.up.prevent="highlightPrev"
      >
      <ul
        v-if="showDropdown && filteredGuests.length"
        class="dropdown"
        role="listbox"
      >
        <li
          v-for="(guest, idx) in filteredGuests"
          :key="guest.guest_key"
          class="dropdown__item"
          :class="{ 'dropdown__item--active': idx === highlightIndex }"
          role="option"
          @mousedown.prevent="selectGuest(guest)"
        >
          {{ guest.name }}
        </li>
      </ul>
    </div>
    <button
      type="button"
      class="add-btn"
      :disabled="!inputValue.trim()"
      @click="handleAdd"
    >
      + 新增
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../stores/app.js'

const props = defineProps({
  placeholder: { type: String, default: '輸入訪客姓名…' },
})

const emit = defineEmits(['add'])

const store = useAppStore()
const inputValue = ref('')
const showDropdown = ref(false)
const highlightIndex = ref(-1)
const wrapperRef = ref(null)

const MAX_RESULTS = 10

const filteredGuests = computed(() => {
  const q = inputValue.value.trim().toLowerCase()
  const list = q
    ? store.allUniqueGuests.filter(g => g.name.toLowerCase().includes(q))
    : store.allUniqueGuests
  return list.slice(0, MAX_RESULTS)
})

function onInput() {
  showDropdown.value = true
  highlightIndex.value = -1
}

function highlightNext() {
  if (highlightIndex.value < filteredGuests.value.length - 1) highlightIndex.value++
}

function highlightPrev() {
  if (highlightIndex.value > 0) highlightIndex.value--
}

function selectGuest(guest) {
  emit('add', guest.name)
  inputValue.value = ''
  showDropdown.value = false
  highlightIndex.value = -1
}

function handleAdd() {
  if (highlightIndex.value >= 0 && filteredGuests.value[highlightIndex.value]) {
    selectGuest(filteredGuests.value[highlightIndex.value])
    return
  }
  const name = inputValue.value.trim()
  if (!name) return
  emit('add', name)
  inputValue.value = ''
  showDropdown.value = false
  highlightIndex.value = -1
}

function onClickOutside(e) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
    showDropdown.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<style scoped>
.autocomplete-row {
  display: flex;
  gap: 8px;
  margin: 10px 0 0;
}

.autocomplete-wrapper {
  flex: 1;
  position: relative;
}

.guest-field {
  width: 100%;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  font-size: 15px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  box-sizing: border-box;
}
.guest-field:focus-visible {
  border-color: var(--secondary-variant);
  box-shadow: 0 0 0 3px rgba(1, 135, 134, 0.2);
}
.guest-field::placeholder { color: var(--text-tertiary); }

.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--surface, #fff);
  border: 1.5px solid var(--border);
  border-top: none;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  list-style: none;
  margin: 0;
  padding: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.dropdown__item {
  padding: 10px 14px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.1s ease;
}
.dropdown__item:hover,
.dropdown__item--active {
  background: var(--surface-tinted, #f5f0ff);
}

.add-btn {
  background: var(--secondary);
  color: var(--on-secondary);
  border: none;
  border-radius: var(--radius-sm);
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  outline: none;
  transition: opacity 0.15s ease, transform 0.1s ease;
  white-space: nowrap;
}
.add-btn:focus-visible { box-shadow: 0 0 0 3px rgba(3, 218, 198, 0.4); }
.add-btn:disabled { opacity: 0.4; cursor: default; }
@media (hover: hover) { .add-btn:hover:not(:disabled) { opacity: 0.85; } }
.add-btn:active:not(:disabled) { transform: scale(0.96); }
</style>
