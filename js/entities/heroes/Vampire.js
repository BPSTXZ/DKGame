import { Hero } from '../Hero.js';

/**
 * 吸血鬼英雄类
 * 特性：碰撞时黏住敌人并吸血/减速，低血量时吸血效率提升，觉醒时发射带有吸血效果的牙齿
 */
export class Vampire extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '吸血鬼';
        this.maxHp = 100;
        this.hp = 100;
        this.baseSpeed = 60; // 基础移速同步提升到 60
        this.color = '#8b0000'; // Dark red
        
        // Vampire specific
        this.isSucking = false;
        this.suckTime = 0;
        this.suckDuration = 3.0;
        
        // Awaken specific
        this.awakenShotsLeft = 0;
        this.awakenShotTimer = 0;
        this.fangs = [];
        
        // Audio specific
        this.suckAudio = new Audio('assets/audio/vampire/吸血.mp3');
        this.suckAudio.loop = true; // 确保无缝循环
        
        this.laughAudio = new Audio('assets/audio/vampire/吸血鬼笑.mp3');
        this.biteAudio = new Audio('assets/audio/vampire/牙齿咬住.mp3');
    }
    
    applyPassives() {
        // 被动技能：血量低于 10 时，吸血效率从 5 提升到 10
        this.currentDrainRate = (this.hp <= 10) ? 10 : 5;
    }
    
    updateSpecific(dt) {
        if (this.isSucking) {
            this.suckTime += dt;
            
            // 每帧连续扣血并恢复自身，应用攻击力倍率
            const drainAmount = this.currentDrainRate * this.damageMultiplier * dt;
            
            if (this.enemy && !this.enemy.isDead) {
                // 手动减敌方血，给自己加血
                this.enemy.hp -= drainAmount;
                if (this.enemy.hp < 0) this.enemy.hp = 0; // 防止负血
                this.hp += drainAmount; // 取消血量上限限制
                
                // 每0.5秒触发一次伤害数字提示（只做视觉，不扣血）
                this.suckTickTimer = (this.suckTickTimer || 0) + dt;
                if (this.suckTickTimer >= 0.5) {
                    this.suckTickTimer -= 0.5;
                    const tickDamage = (this.currentDrainRate * this.damageMultiplier * 0.5).toFixed(1);
                    this.game.addFloatingText(this.enemy.x, this.enemy.y - 30, `-${tickDamage}`, '#ff4444');
                    this.game.addFloatingText(this.x, this.y - 30, `+${tickDamage}`, '#4caf50');
                }
                
                // 黏附逻辑：强制与敌方保持紧贴，并跟随其移动
                const dx = this.x - this.enemy.x;
                const dy = this.y - this.enemy.y;
                let dist = Math.hypot(dx, dy);
                if (dist === 0) dist = 1; // 防止除0错误
                const targetDist = this.radius + this.enemy.radius;
                
                // 根据目标距离重置吸血鬼的位置，使其完美贴合敌方边缘
                this.x = this.enemy.x + (dx / dist) * targetDist;
                this.y = this.enemy.y + (dy / dist) * targetDist;
                
                // 匹配敌方的速度向量，保持共同移动，防止位移打断
                this.vx = this.enemy.vx;
                this.vy = this.enemy.vy;
            }
            
            // 结束吸血状态并给予推开力，防止分离后瞬间再次碰撞黏附
            if (this.suckTime >= this.suckDuration) {
                this.isSucking = false;
                
                // 给双方施加一个向后的推力（反弹），保证顺利脱离
                if (this.enemy) {
                    const dx = this.x - this.enemy.x;
                    const dy = this.y - this.enemy.y;
                    const baseAngle = Math.atan2(dy, dx);
                    
                    // 随机加入 -25度 到 +25度 的角度偏移 (总计50度随机范围)，避免完全直线弹回
                    const randomOffset = (Math.random() - 0.5) * (50 * Math.PI / 180);
                    const pushAngle = baseAngle + randomOffset;
                    
                    const pushSpeed = 150; // 推开速度
                    this.vx = Math.cos(pushAngle) * pushSpeed;
                    this.vy = Math.sin(pushAngle) * pushSpeed;
                    
                    // 敌方往相反方向推开 (加上同样的随机偏移，让两者的相对轨迹错开)
                    const enemyPushAngle = pushAngle + Math.PI;
                    this.enemy.vx = Math.cos(enemyPushAngle) * pushSpeed;
                    this.enemy.vy = Math.sin(enemyPushAngle) * pushSpeed;
                }
            }
        }
        
        // 觉醒技能：发射牙齿
        if (this.isAwakened) {
            if (this.awakenShotsLeft > 0) {
                this.awakenShotTimer -= dt;
                if (this.awakenShotTimer <= 0) {
                    this.shootFang();
                    this.awakenShotsLeft--;
                    this.awakenShotTimer = 0.5; // 每0.5秒发射一次
                }
            } else {
                // 当牙齿发射完毕，且场上没有存活的飞行牙齿时，结束觉醒状态
                if (this.fangs.length === 0) {
                    this.isAwakened = false;
                }
            }
        }
        
        // 更新飞行中的牙齿位置和碰撞
        for (let i = this.fangs.length - 1; i >= 0; i--) {
            const fang = this.fangs[i];
            
            // 智能追踪逻辑 (Homing)
            if (this.enemy && !this.enemy.isDead && this.enemy.invincibleTime <= 0) {
                // 计算当前指向敌人的理想向量
                const dx = this.enemy.x - fang.x;
                const dy = this.enemy.y - fang.y;
                const dist = Math.hypot(dx, dy);
                
                if (dist > 0) {
                    const targetAngle = Math.atan2(dy, dx);
                    
                    // 限制最大转向角，实现平滑追踪 (例如每秒转向一定弧度)
                    // 使用简单的线性插值或角度差计算
                    let angleDiff = targetAngle - fang.angle;
                    // 确保角度差在 -PI 到 PI 之间
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                    
                    const turnSpeed = Math.PI * 2; // 每秒最多转一圈
                    
                    // 应用转向
                    if (Math.abs(angleDiff) < turnSpeed * dt) {
                        fang.angle = targetAngle;
                    } else {
                        fang.angle += Math.sign(angleDiff) * turnSpeed * dt;
                    }
                    
                    // 根据新角度重新计算速度向量
                    const currentSpeed = Math.hypot(fang.vx, fang.vy);
                    fang.vx = Math.cos(fang.angle) * currentSpeed;
                    fang.vy = Math.sin(fang.angle) * currentSpeed;
                }
            }
            
            fang.x += fang.vx * dt;
            fang.y += fang.vy * dt;
            
            // 检查牙齿是否击中敌人
            if (this.game.physics.checkCircleCollision({x: fang.x, y: fang.y, radius: 10}, this.enemy)) { // Doubled fang radius
                this.onFangHit(this.enemy, fang);
                this.fangs.splice(i, 1);
                continue;
            }
            
            // 清除飞出屏幕的牙齿
            if (fang.x < 0 || fang.x > this.game.width || fang.y < 0 || fang.y > this.game.height) {
                this.fangs.splice(i, 1);
            }
        }
        
        // 统一管理吸血音效状态：物理吸附或牙齿吸血 buff 生效期间均播放音效
        let isDraining = this.isSucking;
        if (this.enemy && !this.enemy.isDead) {
            const hasFangDrain = this.enemy.buffs.some(b => b.type === 'vampire_drain' && b.source === this);
            if (hasFangDrain) {
                isDraining = true;
            }
        }
        
        if (isDraining) {
            if (this.suckAudio.paused) {
                this.suckAudio.play().catch(e => console.warn('Suck audio play failed:', e));
            }
        } else {
            if (!this.suckAudio.paused) {
                this.suckAudio.pause();
                this.suckAudio.currentTime = 0;
            }
        }
    }
    
    onHeroCollision(other) {
        if (this.isDead || other.isDead) return;
        
        // 目标处于无敌/无法选中状态时，无法触发吸附
        if (other.invincibleTime > 0) return;
        
        // 触发吸附
        if (!this.isSucking) {
            this.isSucking = true;
            this.suckTime = 0;
            
            // 施加减速 buff
            other.addBuff('vampire_slow', 'slow', 0.5, 3.0);
            
            // 初始化黏附时，让吸血鬼主动朝向目标移动
            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0) {
                this.vx = (dx / dist) * this.getSpeed();
                this.vy = (dy / dist) * this.getSpeed();
            }
        }
    }
    
    onAwaken() {
        this.awakenShotsLeft = 3;
        this.awakenShotTimer = 0; // shoot immediately
    }
    
    playAwakenAudio() {
        // 单次播放觉醒音效防重叠 (在动画刚开始时触发)
        if (this.laughAudio) {
            this.laughAudio.currentTime = 0;
            this.laughAudio.play().catch(e => console.warn('Audio play failed:', e));
        }
    }
    
    playVictoryAudio() {
        // 当前版本临时复用觉醒音效作为胜利音效
        this.playAwakenAudio();
    }
    
    stopAllAudio() {
        if (this.suckAudio) {
            this.suckAudio.pause();
            this.suckAudio.currentTime = 0;
        }
        if (this.laughAudio) {
            this.laughAudio.pause();
            this.laughAudio.currentTime = 0;
        }
        if (this.biteAudio) {
            this.biteAudio.pause();
            this.biteAudio.currentTime = 0;
        }
    }
    
    shootFang() {
        if (!this.enemy) return;
        
        const dx = this.enemy.x - this.x;
        const dy = this.enemy.y - this.y;
        const dist = Math.hypot(dx, dy);
        
        const speed = this.getSpeed() * 1.5; // 150% speed
        
        if (dist > 0) {
            this.fangs.push({
                x: this.x,
                y: this.y,
                vx: (dx / dist) * speed,
                vy: (dy / dist) * speed,
                angle: Math.atan2(dy, dx)
            });
        }
    }
    
    onFangHit(target, fang) {
        if (target.isDead || target.invincibleTime > 0) return;
        
        // 播放击中音效
        if (this.biteAudio) {
            this.biteAudio.currentTime = 0;
            this.biteAudio.play().catch(e => console.warn('Bite audio play failed:', e));
        }
        
        // 计算击中时的角度
        const hitAngle = Math.atan2(fang.y - target.y, fang.x - target.x);
        
        // 触发吸血效果，可叠加回馈本体
        // 吸血量根据当前被动状态和攻击倍率决定
        target.addBuff(`fang_drain_${Date.now()}_${Math.random()}`, 'vampire_drain', this.currentDrainRate * this.damageMultiplier, 3.0, {
            source: this,
            hitAngle: hitAngle,
            fangAngle: fang.angle
        });
        
        // 减速效果：只触发一次（不可叠加）
        // 这里需要检查目标身上是否已经带有减速 buff（因为黏附也会给减速），只要有 slow buff 就不再叠加
        const hasFangSlow = target.buffs.find(b => b.type === 'slow');
        if (!hasFangSlow) {
            target.addBuff('fang_slow', 'slow', 0.5, 3.0);
        }
    }
    
    drawBody(ctx) {
        super.drawBody(ctx); // draws base circle
        
        // Draw fangs pointing to enemy
        let angle = 0;
        if (this.enemy) {
            angle = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
        }
        
        ctx.save();
        ctx.rotate(angle);
        
        // Fang 1
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(this.radius * 0.8, -this.radius * 0.4);
        ctx.lineTo(this.radius * 1.2, -this.radius * 0.2);
        ctx.lineTo(this.radius * 0.8, 0);
        ctx.fill();
        
        // Fang 2
        ctx.beginPath();
        ctx.moveTo(this.radius * 0.8, 0);
        ctx.lineTo(this.radius * 1.2, this.radius * 0.2);
        ctx.lineTo(this.radius * 0.8, this.radius * 0.4);
        ctx.fill();
        
        ctx.restore();
        
        // Draw flying fangs
        // We need to inverse translate because fangs have world coordinates
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform to world
        for (const fang of this.fangs) {
            ctx.translate(fang.x, fang.y);
            ctx.rotate(fang.angle);
            
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(-10, -6);
            ctx.lineTo(20, 0);
            ctx.lineTo(-10, 6);
            ctx.fill();
            
            ctx.rotate(-fang.angle);
            ctx.translate(-fang.x, -fang.y);
        }
        ctx.restore();
    }
}
