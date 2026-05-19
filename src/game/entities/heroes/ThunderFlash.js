import { Hero } from '../Hero.js';

export class ThunderFlash extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '雷霆闪';
        this.maxHp = 100;
        this.hp = 100;
        this.baseSpeed = 60;
        this.color = '#1a237e'; // 深蓝靛青球体
        this.strokeColor = '#00ffff'; // 电蓝描边
        
        // Skill 1: Thunder Flash
        this.isCharging = false;
        this.chargeTimer = 0;
        this.maxChargeTime = 0.3;
        this.isDashing = false;
        this.dashSpeedMult = 1.0;
        this.dashCooldown = 0;
        this.skillCooldown = 0; // 技能一冷却时间
        this.hasHitEnemy = false;
        this.wallNormal = { x: 0, y: 0 };
        this.timeSinceLastChargeStart = 0;
        
        // Skill 2: Free Acceleration
        this.isFreeAccel = false;
        this.freeAccelTimer = 0;
        
        // Awakening: 8-Combo
        this.isAwakenCombo = false;
        this.comboCount = 0;
        this.maxCombo = 8;
        
        // Visuals
        this.afterImages = [];
        this.chargeFlash = false;
        
        // Disable regular hero collision bounce when dashing
        this.ignoreHeroCollisionBounce = false;
        
        // Audio (if needed, but not specified, so we'll use common or none)
        // this.chargeAudio = ...
    }
    
    isCurrentlyControlled() {
        // 检查是否正在被强控：
        // 1. 被 S女王 / 白袜尊者 压制 (van_suppressed)
        // 2. 被吸血鬼吸附 (vampire_drain)
        // 3. 被麻痹 (paralyze)
        // 4. 正处于被击退中 (knockbackTimer > 0)
        // 注意：不包括普通的减速 (slow)
        const hasControlBuff = this.buffs.some(b => 
            b.type === 'paralyze' || 
            b.type === 'vampire_drain' || 
            b.type === 'van_suppressed'
        );
        return hasControlBuff || this.knockbackTimer > 0;
    }

    applyPassives() {
        super.applyPassives();
        
        // 强制清除已有的控制状态（如果意外被附加或残留）
        if (this.isCharging || this.isDashing) {
            this.buffs = this.buffs.filter(b => 
                b.type !== 'slow' && 
                b.type !== 'paralyze' && 
                b.type !== 'vampire_drain' && 
                b.type !== 'van_suppressed'
            );
            // 清除被 S女王 / 白袜 强行设置的特殊坐标绑定状态
            this.knockbackTimer = 0;
            // 清除某些特殊强制拉扯效果产生的位移干扰
            if (this.isDashing) {
                // 确保在 Dashing 期间，任何由其他英雄附加的强行覆盖坐标的行为失效
                this.isSuperArmor = true;
                this.ignoreHeroCollisionBounce = true;
                this.speedMultiplier *= this.dashSpeedMult;
            } else if (this.isCharging) {
                this.isSuperArmor = true;
                this.ignoreHeroCollisionBounce = true;
                this.speedMultiplier = 0; // Stop moving
            }
        } else {
            this.ignoreHeroCollisionBounce = false;
            this.isSuperArmor = false;
            
            if (this.isFreeAccel) {
                this.speedMultiplier *= 2.0;
            }
        }
    }
    
    addBuff(id, type, value, time, extra = {}) {
        // 霸体状态下免疫减速、麻痹、吸血等控制/软控效果，但不免疫纯伤害
        if (this.isSuperArmor && (type === 'slow' || type === 'paralyze' || type === 'vampire_drain' || type === 'van_suppressed')) {
            return;
        }
        super.addBuff(id, type, value, time, extra);
    }
    
    startCharge(isAwaken) {
        // 如果起手时处于强控状态，禁止进入蓄力和后续弹射（觉醒八连不在此限制，强制突破）
        if (!isAwaken && this.isCurrentlyControlled()) {
            return false;
        }

        this.isCharging = true;
        this.chargeTimer = isAwaken ? 0.1 : 0.3;
        this.maxChargeTime = this.chargeTimer;
        this.chargeFlash = false;
        this.isDashing = false;
        
        // Reset free acceleration
        this.timeSinceLastChargeStart = 0;
        if (this.isFreeAccel) {
            this.isFreeAccel = false;
            this.createAccelEndEffect();
        }
        this.freeAccelTimer = 0;
        
        if (isAwaken) {
            this.comboCount++;
            // If starting anywhere (not just wall), calculate normal away from enemy for squeeze
            if (this.enemy) {
                const dx = this.x - this.enemy.x;
                const dy = this.y - this.enemy.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 0) {
                    this.wallNormal = { x: dx / dist, y: dy / dist };
                } else {
                    this.wallNormal = { x: 1, y: 0 };
                }
            }
        }
        
        return true;
    }
    
    onWallBounce() {
        if (this.isDead) return;
        
        const cx = this.x;
        const cy = this.y;
        
        // Determine wall normal
        let nx = 0; let ny = 0;
        if (cx <= this.radius + 1) nx = 1;
        else if (cx >= this.game.width - this.radius - 1) nx = -1;
        
        if (cy <= this.radius + 1) ny = 1;
        else if (cy >= this.game.height - this.radius - 1) ny = -1;
        
        if (nx !== 0 || ny !== 0) {
            this.wallNormal = { x: nx, y: ny };
        } else {
            this.wallNormal = { x: -this.vx, y: -this.vy };
        }
        
        // If we were dashing, end it
        if (this.isDashing) {
            this.isDashing = false;
            this.dashCooldown = 0.15;
            this.skillCooldown = 1.0; // 技能一改为 1 秒冷却时间
            
            // Spark visual
            this.createSparks(cx, cy, nx, ny);
            
            if (this.isAwakenCombo) {
                if (this.comboCount < this.maxCombo && this.enemy && !this.enemy.isDead) {
                    // Start next combo
                    this.startCharge(true);
                    return; // Prevent normal bounce logic if charging immediately
                } else {
                    // End combo
                    this.isAwakenCombo = false;
                    this.isAwakened = false; // 关闭觉醒状态
                    this.awakenTimer = 0;
                    this.createLargeBurst();
                }
            }
        }
        
        // If we can charge
        const isControlled = this.isCurrentlyControlled();
        if (!this.isDashing && !this.isCharging && this.dashCooldown <= 0 && this.skillCooldown <= 0 && !isControlled && !this.isAwakenCombo) {
            const chargeSuccess = this.startCharge(false);
            
            if (chargeSuccess) {
                // 如果起手蓄力成功，则我们需要将已经在 Physics.js 中被反转的速度恢复回来
                // 因为进入蓄力意味着“不反弹”，我们应该保持原有的运动方向（或者至少不表现出反弹的动量）
                // 在 startCharge 中，isCharging 被置为 true，速度会由 applyPassives 置零
                // 所以即使恢复了 vx/vy 也不会立刻移动，但为了保证方向法线的正确性，我们将其反转回来
                this.vx = -this.vx;
                this.vy = -this.vy;
            }
            
        } else if (!this.isCharging) {
            // 如果未能进入蓄力且不处于正在蓄力的状态，我们需要执行正常反弹。
            // 因为子类覆盖了 onWallBounce，原本 Hero 基类的物理反弹逻辑（vx/vy 取反）在 Physics.js 里已经做过了
            // 所以这里什么都不做就等同于“正常反弹”（因为速度在 Physics.js 里已经反转）
        }
    }
    
    onHeroCollision(other) {
        if (this.isDead || other.isDead) return;
        
        if (this.isDashing && !this.hasHitEnemy) {
            this.hasHitEnemy = true;
            const damage = this.isAwakenCombo ? 5 : 8; // 觉醒5点，未觉醒8点
            other.takeDamage(damage * this.damageMultiplier, this.x, this.y);
            
            // Speed decays
            this.dashSpeedMult = 3.0 + Math.random() * 0.5;
            
            // Visual: electric slash mark
            this.createSlashMark(other.x, other.y);
            
            // Custom "-5" pop is handled by takeDamage already, but maybe we can add a slash particle
        }
        
        if (!this.isDashing && !this.isCharging) {
            // Normal collision damage if needed? Original hero base has damage 1?
            // Actually Hero.js doesn't do base damage by default, it relies on sub-classes.
            // Let's do 1 base damage like Spider if not dashing.
            const now = Date.now();
            if (!this.lastCollisionTime || now - this.lastCollisionTime > 500) {
                other.takeDamage(1 * this.damageMultiplier, this.x, this.y);
                this.lastCollisionTime = now;
            }
        }
    }
    
    updateSpecific(dt) {
        if (this.isDead) return;
        
        // 确保雷霆闪始终面朝敌人
        if (this.enemy && !this.enemy.isDead && !this.isDashing && !this.isCharging) {
            this.visualRotation = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
        }
        
        if (this.dashCooldown > 0) {
            this.dashCooldown -= dt;
        }
        
        if (this.skillCooldown > 0) {
            this.skillCooldown -= dt;
        }
        
        if (!this.isCharging && !this.isAwakenCombo) {
            // 被强控时，不累计无接触时间，也不触发游离加速
            if (!this.isCurrentlyControlled()) {
                this.timeSinceLastChargeStart += dt;
                if (this.timeSinceLastChargeStart >= 3.0 && !this.isFreeAccel) {
                    this.isFreeAccel = true;
                    this.freeAccelTimer = 2.0;
                }
            } else {
                // 如果正在被强控，重置加速计时器并打断当前的加速状态
                this.timeSinceLastChargeStart = 0;
                if (this.isFreeAccel) {
                    this.isFreeAccel = false;
                    this.createAccelEndEffect();
                    this.freeAccelTimer = 0;
                }
            }
        }
        
        if (this.isFreeAccel) {
            this.freeAccelTimer -= dt;
            if (this.freeAccelTimer <= 0) {
                this.isFreeAccel = false;
                this.createAccelEndEffect();
            }
            // Add electric particles around body
            if (Math.random() < 0.3) {
                this.game.addParticle({
                    x: this.x + (Math.random() - 0.5) * this.radius * 2,
                    y: this.y + (Math.random() - 0.5) * this.radius * 2,
                    vx: (Math.random() - 0.5) * 20,
                    vy: (Math.random() - 0.5) * 20,
                    color: '#00ffff',
                    size: Math.random() * 2 + 1,
                    life: 0.3
                });
            }
        }
        
        if (this.isCharging) {
            this.chargeTimer -= dt;
            
            // 80% flash
            if (!this.chargeFlash && this.chargeTimer <= this.maxChargeTime * 0.2) {
                this.chargeFlash = true;
                // Add flash particle
                this.game.addParticle({
                    x: this.x, y: this.y,
                    vx: 0, vy: 0,
                    color: '#ffffff',
                    size: this.radius * 1.5,
                    life: 0.1
                });
            }
            
            // UI Ring / Electric gathering
            if (Math.random() < 0.5) {
                const angle = Math.random() * Math.PI * 2;
                const dist = this.radius * (1.5 + Math.random());
                this.game.addParticle({
                    x: this.x + Math.cos(angle) * dist,
                    y: this.y + Math.sin(angle) * dist,
                    vx: -Math.cos(angle) * 100,
                    vy: -Math.sin(angle) * 100,
                    color: '#00ffff',
                    size: 2,
                    life: 0.2,
                    target: this
                });
            }
            
            if (this.chargeTimer <= 0) {
                this.isCharging = false;
                this.isDashing = true;
                this.dashSpeedMult = 10.0;
                this.hasHitEnemy = false;
                
                // Shoot towards enemy
                if (this.enemy && !this.enemy.isDead) {
                    const dx = this.enemy.x - this.x;
                    const dy = this.enemy.y - this.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist > 0) {
                        this.vx = (dx / dist) * this.baseSpeed; // normalizeSpeed will multiply by dashSpeedMult
                        this.vy = (dy / dist) * this.baseSpeed;
                    }
                }
                
                // Flash on dash
                if (this.isAwakenCombo) {
                    this.game.addParticle({
                        x: this.x, y: this.y,
                        vx: 0, vy: 0,
                        color: '#ffffff',
                        size: this.radius * 2,
                        life: 0.15
                    });
                }
            }
        }
        
        if (this.isDashing) {
            // Afterimages
            if (Math.random() < 0.5) {
                this.afterImages.push({
                    x: this.x, y: this.y,
                    life: 0.2,
                    maxLife: 0.2,
                    radius: this.radius,
                    angle: Math.atan2(this.vy, this.vx),
                    speedBonus: Math.max(0, this.speedMultiplier - 1)
                });
            }
        }
        
        // Update afterimages
        for (let i = this.afterImages.length - 1; i >= 0; i--) {
            this.afterImages[i].life -= dt;
            if (this.afterImages[i].life <= 0) {
                this.afterImages.splice(i, 1);
            }
        }
    }
    
    onAwaken() {
        this.isAwakenCombo = true;
        this.comboCount = 0;
        this.awakenTimer = 999; // 保持一个数值以便在UI中显示觉醒图标
        this.startCharge(true);
    }
    
    createSparks(cx, cy, nx, ny) {
        // Wall collision point
        let px = cx; let py = cy;
        if (nx > 0) px -= this.radius;
        if (nx < 0) px += this.radius;
        if (ny > 0) py -= this.radius;
        if (ny < 0) py += this.radius;
        
        for (let i = 0; i < 15; i++) {
            const angle = Math.atan2(ny, nx) + (Math.random() - 0.5) * Math.PI;
            const speed = Math.random() * 200 + 50;
            this.game.addParticle({
                x: px, y: py,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: Math.random() > 0.5 ? '#00ffff' : '#ffffff',
                size: Math.random() * 3 + 1,
                life: 0.3 + Math.random() * 0.2
            });
        }
    }
    
    createSlashMark(x, y) {
        const angle = Math.random() * Math.PI;
        for (let i = 0; i < 5; i++) {
            this.game.addParticle({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                vx: Math.cos(angle) * 100 * (Math.random() > 0.5 ? 1 : -1),
                vy: Math.sin(angle) * 100 * (Math.random() > 0.5 ? 1 : -1),
                color: '#00ffff',
                size: 2,
                life: 0.2,
                isLine: true // Assuming game engine supports this or we just use normal particles
            });
        }
    }
    
    createLargeBurst() {
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 300 + 100;
            this.game.addParticle({
                x: this.x, y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: '#00ffff',
                size: Math.random() * 4 + 2,
                life: 0.5
            });
        }
        this.game.addParticle({
            x: this.x, y: this.y,
            vx: 0, vy: 0,
            color: 'rgba(0, 255, 255, 0.5)',
            size: this.radius * 4,
            life: 0.3
        });
    }

    createAccelEndEffect() {
        // "电光快速收缩消失" -> particles moving towards center
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = this.radius * 2;
            this.game.addParticle({
                x: this.x + Math.cos(angle) * dist,
                y: this.y + Math.sin(angle) * dist,
                vx: -Math.cos(angle) * 150,
                vy: -Math.sin(angle) * 150,
                color: '#00ffff',
                size: Math.random() * 2 + 1,
                life: 0.2
            });
        }
    }
    
    draw(ctx) {
        if (!this.isDead && this.afterImages.length > 0) {
            for (const img of this.afterImages) {
                ctx.save();
                ctx.globalAlpha = (img.life / img.maxLife) * 0.5;
                ctx.translate(img.x, img.y);
                
                if (img.angle !== undefined && img.speedBonus !== undefined) {
                    ctx.rotate(img.angle);
                    const scaleX = 1 + (img.speedBonus * 0.1);
                    const scaleY = 1 / scaleX;
                    ctx.scale(scaleX, scaleY);
                }
                
                ctx.beginPath();
                ctx.arc(0, 0, img.radius, 0, Math.PI * 2);
                
                // Gradient for trail
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, img.radius);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(1, '#00ffff');
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.restore();
            }
        }
        
        super.draw(ctx);
    }
    
    drawBody(ctx) {
        ctx.save();
        
        // Squeeze visual during charge
        if (this.isCharging) {
            // Normal is wallNormal
            // Squeeze towards wall Normal
            const angle = Math.atan2(this.wallNormal.y, this.wallNormal.x);
            // 这里因为我们通过 visualRotation 已经锁定朝向敌人了，如果在 drawBody 内部再次无条件 rotate，会导致双重旋转错乱
            // 但是如果是在蓄力状态，我们要覆盖朝向以面向墙壁
            ctx.rotate(angle - (this.visualRotation || 0)); // 修正之前的预旋转
            
            // Scale based on charge progress
            const progress = 1 - (this.chargeTimer / this.maxChargeTime);
            // Squeeze X (towards wall), bulge Y
            const scaleX = 1 - (0.4 * progress); // squash
            const scaleY = 1 + (0.3 * progress); // stretch
            
            // Translate slightly towards the wall so it looks stuck to it
            // Wall normal points INTO the play area. So wall is at -normal.
            const offset = this.radius * (1 - scaleX);
            ctx.translate(-offset, 0);
            
            ctx.scale(scaleX, scaleY);
            // DO NOT rotate back, so the circle stretches correctly along the rotated axes
        } else if (this.isDashing) {
            // Squeeze during dash based on speed multiplier
            const angle = Math.atan2(this.vy, this.vx);
            ctx.rotate(angle - (this.visualRotation || 0)); // 修正之前的预旋转
            
            const speedBonus = Math.max(0, this.speedMultiplier - 1);
            // Dash speed starts at 10x (speedBonus=9) and decays.
            const scaleX = 1 + (speedBonus * 0.1); // Stretch along velocity
            const scaleY = 1 / scaleX; // Squeeze perpendicular to velocity to maintain area
            
            ctx.scale(scaleX, scaleY);
        }
        
        // Electric glow
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = this.isFreeAccel ? 20 : (this.isDashing ? 30 : 10);
        
        // Body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Stroke
        ctx.lineWidth = 3;
        ctx.strokeStyle = this.strokeColor;
        ctx.stroke();
        
        // 绘制佩剑 (别在身边)
        ctx.save();
        // 取消外发光避免佩剑糊成一团
        ctx.shadowBlur = 0;
        
        // 固定在身侧（右侧），这里因为通过 visualRotation 已经让主体面向敌人
        // 所以 x 轴正方向就是敌人的方向，我们把剑挂在下方（y 为正）或上方
        // 挂在“腰部”（y轴正方向为右侧身旁）
        ctx.translate(0, this.radius + 5);
        
        // 调整佩剑角度：现在 x轴正方向 是前方，所以剑应该指向前方，剑柄在后方
        // 旋转让剑身与 x 轴大致平行，剑尖指向 x 正方向
        ctx.rotate(-Math.PI / 2); // 把原来向上的剑转到向右
        
        // 进一步稍微倾斜，让它像斜跨在腰间，而不是完全笔直向前
        ctx.rotate(-Math.PI / 6); 
        
        // 绘制剑柄 (柄在下方，y为正方向，但这里局部坐标系是朝向 -y 为剑尖)
        // 所以剑柄在 +y 方向
        ctx.fillStyle = '#b8860b'; // 暗金色剑柄
        ctx.fillRect(-5, 0, 10, 20); // 从 0 到 20 是剑柄
        
        // 绘制剑格 (护手)
        ctx.fillStyle = '#ffd700'; // 金色护手
        ctx.fillRect(-12, -4, 24, 6);
        
        // 绘制剑刃 (向 -y 方向延伸)
        // 使用渐变表现金属和电光质感
        const bladeGrad = ctx.createLinearGradient(0, -4, 0, -45);
        bladeGrad.addColorStop(0, '#ffffff');
        bladeGrad.addColorStop(0.5, '#00ffff');
        bladeGrad.addColorStop(1, '#0088ff');
        
        ctx.fillStyle = bladeGrad;
        ctx.beginPath();
        ctx.moveTo(-4, -4);
        ctx.lineTo(-2, -40);
        ctx.lineTo(0, -48); // 剑尖
        ctx.lineTo(2, -40);
        ctx.lineTo(4, -4);
        ctx.closePath();
        ctx.fill();
        
        // 绘制剑刃中线
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(0, -45);
        ctx.stroke();
        
        ctx.restore();
        
        ctx.restore();
        
        // Awaken combo count (rendered upright, outside the rotated/scaled context)
        if (this.isAwakenCombo && this.comboCount > 0) {
            ctx.save();
            ctx.shadowColor = '#ffd700'; // 金色发光
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#ffd700'; // 金色文字
            ctx.font = 'bold 28px Arial'; // 稍微放大一点字号
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.comboCount.toString(), 0, -this.radius - 25); // 略微往上抬一点避免遮挡发光
            ctx.restore();
        }
    }
}
