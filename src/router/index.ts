import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { guest: true, title: '登录' }
    },
    {
      path: '/',
      component: () => import('@/components/layout/AdminLayout.vue'),
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { title: '仪表盘' }
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/UsersView.vue'),
          meta: { title: '用户管理' }
        },
        {
          path: 'templates',
          name: 'templates',
          component: () => import('@/views/TemplatesView.vue'),
          meta: { title: 'SOP模板管理' }
        },
        {
          path: 'templates/:id/edit',
          name: 'template-edit',
          component: () => import('@/views/TemplateEditView.vue'),
          meta: { title: '编辑模板' }
        },
        {
          path: 'templates/new',
          name: 'template-new',
          component: () => import('@/views/TemplateEditView.vue'),
          meta: { title: '新建模板' }
        },
        {
          path: 'runs',
          name: 'runs',
          component: () => import('@/views/RunsView.vue'),
          meta: { title: '运行监控' }
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { guest: true, title: '页面不存在' }
    }
  ]
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  if (!to.meta.guest && !authStore.isLoggedIn) {
    return { name: 'login' }
  }
  if (to.meta.guest && authStore.isLoggedIn && to.name === 'login') {
    return { name: 'dashboard' }
  }
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} - 莫小派管理` : '莫小派管理'
})

export default router
