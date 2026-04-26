<template>
  <div class="screen active">
    <div class="battle-layout">
      <!-- 隐藏的旧控制面板结构（移除显示） -->
      <div id="training-panel-p1" class="training-panel hidden"></div>

      <div class="arena-wrapper">
        <div class="battle-header">
          <!-- p1 点击触发觉醒 -->
          <div class="player-info" id="p1-info" 
               @click="handlePlayerClick(1)" 
               :class="{ 'clickable-player': store.isTraining && !store.battleState.p1.isDead && !store.battleState.p1.isAwakened }">
            <h2 class="hero-name">
              {{ store.battleState.p1.name }}
              <span class="hero-indicator" :style="{ background: store.battleState.p1.color }"></span>
            </h2>
            <div class="hp-bar-container">
              <div class="hp-bar" :style="{ width: Math.max(0, (store.battleState.p1.hp / store.battleState.p1.maxHp) * 100) + '%' }"></div>
            </div>
            <p class="hp-text">HP: <span>{{ Math.floor(store.battleState.p1.hp) }}</span></p>
            <p class="hp-text" style="font-size: 1rem; color: #aaa;">移速: <span>{{ store.battleState.p1.speed.toFixed(1) }}</span><span v-if="store.battleState.p1.spinSpeed !== null"> | 转速: <span>{{ store.battleState.p1.spinSpeed.toFixed(1) }}</span></span></p>
            <div class="buffs">
              <span v-if="store.battleState.p1.rage > 0" class="buff-icon" :style="{ background: store.battleState.p1.rage >= 100 ? '#ff0000' : '#ff9900', color: '#fff' }">怒气 {{ store.battleState.p1.rage }}%</span>
              <span v-if="store.battleState.p1.damageReduction > 0" class="buff-icon" style="background: #4caf50; color: #fff;">减伤 {{ store.battleState.p1.damageReduction }}%</span>
              <span v-if="store.battleState.p1.isAwakened" class="buff-icon" style="background: #ffd700; color: #000;">觉醒 <span v-if="store.battleState.p1.awakenTimer > 0">({{ store.battleState.p1.awakenTimer.toFixed(1) }}s)</span></span>
              <span v-if="store.battleState.p1.invincibleTime > 0" class="buff-icon" style="background: #ffd700; color: #000;">无敌 ({{ store.battleState.p1.invincibleTime.toFixed(1) }}s)</span>
              <span v-for="(buff, i) in store.battleState.p1.buffs" :key="i" class="buff-icon" 
                    :style="{ background: buff.type === 'slow' ? '#ff4444' : (buff.type === 'vampire_drain' ? '#8b0000' : (buff.type === 'paralyze' ? '#9932cc' : (buff.type === 'van_suppressed' ? '#ff69b4' : '#444'))) }">
                {{ buff.type === 'slow' ? `减速 (${buff.time.toFixed(1)}s)` : 
                   buff.type === 'vampire_drain' ? `被吸血 (${buff.time.toFixed(1)}s)` : 
                   buff.type === 'paralyze' ? `麻痹 (${buff.time.toFixed(1)}s)` :
                   buff.type === 'van_suppressed' ? `压制 (${buff.time.toFixed(1)}s)` :
                   buff.type === 'suppress_damage' ? `压制减伤 (${buff.time.toFixed(1)}s)` :
                   buff.type }}
              </span>
            </div>
            <!-- 训练场觉醒提示 -->
            <div v-if="store.isTraining && !store.battleState.p1.isDead && !store.battleState.p1.isAwakened" class="awaken-hint">点击触发觉醒</div>
          </div>
          <div class="vs">VS</div>
          <!-- p2 点击触发觉醒 -->
          <div class="player-info right" id="p2-info"
               @click="handlePlayerClick(2)"
               :class="{ 'clickable-player': store.isTraining && !store.battleState.p2.isDead && !store.battleState.p2.isAwakened }">
            <h2 class="hero-name">
              {{ store.battleState.p2.name }}
              <span class="hero-indicator" :style="{ background: store.battleState.p2.color }"></span>
            </h2>
            <div class="hp-bar-container">
              <div class="hp-bar" :style="{ width: Math.max(0, (store.battleState.p2.hp / store.battleState.p2.maxHp) * 100) + '%' }"></div>
            </div>
            <p class="hp-text">HP: <span>{{ Math.floor(store.battleState.p2.hp) }}</span></p>
            <p class="hp-text" style="font-size: 1rem; color: #aaa;">移速: <span>{{ store.battleState.p2.speed.toFixed(1) }}</span><span v-if="store.battleState.p2.spinSpeed !== null"> | 转速: <span>{{ store.battleState.p2.spinSpeed.toFixed(1) }}</span></span></p>
            <div class="buffs">
              <span v-if="store.battleState.p2.rage > 0" class="buff-icon" :style="{ background: store.battleState.p2.rage >= 100 ? '#ff0000' : '#ff9900', color: '#fff' }">怒气 {{ store.battleState.p2.rage }}%</span>
              <span v-if="store.battleState.p2.damageReduction > 0" class="buff-icon" style="background: #4caf50; color: #fff;">减伤 {{ store.battleState.p2.damageReduction }}%</span>
              <span v-if="store.battleState.p2.isAwakened" class="buff-icon" style="background: #ffd700; color: #000;">觉醒 <span v-if="store.battleState.p2.awakenTimer > 0">({{ store.battleState.p2.awakenTimer.toFixed(1) }}s)</span></span>
              <span v-if="store.battleState.p2.invincibleTime > 0" class="buff-icon" style="background: #ffd700; color: #000;">无敌 ({{ store.battleState.p2.invincibleTime.toFixed(1) }}s)</span>
              <span v-for="(buff, i) in store.battleState.p2.buffs" :key="i" class="buff-icon" 
                    :style="{ background: buff.type === 'slow' ? '#ff4444' : (buff.type === 'vampire_drain' ? '#8b0000' : (buff.type === 'paralyze' ? '#9932cc' : (buff.type === 'van_suppressed' ? '#ff69b4' : '#444'))) }">
                {{ buff.type === 'slow' ? `减速 (${buff.time.toFixed(1)}s)` : 
                   buff.type === 'vampire_drain' ? `被吸血 (${buff.time.toFixed(1)}s)` : 
                   buff.type === 'paralyze' ? `麻痹 (${buff.time.toFixed(1)}s)` :
                   buff.type === 'van_suppressed' ? `压制 (${buff.time.toFixed(1)}s)` :
                   buff.type === 'suppress_damage' ? `压制减伤 (${buff.time.toFixed(1)}s)` :
                   buff.type }}
              </span>
            </div>
            <!-- 训练场觉醒提示 -->
            <div v-if="store.isTraining && !store.battleState.p2.isDead && !store.battleState.p2.isAwakened" class="awaken-hint">点击触发觉醒</div>
          </div>
        </div>
        <div class="arena-container">
          <canvas id="game-canvas" width="600" height="600"></canvas>
        </div>
        
        <!-- 英雄机制描述栏 -->
        <div class="mechanics-info" v-if="store.p1Selection?.skill && store.p2Selection?.skill">
          <div class="mechanic-card p1-mechanic">
            <p><strong>{{ store.p1Selection.skill.name }}:</strong> {{ store.p1Selection.skill.desc }}</p>
          </div>
          <div class="mechanic-card p2-mechanic">
            <p><strong>{{ store.p2Selection.skill.name }}:</strong> {{ store.p2Selection.skill.desc }}</p>
          </div>
        </div>

        <!-- 回放控制栏 -->
        <div v-if="isReplayMode" class="replay-controls">
          <button @click="toggleReplayPause" class="ctrl-btn">{{ isReplayPaused ? '▶ 继续' : '⏸ 暂停' }}</button>
          <div class="progress-wrapper">
            <div class="progress-bar-container">
              <div class="progress-bar-fill" :style="{ width: (replayProgress * 100) + '%' }"></div>
            </div>
            <span class="replay-time">{{ replayCurrentTime.toFixed(1) }}s / {{ replayTotalTime.toFixed(1) }}s</span>
          </div>
          <select v-model="replaySpeed" @change="updateReplaySpeed" class="ctrl-select">
            <option :value="0.5">0.5x</option>
            <option :value="1.0">1.0x</option>
            <option :value="2.0">2.0x</option>
            <option :value="4.0">4.0x</option>
          </select>
          <button @click="backToSelect" class="ctrl-btn exit-btn">退出</button>
        </div>
        
      </div>

      <!-- 隐藏的旧控制面板结构 -->
      <div id="training-panel-p2" class="training-panel hidden"></div>
    </div>
    
    <!-- 胜利提示 -->
    <div id="victory-overlay" :class="{ hidden: !victory.show }">
      <h2 id="victory-text">{{ victory.text }}</h2>
      <div v-if="store.isTraining" v-show="victory.showButtons" style="margin-bottom: 15px; display: flex; align-items: center; gap: 5px;">
        <input type="checkbox" id="keep-params-checkbox" v-model="victory.keepParams">
        <label for="keep-params-checkbox" style="color: white; font-size: 1.1rem; cursor: pointer;">保持当前参数</label>
      </div>
      <div class="victory-actions" v-show="victory.showButtons">
        <button @click="backToSelect">返回选择</button>
        <button @click="restartBattle" style="background: #4caf50; color: white;">重新本局</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, watch, nextTick, ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useGameStore } from '@/store/gameStore';
import { Game } from '@/game/engine/Game.js';
import { Vampire } from '@/game/entities/heroes/Vampire.js';
import { Spider } from '@/game/entities/heroes/Spider.js';
import { Berserker } from '@/game/entities/heroes/Berserker.js';
import { Gambler } from '@/game/entities/heroes/Gambler.js';
import { MaLaoshi } from '@/game/entities/heroes/MaLaoshi.js';
import { HuaQiang } from '@/game/entities/heroes/HuaQiang.js';
import { Van } from '@/game/entities/heroes/Van.js';
import { SunWukong } from '@/game/entities/heroes/SunWukong.js';
import { T1000 } from '@/game/entities/heroes/T1000.js';
import { OnePunchMan } from '@/game/entities/heroes/OnePunchMan.js';
import { BattleRecordManager } from '@/utils/BattleRecordManager.js';

// 将 heroPool 抽离出来供回放使用
const heroPool = [
  { id: 'vampire', class: 'Vampire', skill: { name: '尖牙吸附', desc: '碰撞时黏附敌人持续吸血并减速，残血时吸血效率翻倍。觉醒时发射多枚追踪尖牙。' }, traits: '狡诈、嗜血' },
  { id: 'spider', class: 'Spider', skill: { name: '蛛丝束缚', desc: '周期性向周围粘黏蛛网，触碰后造成减速控制。觉醒时获得无敌并暴增移速。' }, traits: '敏捷、阴险' },
  { id: 'berserker', class: 'Berserker', skill: { name: '旋风斩', desc: '挥舞双斧旋转，斧刃造成全额伤害，斧柄造成半额伤害，附带减速。扣血将转换为属性提升。觉醒时双斧攻击范围、转速与移速暴增。' }, traits: '狂暴、鲁莽' },
  { id: 'gambler', class: 'Gambler', skill: { name: '命运骰子', desc: '投掷骰子发射同点数追踪卡牌，连续同点数可倍增卡牌量。点数6额外附带减速。' }, traits: '莫测、高风险' },
  { id: 'malaoshi', class: 'MaLaoshi', skill: { name: '混元太极', desc: '周期发射松果糖豆。阶段性掉血时释放全图混元劲击退敌人。觉醒触发闪电五连鞭，必中且高额减速。' }, traits: '宗师、化劲' },
  { id: 'huaqiang', class: 'HuaQiang', skill: { name: '劈瓜刀法', desc: '发射贯穿砍刀(携带40%概率破障)，撞墙后变为场地陷阱。觉醒时释放磁吸立场，瞬间回收全场砍刀造成大量伤害。' }, traits: '凶狠、压制' },
  { id: 'van', class: 'Van', skill: { name: '给佬攻击', desc: '脱战3秒后移速翻倍(急色)。碰撞触发瞬移背刺，将敌方压制并造成连续打桩伤害。觉醒生成全屏力场，触发强化版深度压制。' }, traits: '狂热、执念' },
  { id: 'sunwukong', class: 'SunWukong', skill: { name: '如意金箍棒', desc: '金箍棒环绕周身旋转，每4秒变长变粗一次造成更高伤害。受击时20%概率触发金刚不坏，免疫本次及后续连段伤害。觉醒大闹天宫，分出三个分身弹射全场，并同步释放超大范围的强化金箍棒。' }, traits: '齐天大圣、金刚不坏' },
  { id: 'onepunchman', class: 'OnePunchMan', skill: { name: '普通一拳', desc: '受到敌方伤害时积累怒气(每次2%~10%)，满怒释放普通一拳，沿途破除飞行物与陷阱，命中直接秒杀。觉醒：认真一拳，立刻全屏清场并瞬移至敌方身前触发秒杀。' }, traits: '无敌、秒杀' },
  { id: 't1000', class: 'T1000', skill: { name: '变形刺刃', desc: '每2.5秒伸出刺刃攻击附加流血。受击时20%概率液化自愈(受击伤害减半，同时回复5点血量)，随后生成液态碎片。碎片命中叠加标记触发暴击伤害，未命中化为场地陷阱。觉醒时激活所有陷阱碎片进行追踪打击并添加标记。' }, traits: '液态金属、变形穿刺' }
];

const classes = {
  'Vampire': Vampire,
  'Spider': Spider,
  'Berserker': Berserker,
  'Gambler': Gambler,
  'MaLaoshi': MaLaoshi,
  'HuaQiang': HuaQiang,
  'Van': Van,
  'SunWukong': SunWukong,
  'T1000': T1000,
  'OnePunchMan': OnePunchMan
};

const store = useGameStore();
const router = useRouter();
const route = useRoute();

const victory = reactive({
  show: false,
  text: '',
  keepParams: false,
  showButtons: true
});

const isReplayMode = ref(false);
const isReplayPaused = ref(false);
const replayCurrentTime = ref(0);
const replayTotalTime = ref(0);
const replaySpeed = ref(1.0);
const replayProgress = computed(() => replayTotalTime.value > 0 ? Math.min(1, replayCurrentTime.value / replayTotalTime.value) : 0);

const toggleReplayPause = () => {
  if (!gameInstance) return;
  isReplayPaused.value = !isReplayPaused.value;
  gameInstance.isPaused = isReplayPaused.value;
};

const updateReplaySpeed = () => {
  if (!gameInstance) return;
  gameInstance.timeScale = replaySpeed.value;
};

let gameInstance = null;
let cheerAudio = null;

const updateBattleState = (state, hero) => {
  state.name = hero.name;
  state.color = hero.color;
  state.hp = Math.max(0, hero.hp);
  state.maxHp = hero.maxHp;
  state.speed = hero.getSpeed ? hero.getSpeed() : 0;
  state.spinSpeed = hero.currentSpinSpeed !== undefined ? hero.currentSpinSpeed : null;
  state.isDead = hero.isDead;
  state.isAwakened = hero.isAwakened;
  
  const reduction = hero.getDamageReduction ? hero.getDamageReduction() : 0;
  state.damageReduction = Math.round(reduction * 100);
  
  // 同步一拳超人的怒气值
  if (hero.name === '一拳超人' && hero.rage !== undefined) {
    state.rage = hero.rage;
  } else {
    state.rage = 0;
  }
  
  if (hero.name === '狂战士') {
    state.awakenTimer = hero.awakenTimer || 0;
  } else if (hero.name === '蜘蛛') {
    state.awakenTimer = hero.isAwakened ? (hero.awakenTimer || 0) : 0;
  } else if (hero.name === '马老师') {
    state.awakenTimer = 0; // 马老师觉醒不需要显示时长，随技能释放完毕自动结束
  } else if (hero.name === '吸血鬼') {
    state.awakenTimer = 0;
  } else if (hero.name === '赌徒') {
    state.awakenTimer = hero.awakenTimer || 0;
  } else {
    state.awakenTimer = 0;
  }

  state.invincibleTime = hero.invincibleTime;
  state.buffs = hero.buffs.map(b => ({ type: b.type, time: b.time }));
};

const readParamsFromGame = () => {
  if (!gameInstance) return;
  const sync = (params, hero) => {
    params.hp = hero.hp;
    params.maxHp = hero.maxHp;
    params.baseSpeed = hero.baseSpeed;
    params.damageMultiplier = hero.damageMultiplier;
    if (hero.name === '狂战士') params.baseSpinSpeed = hero.baseSpinSpeed || 20;
  };
  sync(store.trainParams.p1, gameInstance.p1);
  sync(store.trainParams.p2, gameInstance.p2);
};

const applyParamsToGame = () => {
  if (!gameInstance) return;
  const apply = (hero, params) => {
    hero.hp = params.hp;
    hero.maxHp = Math.max(hero.maxHp, params.hp);
    hero.baseSpeed = params.baseSpeed;
    hero.damageMultiplier = params.damageMultiplier;
    if (hero.name === '狂战士') hero.baseSpinSpeed = params.baseSpinSpeed;
  };
  apply(gameInstance.p1, store.trainParams.p1);
  apply(gameInstance.p2, store.trainParams.p2);
};

onMounted(async () => {
  let record = null;
  if (route.query.replayId) {
    record = BattleRecordManager.getRecordById(route.query.replayId);
    if (record) {
      isReplayMode.value = true;
      replayTotalTime.value = record.duration;
      // Setup selections just in case, mapping from heroPool to get complete data like skills
      const fullP1 = heroPool.find(h => h.class === record.p1.class) || {};
      const fullP2 = heroPool.find(h => h.class === record.p2.class) || {};

      store.p1Selection = { 
        class: record.p1.class, 
        name: record.p1.name, 
        color: record.p1.color,
        skill: fullP1.skill || { name: '未知技能', desc: '暂无描述' },
        traits: fullP1.traits || '未知'
      };
      store.p2Selection = { 
        class: record.p2.class, 
        name: record.p2.name, 
        color: record.p2.color,
        skill: fullP2.skill || { name: '未知技能', desc: '暂无描述' },
        traits: fullP2.traits || '未知'
      };
    }
  }

  if (!store.p1Selection || !store.p2Selection) {
    router.push('/');
    return;
  }

  cheerAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/common/喝彩.mp3');

  await nextTick();

  const canvas = document.getElementById('game-canvas');
  const p1Class = classes[store.p1Selection.class];
  const p2Class = classes[store.p2Selection.class];

  const seed = isReplayMode.value ? record.seed : Date.now();

  gameInstance = new Game(
    canvas, p1Class, p2Class, store.isTraining,
    (p1, p2) => {
      updateBattleState(store.battleState.p1, p1);
      updateBattleState(store.battleState.p2, p2);
      
      if (isReplayMode.value && gameInstance) {
        replayCurrentTime.value = gameInstance.gameTime;
      }

      if (store.isTraining) {
        store.trainParams.p1.hp = p1.hp;
        store.trainParams.p2.hp = p2.hp;
      }
    },
    (text) => {
      victory.text = text;
      victory.show = true;
      if (!store.isTraining || isReplayMode.value) {
        victory.showButtons = false;
        setTimeout(() => {
          victory.showButtons = true;
        }, 1500);
      } else {
        victory.showButtons = true;
      }
    },
    (winner) => {
      if (gameInstance) {
        if (gameInstance.p1) gameInstance.p1.stopAllAudio();
        if (gameInstance.p2) gameInstance.p2.stopAllAudio();
      }
      
      if (winner && winner !== 'draw' && winner.playVictoryAudio) {
        winner.playVictoryAudio();
      }
      
      cheerAudio.currentTime = 0;
      cheerAudio.play().catch(e => console.warn('Cheer audio play failed:', e));
    },
    seed,
    isReplayMode.value,
    store.p1Selection.class,
    store.p2Selection.class
  );

  readParamsFromGame();
  gameInstance.start();
});

onUnmounted(() => {
  if (gameInstance) {
    gameInstance.stop();
    if (gameInstance.p1) gameInstance.p1.stopAllAudio();
    if (gameInstance.p2) gameInstance.p2.stopAllAudio();
  }
  if (cheerAudio) {
    cheerAudio.pause();
  }
});

// Watch input params to instantly mutate game instance
watch(() => store.trainParams.p1.hp, (val) => { if (gameInstance && !gameInstance.p1.isDead) { gameInstance.p1.hp = val; gameInstance.p1.maxHp = Math.max(gameInstance.p1.maxHp, val); } });
watch(() => store.trainParams.p1.baseSpeed, (val) => { if (gameInstance) gameInstance.p1.baseSpeed = val; });
watch(() => store.trainParams.p1.damageMultiplier, (val) => { if (gameInstance) gameInstance.p1.damageMultiplier = val; });
watch(() => store.trainParams.p1.baseSpinSpeed, (val) => { if (gameInstance && gameInstance.p1.name === '狂战士') gameInstance.p1.baseSpinSpeed = val; });

watch(() => store.trainParams.p2.hp, (val) => { if (gameInstance && !gameInstance.p2.isDead) { gameInstance.p2.hp = val; gameInstance.p2.maxHp = Math.max(gameInstance.p2.maxHp, val); } });
watch(() => store.trainParams.p2.baseSpeed, (val) => { if (gameInstance) gameInstance.p2.baseSpeed = val; });
watch(() => store.trainParams.p2.damageMultiplier, (val) => { if (gameInstance) gameInstance.p2.damageMultiplier = val; });
watch(() => store.trainParams.p2.baseSpinSpeed, (val) => { if (gameInstance && gameInstance.p2.name === '狂战士') gameInstance.p2.baseSpinSpeed = val; });

const handlePlayerClick = (playerIndex) => {
  if (!store.isTraining) return;
  const targetState = playerIndex === 1 ? store.battleState.p1 : store.battleState.p2;
  if (!targetState.isDead && !targetState.isAwakened) {
    triggerAwaken(playerIndex);
  }
};

const triggerAwaken = (playerIndex) => {
  if (!gameInstance) return;
  const hero = playerIndex === 1 ? gameInstance.p1 : gameInstance.p2;
  if (hero && !hero.isDead && !hero.isAwakened) {
    // 借用游戏引擎收集觉醒石的逻辑，复用时停、粒子与触发特效
    gameInstance.collectAwakenStone(hero);
  }
};

const resetToDefaults = () => {
  if (confirm('是否重置所有参数并重新开始本局？')) {
    victory.show = false;
    victory.keepParams = false;
    cheerAudio.pause();
    cheerAudio.currentTime = 0;
    gameInstance.restart();
    readParamsFromGame();
  }
};

const savePreset = () => {
  localStorage.setItem('dk_training_preset', JSON.stringify(store.trainParams));
  alert('预设已保存！');
};

const loadPreset = () => {
  const data = localStorage.getItem('dk_training_preset');
  if (data) {
    try {
      const preset = JSON.parse(data);
      Object.assign(store.trainParams.p1, preset.p1);
      Object.assign(store.trainParams.p2, preset.p2);
      applyParamsToGame();
      alert('预设加载成功！');
    } catch (e) {
      alert('预设数据损坏');
    }
  } else {
    alert('没有找到保存的预设');
  }
};

const restartBattle = () => {
  victory.show = false;
  cheerAudio.pause();
  cheerAudio.currentTime = 0;
  
  if (gameInstance) {
    if (isReplayMode.value) {
      replayCurrentTime.value = 0;
      isReplayPaused.value = false;
      gameInstance.isPaused = false;
      gameInstance.restart();
    } else {
      gameInstance.seed = Date.now(); // new seed for normal battle
      gameInstance.restart();
      if (store.isTraining && victory.keepParams) {
        applyParamsToGame();
      } else {
        readParamsFromGame();
      }
    }
  }
};

const backToSelect = () => {
  router.push('/');
};
</script>

<style scoped>
.clickable-player {
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.2s ease;
  position: relative;
}

.clickable-player:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
}

.clickable-player:active {
  transform: translateY(0);
}

.awaken-hint {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.8rem;
  color: #ffd700;
  opacity: 0;
  transition: opacity 0.2s ease;
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.clickable-player:hover .awaken-hint {
  opacity: 1;
}

.replay-controls {
  margin-top: 15px;
  background: rgba(0, 0, 0, 0.8);
  padding: 10px 20px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
  z-index: 10;
  width: 100%;
  max-width: 600px;
  box-sizing: border-box;
}

.ctrl-btn {
  background: #2196F3;
  color: white;
  border: none;
  padding: 5px 15px;
  border-radius: 15px;
  cursor: pointer;
  font-weight: bold;
  white-space: nowrap;
}

.exit-btn {
  background: #f44336;
}

.ctrl-select {
  background: #333;
  color: white;
  border: 1px solid #555;
  padding: 5px 10px;
  border-radius: 10px;
  cursor: pointer;
}

.progress-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.progress-bar-container {
  flex: 1;
  height: 8px;
  background: #333;
  border-radius: 4px;
  overflow: hidden;
  min-width: 100px;
}

.progress-bar-fill {
  height: 100%;
  background: #4caf50;
  transition: width 0.1s linear;
}

.replay-time {
  font-family: monospace;
  font-size: 0.9rem;
  color: #ccc;
  white-space: nowrap;
}

/* 英雄机制描述栏样式 */
.mechanics-info {
  display: flex;
  gap: 20px;
  margin-top: 10px;
  width: 100%;
  max-width: 600px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 10px;
  padding: 15px;
  box-sizing: border-box;
}

.mechanic-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.p1-mechanic {
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  padding-right: 15px;
}

.p2-mechanic {
  padding-left: 5px;
}

.mechanic-card h4 {
  margin: 0;
  font-size: 1.1rem;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
}

.mechanic-card h4 span {
  font-size: 0.85rem;
  color: #aaa;
  font-weight: normal;
}

.mechanic-card p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
  color: #ddd;
}

.mechanic-card strong {
  color: #ff9800;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .replay-controls {
    flex-wrap: wrap;
    padding: 15px;
    border-radius: 10px;
    gap: 10px;
    margin-top: 15px;
  }

  .progress-wrapper {
    width: 100%;
    order: -1; /* 将进度条置于最上方 */
    justify-content: space-between;
  }

  .ctrl-btn {
    flex: 1;
    padding: 10px;
    font-size: 1rem;
    border-radius: 8px;
  }

  .ctrl-select {
    flex: 1;
    padding: 10px;
    font-size: 1rem;
    border-radius: 8px;
    text-align: center;
  }

  .mechanics-info {
    gap: 10px;
    padding: 10px;
    /* 保持左右布局，不覆盖为 column */
  }

  .mechanic-card h4 {
    font-size: 0.95rem;
    flex-wrap: wrap; /* 允许名字和风格标签换行 */
    gap: 4px;
  }

  .mechanic-card h4 span {
    font-size: 0.75rem;
  }

  .mechanic-card p {
    font-size: 0.8rem;
  }

  .p1-mechanic {
    padding-right: 10px;
  }

  .p2-mechanic {
    padding-left: 5px;
  }
}
</style>
