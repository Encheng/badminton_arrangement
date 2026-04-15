<!-- src/components/AttendeeChip.vue -->
<template>
  <div
    class="chip"
    :class="type === 'guest' ? 'chip--guest' : 'chip--member'"
    role="listitem"
  >
    <div class="avatar" aria-hidden="true">{{ initial }}</div>
    <span>{{ name }}</span>
  </div>
</template>

<script setup>
const props = defineProps({
  name: { type: String, required: true },
  type: { type: String, default: 'member' }, // 'member' | 'guest'
})

const initial = props.name.charAt(0).toUpperCase()
</script>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 13px 8px 8px;
  border-radius: 100px;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.chip--member {
  background: var(--surface);
  color: var(--primary);
  border-color: rgba(98, 0, 238, 0.15);
}

.chip--guest {
  background: #fff8f8;
  color: var(--error);
  border-color: rgba(176, 0, 32, 0.2);
}

.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--on-primary);
  background: var(--primary);
  flex-shrink: 0;
}

.chip--guest .avatar {
  background: var(--error);
}
</style>
