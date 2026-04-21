<!-- src/views/StatsView.vue -->
<template>
  <PullRefresh @refresh="onRefresh">
  <div class="view">
    <motion.header
      class="hero hero--sec-variant"
      :initial="{ opacity: 0, y: 30 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.45, ease: 'easeOut' }"
    >
      <div class="status-bar" aria-hidden="true"></div>
      <div class="hero__content">
        <p class="hero__eyebrow">統計 &amp; 榮譽</p>
        <h1 class="hero__title">排行榜</h1>
        <p class="hero__meta">共 {{ store.sessions.length }} 週統計</p>
      </div>
    </motion.header>

    <motion.main
      class="sheet"
      :initial="{ opacity: 0, y: 40 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.5, ease: 'easeOut', delay: 0.12 }"
    >
      <!-- 骨架屏 -->
      <div v-if="store.loading" class="skeleton-state" aria-label="載入中">
        <div v-for="n in 5" :key="n" class="skeleton-rank">
          <SkeletonBlock width="28px" height="22px" radius="6px" />
          <div style="flex: 1; min-width: 0;">
            <SkeletonBlock :width="60 + n * 8 + 'px'" height="14px" radius="6px" />
            <SkeletonBlock width="100%" height="4px" radius="4px" style="margin-top: 6px;" />
          </div>
          <SkeletonBlock width="36px" height="13px" radius="6px" />
        </div>
      </div>

      <div v-else-if="!leaderboard.length" class="empty-state">
        <p class="empty-state__icon"><Trophy :size="48" :stroke-width="1.5" /></p>
        <p class="empty-state__title">尚無出席記錄</p>
      </div>
      <template v-else>
        <ol aria-label="出席排行榜" class="rank-list">
          <RankCard
            v-for="(entry, i) in leaderboard"
            :key="entry.member.id"
            :rank="i + 1"
            :member="entry.member"
            :count="entry.count"
            :max-count="leaderboard[0].count"
          />
        </ol>

        <!-- 選取成員查看徽章 -->
        <div class="member-selector">
          <label for="badge-member-select" class="section-heading">
            查看個人成就
          </label>
          <select
            id="badge-member-select"
            v-model="selectedMemberId"
            class="member-select"
            autocomplete="off"
          >
            <option v-for="m in store.activeMembers" :key="m.id" :value="m.id">
              {{ m.name }}
            </option>
          </select>
        </div>

        <BadgeGrid v-if="selectedMemberId" :member-id="selectedMemberId" />
      </template>
    </motion.main>
  </div>
  </PullRefresh>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { motion } from 'motion-v'
import { Trophy } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import { buildLeaderboard } from '../utils/stats.js'
import RankCard from '../components/RankCard.vue'
import SkeletonBlock from '../components/SkeletonBlock.vue'
import BadgeGrid from '../components/BadgeGrid.vue'
import PullRefresh from '../components/PullRefresh.vue'

const store = useAppStore()

async function onRefresh({ done, fail }) {
  try { await store.refresh(); done() }
  catch (e) { fail(e) }
}

const leaderboard = computed(() =>
  buildLeaderboard(store.members, store.sessions)
)

const selectedMemberId = ref(null)
watch(() => store.activeMembers, (members) => {
  if (!selectedMemberId.value && members.length) {
    selectedMemberId.value = members[0].id
  }
}, { immediate: true })
</script>

<style scoped>
.view { min-height: 100dvh; display: flex; flex-direction: column; }
.hero--sec-variant { background: var(--secondary-variant); }

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
}

.rank-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 4px; }

.member-selector { margin-top: 20px; }
.section-heading {
  display: block;
  font-size: 12px; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;
}
.member-select {
  width: 100%;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  font-size: 15px;
  color: var(--text-primary);
  touch-action: manipulation;
  outline: none;
  color-scheme: light;
}
.member-select:focus-visible {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(98, 0, 238, 0.15);
}

.skeleton-state { display: flex; flex-direction: column; gap: 8px; }
.skeleton-rank {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--border);
}

.empty-state {
  text-align: center; padding: 48px 16px;
}
.empty-state__icon  { margin-bottom: 12px; color: var(--text-tertiary); }
.empty-state__title { font-size: 16px; font-weight: 600; }
</style>
