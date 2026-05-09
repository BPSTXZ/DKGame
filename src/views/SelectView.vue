<template>
  <!-- 在根节点上监听点击事件，如果点到了卡片/浮窗外的地方，就会触发 hideTooltip -->
  <div class="screen active" id="select-screen" @click="hideTooltip">
    <!-- 点击标题触发彩蛋 -->
    <h1 @click.stop="handleTitleClick">选择你的英雄</h1>
    <div class="hero-pool" id="hero-pool">
      <div v-for="hero in filteredHeroPool" :key="hero.id" class="hero-card"
        :class="{ 'selected-p1': store.p1Selection?.id === hero.id, 'selected-p2': store.p2Selection?.id === hero.id, 'disabled': hero.disabled }"
        @click.stop="handleCardClick(hero, $event)" @contextmenu.prevent>
        <div class="hero-icon" :class="{ 'hero-icon--van': hero.class === 'Van' }" :style="{ background: hero.iconColor }">
          <div v-if="hero.class === 'Van'" class="hero-icon-sock"></div>
          <span v-if="hero.disabled"
            style="display: flex; justify-content: center; align-items: center; height: 100%; font-size: 2rem; color: #888;">?</span>
        </div>
        <h3>{{ hero.name }}</h3>
      </div>
    </div>

    <!-- 英雄介绍悬浮窗 -->
    <transition name="fade">
      <div v-if="hoveredHero" class="hero-tooltip" ref="tooltipRef" @click.stop
        :style="{ top: tooltipStyle.top, left: tooltipStyle.left, opacity: tooltipStyle.opacity }">
        <div class="tooltip-header">
          <h4>{{ hoveredHero.name }}</h4>
          <span class="tooltip-quote">{{ hoveredHero.quote }}</span>
          <!-- 彻底拦截点击/触摸事件，防止鬼影点击触发底部英雄卡片 -->
          <button class="tooltip-close" @click.stop.prevent="hideTooltip" @touchstart.stop.prevent="hideTooltip">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="white" stroke-width="3" stroke-linecap="round"
              stroke-linejoin="round" fill="none">
              <line x1="6" y1="6" x2="18" y2="18"></line>
              <line x1="6" y1="18" x2="18" y2="6"></line>
            </svg>
          </button>
        </div>
        <div class="tooltip-body">
          <p><strong>属性：</strong>{{ hoveredHero.stats }}</p>
          <p><strong>风格：</strong>{{ hoveredHero.traits }}</p>
          <div class="tooltip-skill">
            <strong>核心技能：{{ hoveredHero.skill.name }}</strong>
            <p>{{ hoveredHero.skill.desc }}</p>
          </div>
        </div>
        <!-- 动态偏移的底部小三角 -->
        <div class="tooltip-triangle"
          :style="{ left: triangleStyle.left, top: triangleStyle.top, bottom: triangleStyle.bottom, transform: triangleStyle.transform }">
        </div>
      </div>
    </transition>

    <div class="bottom-bar">
      <div class="selection-status">
        <p>玩家 1: <span>{{ store.p1Selection ? store.p1Selection.name : '未选择' }}</span></p>
        <p>玩家 2: <span>{{ store.p2Selection ? store.p2Selection.name : '未选择' }}</span></p>
      </div>
      <div class="action-buttons">
        <button :disabled="!store.p1Selection || !store.p2Selection" @click="startGame(false)">开始对战</button>
        <!-- 训练场按钮：只有在解锁后，并且选了两个英雄才能点击 -->
        <button v-if="isTrainingUnlocked" :disabled="!store.p1Selection || !store.p2Selection" @click="startGame(true)"
          style="background: #4caf50; color: white;">进入训练场</button>
        <button @click="router.push('/records')" style="background: #2196F3; color: white;">战斗记录</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// Import store
import { useGameStore } from '@/store/gameStore';
import { useRouter } from 'vue-router';
import { ref, reactive, computed } from 'vue';

import { MaLaoshi } from '@/game/entities/heroes/MaLaoshi.js';
import { HuaQiang } from '@/game/entities/heroes/HuaQiang.js';
import { Van } from '@/game/entities/heroes/Van.js';
import { SunWukong } from '@/game/entities/heroes/SunWukong.js';
import { T1000 } from '@/game/entities/heroes/T1000.js';
import { OnePunchMan } from '@/game/entities/heroes/OnePunchMan.js';
import { QueenS } from '@/game/entities/heroes/QueenS.js';
import { heroConfig } from '@/config/heroes.js';

const store = useGameStore();
const router = useRouter();

const heroPool = heroConfig;

let currentSelectAudio = null;

const tooltipRef = ref(null);
const hoveredHero = ref(null);
const tooltipStyle = reactive({ top: '0px', left: '0px', opacity: 0 });
const triangleStyle = reactive({ left: '50%' });

// 训练场解锁彩蛋逻辑
const isTrainingUnlocked = ref(localStorage.getItem('dkgame_training_unlocked') === 'true');

// 过滤后的英雄池计算属性
const filteredHeroPool = computed(() => {
  return heroPool.filter(hero => {
    // 如果是特殊英雄，只有在解锁训练场权限后才展示
    if (hero.isSpecial) {
      return isTrainingUnlocked.value;
    }
    return true;
  });
});

let titleClickCount = 0;
let titleClickTimer = null;

const handleTitleClick = () => {
  if (isTrainingUnlocked.value) return; // 已经解锁就不处理了

  titleClickCount++;

  // 每次点击重置定时器，如果1.5秒内没有连续点击，就清零
  clearTimeout(titleClickTimer);
  titleClickTimer = setTimeout(() => {
    titleClickCount = 0;
  }, 1500);

  // 连续点击8次解锁
  if (titleClickCount >= 8) {
    isTrainingUnlocked.value = true;
    localStorage.setItem('dkgame_training_unlocked', 'true');

    // 给点视觉反馈
    alert("秘籍激活：训练场已解锁！");
  }
};

import { nextTick } from 'vue';

const showTooltip = async (hero, event) => {
  hoveredHero.value = hero;
  // 先把透明度设为 0，防止在计算好高度前出现闪烁
  tooltipStyle.opacity = 0;

  const rect = event.currentTarget.getBoundingClientRect();

  // 等待 Vue 将 DOM 渲染出来，以便我们能拿到真实的 tooltip 高度
  await nextTick();

  // 如果快速移开了鼠标，则不处理
  if (!hoveredHero.value || !tooltipRef.value) return;

  const tooltipWidth = 320;
  // 动态获取真实渲染出来的高度
  const tooltipHeight = tooltipRef.value.offsetHeight;
  const margin = 15; // 边缘安全距离

  // 默认位置：卡片正上方居中
  let targetLeft = rect.left + (rect.width / 2) - (tooltipWidth / 2);
  let left = targetLeft;
  // 始终在上方显示，减去真实的高度，确保不会挡住卡片
  let top = rect.top - tooltipHeight - 15;

  // 1. 检查水平溢出
  if (left < margin) {
    // 屏幕左侧溢出，向右推
    left = margin;
  } else if (left + tooltipWidth > window.innerWidth - margin) {
    // 屏幕右侧溢出，向左拉
    left = window.innerWidth - tooltipWidth - margin;
  }

  // 2. 检查垂直溢出
  if (top < margin) {
    // 如果上方实在放不下了，就放下面
    top = rect.bottom + 15;
    // 小三角位置移到边框外：因为边框有2px，加上小三角高度，设置为 -12px
    triangleStyle.top = '-12px';
    triangleStyle.bottom = 'auto';
    triangleStyle.transform = 'translateX(-50%) rotate(180deg)';
  } else {
    // 正常放上方时的三角样式
    triangleStyle.top = 'auto';
    triangleStyle.bottom = '-12px';
    triangleStyle.transform = 'translateX(-50%)';
  }

  // 计算由于防溢出导致的水平偏移量
  const offset = targetLeft - left;

  // 小三角的基准是 50%，如果整体被偏移了，小三角要反向补偿，确保始终指向卡片中心
  let triangleOffsetPct = 50 + (offset / tooltipWidth) * 100;
  // 限制小三角不要超出 tooltip 的边框圆角范围 (比如限制在 5% 到 95% 之间)
  triangleOffsetPct = Math.max(5, Math.min(95, triangleOffsetPct));

  tooltipStyle.left = `${left}px`;
  tooltipStyle.top = `${top}px`;
  tooltipStyle.opacity = 1; // 计算完毕，显示
  triangleStyle.left = `${triangleOffsetPct}%`;
};

const hideTooltip = () => {
  hoveredHero.value = null;
  tooltipStyle.opacity = 0;
};

const handleCardClick = (hero, event) => {
  // 先执行选择逻辑（selectHero 内部会自动阻止选择 disabled 的英雄）
  selectHero(hero);

  // 无论是否是 disabled 的英雄，都弹出浮窗
  showTooltip(hero, event);
};

const selectHero = (hero) => {
  if (hero.disabled) return;

  if (!store.p1Selection) {
    store.p1Selection = hero;
  } else if (!store.p2Selection && store.p1Selection.id !== hero.id) {
    store.p2Selection = hero;
  } else if (store.p1Selection && store.p2Selection) {
    store.p1Selection = hero;
    store.p2Selection = null;
  }

  // 播放选择音效
  if (hero.audioSrc) {
    if (currentSelectAudio) {
      currentSelectAudio.pause();
      currentSelectAudio.currentTime = 0;
    }
    currentSelectAudio = new Audio(hero.audioSrc);
    currentSelectAudio.play().catch(e => console.warn('Select audio play failed:', e));
  }
};

const startGame = (isTraining) => {
  if (currentSelectAudio) {
    currentSelectAudio.pause();
    currentSelectAudio.currentTime = 0;
  }
  store.isTraining = isTraining;
  router.push('/battle');
};
</script>

<style scoped>
.hero-icon--van {
  position: relative;
  overflow: hidden;
}

.hero-icon-sock {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 38%;
  background: #ffffff;
  border-top: 2px solid rgba(220, 220, 220, 0.95);
  pointer-events: none;
}
</style>
