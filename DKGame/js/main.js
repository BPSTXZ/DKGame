import { createApp, ref, reactive, watch, nextTick } from 'vue';
import { Game } from './engine/Game.js';
import { Vampire } from './entities/heroes/Vampire.js';
import { Spider } from './entities/heroes/Spider.js';
import { Berserker } from './entities/heroes/Berserker.js';

const classes = {
    'Vampire': Vampire,
    'Spider': Spider,
    'Berserker': Berserker
};

createApp({
    setup() {
        const screen = ref('select');
        const isTraining = ref(false);
        
        const heroPool = [
            { id: 'vampire', name: '吸血鬼', class: 'Vampire', iconColor: '#8b0000' },
            { id: 'spider', name: '蜘蛛', class: 'Spider', iconColor: '#cccccc' },
            { id: 'berserker', name: '狂战士', class: 'Berserker', iconColor: '#8b4513' }
        ];

        const p1Selection = ref(null);
        const p2Selection = ref(null);
        
        // 全局音效
        const cheerAudio = new Audio('assets/audio/common/喝彩.mp3');

        const battleState = reactive({
            p1: { name: 'Hero 1', hp: 100, maxHp: 100, isDead: false, isAwakened: false, invincibleTime: 0, buffs: [] },
            p2: { name: 'Hero 2', hp: 100, maxHp: 100, isDead: false, isAwakened: false, invincibleTime: 0, buffs: [] }
        });

        const trainParams = reactive({
            p1: { hp: 100, maxHp: 100, baseSpeed: 60, damageMultiplier: 1.0, baseSpinSpeed: 20 },
            p2: { hp: 100, maxHp: 100, baseSpeed: 60, damageMultiplier: 1.0, baseSpinSpeed: 20 }
        });

        const victory = reactive({
            show: false,
            text: '',
            keepParams: false
        });

        let gameInstance = null;

        const selectHero = (hero) => {
            if (!p1Selection.value) {
                p1Selection.value = hero;
            } else if (!p2Selection.value && p1Selection.value.id !== hero.id) {
                p2Selection.value = hero;
            } else if (p1Selection.value && p2Selection.value) {
                p1Selection.value = hero;
                p2Selection.value = null;
            }
        };

        const updateBattleState = (state, hero) => {
            state.name = hero.name;
            state.hp = Math.max(0, hero.hp);
            state.maxHp = hero.maxHp;
            state.isDead = hero.isDead;
            state.isAwakened = hero.isAwakened;
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
            sync(trainParams.p1, gameInstance.p1);
            sync(trainParams.p2, gameInstance.p2);
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
            apply(gameInstance.p1, trainParams.p1);
            apply(gameInstance.p2, trainParams.p2);
        };

        const startGame = async (training) => {
            isTraining.value = training;
            screen.value = 'battle';
            victory.show = false;

            await nextTick();

            if (gameInstance) {
                gameInstance.stop();
            }

            const canvas = document.getElementById('game-canvas');
            const p1Class = classes[p1Selection.value.class];
            const p2Class = classes[p2Selection.value.class];

            gameInstance = new Game(
                canvas, p1Class, p2Class, isTraining.value,
                (p1, p2) => {
                    // Update state for UI binding
                    updateBattleState(battleState.p1, p1);
                    updateBattleState(battleState.p2, p2);

                    // Only sync HP to slider if hero is losing/gaining hp dynamically during battle
                    if (isTraining.value) {
                        trainParams.p1.hp = p1.hp;
                        trainParams.p2.hp = p2.hp;
                    }
                },
                (text) => {
                    victory.text = text;
                    victory.show = true;
                },
                (winner) => {
                    // 游戏结束（喷出彩带）瞬间停止场上所有角色的音效
                    if (gameInstance) {
                        if (gameInstance.p1) gameInstance.p1.stopAllAudio();
                        if (gameInstance.p2) gameInstance.p2.stopAllAudio();
                    }
                    
                    // 立即播放喝彩音效
                    cheerAudio.currentTime = 0;
                    cheerAudio.play().catch(e => console.warn('Cheer audio play failed:', e));
                }
            );

            // Set initial params to Vue state
            readParamsFromGame();
            gameInstance.start();
        };

        // Watch input params to instantly mutate game instance (Two-way binding)
        watch(() => trainParams.p1.hp, (val) => { if (gameInstance && !gameInstance.p1.isDead) { gameInstance.p1.hp = val; gameInstance.p1.maxHp = Math.max(gameInstance.p1.maxHp, val); } });
        watch(() => trainParams.p1.baseSpeed, (val) => { if (gameInstance) gameInstance.p1.baseSpeed = val; });
        watch(() => trainParams.p1.damageMultiplier, (val) => { if (gameInstance) gameInstance.p1.damageMultiplier = val; });
        watch(() => trainParams.p1.baseSpinSpeed, (val) => { if (gameInstance && gameInstance.p1.name === '狂战士') gameInstance.p1.baseSpinSpeed = val; });

        watch(() => trainParams.p2.hp, (val) => { if (gameInstance && !gameInstance.p2.isDead) { gameInstance.p2.hp = val; gameInstance.p2.maxHp = Math.max(gameInstance.p2.maxHp, val); } });
        watch(() => trainParams.p2.baseSpeed, (val) => { if (gameInstance) gameInstance.p2.baseSpeed = val; });
        watch(() => trainParams.p2.damageMultiplier, (val) => { if (gameInstance) gameInstance.p2.damageMultiplier = val; });
        watch(() => trainParams.p2.baseSpinSpeed, (val) => { if (gameInstance && gameInstance.p2.name === '狂战士') gameInstance.p2.baseSpinSpeed = val; });

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
            localStorage.setItem('dk_training_preset', JSON.stringify(trainParams));
            alert('预设已保存！');
        };

        const loadPreset = () => {
            const data = localStorage.getItem('dk_training_preset');
            if (data) {
                try {
                    const preset = JSON.parse(data);
                    Object.assign(trainParams.p1, preset.p1);
                    Object.assign(trainParams.p2, preset.p2);
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
            
            // Backup params if needed
            const currentParams = JSON.parse(JSON.stringify(trainParams));
            
            gameInstance.restart();
            
            if (isTraining.value && victory.keepParams) {
                Object.assign(trainParams, currentParams);
                applyParamsToGame();
            } else {
                readParamsFromGame();
            }
        };

        const backToSelect = () => {
            victory.show = false;
            cheerAudio.pause();
            cheerAudio.currentTime = 0;
            screen.value = 'select';
            p1Selection.value = null;
            p2Selection.value = null;
            if (gameInstance) gameInstance.stop();
        };

        return {
            screen, isTraining, heroPool, p1Selection, p2Selection,
            battleState, trainParams, victory,
            selectHero, startGame, triggerAwaken, resetToDefaults,
            savePreset, loadPreset, restartBattle, backToSelect
        };
    }
}).mount('#app');