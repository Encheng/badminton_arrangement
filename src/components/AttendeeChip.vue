<!-- src/components/AttendeeChip.vue -->
<template>
  <motion.div
    class="attendee"
    role="listitem"
    :initial="{ opacity: 0, scale: 0.8 }"
    :animate="{ opacity: 1, scale: 1 }"
    :transition="{ type: 'spring', stiffness: 400, damping: 25, delay: delay }"
    :whileHover="{ scale: 1.06, y: -2 }"
    :whilePress="{ scale: 0.95 }"
    @click="flip"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="cancelPress"
    @pointercancel="cancelPress"
    @pointerleave="cancelPress"
    @contextmenu.prevent
  >
    <div class="flip-card" :class="{ flipped }">
      <!-- Front: avatar -->
      <div class="flip-front">
        <div class="avatar" aria-hidden="true">{{ initial }}</div>
      </div>
      <!-- Back: cute animal -->
      <div class="flip-back">
        <CuteAnimal :animal="assignedAnimal" />
      </div>
    </div>
    <span class="name">{{ name }}</span>
  </motion.div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { motion } from 'motion-v'
import CuteAnimal from './CuteAnimal.vue'

const ANIMALS = [
  { id: 'cat', label: '小貓咪' },
  { id: 'dog', label: '小狗狗' },
  { id: 'penguin', label: '小企鵝' },
  { id: 'rabbit', label: '小兔子' },
  { id: 'bear', label: '小熊熊' },
  { id: 'frog', label: '小青蛙' },
  { id: 'chick', label: '小雞仔' },
  { id: 'panda', label: '小熊貓' },
]

const props = defineProps({
  name: { type: String, required: true },
  delay: { type: Number, default: 0 },
})

const emit = defineEmits(['longpress'])

const LONG_PRESS_MS = 500
const MOVE_THRESHOLD_PX = 10

let pressTimer = null
let startX = 0
let startY = 0
let longPressFired = false

function onPointerDown(e) {
  startX = e.clientX
  startY = e.clientY
  longPressFired = false
  clearTimeout(pressTimer)
  pressTimer = setTimeout(() => {
    pressTimer = null
    longPressFired = true
    if (navigator.vibrate) navigator.vibrate(10)
    emit('longpress')
  }, LONG_PRESS_MS)
}

function onPointerMove(e) {
  if (pressTimer === null) return
  if (
    Math.abs(e.clientX - startX) > MOVE_THRESHOLD_PX ||
    Math.abs(e.clientY - startY) > MOVE_THRESHOLD_PX
  ) {
    cancelPress()
  }
}

function cancelPress() {
  clearTimeout(pressTimer)
  pressTimer = null
}

onUnmounted(cancelPress)

const initial = props.name.charAt(0).toUpperCase()
const flipped = ref(false)
const assignedAnimal = ref(ANIMALS[Math.floor(Math.random() * ANIMALS.length)].id)

function flip() {
  // 長按已觸發時，pointerup 後瀏覽器仍會補發 click，須吞掉避免翻牌
  if (longPressFired) {
    longPressFired = false
    return
  }
  if (!flipped.value) {
    assignedAnimal.value = ANIMALS[Math.floor(Math.random() * ANIMALS.length)].id
  }
  flipped.value = !flipped.value
}
</script>

<style scoped>
.attendee {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 4px 10px;
  gap: 6px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  min-width: 0;
  background: var(--surface);
  border: 1px solid rgba(98, 0, 238, 0.1);
  perspective: 600px;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.flip-card {
  width: 40px;
  height: 40px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.flip-card.flipped {
  transform: rotateY(180deg);
}

.flip-front,
.flip-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.flip-back {
  position: absolute;
  inset: 0;
  transform: rotateY(180deg);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  color: var(--on-primary);
  background: var(--primary);
  flex-shrink: 0;
}

.name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

</style>
