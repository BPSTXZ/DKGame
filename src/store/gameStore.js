import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';

export const useGameStore = defineStore('game', () => {
  const p1Selection = ref(null);
  const p2Selection = ref(null);
  const isTraining = ref(false);

  const battleState = reactive({
    p1: { name: 'Hero 1', color: '#ffffff', hp: 100, maxHp: 100, speed: 0, spinSpeed: null, isDead: false, isAwakened: false, awakenTimer: 0, invincibleTime: 0, buffs: [] },
    p2: { name: 'Hero 2', color: '#ffffff', hp: 100, maxHp: 100, speed: 0, spinSpeed: null, isDead: false, isAwakened: false, awakenTimer: 0, invincibleTime: 0, buffs: [] }
  });

  const trainParams = reactive({
    p1: { hp: 100, maxHp: 100, baseSpeed: 60, damageMultiplier: 1.0, baseSpinSpeed: 20 },
    p2: { hp: 100, maxHp: 100, baseSpeed: 60, damageMultiplier: 1.0, baseSpinSpeed: 20 }
  });

  return {
    p1Selection,
    p2Selection,
    isTraining,
    battleState,
    trainParams
  };
});
