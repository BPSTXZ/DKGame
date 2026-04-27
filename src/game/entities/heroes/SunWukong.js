import { Hero } from '../Hero.js';

export class SunWukong extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '猴哥';
        this.maxHp = 100;
        this.hp = 100;
        this.baseSpeed = 60;
        this.color = '#fbd73a';
        
        // 武器：金箍棒
        this.stickAngle = 0;
        this.stickBaseLength = this.radius * 3; // L0 (增加长度)
        this.stickMaxLength = 350; // Lmax 
        this.stickCurrentLength = this.stickBaseLength;
        this.stickBaseSpinSpeed = Math.PI * 2.0; // 常态旋转速度 (360度/秒)
        this.stickCurrentSpinSpeed = this.stickBaseSpinSpeed;
        this.stickOrbitRadius = this.radius + 10; // 棍子离单位中心的距离
        
        // 强化态
        this.isEnhanced = false;
        this.enhanceTimer = 0;
        this.enhanceCooldown = 4.0;
        this.enhanceProgressAngle = 0; // 记录强化态旋转进度
        
        // 伤害冷却
        this.hitCooldownTimer = 0;
        this.hitCooldownDuration = 0.2;
        
        // 被动：金刚不坏之身
        this.isGoldenBody = false;
        this.goldenBodyTimer = 0;
        this.goldenBodyWindow = 0.25; // 金刚不坏无敌持续窗口
        this.comboHitTimer = 0; // 连段攻击判定窗口
        this.comboHitWindow = 0.5; // 0.5秒内的受击被视为同一套连段攻击
        this.isGoldenBodyTriggeredInCombo = false; // 记录当前连段是否已经触发了金刚不坏
        
        // 觉醒：大闹天宫
        this.clones = [];
        this.awakenPhase = 0; // 0: off, 1: spreading, 2: wait, 3: striking, 4: fading
        this.awakenTimer = 0;
        
        // Audio
        this.selectAudioSrc = import.meta.env.BASE_URL + 'assets/audio/SunWukong/老孙来也.mp3';
        this.enhanceAudioSrc = import.meta.env.BASE_URL + 'assets/audio/SunWukong/一棒.mp3';
        this.hitAudioSrc = import.meta.env.BASE_URL + 'assets/audio/common/碰撞.mp3';
        this.enhanceHitAudioSrc = import.meta.env.BASE_URL + 'assets/audio/SunWukong/击中.mp3';
        this.awakenAudioSrc = import.meta.env.BASE_URL + 'assets/audio/SunWukong/大圣觉醒.mp3';
        this.cloneAudioSrc = import.meta.env.BASE_URL + 'assets/audio/SunWukong/妖怪哪里跑.mp3';
    }

    playSelectAudio() {
        if (this.selectAudioSrc) {
            const snd = new Audio(this.selectAudioSrc);
            snd.play().catch(e => console.warn('SunWukong select audio play failed:', e));
        }
    }

    playAwakenAudio() {
        if (this.awakenAudioSrc) {
            const snd = new Audio(this.awakenAudioSrc);
            snd.play().catch(e => console.warn('SunWukong awaken audio play failed:', e));
        }
    }
    
    // 覆盖 takeDamage 实现被动金刚不坏
    takeDamage(amount, sourceX, sourceY) {
        if (this.isDead || this.invincibleTime > 0) return;
        
        // 彩蛋判定：一拳超人的普通一拳或认真一拳 (极高伤害)，触发必定金刚不坏
        if (this.forceInvincibleOnPunch && amount >= 100) {
            this.isGoldenBody = true;
            this.goldenBodyTimer = this.goldenBodyWindow;
            this.game.addFloatingText(this.x, this.y - 40, "免疫", '#fbd73a');
            this.forceInvincibleOnPunch = false; // 彩蛋每次只生效一次
            return;
        }
        
        // 处于金刚不坏连段窗口中，或者当前连段已经触发过金刚不坏且在连段持续时间内
        if (this.isGoldenBody || (this.comboHitTimer > 0 && this.isGoldenBodyTriggeredInCombo)) {
            this.goldenBodyTimer = this.goldenBodyWindow; // 刷新金刚不坏窗口
            this.comboHitTimer = this.comboHitWindow; // 刷新连段窗口
            this.isGoldenBody = true; // 确保金刚不坏状态处于激活状态
            this.game.addFloatingText(this.x, this.y - 40, "免疫", '#fbd73a');
            return;
        }
        
        // 判断是否属于新的连段攻击（comboHitTimer <= 0 时视为第一下）
        if (this.comboHitTimer <= 0) {
            this.isGoldenBodyTriggeredInCombo = false; // 重置连段触发标记
            
            // 20% 概率触发金刚不坏
            if (Math.random() < 0.2) {
                this.isGoldenBody = true;
                this.goldenBodyTimer = this.goldenBodyWindow;
                this.comboHitTimer = this.comboHitWindow;
                this.isGoldenBodyTriggeredInCombo = true; // 标记当前连段已触发
                this.game.addFloatingText(this.x, this.y - 40, "金刚不坏!", '#fbd73a');
                
                // 爆气特效
                for(let i=0; i<15; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 100 + 50;
                    this.game.addParticle({
                        x: this.x, y: this.y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        color: '#fbd73a', life: 0.5, size: 3
                    });
                }
                return;
            }
        }
        
        // 没有触发金刚不坏，无论是第一下还是后续连段，正常受击并刷新连段计时
        this.comboHitTimer = this.comboHitWindow;
        super.takeDamage(amount, sourceX, sourceY);
    }
    
    updateSpecific(dt) {
        // 如果敌方是吸血鬼且正在吸附我们，或者我们身上带有吸血buff，也视为处于持续受击（连段）状态
        const isBeingSucked = this.enemy && this.enemy.name === '吸血鬼' && this.enemy.isSucking;
        const hasDrainBuff = this.buffs && this.buffs.some(b => b.type === 'vampire_drain');
        if (isBeingSucked || hasDrainBuff) {
            this.comboHitTimer = this.comboHitWindow;
        }

        // 更新连段攻击窗口
        if (this.comboHitTimer > 0) {
            this.comboHitTimer -= dt;
            if (this.comboHitTimer <= 0) {
                this.isGoldenBodyTriggeredInCombo = false; // 连段结束，重置标记
            }
        }
        
        // 更新金刚不坏状态
        if (this.isGoldenBody) {
            this.goldenBodyTimer -= dt;
            if (this.goldenBodyTimer <= 0) {
                this.isGoldenBody = false;
            }
        }
        
        // 更新伤害冷却
        if (this.hitCooldownTimer > 0) {
            this.hitCooldownTimer -= dt;
        }
        
        // 觉醒逻辑
        if (this.isAwakened) {
            this.updateAwaken(dt);
        } else {
            // 常态武器逻辑
            this.updateWeapon(dt);
        }
    }
    
    updateWeapon(dt) {
        if (this.isEnhanced) {
            // 强化态逻辑
            const spinDelta = this.stickCurrentSpinSpeed * dt;
            this.stickAngle -= spinDelta;
            this.enhanceProgressAngle += spinDelta;
            
            // 拖尾残影
            // 计算当前棍子近端坐标
            const stickBaseX = this.x + Math.cos(this.stickAngle) * this.stickOrbitRadius;
            const stickBaseY = this.y + Math.sin(this.stickAngle) * this.stickOrbitRadius;
            
            // 棍子朝向（切线加 30 度倾斜角）
            const stickDirAngle = this.stickAngle + Math.PI / 2 + Math.PI / 6;
            
            // 第一行：远端残影，最密集且最大，增强挥舞速度感
            if (Math.random() < 0.6) {
                this.game.addParticle({
                    x: stickBaseX + Math.cos(stickDirAngle) * (this.stickCurrentLength * 0.9),
                    y: stickBaseY + Math.sin(stickDirAngle) * (this.stickCurrentLength * 0.9),
                    vx: 0, vy: 0, color: 'rgba(251, 215, 58, 0.4)', life: 0.3, size: 8
                });
            }
            
            // 第二行：中远端残影，向近端增加的第一行，数量递减
            if (Math.random() < 0.3) {
                this.game.addParticle({
                    x: stickBaseX + Math.cos(stickDirAngle) * (this.stickCurrentLength * 0.7),
                    y: stickBaseY + Math.sin(stickDirAngle) * (this.stickCurrentLength * 0.7),
                    vx: 0, vy: 0, color: 'rgba(251, 215, 58, 0.4)', life: 0.25, size: 6
                });
            }
            
            // 第三行：中段残影，向近端增加的第二行，数量最少
            if (Math.random() < 0.15) {
                this.game.addParticle({
                    x: stickBaseX + Math.cos(stickDirAngle) * (this.stickCurrentLength * 0.5),
                    y: stickBaseY + Math.sin(stickDirAngle) * (this.stickCurrentLength * 0.5),
                    vx: 0, vy: 0, color: 'rgba(251, 215, 58, 0.4)', life: 0.2, size: 4
                });
            }
            
            if (this.enhanceProgressAngle < Math.PI) {
                // 前180度：伸长
                const progress = this.enhanceProgressAngle / Math.PI;
                this.stickCurrentLength = this.stickBaseLength + (this.stickMaxLength - this.stickBaseLength) * progress;
            } else if (this.enhanceProgressAngle < Math.PI * 3) {
                // 中间一圈 (360度)：保持最大长度旋转
                this.stickCurrentLength = this.stickMaxLength;
            } else if (this.enhanceProgressAngle < Math.PI * 4) {
                // 后180度：缩短
                const progress = (this.enhanceProgressAngle - Math.PI * 3) / Math.PI;
                this.stickCurrentLength = this.stickMaxLength - (this.stickMaxLength - this.stickBaseLength) * progress;
            } else {
                // 完成旋转
                this.isEnhanced = false;
                this.stickCurrentLength = this.stickBaseLength;
                this.stickCurrentSpinSpeed = this.stickBaseSpinSpeed;
                this.enhanceTimer = 0; // 重置冷却
            }
        } else {
            // 常态逻辑
            this.stickAngle -= this.stickCurrentSpinSpeed * dt;
            
            // 如果不在连段受击状态（即 comboHitTimer <= 0），才增加强化态进度
            if (this.comboHitTimer <= 0) {
                this.enhanceTimer += dt;
                if (this.enhanceTimer >= this.enhanceCooldown) {
                    this.triggerEnhance();
                }
            } else {
                // 处于连段受击状态，重置冷却时间，确保在连段结束后需要重新等待 0.5s（因为 comboHitTimer 会从 0.5 倒数）
                // 实际上连段结束的瞬间 comboHitTimer 为 0，而题目要求"连段伤害结束0.5s后立即触发，然后重新计时"
                // 所以我们只需保持 enhanceTimer 等于满值即可，等 comboHitTimer <= 0 时，上面逻辑会自动触发。
                // 但如果本来还没满，则不增长。
                // 如果已经满了，就等 comboHitTimer 归零再触发。
                if (this.enhanceTimer > this.enhanceCooldown) {
                    this.enhanceTimer = this.enhanceCooldown;
                }
            }
        }
        
        this.checkWeaponHit(this, this.stickAngle, this.stickCurrentLength, this.isEnhanced ? 8 : 4);
    }
    
    triggerEnhance() {
        if (this.game && !this.isEnhanced) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Enhance: Golden Stick' });
        }
        this.isEnhanced = true;
        this.enhanceProgressAngle = 0;
        this.stickCurrentSpinSpeed = this.stickBaseSpinSpeed * 1.5; // 旋转加速
        
        // 播放强化态触发音效
        if (this.enhanceAudioSrc) {
            const snd = new Audio(this.enhanceAudioSrc);
            snd.play().catch(e => console.warn('SunWukong enhance audio play failed:', e));
        }
        
        // 爆发力感特效
        for(let i=0; i<10; i++) {
            const stickBaseX = this.x + Math.cos(this.stickAngle) * this.stickOrbitRadius;
            const stickBaseY = this.y + Math.sin(this.stickAngle) * this.stickOrbitRadius;
            const stickDirAngle = this.stickAngle + Math.PI / 2 + Math.PI / 6;
            
            // 沿着棍子外侧散开
            const spreadAngle = stickDirAngle + (Math.random() - 0.5) * Math.PI / 4;
            const speed = Math.random() * 300 + 150;
            this.game.addParticle({
                x: stickBaseX + Math.cos(stickDirAngle) * (this.stickBaseLength), // 从棒身中后段爆发
                y: stickBaseY + Math.sin(stickDirAngle) * (this.stickBaseLength),
                vx: Math.cos(spreadAngle) * speed, vy: Math.sin(spreadAngle) * speed,
                color: '#fbd73a', life: 0.4, size: 5
            });
        }
    }
    
    checkWeaponHit(sourceEntity, angle, length, damage) {
        // 使用 sourceEntity 自身的冷却计时器，若无则初始化为 0
        if (sourceEntity.hitCooldownTimer === undefined) {
            sourceEntity.hitCooldownTimer = 0;
        }
        
        if (!this.enemy || this.enemy.isDead || sourceEntity.hitCooldownTimer > 0) return;
        
        // 棍子近端坐标 (围绕着单位中心外一圈轨道上)
        const stickBaseX = sourceEntity.x + Math.cos(angle) * this.stickOrbitRadius;
        const stickBaseY = sourceEntity.y + Math.sin(angle) * this.stickOrbitRadius;
        
        // 棍子的实际朝向（切线 + 30度倾角）
        const stickDirAngle = angle + Math.PI / 2 + Math.PI / 6;
        
        // 棍子的两个端点
        const p1 = {
            x: stickBaseX,
            y: stickBaseY
        };
        const p2 = {
            x: stickBaseX + Math.cos(stickDirAngle) * length,
            y: stickBaseY + Math.sin(stickDirAngle) * length
        };
        
        // 检查敌方圆是否与棍子线段相交
        if (this.game.physics.checkLineCircleCollision(p1.x, p1.y, p2.x, p2.y, this.enemy)) {
            // 命中
            this.enemy.takeDamage(damage * this.damageMultiplier, sourceEntity.x, sourceEntity.y);
            sourceEntity.hitCooldownTimer = this.hitCooldownDuration;
            
            // 播放击中音效
            const hitAudio = sourceEntity.isEnhanced ? this.enhanceHitAudioSrc : this.hitAudioSrc;
            if (hitAudio) {
                const snd = new Audio(hitAudio);
                snd.play().catch(e => console.warn('SunWukong hit audio play failed:', e));
            }
            
            // 额外的火花特效
            for(let i=0; i<5; i++) {
                const sparkAngle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 150 + 50;
                this.game.addParticle({
                    x: this.enemy.x, y: this.enemy.y,
                    vx: Math.cos(sparkAngle) * speed, vy: Math.sin(sparkAngle) * speed,
                    color: '#fff', life: 0.3, size: 2
                });
            }
        }
    }
    
    onAwaken() {
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Awaken: Clones' });
        }
        
        this.awakenPhase = 1;
        this.awakenTimer = 1.0; // 弹射1秒
        
        // 暂停常态棍子逻辑
        this.isEnhanced = false;
        this.stickCurrentLength = this.stickBaseLength;
        
        // 播放释放分身音效
        if (this.cloneAudioSrc) {
            const snd = new Audio(this.cloneAudioSrc);
            snd.play().catch(e => console.warn('SunWukong clone audio play failed:', e));
        }

        // 爆发金色云雾特效
        for(let j=0; j<30; j++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 200 + 50;
            this.game.addParticle({
                x: this.x, y: this.y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                color: Math.random() > 0.3 ? '#fbd73a' : '#ffffff', // 金白交织
                life: 0.8 + Math.random() * 0.4, 
                size: Math.random() * 12 + 6 // 更大的云雾感
            });
        }
        
        // 生成分身
        this.clones = [];
        const baseAngle = Math.random() * Math.PI * 2; // 随机一个基础角度
        for (let i = 0; i < 3; i++) {
            // 均匀分布 3 个分身 (每 120 度一个)
            const angle = baseAngle + (Math.PI * 2 / 3) * i;
            this.clones.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * 1000, // 初始高爆发速度
                vy: Math.sin(angle) * 1000,
                stickAngle: this.stickAngle,
                alpha: 0.5 // 半透明分身
            });
        }
    }
    
    updateAwaken(dt) {
        this.awakenTimer -= dt;
        
        if (this.awakenPhase === 1) {
            // 弹射阶段：先快后慢的线性减速
            const targetSpeed = 350; // 最终稳定保持的弹射速度
            this.clones.forEach(clone => {
                clone.x += clone.vx * dt;
                clone.y += clone.vy * dt;
                
                const currentSpeed = Math.hypot(clone.vx, clone.vy);
                if (currentSpeed > targetSpeed) {
                    // 每秒减速 1200，呈现线性先快后慢效果
                    const newSpeed = Math.max(targetSpeed, currentSpeed - 1200 * dt);
                    clone.vx = (clone.vx / currentSpeed) * newSpeed;
                    clone.vy = (clone.vy / currentSpeed) * newSpeed;
                }
                
                clone.stickAngle -= this.stickBaseSpinSpeed * dt;
                
                // 边界反弹
                if (clone.x < this.radius) { clone.x = this.radius; clone.vx *= -1; }
                if (clone.x > this.game.width - this.radius) { clone.x = this.game.width - this.radius; clone.vx *= -1; }
                if (clone.y < this.radius) { clone.y = this.radius; clone.vy *= -1; }
                if (clone.y > this.game.height - this.radius) { clone.y = this.game.height - this.radius; clone.vy *= -1; }
            });
            
            this.stickAngle -= this.stickBaseSpinSpeed * dt;
            
            if (this.awakenTimer <= 0) {
                this.awakenPhase = 2;
                this.awakenTimer = 1.0; // 等待1秒
            }
        } else if (this.awakenPhase === 2) {
            // 等待阶段，分身继续保持远动状态，而不是停在原地
            this.clones.forEach(clone => {
                clone.x += clone.vx * dt;
                clone.y += clone.vy * dt;
                
                // 边界反弹
                if (clone.x < this.radius) { clone.x = this.radius; clone.vx *= -1; }
                if (clone.x > this.game.width - this.radius) { clone.x = this.game.width - this.radius; clone.vx *= -1; }
                if (clone.y < this.radius) { clone.y = this.radius; clone.vy *= -1; }
                if (clone.y > this.game.height - this.radius) { clone.y = this.game.height - this.radius; clone.vy *= -1; }
                
                clone.stickAngle -= this.stickBaseSpinSpeed * dt;
            });
            this.stickAngle -= this.stickBaseSpinSpeed * dt;
            
            if (this.awakenTimer <= 0) {
                this.awakenPhase = 3;
                // 触发群体强化态
                this.triggerEnhance();
                this.clones.forEach(clone => {
                    clone.isEnhanced = true;
                    clone.enhanceProgressAngle = 0;
                    clone.stickCurrentLength = this.stickBaseLength;
                });
            }
        } else if (this.awakenPhase === 3) {
            // 群体强化态攻击阶段
            const spinDelta = this.stickCurrentSpinSpeed * dt;
            
            // 本体更新
            this.stickAngle -= spinDelta;
            this.enhanceProgressAngle += spinDelta;
            if (this.enhanceProgressAngle < Math.PI) {
                this.stickCurrentLength = this.stickBaseLength + (this.stickMaxLength - this.stickBaseLength) * (this.enhanceProgressAngle / Math.PI);
            } else if (this.enhanceProgressAngle < Math.PI * 3) {
                this.stickCurrentLength = this.stickMaxLength;
            } else if (this.enhanceProgressAngle < Math.PI * 4) {
                this.stickCurrentLength = this.stickMaxLength - (this.stickMaxLength - this.stickBaseLength) * ((this.enhanceProgressAngle - Math.PI * 3) / Math.PI);
            }
            this.checkWeaponHit(this, this.stickAngle, this.stickCurrentLength, 8);
            
            // 分身更新
            let finished = false;
            this.clones.forEach(clone => {
                // 独立更新分身的伤害冷却
                if (clone.hitCooldownTimer > 0) {
                    clone.hitCooldownTimer -= dt;
                }
                
                // 攻击阶段继续保持运动
                clone.x += clone.vx * dt;
                clone.y += clone.vy * dt;
                if (clone.x < this.radius) { clone.x = this.radius; clone.vx *= -1; }
                if (clone.x > this.game.width - this.radius) { clone.x = this.game.width - this.radius; clone.vx *= -1; }
                if (clone.y < this.radius) { clone.y = this.radius; clone.vy *= -1; }
                if (clone.y > this.game.height - this.radius) { clone.y = this.game.height - this.radius; clone.vy *= -1; }
                
                clone.stickAngle -= spinDelta;
                clone.enhanceProgressAngle += spinDelta;
                if (clone.enhanceProgressAngle < Math.PI) {
                    clone.stickCurrentLength = this.stickBaseLength + (this.stickMaxLength - this.stickBaseLength) * (clone.enhanceProgressAngle / Math.PI);
                } else if (clone.enhanceProgressAngle < Math.PI * 3) {
                    clone.stickCurrentLength = this.stickMaxLength;
                } else if (clone.enhanceProgressAngle < Math.PI * 4) {
                    clone.stickCurrentLength = this.stickMaxLength - (this.stickMaxLength - this.stickBaseLength) * ((clone.enhanceProgressAngle - Math.PI * 3) / Math.PI);
                } else {
                    finished = true;
                }
                this.checkWeaponHit(clone, clone.stickAngle, clone.stickCurrentLength, 8);
            });
            
            if (this.enhanceProgressAngle >= Math.PI * 4 || finished) {
                this.awakenPhase = 4;
                this.awakenTimer = 1.0; // 渐隐1秒
                this.isEnhanced = false;
                this.stickCurrentLength = this.stickBaseLength;
                this.stickCurrentSpinSpeed = this.stickBaseSpinSpeed;
                this.enhanceTimer = 0; // 觉醒后重置循环
            }
        } else if (this.awakenPhase === 4) {
            // 渐隐阶段
            this.clones.forEach(clone => {
                clone.x += clone.vx * dt;
                clone.y += clone.vy * dt;
                if (clone.x < this.radius) { clone.x = this.radius; clone.vx *= -1; }
                if (clone.x > this.game.width - this.radius) { clone.x = this.game.width - this.radius; clone.vx *= -1; }
                if (clone.y < this.radius) { clone.y = this.radius; clone.vy *= -1; }
                if (clone.y > this.game.height - this.radius) { clone.y = this.game.height - this.radius; clone.vy *= -1; }
                
                clone.alpha -= dt;
                clone.stickAngle -= this.stickBaseSpinSpeed * dt;
                
                // 散成小光点特效
                if (Math.random() < 0.2) {
                    this.game.addParticle({
                        x: clone.x + (Math.random() - 0.5) * 20,
                        y: clone.y + (Math.random() - 0.5) * 20,
                        vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50,
                        color: '#fbd73a', life: 0.5, size: 2
                    });
                }
            });
            this.stickAngle -= this.stickBaseSpinSpeed * dt;
            
            if (this.awakenTimer <= 0) {
                this.isAwakened = false;
                this.clones = [];
                this.awakenPhase = 0;
            }
        }
    }
    
    draw(ctx) {
        super.draw(ctx);
        
        // 绘制分身及其金箍棒（在世界坐标系下独立绘制，不受本体受击形变、震动和偏移的影响）
        if (this.clones && this.clones.length > 0) {
            ctx.save();
            this.clones.forEach(clone => {
                if (clone.alpha <= 0) return;
                ctx.save();
                ctx.translate(clone.x, clone.y);
                ctx.globalAlpha = clone.alpha;
                
                // 画分身本体
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = this.playerId === 1 ? '#ff4444' : '#4444ff';
                ctx.stroke();
                
                // 画分身金箍棒
                this.drawStick(ctx, 0, 0, clone.stickAngle, clone.stickCurrentLength || this.stickBaseLength, clone.alpha);
                
                ctx.restore();
            });
            ctx.restore();
        }
    }
    
    drawBody(ctx) {
        super.drawBody(ctx);
        
        // 绘制被动光晕
        if (this.isGoldenBody) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10 + Math.sin(Date.now()/50)*5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(251, 215, 58, 0.6)';
            ctx.lineWidth = 4;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 20 + Math.cos(Date.now()/50)*5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(251, 215, 58, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }
        
        // 绘制本体金箍棒
        this.drawStick(ctx, 0, 0, this.stickAngle, this.stickCurrentLength, 1.0);
    }
    
    drawStick(ctx, cx, cy, angle, length, alpha) {
        ctx.save();
        
        // 计算棍子靠近端的位置
        const stickBaseX = cx + Math.cos(angle) * this.stickOrbitRadius;
        const stickBaseY = cy + Math.sin(angle) * this.stickOrbitRadius;
        
        ctx.translate(stickBaseX, stickBaseY);
        // 切线方向倾斜，增加一个偏移角度使其呈现一头近一头远的倾斜效果
        ctx.rotate(angle + Math.PI / 2 + Math.PI / 6);
        ctx.globalAlpha = alpha;
        
        const thickness = length > this.stickBaseLength ? 12 : 8;
        
        // --- 新增：物理弯曲与形变计算 ---
        const progress = Math.max(0, (length - this.stickBaseLength) / (this.stickMaxLength - this.stickBaseLength));
        // 峰值时 0.15~0.25 倍棍长的弹性弧度，增加一定的随机抖动感 (使用 angle 替代 Math.random 以防止暂停时晃动)
        const jitter = (Math.sin(angle * 15) + Math.sin(angle * 27)) / 2; // -1 到 1 的伪随机振荡
        const maxBendRatio = 0.2 + jitter * 0.05; 
        // 逆时针旋转时，根据物理规律应向反方向弯曲，这里将弯曲方向反转 (设为负值)
        const bendY = -length * maxBendRatio * progress;
        
        const cpX = length / 2;
        const cpY = 2 * bendY; // 使二次贝塞尔曲线顶点通过 bendY
        
        // 基础粗细保持不变，末端(尖端)放大 1.2 倍
        const baseThick = thickness;
        const endThick = thickness * (1 + 1.2 * progress); // 末端放大，最高额外放大 1.2 倍 (即达到原本的 2.2 倍，呈现强烈透视感)
        
        ctx.beginPath();
        if (progress > 0.05) {
            // 强化态弯曲形变绘制
            const baseAngle = Math.atan2(cpY, cpX);
            const tipAngle = Math.atan2(-cpY, length - cpX);
            
            const cpTopY = cpY - (baseThick + endThick) / 4;
            const cpBottomY = cpY + (baseThick + endThick) / 4;
            
            // Base top (计算基于法线的偏移)
            const baseTopX = 0 + baseThick/2 * Math.cos(baseAngle - Math.PI/2);
            const baseTopY = 0 + baseThick/2 * Math.sin(baseAngle - Math.PI/2);
            ctx.moveTo(baseTopX, baseTopY);
            
            // Top curve
            const tipTopX = length + endThick/2 * Math.cos(tipAngle - Math.PI/2);
            const tipTopY = 0 + endThick/2 * Math.sin(tipAngle - Math.PI/2);
            ctx.quadraticCurveTo(cpX, cpTopY, tipTopX, tipTopY);
            
            // Tip cap (顺时针绘制末端半圆)
            ctx.arc(length, 0, endThick/2, tipAngle - Math.PI/2, tipAngle + Math.PI/2);
            
            // Bottom curve
            const baseBotX = 0 + baseThick/2 * Math.cos(baseAngle + Math.PI/2);
            const baseBotY = 0 + baseThick/2 * Math.sin(baseAngle + Math.PI/2);
            ctx.quadraticCurveTo(cpX, cpBottomY, baseBotX, baseBotY);
            
            // Base cap (顺时针绘制近端半圆)
            ctx.arc(0, 0, baseThick/2, baseAngle + Math.PI/2, baseAngle + 3*Math.PI/2);
        } else {
            // 常态直棍
            if (ctx.roundRect) {
                ctx.roundRect(0, -baseThick/2, length, baseThick, baseThick/2);
            } else {
                ctx.rect(0, -baseThick/2, length, baseThick);
            }
        }
        
        // 金箍棒材质渐变
        const grad = ctx.createLinearGradient(0, 0, length, 0);
        grad.addColorStop(0, '#fff3a1');   // 近端高光
        grad.addColorStop(0.05, '#fbd73a'); // 近端金箍
        grad.addColorStop(0.15, '#e63946'); // 红色棒身
        grad.addColorStop(0.85, '#e63946');
        grad.addColorStop(0.95, '#fbd73a'); // 远端金箍
        grad.addColorStop(1, '#fff3a1');   // 远端高光
        
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        ctx.restore();
    }
}
