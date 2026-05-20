import { Hero } from '../Hero.js';

export class ThunderFlash extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '霹雳闪';
        this.maxHp = 100;
        this.hp = 100;
        this.baseSpeed = 60;
        this.color = '#f9a825'; // 主题色改为橙黄
        this.strokeColor = '#ffffff'; // 描边色改为白色
        
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
        
        // Lightning trail history
        this.trailPoints = []; 
        this.maxTrailPoints = 12; // 稍微减少采样点数，避免短距离折线过于密集
        this.trailDistanceThreshold = 15; // 限制采样距离，避免移动过慢时堆积点
        
        // Audio
        this.chargeAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/thunderflash/霹雳一闪.mp3');
        this.pierceAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/thunderflash/贯穿.mp3');
        this.hasPlayedPierceAudio = false; // 用于标记单次冲刺是否已提前播放过贯穿音效
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
        this.hasPlayedPierceAudio = false; // 重置提前播放贯穿音效的标记
        
        // 播放蓄力/弹射音效
        if (this.chargeAudio) {
            // 为避免八连闪时音效重叠过分嘈杂，也可以选择只在未觉醒或首发时播放
            // 但既然是雷霆一闪的核心音效，我们每次起手都重置并播放
            this.chargeAudio.currentTime = 0;
            this.chargeAudio.play().catch(e => console.warn('ThunderFlash charge audio play failed:', e));
        }
        
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
            
            // 将当前的电弧作为残影保留下来渐隐，停止采集新点
            if (this.trailPoints.length > 0) {
                // 不清空 trailPoints，而是让它在 updateSpecific 里自然生命周期衰减
            }
            
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
            
            // 如果因为距离太近导致提前判定没有成功播放，这里做个兜底播放
            if (this.pierceAudio && !this.hasPlayedPierceAudio) {
                this.pierceAudio.currentTime = 0;
                this.pierceAudio.play().catch(e => console.warn('ThunderFlash pierce audio play failed:', e));
                this.hasPlayedPierceAudio = true;
            }
            
            // 在敌方身上留下一条刀痕特效 (可叠加，持续 1.2s)
            const slashAngle = Math.atan2(this.vy, this.vx);
            // 给刀痕稍微加一点随机的倾斜偏移，看起来更像多段切割
            const randomOffset = (Math.random() - 0.5) * (Math.PI / 4); 
            // 增加中心位置的随机偏移量，避免所有刀痕都死板地交汇在一个中心点
            const offsetX = (Math.random() - 0.5) * this.radius * 1.5;
            const offsetY = (Math.random() - 0.5) * this.radius * 1.5;
            // 长度拉长一点(radius * 4)，加粗(width: 8)，外层颜色青色(#00ffff)，持续 1.2s
            other.addSlashMark(slashAngle + randomOffset, this.radius * 4, 8, '#00ffff', 1.2, offsetX, offsetY);
            
            // Visual: electric slash mark (额外的散落电光粒子)
            this.createSlashMark(other.x, other.y);
            
            // Speed decays
            this.dashSpeedMult = 3.0 + Math.random() * 0.5;
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
        
        // 确保霹雳闪始终面朝敌人
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
                    color: '#00ffff', // 还原青色
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
            // 提前播放贯穿音效判断 (预计撞击前 0.5s)
            // 根据当前速度和与敌方的距离估算时间
            if (this.enemy && !this.enemy.isDead && !this.hasPlayedPierceAudio && this.pierceAudio) {
                const dx = this.enemy.x - this.x;
                const dy = this.enemy.y - this.y;
                const dist = Math.hypot(dx, dy);
                const currentSpeed = Math.hypot(this.vx, this.vy);
                
                if (currentSpeed > 0) {
                    const timeToHit = dist / currentSpeed;
                    if (timeToHit <= 0.5) {
                        this.pierceAudio.currentTime = 0;
                        this.pierceAudio.play().catch(e => console.warn('ThunderFlash pierce audio early play failed:', e));
                        this.hasPlayedPierceAudio = true;
                    }
                }
            }
            
            // 记录电弧拖尾路径点
            // 每帧记录当前位置，并稍微加入一点横向抖动偏移，用来在绘制时产生闪电的折线感
            const currentSpeed = Math.hypot(this.vx, this.vy);
            
            // 只有当距离上一个采样点足够远时才添加新点，防止短距离抖动点堆积
            let shouldAddPoint = true;
            if (this.trailPoints.length > 0) {
                const lastPoint = this.trailPoints[0];
                const distToLast = Math.hypot(this.x - lastPoint.x, this.y - lastPoint.y);
                if (distToLast < this.trailDistanceThreshold) {
                    shouldAddPoint = false;
                }
            }
            
            if (currentSpeed > 0 && shouldAddPoint) {
                const dirX = this.vx / currentSpeed;
                const dirY = this.vy / currentSpeed;
                // 计算垂直于运动方向的法向量
                const perpX = -dirY;
                const perpY = dirX;
                
                // 缩小随机横向抖动范围，限制角度过大
                // 原来是 this.radius * 1.5，改为 this.radius * 0.5
                const jitter = (Math.random() - 0.5) * this.radius * 0.5;
                
                this.trailPoints.unshift({
                    x: this.x + perpX * jitter,
                    y: this.y + perpY * jitter,
                    life: 1.0 // 记录初始生命值用于透明度衰减
                });
                
                // 限制采样点数量
                if (this.trailPoints.length > this.maxTrailPoints) {
                    this.trailPoints.pop();
                }
            }
            
            // Afterimages (点状残影)
            if (Math.random() < 0.5) {
                this.afterImages.push({
                    isLongTrail: false,
                    x: this.x, y: this.y,
                    life: 0.2,
                    maxLife: 0.2,
                    radius: this.radius,
                    angle: Math.atan2(this.vy, this.vx),
                    speedBonus: Math.max(0, this.speedMultiplier - 1)
                });
            }
        }
        
        // 更新电弧拖尾生命周期
        if (!this.isDashing && this.trailPoints.length > 0) {
            for (let i = this.trailPoints.length - 1; i >= 0; i--) {
                this.trailPoints[i].life -= dt * 3; // 非弹射状态下快速消散
                if (this.trailPoints[i].life <= 0) {
                    this.trailPoints.splice(i, 1);
                }
            }
        } else if (this.isDashing && this.trailPoints.length > 0) {
             for (let i = this.trailPoints.length - 1; i >= 0; i--) {
                this.trailPoints[i].life -= dt * 2; // 弹射状态下自然消散
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
    
    stopAllAudio() {
        if (this.chargeAudio) {
            this.chargeAudio.pause();
            this.chargeAudio.currentTime = 0;
        }
        if (this.pierceAudio) {
            this.pierceAudio.pause();
            this.pierceAudio.currentTime = 0;
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
                color: Math.random() > 0.5 ? '#00ffff' : '#ffffff', // 还原青白火花
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
                color: '#00ffff', // 还原青色
                size: 2,
                life: 0.2,
                isLine: true
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
                color: '#00ffff', // 还原青色
                size: Math.random() * 4 + 2,
                life: 0.5
            });
        }
        this.game.addParticle({
            x: this.x, y: this.y,
            vx: 0, vy: 0,
            color: 'rgba(0, 255, 255, 0.5)', // 还原青色外圈
            size: this.radius * 4,
            life: 0.3
        });
    }

    createAccelEndEffect() {
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = this.radius * 2;
            this.game.addParticle({
                x: this.x + Math.cos(angle) * dist,
                y: this.y + Math.sin(angle) * dist,
                vx: -Math.cos(angle) * 150,
                vy: -Math.sin(angle) * 150,
                color: '#00ffff', // 还原青色
                size: Math.random() * 2 + 1,
                life: 0.2
            });
        }
    }
    
    draw(ctx) {
        if (!this.isDead) {
            // 绘制闪电电弧长拖尾
            if (this.trailPoints.length > 1) {
                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'miter'; // 折线连接处尖锐，更像闪电
                
                // 为了让电弧更生动，绘制两层：外层宽且模糊，内层细且亮白
                
                // 第一层：外层青色光晕
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 20;
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
                
                ctx.beginPath();
                // 强制将当前真实坐标作为电弧起点连接上去，保证电弧不脱节
                ctx.moveTo(this.x, this.y);
                
                for (let i = 0; i < this.trailPoints.length; i++) {
                    const p = this.trailPoints[i];
                    // 随着距离拉远，线条变细 (模拟闪电的尖端)
                    const progress = 1 - (i / this.trailPoints.length);
                    ctx.lineTo(p.x, p.y);
                    ctx.lineWidth = this.radius * 1.5 * progress;
                }
                ctx.stroke();
                
                // 第二层：内层纯白高亮核心
                ctx.shadowBlur = 10;
                ctx.strokeStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                for (let i = 0; i < this.trailPoints.length; i++) {
                    const p = this.trailPoints[i];
                    const progress = 1 - (i / this.trailPoints.length);
                    ctx.lineTo(p.x, p.y);
                    ctx.lineWidth = this.radius * 0.5 * progress;
                }
                ctx.stroke();
                
                // 可选：再画一条稍微错开的细小分支闪电，增加随机感
                if (this.isDashing && Math.random() > 0.3 && this.trailPoints.length > 3) {
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.shadowBlur = 5;
                    
                    let branchLen = Math.floor(this.trailPoints.length / 2);
                    for (let i = 0; i < branchLen; i++) {
                        const p = this.trailPoints[i];
                        // 在主电弧基础上再做一次随机偏移
                        ctx.lineTo(p.x + (Math.random() - 0.5) * 15, p.y + (Math.random() - 0.5) * 15);
                    }
                    ctx.stroke();
                }
                
                ctx.restore();
            }

            // 绘制残影
            if (this.afterImages.length > 0) {
                for (const img of this.afterImages) {
                    ctx.save();
                    ctx.globalAlpha = (img.life / img.maxLife) * 0.6;
                    
                    // 绘制点状残影
                    ctx.translate(img.x, img.y);
                    
                    if (img.angle !== undefined && img.speedBonus !== undefined) {
                        ctx.rotate(img.angle);
                        const scaleX = 1 + (img.speedBonus * 0.1);
                        const scaleY = 1 / scaleX;
                        ctx.scale(scaleX, scaleY);
                    }
                    
                    ctx.beginPath();
                    ctx.arc(0, 0, img.radius, 0, Math.PI * 2);
                    
                    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, img.radius);
                    grad.addColorStop(0, '#ffffff');
                    grad.addColorStop(1, '#fbc02d'); // 橙色颜色
                    ctx.fillStyle = grad;
                    ctx.fill();
                    ctx.restore();
                }
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
        ctx.shadowColor = '#f9a825';
        ctx.shadowBlur = this.isFreeAccel ? 20 : (this.isDashing ? 30 : 10);
        
        // Body Background (Orange to White Gradient)
        const bodyGrad = ctx.createLinearGradient(-this.radius, -this.radius, this.radius, this.radius);
        bodyGrad.addColorStop(0, '#f57f17'); // 深橙
        bodyGrad.addColorStop(0.6, '#fbc02d'); // 明黄
        bodyGrad.addColorStop(1, '#ffffff'); // 渐变至白
        
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 使用 clip() 进行裁切，使得超出的花纹不会画到球体外面
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.clip();
        
        // Draw White Triangles Pattern (Regular Pattern)
        ctx.fillStyle = '#ffffff';
        // 绘制单个三角形
        const drawTriangle = (tx, ty, scale, rot) => {
            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(rot);
            ctx.scale(scale, scale);
            ctx.beginPath();
            ctx.moveTo(0, -6);
            ctx.lineTo(5, 4);
            ctx.lineTo(-5, 4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        };
        
        // 生成规则的网格排列三角形，参考我妻善逸羽织的花纹（鳞纹）
        // 放大间距和三角形尺寸
        const spacingX = 22;
        const spacingY = 19;
        
        for (let row = -3; row <= 3; row++) {
            for (let col = -3; col <= 3; col++) {
                // 交错排列
                const offsetX = (row % 2 === 0) ? 0 : spacingX / 2;
                const tx = col * spacingX + offsetX;
                const ty = row * spacingY;
                
                // 放大的三角形 (从 0.8 改为 1.3)
                drawTriangle(tx, ty, 1.3, 0); 
            }
        }
        
        // 结束 clip
        ctx.restore();
        
        // 重新绘制一个圆形路径用于描边
        // 因为之前的 clip() 或三角形绘制可能会干扰当前的 path
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        
        // Stroke (Player ID border)
        ctx.lineWidth = 4; // 加粗一点使阵营更清晰
        ctx.strokeStyle = '#f5e1b2ff';
        ctx.stroke();
        
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
