import { createRouter, createWebHashHistory } from 'vue-router';
import SelectView from '../views/SelectView.vue';

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'select',
      component: SelectView
    },
    {
      path: '/battle',
      name: 'battle',
      component: () => import('../views/BattleView.vue')
    }
  ]
});

// 路由守卫：防止未选择英雄直接进入战斗
import { useGameStore } from '../store/gameStore.js';

router.beforeEach((to, from, next) => {
  if (to.name === 'battle') {
    const store = useGameStore();
    if (!store.p1Selection || !store.p2Selection) {
      next({ name: 'select' });
      return;
    }
  }
  next();
});

export default router;
