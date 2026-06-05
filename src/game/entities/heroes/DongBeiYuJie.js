import { Hero } from '../Hero.js';

export class DongBeiYuJie extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '东北雨姐';
        this.maxHp = 100;
        this.hp = 100;
        this.baseSpeed = 60;
        this.color = '#e91e63'; 
        
        this.imgBody = new Image();
        this.imgBody.src = import.meta.env.BASE_URL + 'assets/img/B18.png';
        
        this.imgFoot = new Image();
        this.imgFoot.src = import.meta.env.BASE_URL + 'assets/img/B17.png';
        
        // 音效
        this.skillAudioSrc = import.meta.env.BASE_URL + 'assets/audio/DongBeiYuJie/带派不.mp3';
        this.selectAudioSrc = import.meta.env.BASE_URL + 'assets/audio/DongBeiYuJie/带派不.mp3'; // 暂用
        
        this.lastCollisionTime = 0;
        
        // Skill 1
        this.skillState = 'ready'; 
        this.skillTimer = 0;
        this.skillCooldown = 2.0;
        this.skillDuration = 3.0;
        
        // 尝试从调试配置中读取参数
        if (this.game && this.game.debugConfig && this.game.debugConfig.enabled) {
            const tuning = this.game.debugConfig.skillTuning[this.playerId === 1 ? 'p1' : 'p2'];
            if (tuning) {
                if (tuning.skillCooldown !== undefined) this.skillCooldown = tuning.skillCooldown;
                if (tuning.skillDuration !== undefined) this.skillDuration = tuning.skillDuration;
            }
        }
        
        this.footLength = 0;
        this.targetFootLength = 0;
        this.currentFootLength = 0;
        this.footDir = {x: 1, y: 0};
        this.footAngle = 0;
        this.footTier = 0;
        this.footR = 10;
        this.footDamagePerTick = 0;
        
        this.tickTimer = 0;
        this.dmgAccumulator = 0;
        this.floatTextTimer = 0;
        
        // Awaken
        this.awakenState = 'off';
        this.awakenTimer = 0;
        this.awakenFeet = [];
    }

    isCurrentlyControlled() {
        const hasControlBuff = this.buffs.some(b => 
            b.type === 'paralyze' || 
            b.type === 'vampire_drain' || 
            b.type === 'van_suppressed'
        );
        return hasControlBuff || this.knockbackTimer > 0;
    }

    onHeroCollision(other) {
        super.onHeroCollision(other);
        if (this.isDead || other.isDead) return;
        
        const now = Date.now();
        if (now - this.lastCollisionTime > 1000) {
            this.lastCollisionTime = now;
            other.takeDamage(2 * this.damageMultiplier, this.x, this.y);
        }
    }

    updateSpecific(dt) {
        if (this.isDead) return;
        
        if (this.enemy && !this.enemy.isDead) {
            this.visualRotation = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
        } else {
            this.visualRotation = Math.atan2(this.vy, this.vx);
        }
        
        if (this.isAwakened) {
            this.updateAwaken(dt);
        } else {
            this.updateSkill(dt);
        }
    }

    playSkillAudio() {
        if (this.skillAudioSrc) {
            const snd = new Audio(this.skillAudioSrc);
            snd.volume = 1.0;
            snd.play().catch(e => console.warn('DongBeiYuJie skill audio play failed:', e));
        }
    }

    updateSkill(dt) {
        if (this.enemy && !this.enemy.isDead && this.skillState !== 'ready' && this.skillState !== 'cooldown') {
            // 持续追踪敌方方向
            const dx = this.enemy.x - this.x;
            const dy = this.enemy.y - this.y;
            const dist = Math.hypot(dx, dy);
            this.footAngle = Math.atan2(dy, dx);
            if (dist > 0) {
                this.footDir = { x: dx / dist, y: dy / dist };
            } else {
                this.footDir = { x: 1, y: 0 };
            }
        }
        
        // 动态调整长度，不再完全锁定
        if (this.skillState === 'active' && this.enemy && !this.enemy.isDead) {
            const dx = this.enemy.x - this.x;
            const dy = this.enemy.y - this.y;
            this.targetFootLength = Math.hypot(dx, dy);
        }
        
        if (this.skillState === 'ready') {
            if (!this.isCurrentlyControlled() && this.enemy && !this.enemy.isDead) {
                this.skillState = 'windup';
                this.skillTimer = 0.15;
                
                const dx = this.enemy.x - this.x;
                const dy = this.enemy.y - this.y;
                const dist = Math.hypot(dx, dy);
                this.footAngle = Math.atan2(dy, dx);
                if (dist > 0) {
                    this.footDir = { x: dx / dist, y: dy / dist };
                } else {
                    this.footDir = { x: 1, y: 0 };
                }
                this.targetFootLength = dist;
                
                // 动态根据距离计算伤害分档
                const S = 600;
                const t = Math.max(0, Math.min(1, this.targetFootLength / S));
                this.footR = 10 + (30 - 10) * t;
                
                if (this.targetFootLength < 0.28 * S) {
                    this.footTier = 0; 
                    this.footDamagePerTick = 0.4;
                } else if (this.targetFootLength < 0.48 * S) {
                    this.footTier = 1; 
                    this.footDamagePerTick = 1.2;
                } else {
                    this.footTier = 2; 
                    this.footDamagePerTick = 1.8;
                }
                
                // 为了避免从0出现的闪动，起始长度设为能够覆盖到球体边缘的大小（通常是 radius 乘以某个比例，这里设定为 40）
                this.currentFootLength = 40;
                this.tickTimer = 0;
                this.dmgAccumulator = 0;
                this.floatTextTimer = 0;
            }
        } else if (this.skillState === 'windup') {
            this.skillTimer -= dt;
            const progress = 1 - Math.max(0, this.skillTimer / 0.15);
            // 前摇期间保持初始大小，轻微膨胀
            this.currentFootLength = 40 + 10 * progress;
            if (this.skillTimer <= 0) {
                this.skillState = 'extend';
                this.skillTimer = 0.25;
            }
        } else if (this.skillState === 'extend') {
            this.skillTimer -= dt;
            const progress = 1 - Math.max(0, this.skillTimer / 0.25);
            // 从 50（前摇结束时的长度）插值到目标长度
            this.currentFootLength = 50 + (this.targetFootLength - 50) * progress;
            this.checkFootDamage(dt);
            
            // 技能一：散发脚气特效
            if (this.game && Math.random() < 0.4) {
                const endX = this.x + this.footDir.x * (this.radius + this.currentFootLength);
                const endY = this.y + this.footDir.y * (this.radius + this.currentFootLength);
                // 在脚尖附近生成
                this.game.addParticle({
                    x: endX + (Math.random() - 0.5) * 40,
                    y: endY + (Math.random() - 0.5) * 40,
                    vx: (Math.random() - 0.5) * 30,
                    vy: -Math.random() * 50 - 20, // 向上飘动
                    color: Math.random() > 0.5 ? '#98fb98cb' : '#8b4513b2', // 浅绿或土黄的气味
                    life: 0.8 + Math.random() * 0.5,
                    size: Math.random() * 10 + 5,
                    alpha: 0.4
                });
            }

            if (this.skillTimer <= 0) {
                this.skillState = 'active';
                this.skillTimer = this.skillDuration;
                // 汗脚伸出到位后播放音效
                this.playSkillAudio();
            }
        } else if (this.skillState === 'active') {
            this.skillTimer -= dt;
            this.currentFootLength = this.targetFootLength;
            
            // 在 active 阶段实时更新伤害分档，因为长度可能会变化
            const S = 600;
            const t = Math.max(0, Math.min(1, this.targetFootLength / S));
            this.footR = 10 + (30 - 10) * t;
            if (this.targetFootLength < 0.28 * S) {
                this.footDamagePerTick = 0.4;
            } else if (this.targetFootLength < 0.48 * S) {
                this.footDamagePerTick = 1.2;
            } else {
                this.footDamagePerTick = 1.8;
            }
            
            this.checkFootDamage(dt);
            
            // 技能一：持续阶段散发脚气特效
            if (this.game && Math.random() < 0.3) {
                const endX = this.x + this.footDir.x * (this.radius + this.currentFootLength);
                const endY = this.y + this.footDir.y * (this.radius + this.currentFootLength);
                this.game.addParticle({
                    x: endX + (Math.random() - 0.5) * 60,
                    y: endY + (Math.random() - 0.5) * 60,
                    vx: (Math.random() - 0.5) * 40,
                    vy: -Math.random() * 60 - 30,
                    color: Math.random() > 0.5 ? '#98fb98' : '#8b4513',
                    life: 1.0 + Math.random() * 0.5,
                    size: Math.random() * 15 + 8,
                    alpha: 0.3
                });
            }

            if (this.skillTimer <= 0) {
                this.skillState = 'retract';
                this.skillTimer = 0.2;
            }
        } else if (this.skillState === 'retract') {
            this.skillTimer -= dt;
            const progress = 1 - Math.max(0, this.skillTimer / 0.2); // 0 -> 1
            // 长度线性收回到 40，而不是完全为 0
            this.currentFootLength = this.targetFootLength - (this.targetFootLength - 40) * progress;
            if (this.skillTimer <= 0) {
                this.skillState = 'cooldown';
                this.skillTimer = this.skillCooldown;
            }
        } else if (this.skillState === 'cooldown') {
            this.skillTimer -= dt;
            if (this.skillTimer <= 0) {
                this.skillState = 'ready';
            }
        }
    }

    getPointToLineDistance(px, py, x1, y1, x2, y2) {
        const l2 = (x2-x1)**2 + (y2-y1)**2;
        if (l2 === 0) return Math.hypot(px-x1, py-y1);
        let t = ((px-x1)*(x2-x1) + (py-y1)*(y2-y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t*(x2-x1)), py - (y1 + t*(y2-y1)));
    }

    checkFootDamage(dt) {
        if (!this.enemy || this.enemy.isDead) return;
        
        const startX = this.x + this.footDir.x * this.radius;
        const startY = this.y + this.footDir.y * this.radius;
        const endX = startX + this.footDir.x * this.currentFootLength;
        const endY = startY + this.footDir.y * this.currentFootLength;
        
        const dist = this.getPointToLineDistance(this.enemy.x, this.enemy.y, startX, startY, endX, endY);
        if (dist <= this.enemy.radius + this.footR) {
            this.tickTimer += dt;
            if (this.tickTimer >= 0.2) {
                this.tickTimer -= 0.2;
                const actualDmg = this.footDamagePerTick * this.damageMultiplier * (1 - this.enemy.getDamageReduction());
                this.enemy.hp -= actualDmg;
                this.enemy.damageBlinkTime = 0.2;
                this.dmgAccumulator += actualDmg;
                if (this.enemy.hp <= 0.001 && !this.enemy.isDead) {
                    this.enemy.hp = 0;
                    this.enemy.die();
                }
            }
            
            this.floatTextTimer += dt;
            if (this.floatTextTimer >= 0.4) {
                this.floatTextTimer -= 0.4;
                if (this.dmgAccumulator > 0) {
                    if (this.game && this.game.addFloatingText) {
                        this.game.addFloatingText(this.enemy.x, this.enemy.y - 30, `-${this.dmgAccumulator.toFixed(1)}`, '#ff4444');
                    }
                    this.dmgAccumulator = 0;
                }
            }
            
            if (Math.random() < 0.3 && this.game) {
                this.game.addParticle({
                    x: this.enemy.x + (Math.random() - 0.5) * this.enemy.radius,
                    y: this.enemy.y - this.enemy.radius,
                    vx: 0, vy: -50,
                    color: '#87CEFA',
                    life: 0.3, size: 3
                });
            }
        }
    }

    onAwaken() {
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Awaken: 四方带派' });
        }
        this.awakenState = 'warning';
        this.awakenTimer = 0.25;
        this.awakenFeet = [];
        
        const S = 600; // Game dimension
        const midLength = 0.55 * S; // 330
        
        const createFoot = (sx, sy, ang) => {
            this.awakenFeet.push({
                startX: sx, startY: sy,
                dirX: Math.cos(ang), dirY: Math.sin(ang),
                angle: ang,
                targetLength: midLength,
                currentLength: 40, // 初始长度设为 40 避免视觉闪烁
                tickTimer: 0,
                dmgAccumulator: 0,
                floatTextTimer: 0
            });
        };
        
        createFoot(S / 2, -10, Math.PI / 2);
        createFoot(S / 2, S + 10, -Math.PI / 2);
        createFoot(-10, S / 2, 0);
        createFoot(S + 10, S / 2, Math.PI);
    }

    updateAwaken(dt) {
        // 动态更新所有脚的角度和方向，使其始终朝向敌方
        if (this.enemy && !this.enemy.isDead && this.awakenState !== 'off' && this.awakenState !== 'retract') {
            this.awakenFeet.forEach(f => {
                const dx = this.enemy.x - f.startX;
                const dy = this.enemy.y - f.startY;
                const dist = Math.hypot(dx, dy);
                f.angle = Math.atan2(dy, dx);
                if (dist > 0) {
                    f.dirX = dx / dist;
                    f.dirY = dy / dist;
                }
                // 动态调整长度，使脚始终正好伸到敌人位置
                f.targetLength = dist;
            });
        }
        
        if (this.awakenState === 'warning') {
            this.awakenTimer -= dt;
            if (this.awakenTimer <= 0) {
                this.awakenState = 'extend';
                this.awakenTimer = 0.2;
            }
        } else if (this.awakenState === 'extend') {
            this.awakenTimer -= dt;
            const progress = 1 - Math.max(0, this.awakenTimer / 0.2);
            this.awakenFeet.forEach(f => {
                f.currentLength = 40 + (f.targetLength - 40) * progress;
                this.checkAwakenFootDamage(f, dt);
                
                // 觉醒：伸展阶段气味
                if (this.game && Math.random() < 0.2) {
                    const endX = f.startX + f.dirX * f.currentLength;
                    const endY = f.startY + f.dirY * f.currentLength;
                    this.game.addParticle({
                        x: endX, y: endY,
                        vx: (Math.random()-0.5)*30, vy: -Math.random()*40-20,
                        color: '#98fb98cb', life: 0.8, size: 10, alpha: 0.3
                    });
                }
            });
            if (this.awakenTimer <= 0) {
                this.awakenState = 'active';
                this.awakenTimer = 5.0;

                // 四只脚伸出到位后混插播放四次，营造爆炸混乱效果
                for (let i = 0; i < 4; i++) {
                    setTimeout(() => {
                        this.playSkillAudio();
                    }, i * 100); // 间隔100ms快速混插
                }
            }
        } else if (this.awakenState === 'active') {
            this.awakenTimer -= dt;
            this.awakenFeet.forEach(f => {
                f.currentLength = f.targetLength;
                this.checkAwakenFootDamage(f, dt);
                
                // 觉醒：持续阶段气味
                if (this.game && Math.random() < 0.15) {
                    const endX = f.startX + f.dirX * f.currentLength;
                    const endY = f.startY + f.dirY * f.currentLength;
                    this.game.addParticle({
                        x: endX, y: endY,
                        vx: (Math.random()-0.5)*40, vy: -Math.random()*50-30,
                        color: '#8b4513b2', life: 1.2, size: 15, alpha: 0.25
                    });
                }
            });
            if (this.awakenTimer <= 0) {
                this.awakenState = 'retract';
                this.awakenTimer = 0.2;
            }
        } else if (this.awakenState === 'retract') {
            this.awakenTimer -= dt;
            const progress = 1 - Math.max(0, this.awakenTimer / 0.2); // 0 -> 1
            this.awakenFeet.forEach(f => {
                f.currentLength = f.targetLength - (f.targetLength - 40) * progress;
            });
            if (this.awakenTimer <= 0) {
                this.isAwakened = false;
                this.awakenState = 'off';
            }
        }
    }

    checkAwakenFootDamage(f, dt) {
        if (!this.enemy || this.enemy.isDead) return;
        
        const endX = f.startX + f.dirX * f.currentLength;
        const endY = f.startY + f.dirY * f.currentLength;
        
        const footR = 20; // Mid foot radius
        
        const dist = this.getPointToLineDistance(this.enemy.x, this.enemy.y, f.startX, f.startY, endX, endY);
        if (dist <= this.enemy.radius + footR) {
            f.tickTimer += dt;
            if (f.tickTimer >= 0.2) {
                f.tickTimer -= 0.2;
                // 每秒 2 点，每 tick (0.2s) 就是 0.4 点
                const actualDmg = 0.4 * this.damageMultiplier * (1 - this.enemy.getDamageReduction());
                this.enemy.hp -= actualDmg;
                this.enemy.damageBlinkTime = 0.2;
                f.dmgAccumulator += actualDmg;
                if (this.enemy.hp <= 0.001 && !this.enemy.isDead) {
                    this.enemy.hp = 0;
                    this.enemy.die();
                }
            }
            
            f.floatTextTimer += dt;
            if (f.floatTextTimer >= 0.4) {
                f.floatTextTimer -= 0.4;
                if (f.dmgAccumulator > 0) {
                    if (this.game && this.game.addFloatingText) {
                        this.game.addFloatingText(this.enemy.x, this.enemy.y - 30, `-${f.dmgAccumulator.toFixed(1)}`, '#ff4444');
                    }
                    f.dmgAccumulator = 0;
                }
            }
            
            if (Math.random() < 0.3 && this.game) {
                this.game.addParticle({
                    x: this.enemy.x + (Math.random() - 0.5) * this.enemy.radius,
                    y: this.enemy.y - this.enemy.radius,
                    vx: 0, vy: -50,
                    color: '#87CEFA',
                    life: 0.3, size: 3
                });
            }
        }
    }

    drawBody(ctx) {
        ctx.save();
        
        // 前摇挤压形变
        if (this.skillState === 'windup') {
            const p = 1 - (this.skillTimer / 0.15); // 0 -> 1
            ctx.rotate(this.footAngle);
            // 沿伸出方向挤压
            ctx.scale(1 - 0.08 * p, 1 + 0.06 * p);
            ctx.rotate(-this.footAngle);
        } else if (this.skillState === 'active') {
            // 持续阶段轻微呼吸
            const bounce = Math.sin(Date.now() / 150) * 0.03;
            ctx.scale(1 + bounce, 1 + bounce);
        }
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.clip();
        
        if (this.imgBody.complete) {
            ctx.drawImage(this.imgBody, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
        } else {
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.playerId === 1 ? '#ff4444' : '#4444ff';
        ctx.stroke();
        ctx.restore();
    }


    /**
     * 绘制透视拉伸效果的大汗脚
     * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
     * @param {number} length - 汗脚当前伸出的总长度
     * @param {number} footR - 当前伤害判定范围的半径（也会用来影响脚底板的渲染大小）
     * @param {boolean} isAwaken - 是否是觉醒状态（觉醒状态起点从场地边缘开始，常态从球体开始）
     */
    drawStretchedFoot(ctx, length, footR, isAwaken = false) {
        if (!this.imgFoot.complete || length <= 0) return;
        const W = this.imgFoot.width;
        const H = this.imgFoot.height;
        if (W === 0 || H === 0) return;
        
        // --- [调整点1：起点位置] ---
        // startX 决定了脚部贴图从哪里开始绘制。
        // 常态下设为 -60，为了让脚看起来从球体内部/表面伸出。
        // 觉醒状态下为了让脚从屏幕边缘伸出，调整一个负数偏移（例如 -120），以便将裤腿的粗大断口隐藏在屏幕外面。
        const startX = isAwaken ? -120 : -60; 
        const totalL = length;
        
        ctx.save();
        ctx.translate(startX, 0);
        
        // --- [调整点2：透视缩放比例] ---
        const scaleX = totalL / W;
        const scaleY = (footR * 12) / H; 
        
        // --- [调整点3：呼吸抖动效果] ---
        let bounce = 0;
        if (this.skillState === 'active' || this.awakenState === 'active') {
            bounce = Math.sin(Date.now() / 100) * 0.02;
        }
        
        // 应用最终的缩放变换
        ctx.scale(scaleX, scaleY * (1 + bounce));
        
        // --- [调整点4：图片绘制锚点] ---
        // 根据素材 B17.png 腿根不在图片的左侧边缘且带有透明区，
        // Y 轴使用 -450 偏移使其视觉居中。
        ctx.drawImage(this.imgFoot, 0, -450, W, H);
        
        ctx.restore();
    }

    drawOverlay(ctx) {
        super.drawOverlay(ctx);
        
        if ((this.skillState === 'ready' || this.skillState === 'cooldown') && this.imgFoot.complete) {
            ctx.save();
            ctx.translate(this.x, this.y);
            // 默认贴图旋转朝向敌人，跟随本体方向
            ctx.rotate(this.visualRotation);
            ctx.drawImage(this.imgFoot, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
            ctx.restore();
        } else if (this.skillState !== 'ready' && this.skillState !== 'cooldown' && this.imgFoot.complete && !this.isAwakened) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.footAngle);
            this.drawStretchedFoot(ctx, this.currentFootLength, this.footR, false);
            ctx.restore();
        }
        
        if (this.isAwakened && this.awakenState !== 'off') {
            this.awakenFeet.forEach(f => {
                if (f.currentLength > 0) {
                    ctx.save();
                    ctx.translate(f.startX, f.startY);
                    ctx.rotate(f.angle);
                    this.drawStretchedFoot(ctx, f.currentLength, 20, true);
                    ctx.restore();
                }
            });
            
            if (this.awakenState === 'warning') {
                this.awakenFeet.forEach(f => {
                    ctx.save();
                    ctx.translate(f.startX, f.startY);
                    ctx.rotate(f.angle);
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    // 预警框的长度保持足够长以覆盖场地，起点稍微往后缩一点
                    ctx.fillRect(-50, -20, f.targetLength + 100, 40);
                    ctx.restore();
                });
            }
        }
    }
}
