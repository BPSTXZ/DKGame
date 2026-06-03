import { Hero } from '../Hero.js';

export class CrimsonBlade extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '绯刃煞客';
        this.color = '#1a0b2e'; // 深紫黑
        this.hp = 100;
        this.maxHp = 100;
        this.baseSpeed = 60;
        this.radius = 40;
        
        // 技能一：绯线斩相关
        this.slashCooldown = 4.0;
        this.slashTimer = 1.0; // 初始给一点延迟
        this.state = 'normal'; // 'normal' | 'charging' | 'slashing' | 'awaken_slashing'
        
        this.chargeDuration = 0.3;
        this.chargeTimer = 0;
        this.lockedSlashAngle = 0; // 蓄力时锁定的方向
        
        this.slashDuration = 0.08;
        this.slashProgress = 0;
        this.slashAngle = 0;
        
        // 斩痕集合
        this.traces = []; // { x1, y1, x2, y2, life, maxLife, id, triggered }
        
        // 技能二：断空罡相关
        this.guardCooldown = 1.0;
        this.lastGuardTime = 0;
        this.guardVisuals = []; // { life, angle }
        this.guardSwingTimer = 0;
        this.guardSwingAngle = 0;
        
        // 觉醒相关
        this.awakenCount = 0;
        this.awakenMaxCount = 5;
        this.awakenInterval = 0.2;
        this.awakenNextTimer = 0;
        this.awakenChargeDuration = 0.15;
        this.awakenSlashes = []; // 存储觉醒凭空斩击的起点坐标 {x, y}
        
        // 特效集合
        this.bladeLights = []; // { x, y, angle, life }
        this.afterImages = []; // { x, y, angle, life, scaleX, scaleY }
        
        // 视觉旋转纹理
        this.textureRotation = 0;
        
        // 武器刀位置与状态
        this.weaponAngle = -Math.PI / 4; // 默认斜向悬浮
        this.weaponOffset = this.radius + 15;
        this.weaponSwingProgress = 0; // 挥刀动画进度 0->1

        // 音效
        this.selectAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/CrimsonBlade/选择.mp3');
        this.chargeAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/CrimsonBlade/蓄力.mp3');
        this.slashAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/CrimsonBlade/斩击触发.mp3');
        this.directHitAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/CrimsonBlade/直击命中.mp3');
        this.comboAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/CrimsonBlade/刀气连击.mp3');
        
        this.hitAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/common/碰撞.mp3');
        this.guardAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/CrimsonBlade/碰撞.mp3');
        this.awakenAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/common/觉醒.mp3');
    }

    stopAllAudio() {
        [this.selectAudio, this.chargeAudio, this.slashAudio, this.directHitAudio, this.comboAudio, this.hitAudio, this.guardAudio, this.awakenAudio].forEach(a => {
            if (a) { a.pause(); a.currentTime = 0; }
        });
    }

    stopAwakenAudio() {
        if (this.awakenAudio) {
            this.awakenAudio.pause();
            this.awakenAudio.currentTime = 0;
        }
    }

    applyPassives() {
        super.applyPassives();
        if (this.state === 'charging' || this.state === 'slashing' || this.state === 'awaken_slashing') {
            this.speedMultiplier = 0;
            this.isSuperArmor = true;
        } else {
            this.isSuperArmor = false;
        }
    }

    playAwakenAudio() {
        if (this.awakenAudio) {
            this.awakenAudio.currentTime = 0;
            this.awakenAudio.play().catch(() => {});
        }
    }

    onHeroCollision(other) {
        // 调用基类的碰撞逻辑（处理默认的反弹与物理效果）
        super.onHeroCollision(other);

        if (this.isDead || other.isDead) return;
        
        const now = Date.now();
        if (now - this.lastGuardTime > this.guardCooldown * 1000) {
            this.lastGuardTime = now;
            
            // 技能二：断空罡伤害
            other.takeDamage(6 * this.damageMultiplier, this.x, this.y);
            
            // 表现
            const angleToOther = Math.atan2(other.y - this.y, other.x - this.x);
            this.guardVisuals.push({ life: 0.3, angle: angleToOther });
            this.guardSwingTimer = 0.15;
            this.guardSwingAngle = angleToOther;
            
            if (this.game && this.game.shakeScreen) {
                this.game.shakeScreen(0.05, 3);
            }
            
            // 刀罡碰撞火花粒子
            for(let i=0; i<15; i++) {
                const a = angleToOther + (Math.random() - 0.5);
                const s = Math.random() * 250 + 50;
                this.game.addParticle({
                    x: this.x + Math.cos(angleToOther) * this.radius,
                    y: this.y + Math.sin(angleToOther) * this.radius,
                    vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                    color: Math.random() > 0.5 ? '#ff4444' : '#ffffff',
                    life: 0.2 + Math.random() * 0.2,
                    size: Math.random() * 3 + 2,
                    isLine: true
                });
            }

            if (this.guardAudio) {
                const snd = this.guardAudio.cloneNode();
                snd.volume = 1.0;
                snd.play().catch(() => {});
            }
        }
    }

    updateSpecific(dt) {
        if (this.isDead) return;

        // 维持面向敌方或移动方向的旋转状态
        if (this.state === 'normal') {
            if (this.enemy && !this.enemy.isDead) {
                this.visualRotation = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
            } else if (this.vx !== 0 || this.vy !== 0) {
                this.visualRotation = Math.atan2(this.vy, this.vx);
            }
        }

        // 更新纹理旋转
        this.textureRotation += dt * 2;
        
        // 更新斩痕生命周期与判定
        this.updateTraces(dt);
        
        // 更新断空罡挥刀动画计时器
        if (this.guardSwingTimer > 0) {
            this.guardSwingTimer -= dt;
        }
        
        // 更新刀罡视觉
        for (let i = this.guardVisuals.length - 1; i >= 0; i--) {
            this.guardVisuals[i].life -= dt;
            if (this.guardVisuals[i].life <= 0) this.guardVisuals.splice(i, 1);
        }

        // 更新刀光视觉
        for (let i = this.bladeLights.length - 1; i >= 0; i--) {
            this.bladeLights[i].life -= dt;
            if (this.bladeLights[i].life <= 0) this.bladeLights.splice(i, 1);
        }

        // 更新残影视觉
        for (let i = this.afterImages.length - 1; i >= 0; i--) {
            this.afterImages[i].life -= dt;
            if (this.afterImages[i].life <= 0) this.afterImages.splice(i, 1);
        }

        // 状态机
        if (this.isAwakened) {
            this.updateAwaken(dt);
        } else {
            this.updateNormal(dt);
        }

        // 挥刀动画平滑回归
        if (this.state === 'normal') {
            this.weaponSwingProgress = Math.max(0, this.weaponSwingProgress - dt * 5);
        }
    }

    updateNormal(dt) {
        if (this.state === 'normal') {
            this.slashTimer -= dt;
            if (this.slashTimer <= 0) {
                this.startCharge();
            }
        } else if (this.state === 'charging') {
            this.chargeTimer -= dt;
            // 挤压变形逻辑由 draw 处理，此处更新武器发光与残影逻辑（由 draw 处理）
            if (this.chargeTimer <= 0) {
                this.performSlash();
            }
        } else if (this.state === 'slashing') {
            this.slashProgress += dt;
            this.weaponSwingProgress = Math.min(1, this.slashProgress / this.slashDuration);
            if (this.slashProgress >= this.slashDuration) {
                this.state = 'normal';
                this.slashTimer = this.slashCooldown;
            }
        }
    }

    updateAwaken(dt) {
        if (this.state === 'normal' || this.state === 'awaken_slashing') {
            if (this.awakenCount < this.awakenMaxCount) {
                this.awakenNextTimer -= dt;
                if (this.awakenNextTimer <= 0) {
                    this.startAwakenCharge();
                }
            } else {
                // 五连斩结束
                this.isAwakened = false;
                this.state = 'normal';
                this.slashTimer = this.slashCooldown;
            }
        } else if (this.state === 'charging') {
            this.chargeTimer -= dt;
            if (this.chargeTimer <= 0) {
                this.performSlash(true);
            }
        }
    }

    startCharge() {
        this.state = 'charging';
        this.chargeTimer = this.chargeDuration;
        this.vx = 0; this.vy = 0; // 蓄力停止移动
        
        // 蓄力瞬间锁定方向
        if (this.enemy && !this.enemy.isDead) {
            this.lockedSlashAngle = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
        } else {
            this.lockedSlashAngle = this.visualRotation || 0;
        }

        if (this.chargeAudio) {
            this.chargeAudio.currentTime = 0;
            this.chargeAudio.play().catch(() => {});
        }
    }

    startAwakenCharge() {
        this.state = 'charging';
        this.chargeTimer = this.awakenChargeDuration;
        this.vx = 0; this.vy = 0;
        
        // 蓄力瞬间锁定方向
        if (this.enemy && !this.enemy.isDead) {
            this.lockedSlashAngle = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
        } else {
            this.lockedSlashAngle = this.visualRotation || 0;
        }
    }

    performSlash(isAwaken = false) {
        this.state = isAwaken ? 'awaken_slashing' : 'slashing';
        this.slashProgress = 0;
        this.weaponSwingProgress = 1;
        
        let startX = this.x;
        let startY = this.y;
        
        // 使用蓄力时锁定的方向作为基准
        let baseAngle = this.lockedSlashAngle;
        
        if (isAwaken) {
            // 觉醒改为凭空生成，朝向随机（制造全场压迫感）
            // 保证生成的起点在地图范围内，并且尽可能分散
            const margin = 100;
            startX = margin + Math.random() * (this.game.width - margin * 2);
            startY = margin + Math.random() * (this.game.height - margin * 2);
            
            // 记录下起点，用于画出本体的挥刀动作朝向
            this.awakenSlashes.push({x: startX, y: startY});
            
            // 每次觉醒斩击的方向也完全随机化
            this.slashAngle = Math.random() * Math.PI * 2;
            
            this.awakenCount++;
            this.awakenNextTimer = this.awakenInterval;
        } else {
            this.slashAngle = baseAngle;
        }

        if (this.slashAudio) {
            const snd = this.slashAudio.cloneNode();
            snd.volume = 0.8;
            snd.play().catch(() => {});
        }

        // 添加刀光弧带特效 (加大生命周期，方便看清)
        this.bladeLights.push({
            x: startX,
            y: startY,
            angle: this.slashAngle,
            life: 0.3
        });

        // 斩击爆发粒子
        for(let i=0; i<20; i++) {
            const a = this.slashAngle + (Math.random() - 0.5) * 0.5;
            const s = Math.random() * 300 + 100;
            this.game.addParticle({
                x: startX + Math.cos(this.slashAngle) * this.radius, 
                y: startY + Math.sin(this.slashAngle) * this.radius,
                vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                color: Math.random() > 0.5 ? '#ff4444' : '#ffffff',
                life: 0.2 + Math.random() * 0.2, 
                size: Math.random() * 4 + 2,
                isLine: true
            });
        }

        // 觉醒残影 (如果在非本体位置生成斩击，我们也可以在斩击起点生成一个红色的虚影来表示是"谁"砍出来的)
        if (isAwaken) {
            this.afterImages.push({
                x: startX,
                y: startY,
                angle: this.slashAngle,
                life: 0.3,
                scaleX: 1.2,
                scaleY: 0.8
            });
        }

        // 计算斩痕终点（与边界交点）
        const endPoint = this.getEdgeIntersection(startX, startY, this.slashAngle);
        
        // 判定直击
        let directHit = false;
        if (this.enemy && !this.enemy.isDead && this.enemy.invincibleTime <= 0) {
            // 线段与圆碰撞判定
            if (this.game.physics.checkLineCircleCollision(startX, startY, endPoint.x, endPoint.y, this.enemy)) {
                directHit = true;
                
                // 播放直击音效
                if (this.directHitAudio) {
                    const snd = this.directHitAudio.cloneNode();
                    snd.volume = 1.0;
                    snd.play().catch(() => {});
                }

                this.enemy.takeDamage(10 * this.damageMultiplier, startX, startY);
                this.game.shakeScreen(0.2, 8); // 加大直击的屏幕震动
                
                // 命中特效：十字大斩痕
                const hitAngle1 = this.slashAngle + (Math.random() - 0.5) * 0.5;
                const hitAngle2 = hitAngle1 + Math.PI / 2 + (Math.random() - 0.5) * 0.5;
                if (this.enemy.addSlashMark) {
                    this.enemy.addSlashMark(hitAngle1, this.radius * 6, 12, '#ffffff', 0.6);
                    this.enemy.addSlashMark(hitAngle2, this.radius * 6, 12, '#ff4444', 0.6);
                }

                // 命中特效：爆裂粒子云
                for(let i=0; i<30; i++) {
                    const a = Math.random() * Math.PI * 2;
                    const s = Math.random() * 400 + 100;
                    this.game.addParticle({
                        x: this.enemy.x + (Math.random() - 0.5) * 20, 
                        y: this.enemy.y + (Math.random() - 0.5) * 20,
                        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                        color: Math.random() > 0.3 ? '#ff4444' : '#ffffff', 
                        life: 0.3 + Math.random() * 0.3, 
                        size: Math.random() * 5 + 2,
                        isLine: Math.random() > 0.5 // 一半线状粒子，一半点状
                    });
                }
                
                // 命中特效：血色扩散光环
                this.game.addParticle({
                    x: this.enemy.x, y: this.enemy.y,
                    vx: 0, vy: 0,
                    color: 'rgba(255, 68, 68, 0.5)',
                    size: this.radius * 4,
                    life: 0.3
                });
            }
        }

        // 生成斩痕 (直击后立刻消失，未命中保留)
        if (!directHit) {
            this.traces.push({
                x1: startX, y1: startY,
                x2: endPoint.x, y2: endPoint.y,
                life: isAwaken ? 5.0 : 4.0,
                maxLife: isAwaken ? 5.0 : 4.0,
                id: Date.now() + Math.random(),
                triggered: false,
                angle: this.slashAngle,
                pulseTimer: 0
            });
        }
    }

    getEdgeIntersection(x, y, angle) {
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const w = this.game.width;
        const h = this.game.height;
        
        let t = 1000; // 默认极远
        
        if (dx > 0) t = Math.min(t, (w - x) / dx);
        if (dx < 0) t = Math.min(t, -x / dx);
        if (dy > 0) t = Math.min(t, (h - y) / dy);
        if (dy < 0) t = Math.min(t, -y / dy);
        
        return { x: x + dx * t, y: y + dy * t };
    }

    updateTraces(dt) {
        for (let i = this.traces.length - 1; i >= 0; i--) {
            const t = this.traces[i];
            t.life -= dt;
            t.pulseTimer += dt;
            
            if (t.life <= 0) {
                this.traces.splice(i, 1);
                continue;
            }

            // 持续散发裂缝粒子
            if (Math.random() < 0.3) {
                const randPos = Math.random();
                const sx = t.x1 + (t.x2 - t.x1) * randPos;
                const sy = t.y1 + (t.y2 - t.y1) * randPos;
                this.game.addParticle({
                    x: sx, y: sy,
                    vx: (Math.random()-0.5)*30, vy: (Math.random()-0.5)*30,
                    color: '#ff4444', life: 0.3, size: 2
                });
            }

            // 刀气连击判定
            if (!t.triggered && this.enemy && !this.enemy.isDead && this.enemy.invincibleTime <= 0) {
                const dist = this.getPointToLineDistance(this.enemy.x, this.enemy.y, t.x1, t.y1, t.x2, t.y2);
                if (dist < this.enemy.radius + 5) {
                    t.triggered = true;
                    this.startBladeQiCombo(this.enemy);
                    // 触发后延迟消散
                    t.life = Math.min(t.life, 0.45); 
                }
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

    startBladeQiCombo(target) {
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                if (target && !target.isDead) {
                    target.takeDamage(2 * this.damageMultiplier, target.x, target.y);
                    
                    // 连击切割音效
                    if (this.comboAudio) {
                        const snd = this.comboAudio.cloneNode();
                        snd.volume = 0.6;
                        snd.play().catch(() => {});
                    }

                    if (this.game.shakeScreen) {
                        this.game.shakeScreen(0.05, 3);
                    }

                    // 在敌方身上留下一条刀痕特效
                    const slashAngle = Math.random() * Math.PI * 2;
                    if (target.addSlashMark) {
                        target.addSlashMark(slashAngle, this.radius * 3, 6, '#ff4444', 0.5, (Math.random()-0.5)*20, (Math.random()-0.5)*20);
                    }

                    // 斩击粒子
                    if (this.game) {
                        for(let j=0; j<15; j++) {
                            const a = slashAngle + (Math.random() - 0.5);
                            const s = Math.random() * 200 + 50;
                            this.game.addParticle({
                                x: target.x + (Math.random()-0.5)*20, 
                                y: target.y + (Math.random()-0.5)*20,
                                vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                                color: Math.random() > 0.5 ? '#ff4444' : '#ffffff', 
                                life: 0.3, size: 3, isLine: true
                            });
                        }
                    }
                }
            }, i * 150);
        }
    }

    onAwaken() {
        this.awakenCount = 0;
        this.awakenNextTimer = 0;
        this.state = 'normal';
        this.awakenSlashes = [];
    }

    drawBody(ctx) {
        const time = Date.now() / 1000;
        
        ctx.save();
        
        // 蓄力挤压变形
        if (this.state === 'charging') {
            const p = 1 - (this.chargeTimer / (this.isAwakened ? this.awakenChargeDuration : this.chargeDuration));
            // 线性增强的挤压感
            const scaleX = 1 + p * 0.25;
            const scaleY = 1 - p * 0.15;
            ctx.rotate(this.slashAngle);
            ctx.scale(scaleX, scaleY);
            ctx.rotate(-this.slashAngle);
        }

        // 本体绘制
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        
        const grad = ctx.createRadialGradient(-this.radius*0.3, -this.radius*0.3, 0, 0, 0, this.radius);
        grad.addColorStop(0, '#2e1a47'); // 核心
        grad.addColorStop(0.7, '#1a0b2e'); 
        grad.addColorStop(1, '#000000'); // 边缘
        ctx.fillStyle = grad;
        ctx.fill();

        // 边缘冷白高光
        ctx.strokeStyle = 'rgba(224, 224, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 切线纹理旋转 (模拟刀光反射)
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.rotate(this.textureRotation);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        for (let i = -5; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(-this.radius * 1.5, i * 15);
            ctx.lineTo(this.radius * 1.5, i * 15);
            ctx.stroke();
        }
        ctx.restore();

        // 绘制武器刀
        this.drawWeapon(ctx);

        ctx.restore();

        // 绘制血量
        // ctx.save();
        // ctx.fillStyle = '#fff';
        // ctx.font = 'bold 16px Arial';
        // ctx.textAlign = 'center';
        // ctx.textBaseline = 'middle';
        // ctx.fillText(Math.ceil(this.hp).toString(), 0, 0);
        // ctx.restore();
    }

    drawWeapon(ctx) {
        ctx.save();
        
        let localAngle = 0;
        let transX = 0;
        let transY = 0;
        
        if (this.state === 'normal') {
            if (this.guardSwingTimer > 0) {
                // 断空罡触发的挥刀动画
                const p = 1 - (this.guardSwingTimer / 0.15); // 0 到 1
                const baseAngle = this.guardSwingAngle - (this.visualRotation || 0);
                const swingOffset = -Math.PI / 2 + p * Math.PI; // 从后方扫向前方
                localAngle = baseAngle + swingOffset;
                
                const offset = this.radius + 15;
                transX = Math.cos(localAngle) * offset;
                transY = Math.sin(localAngle) * offset;
            } else {
                localAngle = Math.PI; // 调转方向，刀头朝后
                transX = 0;
                transY = this.radius + 15; // 刀展示在身侧
            }
        } else if (this.state === 'charging') {
            const p = 1 - (this.chargeTimer / (this.isAwakened ? this.awakenChargeDuration : this.chargeDuration));
            // 拔刀蓄力动作：刀慢慢向后收
            localAngle = Math.PI + p * (-Math.PI / 8); 
            transX = -p * 15;
            transY = this.radius + 15 + p * 5;
            ctx.shadowBlur = 10 + p * 15;
            ctx.shadowColor = '#ff4444';
        } else if (this.state === 'slashing' || this.state === 'awaken_slashing') {
            let baseAngle;
            if (this.state === 'awaken_slashing' && this.awakenSlashes.length > 0) {
                // 如果是觉醒斩击，为了表现合理，让本体的刀依然朝着斩击发生的大致方向挥动
                const lastSlash = this.awakenSlashes[this.awakenSlashes.length - 1];
                baseAngle = Math.atan2(lastSlash.y - this.y, lastSlash.x - this.x) - (this.visualRotation || 0);
            } else {
                baseAngle = this.slashAngle - (this.visualRotation || 0);
            }
            
            const p = this.weaponSwingProgress; // 0 到 1
            // 向前挥刀动作：从后方扫向前方
            const swingOffset = -Math.PI / 2 + p * Math.PI; 
            localAngle = baseAngle + swingOffset;
            
            // 挥出时，围绕身体固定距离挥砍
            const offset = this.radius + 15;
            transX = Math.cos(localAngle) * offset;
            transY = Math.sin(localAngle) * offset;
        }
        
        // 移动到目标位置并旋转
        ctx.translate(transX, transY);
        ctx.rotate(localAngle);
        
        // 刀身 (银白渐变)
        const bladeLen = 60;
        const bladeWidth = 6;
        const bladeGrad = ctx.createLinearGradient(0, -bladeWidth/2, 0, bladeWidth/2);
        bladeGrad.addColorStop(0, '#444'); // 刀背
        bladeGrad.addColorStop(0.5, '#fff'); // 刀锋
        bladeGrad.addColorStop(1, '#ccc');
        
        ctx.fillStyle = bladeGrad;
        ctx.beginPath();
        ctx.moveTo(0, -bladeWidth/2);
        ctx.lineTo(bladeLen, -1);
        ctx.lineTo(bladeLen, 1);
        ctx.lineTo(0, bladeWidth/2);
        ctx.closePath();
        ctx.fill();
        
        // 刀锋亮线
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bladeLen * 0.2, 0);
        ctx.lineTo(bladeLen, 0);
        ctx.stroke();

        // 刀柄 (深红紫)
        ctx.fillStyle = '#4a001a';
        ctx.fillRect(-15, -3, 15, 6);
        
        // 刀镡 (菱形)
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(6, 0);
        ctx.lineTo(0, 6);
        ctx.lineTo(-6, 0);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    drawOverlay(ctx) {
        super.drawOverlay(ctx);
        
        const time = Date.now() / 1000;

        // 绘制斩痕前，可以添加一个觉醒环境氛围压迫感 (红色滤镜)
        if (this.isAwakened) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(255, 0, 0, ${0.1 + Math.sin(time * 10) * 0.05})`;
            ctx.fillRect(0, 0, this.game.width, this.game.height);
            ctx.restore();
        }

        // 1. 绘制斩痕 (地面裂缝线)
        for (const t of this.traces) {
            const alpha = t.life / t.maxLife;
            // 0.3s 周期脉冲
            const pulse = (Math.sin(t.pulseTimer * Math.PI * 2 / 0.3) + 1) / 2;
            
            ctx.save();
            ctx.globalAlpha = alpha;
            
            const dx = t.x2 - t.x1;
            const dy = t.y2 - t.y1;
            const len = Math.hypot(dx, dy);
            
            if (len > 0) {
                const perpX = -dy / len;
                const perpY = dx / len;
                const midX = (t.x1 + t.x2) / 2;
                const midY = (t.y1 + t.y2) / 2;

                // 外层发光（中间偏粗两头细）
                const outerWidth = 15 + pulse * 10;
                ctx.shadowBlur = 20 + pulse * 15;
                ctx.shadowColor = '#ff0000';
                ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
                
                ctx.beginPath();
                ctx.moveTo(t.x1, t.y1);
                ctx.quadraticCurveTo(midX + perpX * outerWidth, midY + perpY * outerWidth, t.x2, t.y2);
                ctx.quadraticCurveTo(midX - perpX * outerWidth, midY - perpY * outerWidth, t.x1, t.y1);
                ctx.fill();
                
                // 内层高亮裂缝（中间偏粗两头细）
                const innerWidth = 3 + pulse * 2;
                ctx.shadowBlur = 5;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(t.x1, t.y1);
                ctx.quadraticCurveTo(midX + perpX * innerWidth, midY + perpY * innerWidth, t.x2, t.y2);
                ctx.quadraticCurveTo(midX - perpX * innerWidth, midY - perpY * innerWidth, t.x1, t.y1);
                ctx.fill();
            }
            
            // 边缘不规则火星 (脉冲时更强)
            if (pulse > 0.8 && Math.random() > 0.5) {
                const randPos = Math.random();
                const sx = t.x1 + (t.x2 - t.x1) * randPos;
                const sy = t.y1 + (t.y2 - t.y1) * randPos;
                this.game.addParticle({
                    x: sx, y: sy,
                    vx: (Math.random()-0.5)*50, vy: (Math.random()-0.5)*50,
                    color: '#ff4444', life: 0.2, size: 2
                });
            }
            
            ctx.restore();
        }

        // 2. 绘制刀光弧带 (slashing 瞬时)
        for (const bl of this.bladeLights) {
            const alpha = bl.life / 0.3; // 改为0.3
            ctx.save();
            ctx.translate(bl.x, bl.y);
            ctx.rotate(bl.angle);
            ctx.globalAlpha = alpha;
            
            // 增加整体光晕
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff4444';
            
            // 扁平刀光弧带
            const grad = ctx.createLinearGradient(0, -30, 0, 30); // 范围变大
            grad.addColorStop(0, 'rgba(255, 68, 68, 0)');
            grad.addColorStop(0.5, 'rgba(255, 255, 255, 1)'); // 更亮的冷白核心
            grad.addColorStop(1, 'rgba(255, 68, 68, 0)');
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            // 绘制一个拉长且更锐利的扇形区域作为弧带
            ctx.moveTo(30, -8);
            ctx.quadraticCurveTo(200, 0, 30, 8);
            ctx.fill();
            
            // 速度线
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            for(let i=0; i<4; i++) {
                const offset = (i - 1.5) * 12;
                ctx.beginPath();
                ctx.moveTo(40, offset);
                ctx.lineTo(250 + Math.random() * 50, offset);
                ctx.stroke();
            }
            
            ctx.restore();
        }

        // 3. 绘制蓄力对准线 (很淡)
        if (this.state === 'charging' && this.enemy) {
            const angle = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
            const end = this.getEdgeIntersection(this.x, this.y, angle);
            ctx.save();
            ctx.setLineDash([15, 15]);
            ctx.strokeStyle = 'rgba(255, 68, 68, 0.15)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
            ctx.restore();
        }

        // 4. 绘制断空罡视觉 (半圆刀波)
        for (const v of this.guardVisuals) {
            ctx.save();
            ctx.translate(this.x, this.y);
            const angle = v.angle !== undefined ? v.angle : 0;
            ctx.rotate(angle);
            
            const p = 1 - v.life / 0.3; // 0 to 1
            ctx.globalAlpha = v.life / 0.3;
            
            const currentRadius = this.radius + 15 + p * 40; // 扩散变大
            
            // 半圆刀波 - 红色外发光
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff4444';
            ctx.strokeStyle = 'rgba(255, 68, 68, 0.8)';
            ctx.lineWidth = 15 * (1 - p);
            ctx.beginPath();
            ctx.arc(0, 0, currentRadius, -Math.PI / 1.5, Math.PI / 1.5);
            ctx.stroke();
            
            // 半圆刀波 - 纯白核心
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#fff';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 5 * (1 - p);
            ctx.stroke();
            
            // 尖锐切割线
            ctx.lineWidth = 2;
            for (let j = 0; j < 5; j++) {
                const a = -Math.PI/2 + Math.PI * (j / 4);
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * currentRadius, Math.sin(a) * currentRadius);
                ctx.lineTo(Math.cos(a) * (currentRadius + 20 + Math.random()*30), Math.sin(a) * (currentRadius + 20 + Math.random()*30));
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.stroke();
            }
            
            ctx.restore();
        }

        // 5. 绘制残影
        for (const ai of this.afterImages) {
            ctx.save();
            ctx.translate(ai.x, ai.y);
            ctx.rotate(ai.angle);
            ctx.scale(ai.scaleX, ai.scaleY);
            ctx.globalAlpha = ai.life / 0.3 * 0.4; // 半透明
            
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#ff4444';
            ctx.fill();
            ctx.restore();
        }
    }
}
