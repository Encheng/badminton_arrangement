<!-- src/components/MemberCheckItem.vue -->
<template>
  <div class="item" :class="{ 'item--guest': isGuest }">
    <label :for="`check-${uid}`" class="item__label">
      <input
        :id="`check-${uid}`"
        type="checkbox"
        :name="`member-${uid}`"
        :checked="checked"
        autocomplete="off"
        class="item__checkbox"
        @change="$emit('update:checked', $event.target.checked)"
      >
      <span class="item__name" :class="{ 'item__name--guest': isGuest }">
        {{ name }}
      </span>
      <span v-if="meta" class="item__meta">{{ meta }}</span>
    </label>
  </div>
</template>

<script setup>
defineProps({
  uid:     { type: String,  required: true },
  name:    { type: String,  required: true },
  checked: { type: Boolean, default: false },
  meta:    { type: String,  default: '' },
  isGuest: { type: Boolean, default: false },
})

defineEmits(['update:checked'])
</script>

<style scoped>
.item {
  background: var(--surface);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.item--guest {
  background: #fff8f8;
  border-color: rgba(176, 0, 32, 0.15);
}
.item__label {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
  touch-action: manipulation;
}
.item__label:focus-within {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
  border-radius: var(--radius-md);
}
@media (hover: hover) {
  .item__label:hover { background: var(--surface-tinted); }
}
.item__checkbox {
  width: 22px; height: 22px;
  border-radius: 50%;
  accent-color: var(--primary);
  cursor: pointer;
  flex-shrink: 0;
}
.item__name         { font-size: 15px; font-weight: 600; color: var(--text-primary); flex: 1; }
.item__name--guest  { color: var(--error); }
.item__meta         { font-size: 11px; color: var(--text-tertiary); flex-shrink: 0; }
</style>
