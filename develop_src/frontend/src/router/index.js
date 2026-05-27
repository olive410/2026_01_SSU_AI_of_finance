import { createRouter, createWebHistory } from 'vue-router'
import DashboardView  from '../views/DashboardView.vue'
import ReportsView    from '../views/ReportsView.vue'
import ReflectionView from '../views/ReflectionView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',           component: DashboardView },
    { path: '/reports',    component: ReportsView },
    { path: '/reflection', component: ReflectionView },
  ],
})

export default router
