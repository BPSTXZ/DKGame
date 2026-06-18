import { Hero } from '../Hero.js';

export class PingPongHero extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '乒乓侠';
        this.maxHp = 100;
        this.hp = 100;
        this.baseSpeed = 60;
        this.color = '#ff6600'; // 橙色乒乓主题
        
        // 乒乓球数据
        this.balls = [];
        this.lastEnhanceTime = 0; // 上次强化时间，0.2s冷却
        this.enhanceCooldown = 0.2;
        
        // 尝试从调试配置中读取参数
        if (this.game && this.game.debugConfig && this.game.debugConfig.enabled) {
            const tuning = this.game.debugConfig.skillTuning[this.playerId === 1 ? 'p1' : 'p2'];
            if (tuning) {
                if (tuning.enhanceCooldown !== undefined) this.enhanceCooldown = tuning.enhanceCooldown;
            }
        }
        
        // 开局即发射第一颗球
        this.initialLaunchDone = false;
        this.initialLaunchDelay = 0.5; // 0.5秒后发射
    }
    
    launchBall(targetX, targetY, damage, speed) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.hypot(dx, dy);
        const dirX = dist > 0 ? dx / dist : 1;
        const dirY = dist > 0 ? dy / dist : 0;
        
        this.balls.push({
            x: this.x + dirX * (this.radius + 15),
            y: this.y + dirY * (this.radius + 15),
            vx: dirX * speed,
            vy: dirY * speed,
            speed: speed,
            damage: damage,
            radius: 10,
            trail: [], // 轨迹点
            hitCooldown: 0
        });
    }
    
    updateSpecific(dt) {
        if (this.isDead) return;
        
        // 开局延迟后向敌方发射乒乓球
        if (!this.initialLaunchDone) {
            this.initialLaunchDelay -= dt;
            if (this.initialLaunchDelay <= 0 && this.enemy && !this.enemy.isDead) {
                this.initialLaunchDone = true;
                const ballSpeed = this.getSpeed() * 1.5; // 1.5倍本体移速
                this.launchBall(this.enemy.x, this.enemy.y, 2, ballSpeed);
            }
        }
        
        // 更新强化冷却
        if (this.lastEnhanceTime > 0) {
            this.lastEnhanceTime -= dt;
        }
        
        // 更新所有乒乓球
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];
            
            // 觉醒球生命周期
            if (ball.life !== undefined) {
                ball.life -= dt;
                if (ball.life <= 0) {
                    this.balls.splice(i, 1);
                    continue;
                }
            }
            
            if (ball.hitCooldown > 0) {
                ball.hitCooldown -= dt;
            }
            
            // 移动
            ball.x += ball.vx * dt;
            ball.y += ball.vy * dt;
            
            // 边界反弹
            if (ball.x < ball.radius) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx); }
            if (ball.x > this.game.width - ball.radius) { ball.x = this.game.width - ball.radius; ball.vx = -Math.abs(ball.vx); }
            if (ball.y < ball.radius) { ball.y = ball.radius; ball.vy = Math.abs(ball.vy); }
            if (ball.y > this.game.height - ball.radius) { ball.y = this.game.height - ball.radius; ball.vy = -Math.abs(ball.vy); }
            
            // 重新归一化速度
            const currentSpeed = Math.hypot(ball.vx, ball.vy);
            if (currentSpeed > 0) {
                ball.vx = (ball.vx / currentSpeed) * ball.speed;
                ball.vy = (ball.vy / currentSpeed) * ball.speed;
            }
            
            // 轨迹点记录
            ball.trail.push({ x: ball.x, y: ball.y, life: 0.2 });
            if (ball.trail.length > 15) ball.trail.shift();
            
            // 碰到敌方
            if (this.enemy && !this.enemy.isDead && ball.hitCooldown <= 0) {
                const dist = Math.hypot(ball.x - this.enemy.x, ball.y - this.enemy.y);
                if (dist < ball.radius + this.enemy.radius) {
                    // 伤害
                    this.enemy.takeDamage(ball.damage * this.damageMultiplier, ball.x, ball.y);
                    
                    // 反弹
                    const ex = ball.x - this.enemy.x;
                    const ey = ball.y - this.enemy.y;
                    const ed = Math.hypot(ex, ey);
                    if (ed > 0) {
                        ball.vx = (ex / ed) * ball.speed;
                        ball.vy = (ey / ed) * ball.speed;
                        ball.x = this.enemy.x + (ex / ed) * (ball.radius + this.enemy.radius + 1);
                        ball.y = this.enemy.y + (ey / ed) * (ball.radius + this.enemy.radius + 1);
                    }
                    
                    ball.hitCooldown = 0.1;
                    
                    // 命中特效
                    if (this.game) {
                        this.game.shakeScreen(0.05, 2);
                        for(let j = 0; j < 8; j++) {
                            const a = Math.random() * Math.PI * 2;
                            this.game.addParticle({
                                x: this.enemy.x, y: this.enemy.y,
                                vx: Math.cos(a) * 100, vy: Math.sin(a) * 100,
                                color: '#ff6600', life: 0.3, size: 3
                            });
                        }
                    }
                }
            }
            
            // 碰到本体 → 强化
            if (ball.hitCooldown <= 0 && this.lastEnhanceTime <= 0) {
                const dist = Math.hypot(ball.x - this.x, ball.y - this.y);
                if (dist < ball.radius + this.radius) {
                    // 强化：伤害+2，移速×1.3；达到上限2000后速度不再提升，伤害改为+3
                    if (ball.speed < 2000) {
                        ball.damage += 2;
                        ball.speed = Math.min(2000, ball.speed * 1.3);
                    } else {
                        ball.speed = 2000;
                        ball.damage += 3;
                    }
                    
                    // 反弹
                    const hx = ball.x - this.x;
                    const hy = ball.y - this.y;
                    const hd = Math.hypot(hx, hy);
                    if (hd > 0) {
                        ball.vx = (hx / hd) * ball.speed;
                        ball.vy = (hy / hd) * ball.speed;
                        ball.x = this.x + (hx / hd) * (ball.radius + this.radius + 1);
                        ball.y = this.y + (hy / hd) * (ball.radius + this.radius + 1);
                    }
                    
                    this.lastEnhanceTime = this.enhanceCooldown;
                    ball.hitCooldown = 0.1;
                    
                    // 强化特效
                    if (this.game) {
                        this.game.addFloatingText(ball.x, ball.y - 20, '强化!', '#ff6600');
                        for(let j = 0; j < 12; j++) {
                            const a = Math.random() * Math.PI * 2;
                            this.game.addParticle({
                                x: this.x, y: this.y,
                                vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
                                color: '#ffaa00', life: 0.4, size: 4
                            });
                        }
                    }
                }
            }
            
            // 更新轨迹生命周期
            for (let j = ball.trail.length - 1; j >= 0; j--) {
                ball.trail[j].life -= dt;
                if (ball.trail[j].life <= 0) ball.trail.splice(j, 1);
            }
        }
        
        // 加速粒子：当球速度很快时，本体周围产生特效
        let maxBallSpeed = 0;
        for (const ball of this.balls) {
            if (ball.speed > maxBallSpeed) maxBallSpeed = ball.speed;
        }
        if (maxBallSpeed > this.getSpeed() * 3 && this.game && Math.random() < 0.3) {
            this.game.addParticle({
                x: this.x + (Math.random() - 0.5) * this.radius,
                y: this.y + (Math.random() - 0.5) * this.radius,
                vx: 0, vy: 0,
                color: '#ff6600', life: 0.5, size: 4
            });
        }
        
        // 觉醒结束后检查
        if (this.isAwakened && this.balls.filter(b => b.life !== undefined).length === 0 && this.balls.length > 0) {
            // 所有觉醒球都消失了
        }
        if (this.isAwakened && this.balls.length === 0) {
            this.isAwakened = false;
        }
    }
    
    onHeroCollision(other) {
        super.onHeroCollision(other);
        // 本体碰撞无额外伤害
    }
    
    /**
     * 觉醒：双重奏 —— 立即生成第二颗与当前球属性相同的乒乓球
     */
    onAwaken() {
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Awaken: 双重奏' });
        }
        
        // 复制当前最强的一颗球
        if (this.balls.length > 0) {
            const mainBall = this.balls[0];
            const cloneBall = {
                x: mainBall.x,
                y: mainBall.y,
                vx: -mainBall.vx,
                vy: -mainBall.vy,
                speed: mainBall.speed,
                damage: mainBall.damage,
                radius: 10,
                trail: [],
                hitCooldown: 0,
                life: 5.0 // 5秒后消失
            };
            this.balls.push(cloneBall);
            
            // 觉醒特效
            if (this.game) {
                this.game.shakeScreen(0.15, 6);
                for (let i = 0; i < 25; i++) {
                    const a = Math.random() * Math.PI * 2;
                    const s = Math.random() * 200 + 100;
                    this.game.addParticle({
                        x: this.x, y: this.y,
                        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                        color: '#ffaa00', life: 0.6, size: 5
                    });
                }
            }
        } else {
            // 无球时立刻向敌方补发一颗
            if (this.enemy && !this.enemy.isDead) {
                const ballSpeed = this.getSpeed() * 1.5;
                this.launchBall(this.enemy.x, this.enemy.y, 2, ballSpeed);
            }
        }
    }
    
    /**
     * 绘制乒乓球本体和轨迹
     */
    draw(ctx) {
        super.draw(ctx);
        
        if (this.balls.length > 0) {
            ctx.save();
            for (const ball of this.balls) {
                // 轨迹
                if (ball.trail.length > 1) {
                    ctx.save();
                    ctx.lineCap = 'round';
                    for (let i = 1; i < ball.trail.length; i++) {
                        const p0 = ball.trail[i - 1];
                        const p1 = ball.trail[i];
                        const alpha = p1.life / 0.2;
                        ctx.strokeStyle = `rgba(255, 102, 0, ${alpha * 0.6})`;
                        ctx.lineWidth = ball.radius * alpha;
                        ctx.beginPath();
                        ctx.moveTo(p0.x, p0.y);
                        ctx.lineTo(p1.x, p1.y);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
                
                // 外层光晕
                ctx.save();
                ctx.translate(ball.x, ball.y);
                
                const glowGrad = ctx.createRadialGradient(0, 0, ball.radius * 0.5, 0, 0, ball.radius * 2.5);
                glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
                glowGrad.addColorStop(0.3, 'rgba(255, 170, 0, 0.6)');
                glowGrad.addColorStop(0.7, 'rgba(255, 102, 0, 0.3)');
                glowGrad.addColorStop(1, 'rgba(255, 102, 0, 0)');
                
                ctx.fillStyle = glowGrad;
                ctx.beginPath();
                ctx.arc(0, 0, ball.radius * 2.5, 0, Math.PI * 2);
                ctx.fill();
                
                // 核心球体
                const ballGrad = ctx.createRadialGradient(-ball.radius * 0.3, -ball.radius * 0.3, ball.radius * 0.1, 0, 0, ball.radius);
                ballGrad.addColorStop(0, '#ffffff');
                ballGrad.addColorStop(0.4, '#ffaa00');
                ballGrad.addColorStop(1, '#cc4400');
                
                ctx.fillStyle = ballGrad;
                ctx.beginPath();
                ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();
                
                // 两道乒乓球接缝线
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 0.5;
                for (let j = 0; j < 2; j++) {
                    const seamAngle = ball.speed * 10 + j * Math.PI;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, ball.radius, ball.radius * 0.25, seamAngle, 0, Math.PI * 2);
                    ctx.stroke();
                }
                
                ctx.restore();
            }
            ctx.restore();
        }
    }
    
    drawBody(ctx) {
        ctx.save();
        
        // 基础球体
        const bodyGrad = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, 0, 0, 0, this.radius);
        bodyGrad.addColorStop(0, '#ff8c00');
        bodyGrad.addColorStop(0.6, '#ff6600');
        bodyGrad.addColorStop(1, '#993300');
        
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 乒乓拍胶皮纹理 - 纵横交错
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.clip();
        
        // 横向纹路
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        for (let i = -this.radius; i < this.radius; i += 6) {
            ctx.beginPath();
            ctx.moveTo(-this.radius, i);
            ctx.lineTo(this.radius, i);
            ctx.stroke();
        }
        
        // 纵向纹路
        ctx.strokeStyle = 'rgba(255, 200, 100, 0.15)';
        for (let i = -this.radius; i < this.radius; i += 6) {
            ctx.beginPath();
            ctx.moveTo(i, -this.radius);
            ctx.lineTo(i, this.radius);
            ctx.stroke();
        }
        
        // 拍柄标记（中心十字）
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
        ctx.moveTo(0, -8); ctx.lineTo(0, 8);
        ctx.stroke();
        
        ctx.restore();
        
        // 描边
        ctx.strokeStyle = this.playerId === 1 ? '#ff4444' : '#4444ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // 速度光环（当有球在高速运动时）
        let maxSpeed = 0;
        for (const ball of this.balls) {
            if (ball.speed > maxSpeed) maxSpeed = ball.speed;
        }
        if (maxSpeed > this.baseSpeed * 8 * 1.5) {
            const intensity = Math.min(1, (maxSpeed - this.baseSpeed * 8 * 1.5) / (this.baseSpeed * 8 * 15));
            ctx.strokeStyle = `rgba(255, 150, 0, ${intensity * 0.7})`;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff6600';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 8 + Math.sin(Date.now() / 200) * 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        
        ctx.restore();
    }
}
