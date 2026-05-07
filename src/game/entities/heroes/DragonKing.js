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
        this.needleFireTimer = 0;
        this.activeNeedles = [];
        this.moveSpeedBuffStacks = 0;
        
        // 隐忍值系统
        this.enduranceValue = 0;
        this.enduranceGainCooldown = 0;
        this.dragonAwakened = false;
        this.dragonAwakenLocked = false; // 是否已经触发过三年之期
        
        // 觉醒状态
        this.isUltimateActive = false;
        this.ultimateNeedles = [];
        this.ultimatePhase = 0; // 0: none, 1: rotating, 2: firing
        this.ultimateRotateTimer = 0;
        
        // 演出状态
        this.sidekickBalls = [];
        
        // 碰撞冷却
        this.lastCollisionTime = 0;
        
        // 特效状态
        this.burnTimer = 0;
        this.burnInterval = 0;
        this.ghostKnockTimer = 0;
        this.ghostKnockCount = 0;
        this.freezeTimer = 0;
        this.slowTimer = 0;
        
        // 额外音效可以这里预留，当前没有实际音频
        // this.awakenAudio = new Audio(...);
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
                
                if (this.enduranceValue >= 100) {
                    this.enduranceValue = 100;
                    this.triggerDragonReturn();
                }
            }
        }
    }
    
    triggerDragonReturn() {
        if (this.dragonAwakenLocked) return;
        this.dragonAwakenLocked = true;
        
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: '三年之期已到' });
            this.game.globalFreezeTime = 0.8; // 全场短暂停顿
            this.game.awakenCenter = { x: this.x, y: this.y };
            this.game.awakenRadius = 0;
            this.game.addFloatingText(this.x, this.y - 60, "三年之期已到！", '#ffd700');
        }
        
        this.mouthState = 'smile';
        
        // 生成配角球用于演出
        const angle = this.enemy ? Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x) : 0;
        const frontX = this.x + Math.cos(angle) * 80;
        const frontY = this.y + Math.sin(angle) * 80;
        const pX = Math.cos(angle + Math.PI / 2);
        const pY = Math.sin(angle + Math.PI / 2);
        
        this.sidekickBalls = [
            { x: frontX, y: frontY, life: 0.8 },
            { x: frontX + pX * 40, y: frontY + pY * 40, life: 0.8 },
            { x: frontX - pX * 40, y: frontY - pY * 40, life: 0.8 }
        ];
        
        // 强化效果延迟在 updateSpecific 中时停结束时应用
        this.pendingDragonAwaken = true;
    }
    
    onAwaken() {
        if (this.isUltimateActive) return;
        this.isUltimateActive = true;
        
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: '真太乙神针' });
        }
        
        this.mouthState = 'smile';
        
        // 生成五针
        const types = [
            { id: 'fire', color: '#ff4500', name: '烧山火' },
            { id: 'ice', color: '#00ffff', name: '透心凉' },
            { id: 'ghost', color: '#800080', name: '鬼敲门' },
            { id: 'gold', color: '#fffff0', name: '观音手' },
            { id: 'life', color: '#32cd32', name: '太乙针' }
        ];
        
        this.ultimateNeedles = [];
        for (let i = 0; i < 5; i++) {
            this.ultimateNeedles.push({
                type: types[i].id,
                color: types[i].color,
                angle: (i / 5) * Math.PI * 2,
                dist: 60,
                x: 0, y: 0,
                vx: 0, vy: 0,
                bounceCount: 0,
                maxBounceCount: 5,
                active: true,
                trail: []
            });
        }
        
        this.ultimatePhase = 1;
        this.ultimateRotateTimer = 1.0; // 旋转一周耗时1秒
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
    }
    
    updateSpecific(dt) {
        if (this.isDead) return;
        
        if (this.enduranceGainCooldown > 0) {
            this.enduranceGainCooldown -= dt;
        }
        
        if (this.smileTimer > 0) {
            this.smileTimer -= dt;
            if (this.smileTimer <= 0 && !this.dragonAwakened && !this.isUltimateActive) {
                this.mouthState = 'normal';
            }
        }
        
        // 三年之期演出结束判定
        if (this.pendingDragonAwaken && (!this.game || this.game.globalFreezeTime <= 0)) {
            this.pendingDragonAwaken = false;
            this.dragonAwakened = true;
            this.enduranceValue = 0;
            // 添加特效气场
            for(let i=0; i<20; i++) {
                this.game.addParticle({
                    x: this.x, y: this.y,
                    vx: (Math.random()-0.5)*150, vy: (Math.random()-0.5)*150,
                    color: '#ffd700', life: 1.0, size: 4
                });
            }
        }
        
        // 配角球更新
        for (let i = this.sidekickBalls.length - 1; i >= 0; i--) {
            this.sidekickBalls[i].life -= dt;
            if (this.sidekickBalls[i].life <= 0) {
                this.sidekickBalls.splice(i, 1);
            }
        }
        
        // 普通神针发射
        // 受击硬直或时停期间不发针
        if (!this.game || this.game.globalFreezeTime <= 0) {
            this.needleFireTimer -= dt;
            if (this.needleFireTimer <= 0) {
                this.fireNormalNeedle();
                this.needleFireTimer = 2.0;
            }
        }
        
        // 更新所有神针
        this.updateNeedles(dt, this.activeNeedles);
        
        // 更新觉醒五针
        if (this.isUltimateActive) {
            if (this.ultimatePhase === 1) {
                this.ultimateRotateTimer -= dt;
                const rotationSpeed = (Math.PI * 2) / 1.0; // 1秒转一圈
                
                for (const n of this.ultimateNeedles) {
                    n.angle += rotationSpeed * dt;
                    n.x = this.x + Math.cos(n.angle) * n.dist;
                    n.y = this.y + Math.sin(n.angle) * n.dist;
                    n.trail.push({ x: n.x, y: n.y, life: 0.2 });
                }
                
                if (this.ultimateRotateTimer <= 0) {
                    this.ultimatePhase = 2;
                    const speed = 100 * 8;
                    for (const n of this.ultimateNeedles) {
                        n.vx = Math.cos(n.angle) * speed;
                        n.vy = Math.sin(n.angle) * speed;
                    }
                }
            } else if (this.ultimatePhase === 2) {
                this.updateNeedles(dt, this.ultimateNeedles);
                if (this.ultimateNeedles.length === 0) {
                    this.isUltimateActive = false;
                    this.ultimatePhase = 0;
                    if (!this.dragonAwakened) {
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
                } else if (hitSelf && n.bounceCount > 0) {
                    // 反弹后命中自身
                    this.heal(5);
                    if (this.moveSpeedBuffStacks < 5) {
                        this.moveSpeedBuffStacks++;
                    }
                    this.mouthState = 'smile';
                    this.smileTimer = 0.5;
                    // 回流特效
                    for(let i=0; i<5; i++) {
                        this.game.addParticle({
                            x: this.x, y: this.y,
                            vx: (Math.random()-0.5)*50, vy: (Math.random()-0.5)*50,
                            color: '#32cd32', life: 0.5, size: 3
                        });
                    }
                    n.active = false;
                }
            } else {
                // 觉醒神针
                const canHitEnemy = n.type !== 'life';
                const canHitSelf = n.type === 'life' && n.bounceCount > 0;
                
                if (hitEnemy && canHitEnemy) {
                    this.applyUltimateNeedleEffect(n.type, this.enemy);
                    n.active = false;
                } else if (hitSelf && canHitSelf) {
                    this.heal(10);
                    // 特效
                    for(let i=0; i<10; i++) {
                        this.game.addParticle({
                            x: this.x, y: this.y,
                            vx: (Math.random()-0.5)*80, vy: (Math.random()-0.5)*80,
                            color: '#32cd32', life: 0.8, size: 4
                        });
                    }
                    n.active = false;
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
        
        // 隐忍值 UI
        if (!this.dragonAwakened && !this.isDead) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 4;
            ctx.stroke();
            
            if (this.enduranceValue > 0) {
                ctx.beginPath();
                const angle = (this.enduranceValue / 100) * Math.PI * 2;
                ctx.arc(0, 0, this.radius + 8, -Math.PI / 2, -Math.PI / 2 + angle);
                ctx.strokeStyle = this.enduranceValue >= 100 ? '#ffd700' : '#ff9900';
                ctx.lineWidth = 4;
                if (this.enduranceValue >= 80) {
                    ctx.shadowColor = '#ff9900';
                    ctx.shadowBlur = 5 + Math.sin(Date.now() / 100) * 5;
                }
                ctx.lineCap = 'round';
                ctx.stroke();
            }
            ctx.restore();
        }
        
        // 嘴巴表情 UI
        ctx.save();
        ctx.strokeStyle = '#ffd700'; // 金色嘴巴
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (this.mouthState === 'smile') {
            // 上扬弧线 (耐克嘴)
            ctx.arc(0, 10, 15, 0, Math.PI, false);
        } else {
            // 横线
            ctx.moveTo(-15, 10);
            ctx.lineTo(15, 10);
        }
        ctx.stroke();
        ctx.restore();
    }
    
    draw(ctx) {
        super.draw(ctx);
        
        if (!this.isDead) {
            // 绘制配角球
            for (const b of this.sidekickBalls) {
                ctx.save();
                ctx.translate(b.x, b.y);
                ctx.globalAlpha = b.life / 0.8;
                ctx.fillStyle = '#555';
                ctx.beginPath();
                ctx.arc(0, 0, 15, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            
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
                ctx.strokeStyle = n.color;
                ctx.globalAlpha = 0.5;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
                
                // 针本体
                if (n.active) {
                    ctx.save();
                    ctx.translate(n.x, n.y);
                    const angle = n.vx !== 0 || n.vy !== 0 ? Math.atan2(n.vy, n.vx) : n.angle || 0;
                    ctx.rotate(angle);
                    ctx.fillStyle = n.color;
                    ctx.shadowColor = n.color;
                    ctx.shadowBlur = 5;
                    ctx.fillRect(-10, -1.5, 20, 3); // 细长针
                    ctx.restore();
                }
            };
            
            this.activeNeedles.forEach(drawNeedle);
            this.ultimateNeedles.forEach(drawNeedle);
        }
    }
}
