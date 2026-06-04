<template>
  <!-- 在根节点上监听点击事件，如果点到了卡片/浮窗外的地方，就会触发 hideTooltip -->
  <div class="screen active" id="select-screen" @click="hideTooltip">
    <!-- 点击标题触发彩蛋 -->
    <h1 @click.stop="handleTitleClick(true)">选择你的英雄<span v-if="isTrainingUnlocked" @click.stop="handleTitleClick(false)">（开发版）</span></h1>
    <div class="hero-pool" id="hero-pool" ref="heroPoolRef" :class="{ 'is-shrunken': isShrinking }">
      <div v-for="hero in filteredHeroPool" :key="hero.id" class="hero-card"
        :class="{ 
          'selected-p1': store.p1Selection?.id === hero.id, 
          'selected-p2': store.p2Selection?.id === hero.id, 
          'disabled': hero.disabled,
          'highlight-random': isRandomizing && (store.p1Selection?.id === hero.id || store.p2Selection?.id === hero.id)
        }"
        @click.stop="handleCardClick(hero, $event)" @contextmenu.prevent>
        <div class="hero-icon" :class="{ 
          'hero-icon--van': hero.class === 'Van', 
          'hero-icon--thunderflash': hero.class === 'ThunderFlash', 
          'hero-icon--malaoshi': hero.class === 'MaLaoshi', 
          'hero-icon--dragonking': hero.class === 'DragonKing', 
          'hero-icon--bomber': hero.class === 'Bomber', 
          'hero-icon--flameartist': hero.class === 'FlameArtist', 
          'hero-icon--crimsonblade': hero.class === 'CrimsonBlade',
          'hero-icon--jueshiyouwu': hero.class === 'JueShiYouWu',
          'is-selected': store.p1Selection?.id === hero.id || store.p2Selection?.id === hero.id 
        }" :style="{ background: hero.iconColor }">
          <div v-if="hero.class === 'Van'" class="hero-icon-sock"></div>
          
          <div v-if="hero.class === 'DragonKing'" class="hero-icon-dragonking-mouth">
            <svg viewBox="0 0 40 40" width="100%" height="100%">
              <!-- 稍微缩放一点嘴巴，通过 transform 的 scale 实现，并向下偏移 -->
              <g transform="translate(4, 10) scale(0.8)">
                <path class="dk-mouth-normal" d="M 10 25 L 30 25" stroke="#ffd700" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                <!-- 使用 transform 旋转以还原游戏中倾斜的 √ 形歪嘴，稍微减轻倾斜和上扬幅度 -->
                <g class="dk-mouth-smile" transform="translate(4, 5) rotate(-5 20 20)">
                  <path d="M 5 20 L 22 20 Q 28 20 32 14" stroke="#ffd700" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                </g>
              </g>
            </svg>
          </div>

          <div v-if="hero.class === 'MaLaoshi'" class="hero-icon-taiji">
            <div class="taiji-left"></div>
            <div class="taiji-right"></div>
            <div class="taiji-top"></div>
            <div class="taiji-bottom"></div>
          </div>
          
          <div v-if="hero.class === 'ThunderFlash'" class="hero-icon-thunderflash-pattern">
            <!-- 规则排列的善逸羽织三角形鳞纹 -->
            <div class="tf-tri-row tf-row-1">
              <div class="tf-tri"></div><div class="tf-tri"></div><div class="tf-tri"></div>
            </div>
            <div class="tf-tri-row tf-row-2">
              <div class="tf-tri"></div><div class="tf-tri"></div>
            </div>
            <div class="tf-tri-row tf-row-3">
              <div class="tf-tri"></div><div class="tf-tri"></div><div class="tf-tri"></div>
            </div>
            <div class="tf-tri-row tf-row-4">
              <div class="tf-tri"></div><div class="tf-tri"></div>
            </div>
          </div>

          <div v-if="hero.class === 'Bomber'" class="hero-icon-bomber-stripes"></div>

          <div v-if="hero.class === 'FlameArtist'" class="hero-icon-flame-waves">
            <div class="flame-wave wave-1"></div>
            <div class="flame-wave wave-2"></div>
          </div>

          <div v-if="hero.class === 'CrimsonBlade'" class="hero-icon-blade-reflection">
            <div class="blade-line"></div>
          </div>

          <div v-if="hero.iconImg" class="hero-icon-jueshiyouwu">
            <img :src="hero.iconImg" alt="图片" />
          </div>

          <span v-if="hero.disabled"
            style="display: flex; justify-content: center; align-items: center; height: 100%; font-size: 2rem; color: #888;">?</span>
        </div>
        <h3>{{ hero.name }}</h3>
      </div>
    </div>

    <!-- 随机对战 VS 弹出展示层 -->
    <transition name="vs-zoom">
      <div v-if="showVSOverlay" class="vs-overlay" @click.stop>
        <div class="vs-content">
          <div class="vs-hero p1-side">
            <div class="vs-icon" :style="{ background: store.p1Selection.iconColor }">
              <div v-if="store.p1Selection.class === 'Van'" class="hero-icon-sock"></div>
              <div v-if="store.p1Selection.class === 'MaLaoshi'" class="hero-icon-taiji">
                <div class="taiji-left"></div>
                <div class="taiji-right"></div>
                <div class="taiji-top"></div>
                <div class="taiji-bottom"></div>
              </div>
              <div v-if="store.p1Selection.class === 'ThunderFlash'" class="hero-icon-thunderflash-pattern">
                <div class="tf-tri-row tf-row-1">
                  <div class="tf-tri"></div><div class="tf-tri"></div><div class="tf-tri"></div>
                </div>
                <div class="tf-tri-row tf-row-2">
                  <div class="tf-tri"></div><div class="tf-tri"></div>
                </div>
              </div>
              <div v-if="store.p1Selection.class === 'Bomber'" class="hero-icon-bomber-stripes"></div>
              <div v-if="store.p1Selection.class === 'FlameArtist'" class="hero-icon-flame-waves">
                <div class="flame-wave wave-1"></div>
                <div class="flame-wave wave-2"></div>
              </div>
              <div v-if="store.p1Selection.class === 'CrimsonBlade'" class="hero-icon-blade-reflection">
                <div class="blade-line"></div>
              </div>
              <div v-if="store.p1Selection.iconImg" class="hero-icon-jueshiyouwu">
                <img :src="store.p1Selection.iconImg" alt="图片" />
              </div>
            </div>
            <div class="vs-name">{{ store.p1Selection.name }}</div>
          </div>
          <div class="vs-divider">VS</div>
          <div class="vs-hero p2-side">
            <div class="vs-icon" :style="{ background: store.p2Selection.iconColor }">
              <div v-if="store.p2Selection.class === 'Van'" class="hero-icon-sock"></div>
              <div v-if="store.p2Selection.class === 'MaLaoshi'" class="hero-icon-taiji">
                <div class="taiji-left"></div>
                <div class="taiji-right"></div>
                <div class="taiji-top"></div>
                <div class="taiji-bottom"></div>
              </div>
              <div v-if="store.p2Selection.class === 'ThunderFlash'" class="hero-icon-thunderflash-pattern">
                <div class="tf-tri-row tf-row-1">
                  <div class="tf-tri"></div><div class="tf-tri"></div><div class="tf-tri"></div>
                </div>
                <div class="tf-tri-row tf-row-2">
                  <div class="tf-tri"></div><div class="tf-tri"></div>
                </div>
              </div>
              <div v-if="store.p2Selection.class === 'Bomber'" class="hero-icon-bomber-stripes"></div>
              <div v-if="store.p2Selection.class === 'FlameArtist'" class="hero-icon-flame-waves">
                <div class="flame-wave wave-1"></div>
                <div class="flame-wave wave-2"></div>
              </div>
              <div v-if="store.p2Selection.class === 'CrimsonBlade'" class="hero-icon-blade-reflection">
                <div class="blade-line"></div>
              </div>
              <div v-if="store.p2Selection.iconImg" class="hero-icon-jueshiyouwu">
                <img :src="store.p2Selection.iconImg" alt="图片" />
              </div>
            </div>
            <div class="vs-name">{{ store.p2Selection.name }}</div>
          </div>
        </div>
      </div>
    </transition>

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
        <p>玩家 1: <span>{{ store.p1Selection ? store.p1Selection.name : (isRandomizing ? '抽取中...' : '未选择') }}</span></p>
        <p>玩家 2: <span>{{ store.p2Selection ? store.p2Selection.name : (isRandomizing ? '抽取中...' : '未选择') }}</span></p>
      </div>
      <div class="action-buttons">
        <button class="primary-btn" :disabled="!store.p1Selection || !store.p2Selection || isRandomizing || showVSOverlay" @click="startGame(false)">开始对战</button>
        <button class="random-btn" :disabled="isRandomizing || showVSOverlay" @click="startRandomBattle">
          {{ isRandomizing ? '正在随机...' : '随机对战' }}
        </button>
        <!-- 训练场按钮：只有在解锁后，并且选了两个英雄才能点击 -->
        <button v-if="isTrainingUnlocked" class="training-btn" :disabled="!store.p1Selection || !store.p2Selection || isRandomizing || showVSOverlay" @click="startGame(true)">进入训练场</button>
        <button v-if="isTrainingUnlocked" class="debug-btn" :disabled="!store.p1Selection || !store.p2Selection || isRandomizing || showVSOverlay" @click="startDebugMode">调试模式</button>
        <button class="records-btn" :disabled="isRandomizing || showVSOverlay" @click="router.push('/records')">战斗记录</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// Import store
import { useGameStore } from '@/store/gameStore';
import { useRouter } from 'vue-router';
import { ref, reactive, computed, onUnmounted } from 'vue';

import { MaLaoshi } from '@/game/entities/heroes/MaLaoshi.js';
import { HuaQiang } from '@/game/entities/heroes/HuaQiang.js';
import { Van } from '@/game/entities/heroes/Van.js';
import { SunWukong } from '@/game/entities/heroes/SunWukong.js';
import { T1000 } from '@/game/entities/heroes/T1000.js';
import { OnePunchMan } from '@/game/entities/heroes/OnePunchMan.js';
import { QueenS } from '@/game/entities/heroes/QueenS.js';
import { FlameArtist } from '@/game/entities/heroes/FlameArtist.js';
import { CrimsonBlade } from '@/game/entities/heroes/CrimsonBlade.js';
import { heroConfig } from '@/config/heroes.js';

const store = useGameStore();
const router = useRouter();

const heroPool = heroConfig;

const heroPoolRef = ref(null);
const isRandomizing = ref(false);
const isShrinking = ref(false);
const showVSOverlay = ref(false);
let currentSelectAudio = null;
let randomTickAudio = null; // 随机跳动音效
const confirmAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/common/选中.mp3'); // 选中确认音效

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

const handleTitleClick = (isTrainingClick) => {
  if (!isTrainingClick){
    //关闭训练场彩蛋
    isTrainingUnlocked.value = false;
    localStorage.setItem('dkgame_training_unlocked', 'false');
    return;
  };
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

const startRandomBattle = async () => {
  if (isRandomizing.value) return;
  
  // 1. 开始缩小动画
  isShrinking.value = true;
  store.p1Selection = null;
  store.p2Selection = null;
  hideTooltip();
  
  // 等待缩小过渡完成
  await new Promise(resolve => setTimeout(resolve, 400));

  const availableHeroes = filteredHeroPool.value.filter(h => !h.disabled);
  if (availableHeroes.length < 2) {
    isShrinking.value = false;
    return;
  }

  isRandomizing.value = true;

  // 1.5秒的随机跳动动画
  const duration = 1500;
  const interval = 80;
  const startTime = Date.now();

  const shuffle = () => {
    let idx1 = Math.floor(Math.random() * availableHeroes.length);
    let idx2 = Math.floor(Math.random() * availableHeroes.length);
    while (idx1 === idx2) {
      idx2 = Math.floor(Math.random() * availableHeroes.length);
    }
    store.p1Selection = availableHeroes[idx1];
    store.p2Selection = availableHeroes[idx2];

    // 播放选中切换音效
    if (confirmAudio) {
      const tick = confirmAudio.cloneNode();
      tick.volume = 0.3; // 过程中的声音小一点
      tick.play().catch(() => {});
    }
  };

  const timer = setInterval(() => {
    shuffle();
    
    // 自动滚动逻辑
    if (heroPoolRef.value) {
      const el = heroPoolRef.value;
      const scrollHeight = el.scrollHeight;
      const clientHeight = el.clientHeight;
      const maxScroll = scrollHeight - clientHeight;
      
      if (maxScroll > 0) {
        const progress = (Date.now() - startTime) / duration;
        // 使用 linear 或 ease-in-out 滚动
        el.scrollTop = maxScroll * Math.min(progress, 1);
      }
    }

    if (Date.now() - startTime > duration) {
      clearInterval(timer);
      isRandomizing.value = false;
      
      // 直接复用 startGame 的逻辑，它包含了展示 VS 动画和跳转
      startGame(false);
    }
  }, interval);
};

const startGame = (isTraining) => {
  // 如果已经在随机或准备阶段，阻止重复点击
  if (isRandomizing.value || showVSOverlay.value) return;

  if (currentSelectAudio) {
    currentSelectAudio.pause();
    currentSelectAudio.currentTime = 0;
  }
  
  // 播放最终确认音效
  if (confirmAudio) {
    confirmAudio.volume = 1.0;
    confirmAudio.currentTime = 0;
    confirmAudio.play().catch(() => {});
  }
  
  // 展示 VS 弹出层
  showVSOverlay.value = true;
  
  // 1S后进入对决
  setTimeout(() => {
    store.isTraining = isTraining;
    store.isDebug = false;
    router.push('/battle');
  }, 1000);
};

const startDebugMode = () => {
  if (currentSelectAudio) {
    currentSelectAudio.pause();
    currentSelectAudio.currentTime = 0;
  }
  store.isTraining = false;
  store.isDebug = true;
  store.resetDebugConfig();
  router.push('/debug-config');
};

onUnmounted(() => {
  isShrinking.value = false;
  showVSOverlay.value = false;
  isRandomizing.value = false;
});
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

.hero-icon--malaoshi {
  position: relative;
  overflow: hidden;
}

.hero-icon-taiji {
  position: absolute;
  top: 7.5%;
  left: 7.5%;
  width: 85%;
  height: 85%;
  border-radius: 50%;
  border: 1px solid #000;
  box-sizing: border-box;
  pointer-events: none;
  animation: spin 4s linear infinite;
}

.hero-pool {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
  padding: 20px;
  transition: all 0.4s ease;
  overflow-y: auto; /* 确保有滚动条 */
  max-height: calc(100vh - 250px); /* 限制高度以便内部滚动 */
  scroll-behavior: smooth; /* 平滑滚动 */
}

/* 隐藏滚动条但保留功能 */
.hero-pool::-webkit-scrollbar {
  display: none;
}
.hero-pool {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.hero-pool.is-shrunken {
  /* 容器不再整体缩放，仅透明度微调 */
  opacity: 0.9;
}

.hero-card {
  width: 150px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid transparent;
  border-radius: 12px;
  padding: 15px;
  text-align: center;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.hero-pool.is-shrunken .hero-card {
  width: 100px; /* 宽度缩小，使一行能容纳更多 */
  padding: 8px;
  font-size: 0.8rem;
}

.hero-pool.is-shrunken .hero-card h3 {
  font-size: 0.8rem;
  margin-top: 5px;
}

.hero-pool.is-shrunken .hero-icon {
  width: 60px; /* 图标同步缩小 */
  height: 60px;
}

.hero-pool.is-randomizing .hero-card:not(.highlight-random) {
  opacity: 0.4;
  filter: grayscale(0.5);
  transform: scale(0.9);
}

.hero-card.highlight-random {
  transform: scale(1.18);
  border-color: #ff5722;
  box-shadow: 0 0 30px rgba(255, 87, 34, 0.8);
  z-index: 10;
}

.vs-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(5px);
}

.vs-content {
  display: flex;
  align-items: center;
  gap: 40px;
}

.vs-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.vs-icon {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 4px solid #fff;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 30px rgba(255, 255, 255, 0.3);
}

.vs-name {
  font-size: 2rem;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 10px rgba(0,0,0,0.5);
}

.vs-divider {
  font-size: 4rem;
  font-weight: 900;
  color: #fbd73a;
  font-style: italic;
  text-shadow: 0 0 20px rgba(251, 215, 58, 0.8);
  animation: vs-pulse 0.5s infinite alternate;
}

@keyframes vs-pulse {
  from { transform: scale(1); opacity: 0.8; }
  to { transform: scale(1.2); opacity: 1; }
}

/* VS Zoom 动画 */
.vs-zoom-enter-active {
  animation: vs-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.vs-zoom-leave-active {
  animation: vs-in 0.3s reverse ease-in;
}

@keyframes vs-in {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes spin {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

.taiji-left {
  position: absolute;
  top: 0;
  left: 0;
  width: 50%;
  height: 100%;
  background-color: #ffffff;
  border-radius: 100px 0 0 100px;
}

.taiji-right {
  position: absolute;
  top: 0;
  right: 0;
  width: 50%;
  height: 100%;
  background-color: #000000;
  border-radius: 0 100px 100px 0;
}

.taiji-top {
  position: absolute;
  top: 0;
  left: 25%;
  width: 50%;
  height: 50%;
  background-color: #000000;
  border-radius: 50%;
}

.taiji-top::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 30%;
  height: 30%;
  background-color: #ffffff;
  border-radius: 50%;
}

.taiji-bottom {
  position: absolute;
  bottom: 0;
  left: 25%;
  width: 50%;
  height: 50%;
  background-color: #ffffff;
  border-radius: 50%;
}

.taiji-bottom::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 30%;
  height: 30%;
  background-color: #000000;
  border-radius: 50%;
}

.hero-icon--thunderflash {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #f57f17 0%, #fbc02d 60%, #ffffff 100%) !important;
}

.hero-icon-thunderflash-pattern {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px; /* 行间距 */
}

.tf-tri-row {
  display: flex;
  gap: 12px; /* 三角形之间的水平间距 */
}

.tf-tri {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 8px solid rgba(255, 255, 255, 0.9);
}

.hero-icon--dragonking {
  position: relative;
}

.hero-icon-dragonking-mouth {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.dk-mouth-normal {
  transition: opacity 0.3s ease;
  opacity: 1;
}

.dk-mouth-smile {
  transition: opacity 0.3s ease;
  opacity: 0;
}

.hero-icon.is-selected .dk-mouth-normal {
  opacity: 0;
}

.hero-icon.is-selected .dk-mouth-smile {
  opacity: 1;
}

.hero-icon--bomber {
  position: relative;
  overflow: hidden;
  background-color: #333333 !important;
}

.hero-icon-bomber-stripes {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    #ff4500 10px,
    #ff4500 20px
  );
  opacity: 0.8;
}

.hero-icon--flameartist {
  position: relative;
  overflow: hidden;
  background: radial-gradient(circle at center, #ff8c00 0%, #ff4500 100%) !important;
  box-shadow: inset 0 0 15px rgba(255, 69, 0, 0.5);
}

.hero-icon--crimsonblade {
  position: relative;
  overflow: hidden;
  background: radial-gradient(circle at center, #2e1a47 0%, #000000 100%) !important;
}

.hero-icon-blade-reflection {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.blade-line {
  width: 140%;
  height: 4px;
  background: linear-gradient(to right, transparent, #fff, transparent);
  transform: rotate(-45deg);
  animation: blade-shine 2s infinite linear;
}

@keyframes blade-shine {
  from { transform: rotate(-45deg) translateX(-100%); }
  to { transform: rotate(-45deg) translateX(100%); }
}

.hero-icon-jueshiyouwu {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
}

.hero-icon-jueshiyouwu img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-icon--jueshiyouwu {
  position: relative;
  overflow: hidden;
  /* 基础背景色，以防图片未加载出来 */
  background-color: #ffcc00 !important;
}

.hero-icon-flame-waves {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.flame-wave {
  position: absolute;
  bottom: 0;
  left: -50%;
  width: 200%;
  height: 60%;
  background: rgba(255, 215, 0, 0.4);
  border-radius: 40%;
  animation: wave-animation 3s infinite linear;
}

.wave-2 {
  height: 45%;
  background: rgba(255, 140, 0, 0.5);
  animation-duration: 2s;
  animation-delay: -1s;
}

@keyframes wave-animation {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(10px);
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

/* 为底部固定栏留出空间 */
#select-screen {
  padding-bottom: 120px;
}

.selection-status {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.selection-status p {
  margin: 0;
  font-size: 1.1rem;
  color: #aaa;
}

.selection-status span {
  color: #fff;
  font-weight: bold;
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.action-buttons button {
  padding: 10px 20px;
  border-radius: 6px;
  border: none;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 100px;
}

.action-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.primary-btn {
  background: #fbd73a;
  color: #000;
}

.primary-btn:hover:not(:disabled) {
  background: #ffe066;
  transform: translateY(-2px);
}

.random-btn {
  background: #ff5722;
  color: white;
}

.random-btn:hover:not(:disabled) {
  background: #ff7043;
  transform: translateY(-2px);
}

.training-btn {
  background: #4caf50;
  color: white;
}

.training-btn:hover:not(:disabled) {
  background: #66bb6a;
  transform: translateY(-2px);
}

.debug-btn {
  background: #9c27b0;
  color: white;
}

.debug-btn:hover:not(:disabled) {
  background: #ba68c8;
  transform: translateY(-2px);
}

.records-btn {
  background: #2196F3;
  color: white;
}

.records-btn:hover {
  background: #42a5f5;
  transform: translateY(-2px);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .bottom-bar {
    flex-direction: column;
    gap: 15px;
    padding: 10px;
  }
  
  #select-screen {
    padding-bottom: 220px; /* 移动端底部栏更高 */
  }

  .selection-status {
    width: 100%;
    flex-direction: row;
    justify-content: space-around;
  }

  .action-buttons {
    width: 100%;
    justify-content: center;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .action-buttons button {
    width: 100%;
    min-width: 0;
    padding: 12px 5px;
    font-size: 0.95rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }
  
  .primary-btn, .random-btn {
    font-size: 1.05rem;
    padding: 14px 5px;
  }
  
  .records-btn {
    grid-column: span 2;
    margin-top: 4px;
    background: #444; /* 稍微低调一点 */
  }

  .vs-content {
    flex-direction: column;
    gap: 20px;
  }

  .vs-divider {
    font-size: 3rem;
  }

  .vs-name {
    font-size: 1.5rem;
  }

  .vs-icon {
    width: 100px;
    height: 100px;
  }
}
</style>
