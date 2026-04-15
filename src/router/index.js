// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { useAppStore } from '../stores/app.js'

const routes = [
  { path: '/',         component: () => import('../views/WeekView.vue') },
  { path: '/sessions', component: () => import('../views/SessionsView.vue') },
  { path: '/history',  redirect: '/sessions' },
  { path: '/stats',    component: () => import('../views/StatsView.vue') },
  { path: '/members',  component: () => import('../views/MembersView.vue') },
  { path: '/admin',    redirect: to => ({ path: '/sessions', query: { date: to.query.date } }) },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  if (to.query.token) {
    const store = useAppStore()
    store.setAdminToken(to.query.token)
    const query = { ...to.query }
    delete query.token
    return { path: to.path, query, replace: true }
  }
})

export default router
