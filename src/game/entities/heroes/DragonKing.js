import { Hero } from '../Hero.js';

export class DragonKing extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '龙王赘婿';
        this.color = '#002b36'; // 深青黑色
        this.hp = 100;
        this.maxHp = 100;
        this.baseSpeed = 60;
        this.radius = 40;
        
        // 状态
        this.mouthState = 'normal'; // 'normal' | 'smile'
        this.smileTimer = 0;
        
        // 技能一：太乙神针
        this.needleFireInterval = 2.0;
        this.needleFireTimer = 0;
        this.activeNeedles = [];
        this.moveSpeedBuffStacks = 0;
        
        // 隐忍值系统
        this.enduranceValue = 0;
        this.enduranceThreshold = 100;
        this.enduranceGainCooldown = 0;
        this.dragonAwakened = false;
        this.dragonAwakenLocked = false; // 是否已经触发过三年之期
        
        // 觉醒演出相关的状态
        this.returnParticleTimer = 0;
        this.returnNeedles = [];
        this.returnNeedlePhase = 0; // 0: none, 1: gathering, 2: firing
        this.returnNeedleTimer = 0;
        
        // 觉醒状态
        this.isUltimateActive = false;
        this.ultimateNeedles = [];
        this.ultimatePhase = 0; // 0: none, 1: active
        this.ultimateGenerateCount = 0;
        this.ultimateGenerateTimer = 0;
        
        // 碰撞冷却
        this.lastCollisionTime = 0;
        
        // 特效状态
        this.burnTimer = 0;
        this.burnInterval = 0;
        this.ghostKnockTimer = 0;
        this.ghostKnockCount = 0;
        this.freezeTimer = 0;
        this.slowTimer = 0;
        
        // 音效配置
        this.needleFireAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/DragonKing/发射.mp3');
        this.needleHitAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/DragonKing/命中.mp3');
        this.needleHealAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/DragonKing/治疗.mp3');
        this.needleAppearAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/DragonKing/五针出现.mp3');
        this.ultimateNeedleHitAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/DragonKing/神针命中.mp3');
        this.dragonReturnAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/DragonKing/三年已到.mp3');
        this.burstAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/thunderflash/霹雳一闪.mp3');
        this.awakenAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/DragonKing/觉醒.mp3');
    }
    
    stopAllAudio() {
        if (this.needleFireAudio) {
            this.needleFireAudio.pause();
            this.needleFireAudio.currentTime = 0;
        }
        if (this.needleHitAudio) {
            this.needleHitAudio.pause();
            this.needleHitAudio.currentTime = 0;
        }
        if (this.needleHealAudio) {
            this.needleHealAudio.pause();
            this.needleHealAudio.currentTime = 0;
        }
        if (this.needleAppearAudio) {
            this.needleAppearAudio.pause();
            this.needleAppearAudio.currentTime = 0;
        }
        if (this.ultimateNeedleHitAudio) {
            this.ultimateNeedleHitAudio.pause();
            this.ultimateNeedleHitAudio.currentTime = 0;
        }
        if (this.dragonReturnAudio) {
            this.dragonReturnAudio.pause();
            this.dragonReturnAudio.currentTime = 0;
        }
        if (this.burstAudio) {
            this.burstAudio.pause();
            this.burstAudio.currentTime = 0;
        }
    }
    
    stopAwakenAudio() {
        if (this.awakenAudio) {
            this.awakenAudio.pause();
            this.awakenAudio.currentTime = 0;
        }
    }

    playAwakenAudio() {
        if (this.awakenAudio) {
            this.awakenAudio.currentTime = 0;
            this.awakenAudio.play().catch(e => console.warn('DragonKing awaken audio play failed:', e));
        }
    }
    
    // 应用被动和自身的Buff
    applyPassives() {
        // 移速加成计算：基础倍率上，叠加神针带来的增速和三年之期的增速
        let bonusSpeed = this.moveSpeedBuffStacks * 2;
        if (this.dragonAwakened) {
            bonusSpeed += 10;
        }
        // 由于 Hero.js 中 baseSpeed 对应实际速度的倍率是 *8，这里的 bonusSpeed 是数值还是百分比？
        // 文档里写：基础移速60，移速增益+2，三年之期+10。
        // 所以我们直接加在实际速度计算的倍率上，或者临时修改 baseSpeed
        // 为不污染 baseSpeed，我们计算额外的速度比例：bonusSpeed / 60
        this.speedMultiplier *= (1 + bonusSpeed / 60);
    }
    
    onHeroCollision(other) {
        if (this.isDead || other.isDead) return;
        
        const now = Date.now();
        if (!this.lastCollisionTime || now - this.lastCollisionTime > 200) {
            other.takeDamage(2 * this.damageMultiplier, this.x, this.y);
            this.lastCollisionTime = now;
        }
    }
    
    takeDamage(amount, sourceX, sourceY) {
        const oldHp = this.hp;
        super.takeDamage(amount, sourceX, sourceY);
        
        // 隐忍值增加
        if (this.hp < oldHp && !this.isDead && !this.dragonAwakenLocked) {
            if (this.enduranceGainCooldown <= 0) {
                const inc = Math.floor(Math.random() * 11) + 5; // 5 到 15
                this.enduranceValue += inc;
                this.enduranceGainCooldown = 0.2;
                
                if (this.enduranceValue >= this.enduranceThreshold) {
                    this.enduranceValue = this.enduranceThreshold;
                    this.triggerDragonReturn();
                }
            }
        }
    }
    
    triggerDragonReturn() {
        if (this.dragonAwakenLocked) return;
        this.dragonAwakenLocked = true;
        
        // 播放回归音效，重新定义演出时间轴
        // 时停与能量汇聚时长一致（根据音效时长，若获取不到默认 2.5s）
        let gatheringDuration = 2.5;
        
        if (this.dragonReturnAudio) {
            this.dragonReturnAudio.currentTime = 0;
            this.dragonReturnAudio.play().catch(e => console.warn('DragonKing return audio play failed:', e));
            // 尝试获取实际音频时长
            if (this.dragonReturnAudio.duration && !isNaN(this.dragonReturnAudio.duration)) {
                gatheringDuration = this.dragonReturnAudio.duration;
            }
        }
        
        // 能量汇聚时长与时停时间一致，最长2.5s
        gatheringDuration = Math.min(gatheringDuration, 2.5);
        
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: '三年之期已到' });
            // 全场停顿时间与汇聚时间一致
            this.game.globalFreezeTime = gatheringDuration; 
            this.game.awakenCenter = { x: this.x, y: this.y };
            this.game.awakenRadius = 0;
            this.game.addFloatingText(this.x, this.y - 60, "三年之期已到！", '#ffd700');
        }
        
        this.mouthState = 'smile';
        
        // 强化效果延迟在 updateSpecific 中时停结束时应用
        this.pendingDragonAwaken = true;
        this.returnParticleTimer = gatheringDuration; // 持续生成汇聚粒子的时间，和时停完全同步
        this.returnParticleDuration = gatheringDuration; // 记录总时长，用于动画进度计算
        this.returnNeedlePhase = 0; // 此时先只汇聚粒子
    }
    
    onAwaken() {
        if (this.isUltimateActive) return;
        this.isUltimateActive = true;
        
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: '真太乙神针' });
        }
        
        this.mouthState = 'smile';
        this.ultimateNeedles = [];
        this.ultimatePhase = 1;
        this.ultimateGenerateCount = 0;
        this.ultimateGenerateTimer = 0; // 立即生成第一针
    }
    
    onVictory() {
        this.mouthState = 'smile'; // 胜利时歪嘴笑
    }
    
    fireNormalNeedle() {
        let angle = 0;
        if (this.enemy) {
            angle = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
        }
        
        const speed = 80 * 8; // 和系统速度倍率对齐
        this.activeNeedles.push({
            type: 'normal',
            color: '#ffd700',
            x: this.x,
            y: this.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            bounceCount: 0,
            maxBounceCount: 5,
            active: true,
            trail: []
        });
        
        // 播放发射音效
        if (this.needleFireAudio) {
            this.needleFireAudio.currentTime = 0;
            this.needleFireAudio.play().catch(e => console.warn('DragonKing fire audio play failed:', e));
        }
        
        // 发射特效
        for(let i=0; i<10; i++) {
            this.game.addParticle({
                x: this.x + Math.cos(angle) * this.radius, 
                y: this.y + Math.sin(angle) * this.radius,
                vx: (Math.random()-0.5)*150 + Math.cos(angle) * 100, 
                vy: (Math.random()-0.5)*150 + Math.sin(angle) * 100,
                color: '#ffd700', life: 0.4, size: 3
            });
        }
    }
    
    updateAwakenAnimation(dt) {
        // 时停期间的特殊演出：汇聚粒子特效
        if (this.returnParticleTimer > 0 && this.game) {
            this.returnParticleTimer -= dt;
            const duration = this.returnParticleDuration || 2.5;
            // 进度 0 -> 1
            const progress = 1 - Math.max(0, this.returnParticleTimer / duration);
            
            // 粒子生成数量随时间指数增加，营造最后的爆发感
            const spawnCount = Math.floor(2 + Math.pow(progress, 2) * 12);
            // 基础生成半径随时间收缩
            const baseRadius = 400 - progress * 250; 

            for (let i = 0; i < spawnCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = baseRadius + Math.random() * 100; 
                
                const startX = this.x + Math.cos(angle) * distance;
                const startY = this.y + Math.sin(angle) * distance;
                
                // 赋予一个强烈的切向初速度，配合 target 吸引形成向心螺旋
                const spiralDir = i % 2 === 0 ? 1 : -1; 
                const tangentAngle = angle + spiralDir * Math.PI / 2;
                
                // 随着进度增加，切向速度提升
                const tangentSpeed = 300 + progress * 500; 
                
                const vx = Math.cos(tangentAngle) * tangentSpeed;
                const vy = Math.sin(tangentAngle) * tangentSpeed;
                
                const isGold = Math.random() > (0.5 - progress * 0.3); // 后期金色更多
                this.game.addParticle({
                    x: startX, y: startY,
                    vx: vx, vy: vy,
                    color: isGold ? '#ffd700' : '#32cd32', 
                    life: 0.4 - progress * 0.15, // 存活时间变短，显得吸收更快
                    size: Math.random() * 3 + 2 + progress * 3, // 粒子逐渐变大
                    target: this 
                });
            }
        }
    }

    updateSpecific(dt) {
        if (this.isDead) return;

        if (this.enduranceGainCooldown > 0) {
            this.enduranceGainCooldown -= dt;
        }
        
        if (this.smileTimer > 0) {
            this.smileTimer -= dt;
            if (this.smileTimer <= 0 && !this.dragonAwakened && !this.isUltimateActive && !this.isVictorious) {
                this.mouthState = 'normal';
            }
        }
        
        // 三年之期演出结束判定 (此时汇聚和时停正好结束)
        if (this.pendingDragonAwaken && (!this.game || this.game.globalFreezeTime <= 0)) {
            this.pendingDragonAwaken = false;
            this.dragonAwakened = true;
            this.enduranceValue = 0;
            
            if (this.game) {
                // 剧烈屏幕震动
                this.game.shakeScreen(0.3, 8);
                // 添加爆发特效气场
                for(let i=0; i<40; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 200 + 100;
                    this.game.addParticle({
                        x: this.x, y: this.y,
                        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                        color: Math.random() > 0.5 ? '#ffd700' : '#32cd32', 
                        life: 0.8, size: Math.random() * 5 + 3
                    });
                }
                // 终极爆发光环
                if (!this.healRings) this.healRings = [];
                this.healRings.push({
                    minRadius: this.radius,
                    maxRadius: this.radius + 400,
                    width: 20,
                    color: '#ffd700',
                    life: 0.6,
                    maxLife: 0.6,
                    hasSparks: true
                });
                
                // 播放爆炸冲击音效
                if (this.burstAudio) {
                    this.burstAudio.currentTime = 0;
                    this.burstAudio.play().catch(e => console.warn('DragonKing burst audio play failed:', e));
                }
            }
            
            // 能量汇聚完毕且时停结束时，立刻生成 6 根普通神针悬停
            this.returnNeedlePhase = 1; // gathering
            this.returnNeedleTimer = 0.5; // 悬停 0.5 秒后发射
            this.returnNeedles = [];
            const count = 6;
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                this.returnNeedles.push({
                    type: 'normal',
                    color: '#ffd700',
                    angle: angle, // 发射角度
                    dist: 40, // 初始生成在身旁
                    x: this.x + Math.cos(angle) * 40,
                    y: this.y + Math.sin(angle) * 40,
                    vx: 0,
                    vy: 0,
                    bounceCount: 0,
                    maxBounceCount: 5,
                    active: true,
                    trail: []
                });
                // 生成时的小光爆
                for(let p=0; p<8; p++) {
                    this.game.addParticle({
                        x: this.x + Math.cos(angle) * 40, 
                        y: this.y + Math.sin(angle) * 40,
                        vx: (Math.random()-0.5)*80, vy: (Math.random()-0.5)*80,
                        color: '#ffd700', life: 0.3, size: 3
                    });
                }
            }
            // 播放五针出现音效作为替代
            if (this.needleAppearAudio) {
                this.needleAppearAudio.currentTime = 0;
                this.needleAppearAudio.play().catch(e => console.warn('DragonKing needle appear audio play failed:', e));
            }
        }
        
        // 处理回归发射的 6 根神针
        if (this.returnNeedlePhase === 1) {
            this.returnNeedleTimer -= dt;
            // 让神针跟随英雄移动
            for (let n of this.returnNeedles) {
                n.x = this.x + Math.cos(n.angle) * n.dist;
                n.y = this.y + Math.sin(n.angle) * n.dist;
            }
            if (this.returnNeedleTimer <= 0) {
                this.returnNeedlePhase = 2; // firing
                const speed = 80 * 8;
                for (let n of this.returnNeedles) {
                    n.vx = Math.cos(n.angle) * speed;
                    n.vy = Math.sin(n.angle) * speed;
                }
                // 加入到全局的神针数组中统一管理
                this.activeNeedles.push(...this.returnNeedles);
                this.returnNeedles = [];
                // 播放发射音效
                if (this.needleFireAudio) {
                    this.needleFireAudio.currentTime = 0;
                    this.needleFireAudio.play().catch(e => console.warn('DragonKing fire audio play failed:', e));
                }
            }
        }
        
        // 普通神针发射
        // 受击硬直或时停期间不发针
        if (!this.game || this.game.globalFreezeTime <= 0) {
            this.needleFireTimer -= dt;
            if (this.needleFireTimer <= 0) {
                this.fireNormalNeedle();
                this.needleFireTimer = this.needleFireInterval;
            }
        }
        
        // 更新所有神针
        this.updateNeedles(dt, this.activeNeedles);
        
        if (this.healRings) {
            for (let i = this.healRings.length - 1; i >= 0; i--) {
                this.healRings[i].life -= dt;
                if (this.healRings[i].life <= 0) {
                    this.healRings.splice(i, 1);
                }
            }
        }
        
        // 觉醒五针
        if (this.isUltimateActive) {
            if (this.ultimatePhase === 1) {
                // 生成阶段：每 0.5s 生成一针
                this.ultimateGenerateTimer -= dt;
                if (this.ultimateGenerateTimer <= 0 && this.ultimateGenerateCount < 5) {
                    const types = [
                        { id: 'fire', color: '#ff4500', name: '烧山火' },
                        { id: 'ice', color: '#00ffff', name: '透心凉' },
                        { id: 'ghost', color: '#800080', name: '鬼敲门' },
                        { id: 'gold', color: '#fffff0', name: '观音手' },
                        { id: 'life', color: '#32cd32', name: '太乙针' }
                    ];
                    
                    const i = this.ultimateGenerateCount;
                    // 为了保证 5 针最终均匀分布（72度一个），第 i 针的初始角度分配
                    // 让神针朝着敌方方向或者随机方向作为基准发射角
                    const baseAngle = this.enemy ? Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x) : 0;
                    const targetAngle = baseAngle + (i / 5) * Math.PI * 2;
                    
                    this.ultimateNeedles.push({
                        type: types[i].id,
                        color: types[i].color,
                        angle: targetAngle, // 当前旋转角度
                        targetAngle: targetAngle, // 发射时的目标角度
                        rotatedAngle: 0, // 记录已经旋转过的弧度
                        state: 'rotating', // 'rotating' | 'firing'
                        dist: 60,
                        x: this.x + Math.cos(targetAngle) * 60,
                        y: this.y + Math.sin(targetAngle) * 60,
                        vx: 0, vy: 0,
                        bounceCount: 0,
                        maxBounceCount: 10, // 觉醒神针可弹射 10 次
                        active: true,
                        trail: []
                    });
                    
                    // 生成特效
                    for(let p=0; p<10; p++) {
                        this.game.addParticle({
                            x: this.x + Math.cos(targetAngle) * 60, 
                            y: this.y + Math.sin(targetAngle) * 60,
                            vx: (Math.random()-0.5)*100, vy: (Math.random()-0.5)*100,
                            color: types[i].color, life: 0.5, size: 3
                        });
                    }
                    
                    // 播放五针出现音效
                    if (this.needleAppearAudio) {
                        this.needleAppearAudio.currentTime = 0;
                        this.needleAppearAudio.play().catch(e => console.warn('DragonKing needle appear audio play failed:', e));
                    }
                    
                    this.ultimateGenerateCount++;
                    this.ultimateGenerateTimer = 0.5; // 下一针间隔
                }

                // 更新所有觉醒针
                const rotationSpeed = Math.PI * 2; // 每秒一圈
                const fireSpeed = 100 * 8;
                
                for (let j = 0; j < this.ultimateNeedles.length; j++) {
                    const n = this.ultimateNeedles[j];
                    
                    if (n.state === 'rotating') {
                        const rotateDelta = rotationSpeed * dt;
                        n.angle += rotateDelta;
                        n.rotatedAngle += rotateDelta;
                        
                        n.x = this.x + Math.cos(n.angle) * n.dist;
                        n.y = this.y + Math.sin(n.angle) * n.dist;
                        n.trail.push({ x: n.x, y: n.y, life: 0.2 });
                        
                        // 环绕一周后直接发射 (旋转超过 2PI 弧度)
                        if (n.rotatedAngle >= Math.PI * 2) {
                            n.state = 'firing';
                            n.vx = Math.cos(n.targetAngle) * fireSpeed;
                            n.vy = Math.sin(n.targetAngle) * fireSpeed;
                            
                            // 播放发射音效
                            if (this.needleFireAudio) {
                                this.needleFireAudio.currentTime = 0;
                                this.needleFireAudio.play().catch(e => console.warn('DragonKing fire audio play failed:', e));
                            }
                        }
                    }
                }
                
                // 已经发射的觉醒针会走统一的 updateNeedles 更新物理和碰撞
                // 注意：updateNeedles 内部会把命中的针标记为 n.active = false
                this.updateNeedles(dt, this.ultimateNeedles.filter(n => n.state === 'firing'));
                
                // 如果五针全部生成且全部发射完毕（或者命中死掉被标记为 active=false），结束觉醒状态
                // 因为清理死针的逻辑在最下面执行，这里判断 active 状态更准确
                const hasActiveUltimateNeedles = this.ultimateNeedles.some(n => n.active);
                if (this.ultimateGenerateCount >= 5 && !hasActiveUltimateNeedles) {
                    this.isUltimateActive = false;
                    this.isAwakened = false; // 关闭觉醒状态
                    this.ultimatePhase = 0;
                    if (!this.dragonAwakened && !this.isVictorious) {
                        this.mouthState = 'normal';
                    }
                }
            }
        }
        
        // 清理过期的残影
        const cleanTrail = (needles) => {
            for (const n of needles) {
                for (let i = n.trail.length - 1; i >= 0; i--) {
                    n.trail[i].life -= dt;
                    if (n.trail[i].life <= 0) n.trail.splice(i, 1);
                }
            }
        };
        cleanTrail(this.activeNeedles);
        cleanTrail(this.ultimateNeedles);
        
        // 清理死针
        this.activeNeedles = this.activeNeedles.filter(n => n.active || n.trail.length > 0);
        this.ultimateNeedles = this.ultimateNeedles.filter(n => n.active || n.trail.length > 0);
    }
    
    updateNeedles(dt, needles) {
        for (const n of needles) {
            if (!n.active) continue;
            
            n.x += n.vx * dt;
            n.y += n.vy * dt;
            
            // 尾光残影
            if (Math.random() < 0.5) {
                n.trail.push({ x: n.x, y: n.y, life: 0.3 });
            }
            
            // 边框碰撞与反弹
            let bounced = false;
            if (n.x < 0) { n.x = 0; n.vx *= -1; bounced = true; }
            else if (n.x > this.game.width) { n.x = this.game.width; n.vx *= -1; bounced = true; }
            if (n.y < 0) { n.y = 0; n.vy *= -1; bounced = true; }
            else if (n.y > this.game.height) { n.y = this.game.height; n.vy *= -1; bounced = true; }
            
            if (bounced) {
                n.bounceCount++;
                // 反弹火花特效
                for(let i=0; i<3; i++) {
                    this.game.addParticle({
                        x: n.x, y: n.y,
                        vx: (Math.random()-0.5)*100, vy: (Math.random()-0.5)*100,
                        color: n.color, life: 0.3, size: 2
                    });
                }
                if (n.bounceCount > n.maxBounceCount) {
                    n.active = false;
                    continue;
                }
            }
            
            // 碰撞判定
            const hitEnemy = this.enemy && !this.enemy.isDead && this.game.physics.checkCircleCollision({x: n.x, y: n.y, radius: 5}, this.enemy);
            const hitSelf = !this.isDead && this.game.physics.checkCircleCollision({x: n.x, y: n.y, radius: 5}, this);
            
            if (n.type === 'normal') {
                if (hitEnemy) {
                    const dmg = this.dragonAwakened ? 7 : 5;
                    this.enemy.takeDamage(dmg * this.damageMultiplier, n.x, n.y);
                    n.active = false;
                    
                    // 播放命中音效
                    if (this.needleHitAudio) {
                        this.needleHitAudio.currentTime = 0;
                        this.needleHitAudio.play().catch(e => console.warn('DragonKing hit audio play failed:', e));
                    }
                } else if (hitSelf && n.bounceCount > 0) {
                    // 反弹后命中自身
                    this.heal(5);
                    if (this.moveSpeedBuffStacks < 5) {
                        this.moveSpeedBuffStacks++;
                    }
                    this.mouthState = 'smile';
                    this.smileTimer = 0.5;
                    
                    // 回流爆炸特效
                    for(let i=0; i<20; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = Math.random() * 150 + 50;
                        this.game.addParticle({
                            x: this.x, y: this.y,
                            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                            color: '#32cd32', life: 0.6, size: Math.random() * 4 + 2
                        });
                    }
                    
                    // 多层发光光环
                    if (!this.healRings) this.healRings = [];
                    this.healRings.push({
                        minRadius: this.radius,
                        maxRadius: this.radius + 60,
                        width: 8,
                        color: '#32cd32',
                        life: 0.4,
                        maxLife: 0.4,
                        hasSparks: true
                    });
                    this.healRings.push({
                        minRadius: this.radius,
                        maxRadius: this.radius + 100,
                        width: 3,
                        color: '#7fff00',
                        life: 0.3,
                        maxLife: 0.3,
                        hasSparks: false
                    });
                    
                    n.active = false;
                    
                    // 播放治疗音效
                    if (this.needleHealAudio) {
                        this.needleHealAudio.currentTime = 0;
                        this.needleHealAudio.play().catch(e => console.warn('DragonKing heal audio play failed:', e));
                    }
                }
            } else {
                // 觉醒神针
                const canHitEnemy = n.type !== 'life';
                const canHitSelf = n.type === 'life' && n.bounceCount > 0;
                
                if (hitEnemy && canHitEnemy) {
                    this.applyUltimateNeedleEffect(n.type, this.enemy);
                    n.active = false;
                    
                    // 觉醒命中震动
                    if (this.game) {
                        this.game.shakeScreen(0.15, 5);
                    }
                    
                    // 不同神针命中敌方时的回流爆炸特效
                    for(let i=0; i<30; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = Math.random() * 150 + 50;
                        this.game.addParticle({
                            x: this.enemy.x, y: this.enemy.y,
                            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                            color: n.color, life: 0.6, size: Math.random() * 4 + 2
                        });
                    }
                    
                    // 敌方身上的多层受击光环特效
                    if (!this.enemy.hitRings) this.enemy.hitRings = [];
                    this.enemy.hitRings.push({
                        x: this.enemy.x,
                        y: this.enemy.y,
                        minRadius: this.enemy.radius,
                        maxRadius: this.enemy.radius + 80,
                        width: 8,
                        color: n.color,
                        life: 0.4,
                        maxLife: 0.4,
                        hasSparks: true
                    });
                    
                    // 播放觉醒神针命中音效
                    if (this.ultimateNeedleHitAudio) {
                        this.ultimateNeedleHitAudio.currentTime = 0;
                        this.ultimateNeedleHitAudio.play().catch(e => console.warn('DragonKing ultimate needle hit audio play failed:', e));
                    }
                } else if (hitSelf && canHitSelf) {
                    this.heal(10);
                    
                    // 觉醒回流爆炸特效
                    for(let i=0; i<40; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = Math.random() * 200 + 80;
                        this.game.addParticle({
                            x: this.x, y: this.y,
                            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                            color: '#32cd32', life: 0.8, size: Math.random() * 5 + 3
                        });
                    }
                    
                    // 强力多层发光光环
                    if (!this.healRings) this.healRings = [];
                    this.healRings.push({
                        minRadius: this.radius,
                        maxRadius: this.radius + 100,
                        width: 15,
                        color: '#32cd32',
                        life: 0.6,
                        maxLife: 0.6,
                        hasSparks: true
                    });
                    this.healRings.push({
                        minRadius: this.radius,
                        maxRadius: this.radius + 150,
                        width: 5,
                        color: '#00ff7f',
                        life: 0.4,
                        maxLife: 0.4,
                        hasSparks: true
                    });
                    
                    n.active = false;
                    
                    // 播放治疗音效
                    if (this.needleHealAudio) {
                        this.needleHealAudio.currentTime = 0;
                        this.needleHealAudio.play().catch(e => console.warn('DragonKing heal audio play failed:', e));
                    }
                }
            }
        }
    }
    
    applyUltimateNeedleEffect(type, target) {
        if (type === 'fire') {
            // 烧山火
            target.takeDamage(2 * this.damageMultiplier, target.x, target.y);
            // 这里利用现有的 buff 系统，如果没有 burn 我们就手写个，或者用 tickTimer
            // 为了简单且符合文档，可以直接在 target 身上挂个自定义字段或buff
            target.addBuff('dk_burn', 'burn', 2 * this.damageMultiplier, 3.0, { tickTimer: 0 });
            // 注意：Hero 基类没有处理 'burn' buff 伤害，所以需要通过特殊方式，或者我们通过被动来处理？
            // 其实最好在 Game 或通过扩展，但我们只能改英雄，所以我们在目标身上动态挂载一个定时器，或者我们自己来轮询。
            // 既然我们控制了 DragonKing，可以在 DragonKing 里轮询对敌人的伤害，但如果 DragonKing 死了呢？
            // 我们可以在 enemy 身上增加属性：
            target.dkBurnTimer = 3.0;
            target.dkBurnTick = 0;
        } else if (type === 'ice') {
            // 透心凉
            target.takeDamage(5 * this.damageMultiplier, target.x, target.y);
            target.addBuff('dk_freeze', 'paralyze', 1.0, 1.0); // 借用 paralyze 达到停移效果
        } else if (type === 'ghost') {
            // 鬼敲门
            target.takeDamage(5 * this.damageMultiplier, target.x, target.y);
            target.addBuff('dk_ghost', 'combo', 0, 0.5); // 添加一个 buff 用于在 UI 上显示“连击”标签
            target.dkGhostTimer = 0.5;
            target.dkGhostCount = 2;
        } else if (type === 'gold') {
            // 观音手
            target.addBuff('dk_slow', 'slow', 0.5, 2.0);
        }
    }
    
    // 覆盖父类的 update 来处理附加在敌人身上的持续效果
    update(dt) {
        super.update(dt);
        
        if (this.enemy && !this.enemy.isDead) {
            // 烧山火
            if (this.enemy.dkBurnTimer > 0) {
                this.enemy.dkBurnTimer -= dt;
                this.enemy.dkBurnTick += dt;
                if (this.enemy.dkBurnTick >= 0.5) {
                    this.enemy.dkBurnTick -= 0.5;
                    this.enemy.takeDamage(2 * this.damageMultiplier, this.enemy.x, this.enemy.y);
                    // 火焰粒子
                    if (this.game) {
                        this.game.addParticle({
                            x: this.enemy.x + (Math.random()-0.5)*20, y: this.enemy.y + (Math.random()-0.5)*20,
                            vx: 0, vy: -30,
                            color: '#ff4500', life: 0.5, size: 3
                        });
                    }
                }
            }
            
            // 鬼敲门
            if (this.enemy.dkGhostTimer > 0 && this.enemy.dkGhostCount > 0) {
                this.enemy.dkGhostTimer -= dt;
                if (this.enemy.dkGhostTimer <= 0.25 && this.enemy.dkGhostCount === 2) {
                    this.enemy.takeDamage(5 * this.damageMultiplier, this.enemy.x, this.enemy.y);
                    this.enemy.dkGhostCount--;
                } else if (this.enemy.dkGhostTimer <= 0 && this.enemy.dkGhostCount === 1) {
                    this.enemy.takeDamage(5 * this.damageMultiplier, this.enemy.x, this.enemy.y);
                    this.enemy.dkGhostCount--;
                }
            }
        }
    }
    
    drawBody(ctx) {
        super.drawBody(ctx);
        
        // 隐忍值进度条 UI
        if (!this.dragonAwakened && !this.isDead) {
            ctx.save();
            
            // 底槽外边框
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = 8;
            ctx.stroke();
            
            // 动态时间计算
            const time = Date.now();
            
            // 底槽内轨（增加微弱的呼吸感）
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
            const emptyBreath = (Math.sin(time / 500) + 1) / 2;
            ctx.strokeStyle = `rgba(150, 150, 150, ${0.3 + emptyBreath * 0.3})`;
            ctx.lineWidth = 4;
            ctx.stroke();
            
            // 进度环
            if (this.enduranceValue > 0) {
                ctx.beginPath();
                const threshold = Math.max(1, this.enduranceThreshold);
                const progress = Math.min(1, this.enduranceValue / threshold);
                const angle = progress * Math.PI * 2;
                ctx.arc(0, 0, this.radius + 10, -Math.PI / 2, -Math.PI / 2 + angle);
                
                // 动态特效
                if (progress >= 1) {
                    // 满值：高频闪烁及光晕发光效果 (金色)
                    const pulse = (Math.sin(time / 100) + 1) / 2;
                    ctx.strokeStyle = `rgb(255, ${215 + Math.floor(pulse * 40)}, 0)`; // 金色高亮交替
                    ctx.shadowColor = '#ffd700';
                    ctx.shadowBlur = 10 + pulse * 15;
                    ctx.lineWidth = 6 + pulse * 3; // 微微变粗
                } else {
                    // 攒值：平缓的呼吸光晕 (橙金色)
                    const breath = (Math.sin(time / 300) + 1) / 2;
                    ctx.strokeStyle = '#ff9900';
                    ctx.shadowColor = '#ff9900';
                    ctx.shadowBlur = 5 + breath * 8;
                    ctx.lineWidth = 6;
                }
                
                ctx.lineCap = 'round';
                ctx.stroke();
                
                // 清除阴影防止影响其他元素的绘制
                ctx.shadowBlur = 0;
            }
            ctx.restore();
        }
        
        // 嘴巴表情 UI
        ctx.save();
        ctx.strokeStyle = '#ffd700'; // 金色嘴巴
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (this.mouthState === 'smile') {
            // 龙王歪嘴：整体向右上方偏移，减轻倾斜角度使之更自然
            ctx.translate(5, 12); 
            ctx.rotate(-5 * Math.PI / 180); // 减轻逆时针倾斜
            
            // 左半边平直，右嘴角上扬（减轻上扬幅度）
            ctx.moveTo(-15, 0);
            ctx.lineTo(2, 0);
            ctx.quadraticCurveTo(10, 0, 15, -8);
        } else {
            // 横线，调整了 y 坐标使其偏下一点
            ctx.moveTo(-15, 15);
            ctx.lineTo(15, 15);
        }
        ctx.stroke();
        ctx.restore();
    }
    
    draw(ctx) {
        super.draw(ctx);
        
        if (!this.isDead) {
            // 绘制神针
            const drawNeedle = (n) => {
                // 拖尾
                ctx.save();
                ctx.beginPath();
                if (n.trail.length > 0) {
                    ctx.moveTo(n.trail[0].x, n.trail[0].y);
                    for (let i = 1; i < n.trail.length; i++) {
                        ctx.lineTo(n.trail[i].x, n.trail[i].y);
                    }
                }
                // 拖尾更粗更亮
                ctx.strokeStyle = n.color;
                ctx.shadowColor = n.color;
                ctx.shadowBlur = 15;
                ctx.globalAlpha = 0.7;
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke();
                ctx.restore();
                
                // 针本体
                if (n.active) {
                    ctx.save();
                    ctx.translate(n.x, n.y);
                    
                    // 计算针的朝向：
                    // 如果有速度，则朝向运动方向
                    // 如果在环绕 (vx/vy == 0)，则让针呈现水平环绕姿态 (切线方向：angle + PI/2)
                    let drawAngle = 0;
                    if (n.vx !== 0 || n.vy !== 0) {
                        drawAngle = Math.atan2(n.vy, n.vx);
                    } else if (n.angle !== undefined) {
                        drawAngle = n.angle + Math.PI / 2;
                    }
                    
                    ctx.rotate(drawAngle);
                    
                    // 外发光层
                    ctx.fillStyle = n.color;
                    ctx.shadowColor = n.color;
                    ctx.shadowBlur = 15;
                    ctx.globalAlpha = 0.8;
                    // 加长加粗：长度 40，宽度 6 (原20x3)
                    ctx.fillRect(-20, -3, 40, 6); 
                    
                    // 内核纯白高亮，表现法宝质感
                    ctx.shadowBlur = 5;
                    ctx.globalAlpha = 1.0;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(-16, -1.5, 32, 3);
                    
                    // 针尖锐化处理 (画一个小三角形)
                    ctx.beginPath();
                    ctx.moveTo(20, -3);
                    ctx.lineTo(26, 0);
                    ctx.lineTo(20, 3);
                    ctx.closePath();
                    ctx.fillStyle = n.color;
                    ctx.fill();
                    
                    ctx.beginPath();
                    ctx.moveTo(16, -1.5);
                    ctx.lineTo(24, 0);
                    ctx.lineTo(16, 1.5);
                    ctx.closePath();
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                    
                    ctx.restore();
                }
            };
            
            this.activeNeedles.forEach(drawNeedle);
            this.ultimateNeedles.forEach(drawNeedle);
            this.returnNeedles.forEach(drawNeedle);
        }
    }
    
    drawOverlay(ctx) {
        super.drawOverlay(ctx);
        
        // 渲染治疗波纹/阵法特效等
        if (this.healRings && this.healRings.length > 0) {
            ctx.save();
            ctx.translate(this.x, this.y);
            
            for (let i = this.healRings.length - 1; i >= 0; i--) {
                const ring = this.healRings[i];
                const alpha = Math.max(0, ring.life / ring.maxLife);
                // 非线性衰减：让光环迅速扩大，后期缓慢消散 (ease-out)
                const progress = 1 - Math.pow(alpha, 3);
                const currentRadius = ring.minRadius + (ring.maxRadius - ring.minRadius) * progress;
                
                ctx.beginPath();
                ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
                ctx.strokeStyle = ring.color || '#32cd32';
                ctx.lineWidth = ring.width * alpha;
                ctx.globalAlpha = alpha;
                ctx.shadowColor = ring.color || '#32cd32';
                ctx.shadowBlur = 15;
                ctx.stroke();
                
                // 动漫感随机电弧
                if (ring.hasSparks && alpha > 0.3) {
                    ctx.save();
                    ctx.globalAlpha = alpha * 0.8;
                    ctx.lineWidth = 2;
                    for (let j = 0; j < 5; j++) {
                        const angle = Math.random() * Math.PI * 2;
                        const r1 = currentRadius * 0.9;
                        const r2 = currentRadius * 1.1;
                        ctx.beginPath();
                        ctx.moveTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
                        ctx.lineTo(Math.cos(angle + 0.1) * currentRadius, Math.sin(angle + 0.1) * currentRadius);
                        ctx.lineTo(Math.cos(angle + 0.2) * r2, Math.sin(angle + 0.2) * r2);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            }
            ctx.restore();
        }

        // 增加能量汇聚时的阵法与光球效果
        if (this.returnParticleTimer > 0 && this.returnParticleDuration > 0) {
            ctx.save();
            ctx.translate(this.x, this.y);
            
            const progress = 1 - Math.max(0, this.returnParticleTimer / this.returnParticleDuration);
            
            // 1. 底部旋转法阵 (逆时针加速收缩)
            ctx.save();
            ctx.rotate(-progress * Math.PI * 8); // 旋转四圈
            ctx.beginPath();
            const ringRadius = 150 - progress * 80; // 收缩的法阵
            ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 215, 0, ${0.2 + progress * 0.6})`;
            ctx.lineWidth = 3 + progress * 4;
            ctx.setLineDash([15, 15, 5, 15]);
            ctx.stroke();
            ctx.restore();
            
            // 2. 核心高光球 (随着汇聚越来越大，越来越亮)
            const coreRadius = this.radius * (0.5 + progress * 1.2);
            ctx.beginPath();
            ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius);
            grad.addColorStop(0, `rgba(255, 255, 255, ${progress})`);
            grad.addColorStop(0.5, `rgba(255, 215, 0, ${progress * 0.8})`);
            grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx.fillStyle = grad;
            ctx.fill();
            
            ctx.restore();
        }
    }
}
