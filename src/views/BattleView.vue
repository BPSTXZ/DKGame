<template>
  <div class="screen active">
    <div class="battle-layout">
      <!-- 训练场左侧控制面板 -->
      <div id="training-panel-p1" class="training-panel" :class="{ hidden: !store.isTraining }">
        <h3>Player 1 参数</h3>
        <div class="control-group">
          <label>生命值 (HP): <span>{{ Math.floor(store.trainParams.p1.hp) }}</span></label>
          <input type="range" v-model.number="store.trainParams.p1.hp" min="1" max="500">
        </div>
        <div class="control-group">
          <label>基础移速: <span>{{ store.trainParams.p1.baseSpeed }}</span></label>
          <input type="range" v-model.number="store.trainParams.p1.baseSpeed" min="10" max="200">
        </div>
        <div class="control-group">
          <label>攻击倍率: <span>{{ store.trainParams.p1.damageMultiplier.toFixed(1) }}</span>x</label>
          <input type="range" v-model.number="store.trainParams.p1.damageMultiplier" min="0.1" max="5" step="0.1">
        </div>
        <div class="control-group" v-if="store.battleState.p1.name === '狂战士'">
          <label>旋转速度: <span>{{ store.trainParams.p1.baseSpinSpeed }}</span></label>
          <input type="range" v-model.number="store.trainParams.p1.baseSpinSpeed" min="5" max="50">
        </div>
        <div class="control-group">
          <button @click="triggerAwaken(1)" class="action-btn" :disabled="store.battleState.p1.isDead || store.battleState.p1.isAwakened">触发觉醒</button>
        </div>
      </div>

      <div class="arena-wrapper">
        <div class="battle-header">
          <div class="player-info" id="p1-info">
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
              <span v-if="store.battleState.p1.isAwakened" class="buff-icon" style="background: #ffd700; color: #000;">觉醒 <span v-if="store.battleState.p1.awakenTimer > 0">({{ store.battleState.p1.awakenTimer.toFixed(1) }}s)</span></span>
              <span v-if="store.battleState.p1.invincibleTime > 0" class="buff-icon" style="background: #ffd700; color: #000;">无敌 ({{ store.battleState.p1.invincibleTime.toFixed(1) }}s)</span>
              <span v-for="(buff, i) in store.battleState.p1.buffs" :key="i" class="buff-icon" 
                    :style="{ background: buff.type === 'slow' ? '#ff4444' : (buff.type === 'vampire_drain' ? '#8b0000' : '#444') }">
                {{ buff.type === 'slow' ? `Slow (${buff.time.toFixed(1)}s)` : (buff.type === 'vampire_drain' ? `Drain (${buff.time.toFixed(1)}s)` : buff.type) }}
              </span>
            </div>
          </div>
          <div class="vs">VS</div>
          <div class="player-info right" id="p2-info">
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
              <span v-if="store.battleState.p2.isAwakened" class="buff-icon" style="background: #ffd700; color: #000;">觉醒 <span v-if="store.battleState.p2.awakenTimer > 0">({{ store.battleState.p2.awakenTimer.toFixed(1) }}s)</span></span>
              <span v-if="store.battleState.p2.invincibleTime > 0" class="buff-icon" style="background: #ffd700; color: #000;">无敌 ({{ store.battleState.p2.invincibleTime.toFixed(1) }}s)</span>
              <span v-for="(buff, i) in store.battleState.p2.buffs" :key="i" class="buff-icon" 
                    :style="{ background: buff.type === 'slow' ? '#ff4444' : (buff.type === 'vampire_drain' ? '#8b0000' : '#444') }">
                {{ buff.type === 'slow' ? `Slow (${buff.time.toFixed(1)}s)` : (buff.type === 'vampire_drain' ? `Drain (${buff.time.toFixed(1)}s)` : buff.type) }}
              </span>
            </div>
          </div>
        </div>
        <div class="arena-container">
          <canvas id="game-canvas" width="600" height="600"></canvas>
        </div>
        
        <div id="training-global-controls" :class="{ hidden: !store.isTraining }">
          <button @click="resetToDefaults" class="small-btn">重置默认</button>
          <button @click="savePreset" class="small-btn">保存预设</button>
          <button @click="loadPreset" class="small-btn">加载预设</button>
        </div>
      </div>

      <!-- 训练场右侧控制面板 -->
      <div id="training-panel-p2" class="training-panel" :class="{ hidden: !store.isTraining }">
        <h3>Player 2 参数</h3>
        <div class="control-group">
          <label>生命值 (HP): <span>{{ Math.floor(store.trainParams.p2.hp) }}</span></label>
          <input type="range" v-model.number="store.trainParams.p2.hp" min="1" max="500">
        </div>
        <div class="control-group">
          <label>基础移速: <span>{{ store.trainParams.p2.baseSpeed }}</span></label>
          <input type="range" v-model.number="store.trainParams.p2.baseSpeed" min="10" max="200">
        </div>
        <div class="control-group">
          <label>攻击倍率: <span>{{ store.trainParams.p2.damageMultiplier.toFixed(1) }}</span>x</label>
          <input type="range" v-model.number="store.trainParams.p2.damageMultiplier" min="0.1" max="5" step="0.1">
        </div>
        <div class="control-group" v-if="store.battleState.p2.name === '狂战士'">
          <label>旋转速度: <span>{{ store.trainParams.p2.baseSpinSpeed }}</span></label>
          <input type="range" v-model.number="store.trainParams.p2.baseSpinSpeed" min="5" max="50">
        </div>
        <div class="control-group">
          <button @click="triggerAwaken(2)" class="action-btn" :disabled="store.battleState.p2.isDead || store.battleState.p2.isAwakened">触发觉醒</button>
        </div>
      </div>
    </div>
    
    <!-- 胜利提示 -->
    <div id="victory-overlay" :class="{ hidden: !victory.show }">
      <h2 id="victory-text">{{ victory.text }}</h2>
      <div v-if="store.isTraining" style="margin-bottom: 15px; display: flex; align-items: center; gap: 5px;">
        <input type="checkbox" id="keep-params-checkbox" v-model="victory.keepParams">
        <label for="keep-params-checkbox" style="color: white; font-size: 1.1rem; cursor: pointer;">保持当前参数</label>
      </div>
      <div style="display: flex; gap: 10px;">
        <button @click="backToSelect">返回选择</button>
        <button @click="restartBattle" style="background: #4caf50; color: white;">重新本局</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '@/store/gameStore';
import { Game } from '@/game/engine/Game.js';
import { Vampire } from '@/game/entities/heroes/Vampire.js';
import { Spider } from '@/game/entities/heroes/Spider.js';
import { Berserker } from '@/game/entities/heroes/Berserker.js';
import { Gambler } from '@/game/entities/heroes/Gambler.js';
import { MaLaoshi } from '@/game/entities/heroes/MaLaoshi.js';
import { HuaQiang } from '@/game/entities/heroes/HuaQiang.js';
import { Van } from '@/game/entities/heroes/Van.js';

const classes = {
  'Vampire': Vampire,
  'Spider': Spider,
  'Berserker': Berserker,
  'Gambler': Gambler,
  'MaLaoshi': MaLaoshi,
  'HuaQiang': HuaQiang,
  'Van': Van
};

const store = useGameStore();
const router = useRouter();

const victory = reactive({
  show: false,
  text: '',
  keepParams: false
});

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
  if (!store.p1Selection || !store.p2Selection) {
    router.push('/');
    return;
  }

  cheerAudio = new Audio('/assets/audio/common/喝彩.mp3');

  await nextTick();

  const canvas = document.getElementById('game-canvas');
  const p1Class = classes[store.p1Selection.class];
  const p2Class = classes[store.p2Selection.class];

  gameInstance = new Game(
    canvas, p1Class, p2Class, store.isTraining,
    (p1, p2) => {
      updateBattleState(store.battleState.p1, p1);
      updateBattleState(store.battleState.p2, p2);

      if (store.isTraining) {
        store.trainParams.p1.hp = p1.hp;
        store.trainParams.p2.hp = p2.hp;
      }
    },
    (text) => {
      victory.text = text;
      victory.show = true;
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
    }
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

const triggerAwaken = (pId) => {
  const hero = pId === 1 ? gameInstance?.p1 : gameInstance?.p2;
  if (hero && !hero.isDead && !hero.isAwakened) {
    hero.triggerAwaken();
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
    gameInstance.restart();
    if (store.isTraining && victory.keepParams) {
      applyParamsToGame();
    } else {
      readParamsFromGame();
    }
  }
};

const backToSelect = () => {
  router.push('/');
};
</script>
