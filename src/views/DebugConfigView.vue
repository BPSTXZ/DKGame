<template>
  <div class="debug-screen">
    <div class="debug-panel">
      <h1>调试模式</h1>
      <p class="debug-subtitle">用于测试角色交互与技能效果，擂台展示保持不变。</p>

      <div class="matchup-row">
        <div class="hero-chip">
          <span class="hero-dot" :style="{ background: store.p1Selection?.iconColor || store.p1Selection?.color || '#fff' }"></span>
          <span>玩家 1：{{ store.p1Selection?.name || '未选择' }}</span>
        </div>
        <div class="hero-chip">
          <span class="hero-dot" :style="{ background: store.p2Selection?.iconColor || store.p2Selection?.color || '#fff' }"></span>
          <span>玩家 2：{{ store.p2Selection?.name || '未选择' }}</span>
        </div>
      </div>

      <div class="config-grid">
        <section class="config-card">
          <h2>模式设置</h2>
          <label class="field">
            <span>战斗模式</span>
            <select v-model="store.debugConfig.mode">
              <option value="normal">正常模式</option>
              <option value="fixed">固定模式</option>
            </select>
          </label>

          <label v-if="store.debugConfig.mode === 'fixed'" class="field">
            <span>站桩方</span>
            <select v-model.number="store.debugConfig.fixedPlayer">
              <option :value="1">玩家 1 站桩</option>
              <option :value="2">玩家 2 站桩</option>
            </select>
          </label>

        </section>

        <section class="config-card config-card-wide">
          <h2>技能参数</h2>
          <div class="skill-grid">
            <div class="skill-player">
              <h3>玩家 1 · {{ store.p1Selection?.name || '未选择' }}</h3>
              <template v-if="p1SkillFields.length">
                <label
                  v-for="field in p1SkillFields"
                  :key="`p1-${field.key}`"
                  class="field"
                >
                  <span>{{ field.label }}</span>
                  <input
                    v-model.number="store.debugConfig.skillTuning.p1[field.key]"
                    type="number"
                    :min="field.min"
                    :step="field.step"
                  >
                  <small class="field-meta">{{ field.hint }}</small>
                </label>
              </template>
              <p v-else class="empty-state">当前英雄暂无精细调试项。</p>
            </div>

            <div class="skill-player">
              <h3>玩家 2 · {{ store.p2Selection?.name || '未选择' }}</h3>
              <template v-if="p2SkillFields.length">
                <label
                  v-for="field in p2SkillFields"
                  :key="`p2-${field.key}`"
                  class="field"
                >
                  <span>{{ field.label }}</span>
                  <input
                    v-model.number="store.debugConfig.skillTuning.p2[field.key]"
                    type="number"
                    :min="field.min"
                    :step="field.step"
                  >
                  <small class="field-meta">{{ field.hint }}</small>
                </label>
              </template>
              <p v-else class="empty-state">当前英雄暂无精细调试项。</p>
            </div>
          </div>
          <p class="field-hint">时间类参数最小调整粒度为 0.1 秒，次数类参数按整数生效。</p>
        </section>

        <section class="config-card">
          <h2>生命值设置</h2>
          <label class="field">
            <span>玩家 1 HP</span>
            <input v-model.number="store.debugConfig.p1Hp" type="number" min="1" max="9999999" step="1">
          </label>
          <label class="field">
            <span>玩家 2 HP</span>
            <input v-model.number="store.debugConfig.p2Hp" type="number" min="1" max="9999999" step="1">
          </label>
          <p class="field-hint">生命值上限为 9999999，进入擂台后会同时作为当前生命值与最大生命值。</p>
        </section>

        <section class="config-card">
          <h2>自动觉醒</h2>
          <label class="field">
            <span>玩家 1 觉醒时间</span>
            <input v-model.number="store.debugConfig.p1AutoAwakenTime" type="number" min="0" step="0.1" placeholder="留空表示不自动觉醒">
          </label>
          <label class="field">
            <span>玩家 2 觉醒时间</span>
            <input v-model.number="store.debugConfig.p2AutoAwakenTime" type="number" min="0" step="0.1" placeholder="留空表示不自动觉醒">
          </label>
          <p class="field-hint">调试模式不会生成觉醒石，到达设定时间后将直接进入觉醒后续效果，不播放觉醒石动画。</p>
        </section>
      </div>

      <div class="action-row">
        <button class="secondary-btn" @click="backToSelect">返回选择</button>
        <button class="secondary-btn" @click="resetConfig">恢复默认</button>
        <button class="primary-btn" @click="startDebugBattle">进入调试擂台</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '@/store/gameStore';

const store = useGameStore();
const router = useRouter();

const skillTuningSchemas = {
  QueenS: [
    {
      key: 'slapHitLimit',
      label: '耳光次数',
      min: 1,
      step: 1,
      type: 'integer',
      defaultValue: 8,
      hint: '技能一总耳光次数，可改为任意整数。'
    }
  ],
  Vampire: [
    {
      key: 'suckDuration',
      label: '吸血持续时间',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 3.0,
      hint: '控制近身吸血持续多久，最小 0.1 秒。'
    },
    {
      key: 'awakenShotCount',
      label: '觉醒尖牙数量',
      min: 1,
      step: 1,
      type: 'integer',
      defaultValue: 3,
      hint: '觉醒后总共发射多少枚尖牙。'
    },
    {
      key: 'awakenShotInterval',
      label: '觉醒尖牙间隔',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 0.5,
      hint: '控制觉醒尖牙的发射间隔，最小 0.1 秒。'
    }
  ],
  HuaQiang: [
    {
      key: 'macheteInterval',
      label: '砍刀发射间隔',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 3.0,
      hint: '控制循环发射砍刀的时间间隔，最小 0.1 秒。'
    }
  ],
  Van: [
    {
      key: 'gayAttackDuration',
      label: '打桩持续时间',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 3.0,
      hint: '普通打桩总持续时间，最小 0.1 秒。'
    },
    {
      key: 'gayHitInterval',
      label: '打桩结算间隔',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 0.25,
      hint: '每次打桩伤害结算的时间间隔，最小 0.1 秒。'
    },
    {
      key: 'noContactTriggerTime',
      label: '急色触发时间',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 3.0,
      hint: '脱战多久后进入急色状态，最小 0.1 秒。'
    },
    {
      key: 'desperateDuration',
      label: '急色持续时间',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 3.0,
      hint: '急色状态持续多久，最小 0.1 秒。'
    },
    {
      key: 'forceFieldWarmupDuration',
      label: '觉醒前摇时间',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 0.5,
      hint: '觉醒力场只展示不触发攻击的前摇时间。'
    },
    {
      key: 'awakenForceFieldDuration',
      label: '觉醒力场持续',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 4.5,
      hint: '觉醒力场总持续时间，最小 0.1 秒。'
    }
  ],
  MaLaoshi: [
    {
      key: 'nutBeanInterval',
      label: '松果糖豆间隔',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 2.0,
      hint: '普通状态发射松果糖豆的时间间隔。'
    },
    {
      key: 'whipMaxCount',
      label: '五连鞭次数',
      min: 1,
      step: 1,
      type: 'integer',
      defaultValue: 5,
      hint: '觉醒期间总共触发多少次闪电鞭。'
    },
    {
      key: 'whipInterval',
      label: '五连鞭间隔',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 1.5,
      hint: '每一鞭之间的触发间隔，最小 0.1 秒。'
    }
  ],
  DragonKing: [
    {
      key: 'needleFireInterval',
      label: '神针发射间隔',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 2.0,
      hint: '普通太乙神针的发射间隔，最小 0.1 秒。'
    },
    {
      key: 'enduranceThreshold',
      label: '三年之期阈值',
      min: 1,
      step: 1,
      type: 'integer',
      defaultValue: 100,
      hint: '隐忍值达到多少时触发三年之期。'
    },
    {
      key: 'ultimateRotateDuration',
      label: '觉醒旋转时间',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 1.0,
      hint: '真太乙神针发射前的旋转蓄力时长。'
    }
  ],
  Spider: [
    {
      key: 'passiveSpeedBonus',
      label: '调教移速加成',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 0.2,
      hint: '按已损失血量比例结算的额外移速系数，0.2 表示最高 +20%。'
    }
  ],
  ThunderFlash: [
    {
      key: 'maxChargeTime',
      label: '蓄力时间',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 0.3,
      hint: '霹雳一闪撞墙后的蓄力时长，最小 0.1 秒。'
    },
    {
      key: 'skillCooldown',
      label: '弹射冷却',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 1.0,
      hint: '每次弹射结束后的冷却时间，最小 0.1 秒。'
    },
    {
      key: 'maxCombo',
      label: '觉醒连击数',
      min: 1,
      step: 1,
      type: 'integer',
      defaultValue: 6,
      hint: '霹雳一闪·六连的弹射次数，默认 6 次。'
    }
  ],
  CrimsonBlade: [
    {
      key: 'slashCooldown',
      label: '斩击冷却',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 4.0,
      hint: '绯线斩的触发间隔，默认 4.0 秒。'
    },
    {
      key: 'traceLife',
      label: '斩痕存在时间',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 4.0,
      hint: '未直接命中的斩痕在地面的保留时间。'
    },
    {
      key: 'awakenTraceLife',
      label: '觉醒斩痕存在',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 5.0,
      hint: '觉醒释放的强化斩痕保留时间。'
    }
  ],
  JueShiYouWu: [
    {
      key: 'trackingTriggerTime',
      label: '追踪触发时间',
      min: 0.1,
      step: 0.1,
      type: 'float',
      defaultValue: 2.0,
      hint: '多长时间未造成伤害则进入追踪模式。'
    },
    {
      key: 'cloneCount',
      label: '觉醒分身数量',
      min: 1,
      step: 1,
      type: 'integer',
      defaultValue: 4,
      hint: '觉醒时产生的分身数量，默认 4 个。'
    },
    {
      key: 'cloneLife',
      label: '分身存在时间',
      min: 1.0,
      step: 0.5,
      type: 'float',
      defaultValue: 5.0,
      hint: '分身在场上的存活时间，默认 5.0 秒。'
    }
  ]
};

const getSkillFields = (className) => skillTuningSchemas[className] || [];

const p1SkillFields = computed(() => getSkillFields(store.p1Selection?.class));
const p2SkillFields = computed(() => getSkillFields(store.p2Selection?.class));

const clampHp = (value) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return 100;
  return Math.max(1, Math.min(9999999, Math.round(next)));
};

const normalizeAwakenTime = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const next = Number(value);
  if (!Number.isFinite(next)) return null;
  return Math.max(0, next);
};

const roundToStep = (value, step) => {
  const precision = `${step}`.includes('.') ? `${step}`.split('.')[1].length : 0;
  return Number((Math.round(value / step) * step).toFixed(precision));
};

const normalizeSkillValue = (value, field) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return field.defaultValue;
  if (field.type === 'integer') {
    return Math.max(field.min, Math.round(next));
  }
  return Math.max(field.min, roundToStep(next, field.step));
};

const ensureSkillTuning = (playerKey, className) => {
  const fields = getSkillFields(className);
  if (!store.debugConfig.skillTuning[playerKey]) {
    store.debugConfig.skillTuning[playerKey] = {};
  }

  const tuning = store.debugConfig.skillTuning[playerKey];
  const validKeys = new Set(fields.map((field) => field.key));

  Object.keys(tuning).forEach((key) => {
    if (!validKeys.has(key)) {
      delete tuning[key];
    }
  });

  fields.forEach((field) => {
    tuning[field.key] = normalizeSkillValue(tuning[field.key], field);
  });
};

const normalizeConfig = () => {
  store.debugConfig.p1Hp = clampHp(store.debugConfig.p1Hp);
  store.debugConfig.p2Hp = clampHp(store.debugConfig.p2Hp);
  store.debugConfig.p1AutoAwakenTime = normalizeAwakenTime(store.debugConfig.p1AutoAwakenTime);
  store.debugConfig.p2AutoAwakenTime = normalizeAwakenTime(store.debugConfig.p2AutoAwakenTime);
  if (!store.debugConfig.skillTuning) {
    store.debugConfig.skillTuning = { p1: {}, p2: {} };
  }
  ensureSkillTuning('p1', store.p1Selection?.class);
  ensureSkillTuning('p2', store.p2Selection?.class);
  if (store.debugConfig.mode !== 'fixed') {
    store.debugConfig.fixedPlayer = 2;
  }
};

const backToSelect = () => {
  store.isDebug = false;
  router.push('/');
};

const resetConfig = () => {
  store.resetDebugConfig();
  normalizeConfig();
};

const startDebugBattle = () => {
  normalizeConfig();
  store.isTraining = false;
  store.isDebug = true;
  router.push('/battle');
};

onMounted(() => {
  if (!store.p1Selection || !store.p2Selection) {
    router.push('/');
    return;
  }
  normalizeConfig();
});

watch(
  () => [store.p1Selection?.class, store.p2Selection?.class],
  () => {
    normalizeConfig();
  }
);
</script>

<style scoped>
.debug-screen {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  min-height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
}

.debug-panel {
  width: min(920px, 100%);
  background: rgba(0, 0, 0, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  padding: 24px;
  box-sizing: border-box;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  margin: auto 0;
}

.debug-panel h1 {
  margin: 0 0 8px;
  color: #fff;
  font-size: 2rem;
}

.debug-subtitle {
  margin: 0 0 20px;
  color: #bbb;
}

.matchup-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.hero-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  border-radius: 999px;
  padding: 8px 14px;
}

.hero-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.config-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 14px;
  padding: 16px;
}

.config-card-wide {
  grid-column: 1 / -1;
}

.config-card h2 {
  margin: 0 0 14px;
  font-size: 1.05rem;
  color: #ffcf5c;
}

.skill-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.skill-player {
  background: rgba(0, 0, 0, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 14px;
}

.skill-player h3 {
  margin: 0 0 14px;
  color: #fff;
  font-size: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
  color: #ddd;
  font-size: 0.95rem;
}

.field input,
.field select {
  width: 100%;
  background: #1f1f1f;
  color: #fff;
  border: 1px solid #444;
  border-radius: 10px;
  padding: 10px 12px;
  box-sizing: border-box;
}

.field-hint {
  margin: 0;
  color: #999;
  font-size: 0.85rem;
  line-height: 1.5;
}

.field-meta {
  color: #8f8f8f;
  line-height: 1.4;
}

.empty-state {
  margin: 0;
  color: #999;
  line-height: 1.5;
}

.action-row {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 22px;
  flex-wrap: wrap;
}

.primary-btn,
.secondary-btn {
  border: none;
  border-radius: 10px;
  padding: 12px 18px;
  cursor: pointer;
  font-weight: bold;
}

.primary-btn {
  background: #4caf50;
  color: #fff;
}

.secondary-btn {
  background: #2d2d2d;
  color: #fff;
}

@media (max-width: 900px) {
  .debug-screen {
    padding: 16px;
  }

  .debug-panel {
    padding: 18px;
  }

  .config-grid {
    grid-template-columns: 1fr;
  }

  .skill-grid {
    grid-template-columns: 1fr;
  }
}
</style>
