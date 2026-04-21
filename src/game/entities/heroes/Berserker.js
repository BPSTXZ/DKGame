import { Hero } from '../Hero.js';

/**
 * 狂战士英雄类
 * 特性：双斧旋转攻击敌人，残血时斧柄变长。受伤提升移速与转速。觉醒状态下全方位强化。
 */
export class Berserker extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '狂战士';
        this.maxHp = 120;
        this.hp = 120;
        this.baseSpeed = 60; // 基础移速同步提升 (略低于其他英雄以体现力量感)
        this.baseSpinSpeed = 6; // radians per sec, wait 20 is very fast, let's say degrees or just a scalar
        this.baseWeaponLength = 40; // Increased to match new radius proportion
        this.color = '#8b4513'; // SaddleBrown
        
        // Berserker specific
        this.weaponRotation = 0;
        this.axeTrails = [];
        this.axe1Hitting = false; // 记录斧头1当前是否正在命中目标
        this.axe2Hitting = false; // 记录斧头2当前是否正在命中目标
        
        this.currentSpinSpeed = this.baseSpinSpeed;
        this.currentWeaponLength = this.baseWeaponLength;
        this.awakenTimer = 0;
        
        // Audio specific
        this.axeHitAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/berserker/斧头.mp3');
        this.awakenAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/berserker/狂战士.mp3');
    }
    
    applyPassives() {
        const lossRatio = 1 - (this.hp / this.maxHp);
        
        // Speed up based on lost HP
        this.speedMultiplier *= (1.0 + lossRatio * 0.8);
        this.currentSpinSpeed = this.baseSpinSpeed * (1.0 + lossRatio * 1.0);
        
        // HP < 30 weapon length increase
        this.currentWeaponLength = (this.hp < 30) ? 60 : this.baseWeaponLength;
        
        if (this.isAwakened) {
            this.speedMultiplier *= 1.2;
            this.currentSpinSpeed *= 1.3;
            this.currentWeaponLength *= 5.0; // 觉醒时武器长度大幅增加 (3倍)
        }
    }
    
    updateSpecific(dt) {
        this.weaponRotation += this.currentSpinSpeed * dt;
        
        if (this.isAwakened) {
            this.awakenTimer -= dt;
            if (this.awakenTimer <= 0) {
                this.isAwakened = false;
            }
        }
        
        // Axe positions relative to center
        const axeDistance = this.radius + this.currentWeaponLength;
        
        // Axe 1 (Head)
        const axe1 = {
            x: this.x + Math.cos(this.weaponRotation) * axeDistance,
            y: this.y + Math.sin(this.weaponRotation) * axeDistance,
            radius: 20 // axe hit radius, doubled
        };
        // Axe 1 (Handle - Line segment from hero edge to axe head)
        const handle1Start = {
            x: this.x + Math.cos(this.weaponRotation) * this.radius,
            y: this.y + Math.sin(this.weaponRotation) * this.radius
        };
        
        // Axe 2 (Head)
        const axe2 = {
            x: this.x + Math.cos(this.weaponRotation + Math.PI) * axeDistance,
            y: this.y + Math.sin(this.weaponRotation + Math.PI) * axeDistance,
            radius: 20 // axe hit radius, doubled
        };
        // Axe 2 (Handle)
        const handle2Start = {
            x: this.x + Math.cos(this.weaponRotation + Math.PI) * this.radius,
            y: this.y + Math.sin(this.weaponRotation + Math.PI) * this.radius
        };
        
        // Axe trails
        this.axeTrails.push({ x: axe1.x, y: axe1.y, life: 0.2 });
        this.axeTrails.push({ x: axe2.x, y: axe2.y, life: 0.2 });
        for(let i = this.axeTrails.length - 1; i >= 0; i--) {
            this.axeTrails[i].life -= dt;
            if (this.axeTrails[i].life <= 0) this.axeTrails.splice(i, 1);
        }
        
        // Check weapon collision
        if (this.enemy && !this.enemy.isDead) {
            // Axe 1 Hit logic
            const hitHead1 = this.game.physics.checkCircleCollision(axe1, this.enemy);
            const hitHandle1 = !hitHead1 && this.game.physics.checkLineCircleCollision(handle1Start.x, handle1Start.y, axe1.x, axe1.y, this.enemy);
            
            if (hitHead1 || hitHandle1) {
                if (!this.axe1Hitting) {
                    this.axe1Hitting = true; // 标记正在命中，避免重复计伤
                    // 斧头造成 100% 伤害，斧柄造成 50% 伤害
                    const damage = (hitHead1 ? 5 : 2.5) * this.damageMultiplier;
                    this.enemy.takeDamage(damage, this.x, this.y);
                    this.spawnHitParticles(this.enemy.x, this.enemy.y);
                    this.playAxeHitSound();
                    
                    // 触发武器命中时的减速效果 (60%, 持续1秒，不可叠加但可刷新)
                    this.applyAxeSlow(this.enemy);
                }
            } else {
                this.axe1Hitting = false; // 离开目标后重置状态
            }
            
            // Axe 2 Hit logic
            const hitHead2 = this.game.physics.checkCircleCollision(axe2, this.enemy);
            const hitHandle2 = !hitHead2 && this.game.physics.checkLineCircleCollision(handle2Start.x, handle2Start.y, axe2.x, axe2.y, this.enemy);
            
            if (hitHead2 || hitHandle2) {
                if (!this.axe2Hitting) {
                    this.axe2Hitting = true;
                    const damage = (hitHead2 ? 5 : 2.5) * this.damageMultiplier;
                    this.enemy.takeDamage(damage, this.x, this.y);
                    this.spawnHitParticles(this.enemy.x, this.enemy.y);
                    this.playAxeHitSound();
                    
                    // 触发武器命中时的减速效果 (60%, 持续1秒，不可叠加但可刷新)
                    this.applyAxeSlow(this.enemy);
                }
            } else {
                this.axe2Hitting = false;
            }
        }
    }
    
    applyAxeSlow(target) {
        if (target.isDead || target.invincibleTime > 0) return;
        // 使用固定ID 'berserker_axe_slow'，利用底层 Hero.addBuff 的逻辑，
        // 同ID再次添加会自动刷新 time，不会产生多重叠加的 value。
        // type为 'slow' 会被 Hero.update 自动处理减速 (乘以 1 - value)
        target.addBuff('berserker_axe_slow', 'slow', 0.6, 1.0);
    }
    
    playAxeHitSound() {
        // 重置时间并播放音效
        if (this.axeHitAudio) {
            this.axeHitAudio.currentTime = 0;
            this.axeHitAudio.play().catch(e => console.warn('Audio play failed:', e));
        }
    }
    
    spawnHitParticles(ex, ey) {
        for(let i=0; i<5; i++) {
            this.game.addParticle({
                x: ex, y: ey,
                vx: (Math.random() - 0.5) * 100, vy: (Math.random() - 0.5) * 100,
                color: '#fff', life: 0.5, size: 2
            });
        }
    }
    
    onAwaken() {
        this.awakenTimer = 4.0;
    }
    
    playAwakenAudio() {
        if (this.awakenAudio) {
            this.awakenAudio.currentTime = 0;
            this.awakenAudio.play().catch(e => console.warn('Audio play failed:', e));
        }
    }
    
    playVictoryAudio() {
        // 当前版本临时复用觉醒音效作为胜利音效
        this.playAwakenAudio();
    }
    
    stopAllAudio() {
        if (this.axeHitAudio) {
            this.axeHitAudio.pause();
            this.axeHitAudio.currentTime = 0;
        }
    }
    
    drawBody(ctx) {
        super.drawBody(ctx); // Base body
        
        ctx.save();
        ctx.rotate(this.weaponRotation);
        
        const axeDist = this.radius + this.currentWeaponLength;
        
        // Draw axe handles
        ctx.strokeStyle = '#d2b48c'; // Wood color
        ctx.lineWidth = 12; // Thicker handles
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(axeDist, 0);
        ctx.moveTo(-this.radius, 0);
        ctx.lineTo(-axeDist, 0);
        ctx.stroke();
        
        // Draw axe heads
        ctx.fillStyle = '#aaa'; // Iron color
        // Axe 1
        ctx.beginPath();
        ctx.arc(axeDist, 0, 20, -Math.PI/2, Math.PI/2);
        ctx.lineTo(axeDist - 10, 0);
        ctx.fill();
        // Axe 2
        ctx.beginPath();
        ctx.arc(-axeDist, 0, 20, Math.PI/2, -Math.PI/2);
        ctx.lineTo(-axeDist + 10, 0);
        ctx.fill();
        
        ctx.restore();
        
        // Draw trails in world space
        ctx.save();
        // 取消由于 draw 方法里的 translate(this.x, this.y) 带来的局部坐标系偏移
        // 而不是使用 setTransform(1,0,0,1,0,0) 重置矩阵，因为那样会丢掉外层 Game.js 设置的 devicePixelRatio 缩放
        ctx.translate(-this.x, -this.y); 
        for (const trail of this.axeTrails) {
            ctx.globalAlpha = Math.max(0, trail.life / 0.2) * 0.5;
            ctx.fillStyle = '#aaa';
            ctx.beginPath();
            ctx.arc(trail.x, trail.y, 10, 0, Math.PI*2); // Doubled trail size
            ctx.fill();
        }
        ctx.restore();
    }
}
