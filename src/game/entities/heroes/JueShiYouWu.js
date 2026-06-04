import { Hero } from '../Hero.js';

export class JueShiYouWu extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '绝世油物';
        this.maxHp = 100;
        this.hp = 100;
        this.baseSpeed = 60;
        this.color = '#ffaa00'; 
        
        this.img = new Image();
        this.img.src = import.meta.env.BASE_URL + 'assets/img/jsyw.jpeg';
        
        this.lastCollisionTime = 0;
        this.timeSinceLastHit = 0;
        this.isTracking = false;
        this.currentTrackingSpeed = 0;
        
        // 调试参数默认值
        this.trackingTriggerTime = 2.0;
        this.cloneCount = 4;
        this.cloneLife = 5.0;
        
        // 尝试从调试配置中读取参数
        if (this.game && this.game.debugConfig && this.game.debugConfig.enabled) {
            const tuning = this.game.debugConfig.skillTuning[this.playerId === 1 ? 'p1' : 'p2'];
            if (tuning) {
                if (tuning.trackingTriggerTime !== undefined) this.trackingTriggerTime = tuning.trackingTriggerTime;
                if (tuning.cloneCount !== undefined) this.cloneCount = tuning.cloneCount;
                if (tuning.cloneLife !== undefined) this.cloneLife = tuning.cloneLife;
            }
        }
        
        this.hitVisuals = [];
        this.clones = [];
        
        this.bgmAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/JueShiYouWu/bgm.mp3');
        this.bgmAudio.loop = true;
        this.hitAudioSrc = import.meta.env.BASE_URL + 'assets/audio/JueShiYouWu/亲嘴.mp3';
        
        this.bgmStarted = false;
    }
    
    stopAllAudio() {
        if (this.bgmAudio) {
            this.bgmAudio.pause();
            this.bgmAudio.currentTime = 0;
        }
        if (this.clones && this.clones.length > 0) {
            this.clones.forEach(clone => {
                if (clone.bgmAudio) {
                    clone.bgmAudio.pause();
                    clone.bgmAudio.currentTime = 0;
                }
            });
        }
    }
    
    die() {
        super.die();
        this.stopAllAudio();
    }
    
    applyPassives() {
        super.applyPassives();
        if (this.isTracking) {
            this.speedMultiplier = this.currentTrackingSpeed / (this.baseSpeed * 8);
        }
    }
    
    onHeroCollision(other) {
        super.onHeroCollision(other);
        if (this.isDead || other.isDead) return;
        
        const now = Date.now();
        if (now - this.lastCollisionTime > 1000) {
            this.lastCollisionTime = now;
            this.triggerHit(other, this.x, this.y);
        }
    }
    
    triggerHit(target, hitX, hitY) {
        target.takeDamage(8 * this.damageMultiplier, hitX, hitY);
        
        this.timeSinceLastHit = 0;
        if (this.isTracking) {
            this.isTracking = false;
            this.speedMultiplier = 1.0;
        }
        
        this.hitVisuals.push({
            x: hitX,
            y: hitY,
            life: 0.5,
            maxLife: 0.5
        });
        
        if (this.game && this.game.shakeScreen) {
            this.game.shakeScreen(0.1, 5);
        }
        
        const hitAudio = new Audio(this.hitAudioSrc);
        hitAudio.play().catch(() => {});
    }
    
    onAwaken() {
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Awaken: Clones' });
        }
        
        for (let i = 0; i < this.cloneCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            
            // 为每个分身创建一个独立的 BGM 实例
            const cloneBgm = new Audio(import.meta.env.BASE_URL + 'assets/audio/JueShiYouWu/bgm.mp3');
            cloneBgm.loop = true;
            cloneBgm.volume = 0;
            cloneBgm.play().catch(e => console.warn('Clone BGM play failed', e));

            this.clones.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * (this.baseSpeed * 8),
                vy: Math.sin(angle) * (this.baseSpeed * 8),
                life: this.cloneLife,
                radius: this.radius,
                isTracking: false,
                timeSinceLastHit: 0,
                currentTrackingSpeed: this.baseSpeed * 8,
                lastCollisionTime: 0,
                bgmAudio: cloneBgm // 记录 BGM 引用以便销毁
            });
        }
    }
    
    updateSpecific(dt) {
        if (!this.bgmStarted) {
            this.bgmStarted = true;
            // 初始音量设为0，通过距离动态调整
            this.bgmAudio.volume = 0;
            this.bgmAudio.play().catch(e => console.warn('JueShiYouWu BGM play failed', e));
        }
        
        if (this.isDead) return;
        
        // 动态调整BGM音量（根据距离）
        if (this.enemy && !this.enemy.isDead && this.game) {
            const dist = Math.hypot(this.enemy.x - this.x, this.enemy.y - this.y);
            // 假设最远距离为对角线（约848），最近距离为两个单位紧贴（radius*2=80）
            // 我们设定在距离 400（半屏）时音量开始明显增大
            const maxDist = 600; 
            const minDist = this.radius + this.enemy.radius;
            
            // 距离越近，音量越大 (0.1 到 1.0 之间平滑过渡)
            let targetVolume = 1.0 - (dist - minDist) / (maxDist - minDist);
            targetVolume = Math.max(0.1, Math.min(1.0, targetVolume));
            
            // 使用简单的平滑插值过渡音量，避免突变
            this.bgmAudio.volume += (targetVolume - this.bgmAudio.volume) * 0.1;
        }
        
        this.timeSinceLastHit += dt;
        if (this.timeSinceLastHit >= this.trackingTriggerTime && !this.isTracking) {
            this.isTracking = true;
            this.currentTrackingSpeed = this.getSpeed();
        }
        
        if (this.isTracking) {
            this.currentTrackingSpeed += 240 * dt;
            if (this.enemy && !this.enemy.isDead) {
                const dx = this.enemy.x - this.x;
                const dy = this.enemy.y - this.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 0) {
                    this.vx = dx / dist;
                    this.vy = dy / dist;
                }
            }
        }
        
        // Update hit visuals
        for (let i = this.hitVisuals.length - 1; i >= 0; i--) {
            const v = this.hitVisuals[i];
            v.life -= dt;
            if (v.life <= 0) {
                this.hitVisuals.splice(i, 1);
            }
        }
        
        // Update clones
        let hasActiveClones = false;
        
        for (let i = this.clones.length - 1; i >= 0; i--) {
            const clone = this.clones[i];
            clone.life -= dt;
            if (clone.life <= 0) {
                if (clone.bgmAudio) {
                    clone.bgmAudio.pause();
                    clone.bgmAudio.currentTime = 0;
                }
                this.clones.splice(i, 1);
                continue;
            }
            
            hasActiveClones = true;
            
            // 动态调整分身 BGM 音量
            if (this.enemy && !this.enemy.isDead && this.game && clone.bgmAudio) {
                const dist = Math.hypot(this.enemy.x - clone.x, this.enemy.y - clone.y);
                const maxDist = 600; 
                const minDist = clone.radius + this.enemy.radius;
                
                let targetVolume = 1.0 - (dist - minDist) / (maxDist - minDist);
                targetVolume = Math.max(0.1, Math.min(1.0, targetVolume));
                
                clone.bgmAudio.volume += (targetVolume - clone.bgmAudio.volume) * 0.1;
            }
            
            clone.timeSinceLastHit += dt;
            if (clone.timeSinceLastHit >= this.trackingTriggerTime && !clone.isTracking) {
                clone.isTracking = true;
                clone.currentTrackingSpeed = Math.hypot(clone.vx, clone.vy);
            }
            
            if (clone.isTracking) {
                clone.currentTrackingSpeed += 240 * dt;
                if (this.enemy && !this.enemy.isDead) {
                    const dx = this.enemy.x - clone.x;
                    const dy = this.enemy.y - clone.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist > 0) {
                        clone.vx = (dx / dist) * clone.currentTrackingSpeed;
                        clone.vy = (dy / dist) * clone.currentTrackingSpeed;
                    }
                }
            }
            
            clone.x += clone.vx * dt;
            clone.y += clone.vy * dt;
            
            if (clone.x < clone.radius) { clone.x = clone.radius; clone.vx *= -1; }
            if (clone.x > this.game.width - clone.radius) { clone.x = this.game.width - clone.radius; clone.vx *= -1; }
            if (clone.y < clone.radius) { clone.y = clone.radius; clone.vy *= -1; }
            if (clone.y > this.game.height - clone.radius) { clone.y = this.game.height - clone.radius; clone.vy *= -1; }
            
            if (this.enemy && !this.enemy.isDead) {
                if (this.game.physics.checkCircleCollision(clone, this.enemy)) {
                    const now = Date.now();
                    if (now - clone.lastCollisionTime > 1000) {
                        clone.lastCollisionTime = now;
                        this.triggerHit(this.enemy, clone.x, clone.y);
                        
                        // 碰撞后消失前停止音效
                        if (clone.bgmAudio) {
                            clone.bgmAudio.pause();
                            clone.bgmAudio.currentTime = 0;
                        }
                        this.clones.splice(i, 1);
                        
                        // 重新检查是否还有存活的分身
                        if (this.clones.length === 0) {
                            hasActiveClones = false;
                        }
                        continue;
                    }
                }
            }
        }
        
        // 如果所有分身都消失了，结束觉醒状态
        if (this.isAwakened && !hasActiveClones) {
            this.isAwakened = false;
        }
    }
    
    drawBody(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.clip();
        
        if (this.img.complete) {
            ctx.drawImage(this.img, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
        } else {
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.playerId === 1 ? '#ff4444' : '#4444ff';
        ctx.stroke();
        ctx.restore();
    }
    
    draw(ctx) {
        super.draw(ctx);
        if (this.clones && this.clones.length > 0) {
            ctx.save();
            for (const clone of this.clones) {
                ctx.save();
                ctx.translate(clone.x, clone.y);
                
                ctx.beginPath();
                ctx.arc(0, 0, clone.radius, 0, Math.PI * 2);
                ctx.clip();
                
                if (this.img.complete) {
                    ctx.drawImage(this.img, -clone.radius, -clone.radius, clone.radius * 2, clone.radius * 2);
                } else {
                    ctx.fillStyle = this.color;
                    ctx.fill();
                }
                
                ctx.lineWidth = 2;
                ctx.strokeStyle = this.playerId === 1 ? '#ff4444' : '#4444ff';
                ctx.stroke();
                
                ctx.restore();
            }
            ctx.restore();
        }
    }
    
    drawOverlay(ctx) {
        super.drawOverlay(ctx);
        for (const v of this.hitVisuals) {
            const progress = 1 - v.life / v.maxLife; 
            
            ctx.save();
            ctx.translate(v.x, v.y);
            
            let scale, alpha;
            if (progress <= 0.4) {
                scale = progress / 0.4;
                alpha = 1.0;
            } else {
                scale = 1.0;
                alpha = 1 - (progress - 0.4) / 0.6;
            }
            
            ctx.globalAlpha = alpha;
            const size = 1000 * scale; // 铺满场地，600x600的对角线是848，所以1000足够
            if (this.img.complete) {
                ctx.drawImage(this.img, -size/2, -size/2, size, size);
            }
            ctx.restore();
        }
    }
}
