/**
 * Game 类 - 游戏主引擎
 * 负责主循环、状态管理、对象更新与渲染调度
 */
import { Physics } from './Physics.js';
import { Renderer } from './Renderer.js';
import { AwakenStone } from '../entities/AwakenStone.js';

export class Game {
    constructor(canvas, p1Class, p2Class, isTraining = false, onStateUpdate, onGameOver, onVictory) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        this.isTraining = isTraining;
        this.onStateUpdate = onStateUpdate;
        this.onGameOver = onGameOver;
        this.onVictory = onVictory;
        
        this.p1Class = p1Class;
        this.p2Class = p2Class;
        
        this.renderer = new Renderer(this.ctx, this.width, this.height);
        this.physics = new Physics(this.width, this.height);
        
        this.initGame();
    }
    
    initGame() {
        // Start positions
        const p1Start = { x: 100, y: this.height / 2 };
        const p2Start = { x: this.width - 100, y: this.height / 2 };
        
        this.p1 = new this.p1Class(p1Start.x, p1Start.y, 1); // 1 = player 1
        this.p2 = new this.p2Class(p2Start.x, p2Start.y, 2); // 2 = player 2
        
        this.p1.enemy = this.p2;
        this.p2.enemy = this.p1;
        this.p1.game = this;
        this.p2.game = this;
        
        this.entities = [this.p1, this.p2];
        this.particles = [];
        this.floatingTexts = [];
        
        this.awakenStone = null;
        this.awakenStoneSpawned = false;
        
        this.isPaused = false;
        this.isGameOver = false;
        
        this.globalFreezeTime = 0;
        this.awakenCenter = null;
        this.awakenRadius = 0;
        
        if (this.onStateUpdate) {
            this.onStateUpdate(this.p1, this.p2);
        }
    }
    
    restart() {
        // 用于训练场或战斗结束后重新初始化游戏状态
        this.initGame();
        this.lastTime = performance.now();
    }
    
    start() {
        this.lastTime = performance.now();
        if (this.onStateUpdate) {
            this.onStateUpdate(this.p1, this.p2);
        }
        this.loop(this.lastTime);
    }
    
    stop() {
        if (this.reqId) {
            cancelAnimationFrame(this.reqId);
        }
    }
    
    /**
     * 游戏主循环
     * @param {number} time 当前时间戳
     */
    loop(time) {
        const dt = (time - this.lastTime) / 1000; // 转换为秒
        this.lastTime = time;
        
        // 限制最大 dt 以防止切后台时产生巨大跳跃
        const cappedDt = Math.min(dt, 0.1);
        this.lastDt = cappedDt; // 记录最新帧的 dt 供英雄内部使用
        
        this.update(cappedDt);
        this.draw();
        
        // 游戏循环一直运行，以支持胜利后的粒子和退场动画
        this.reqId = requestAnimationFrame(t => this.loop(t));
    }
    
    /**
     * 游戏逻辑更新
     * @param {number} dt 增量时间（秒）
     */
    update(dt) {
        if (this.isPaused) return;
        
        // 如果游戏结束，则停止英雄逻辑更新和碰撞，但保留退场动画
        if (this.isGameOver) {
            this.entities.forEach(e => {
                if (e.isDead && e.deathTimer > 0) {
                    e.deathTimer -= dt; // 仅更新死亡动画计时器
                }
            });
            this.updateParticles(dt);
            this.updateFloatingTexts(dt);
            return;
        }
        
        // 处理全局时停（觉醒演出）
        if (this.globalFreezeTime > 0) {
            this.globalFreezeTime -= dt;
            this.awakenRadius += 600 * dt; // 扩散特效
            
            // 时停期间仍然更新粒子和飘字
            this.updateParticles(dt);
            this.updateFloatingTexts(dt);
            
            if (this.globalFreezeTime <= 0) {
                // 时停结束，恢复游戏，清除觉醒特效半径
                this.awakenRadius = 0;
            } else {
                return; // 跳过主体逻辑更新
            }
        }
        
        // 检查觉醒石生成条件
        if (!this.awakenStoneSpawned && (this.p1.hp <= 25 || this.p2.hp <= 25)) {
            this.spawnAwakenStone();
        }
        
        // Update entities
        this.entities.forEach(e => {
            if (e.isDead) return;
            e.update(dt);
            this.physics.handleWallCollision(e);
        });
        
        // Hero-Hero collision
        if (!this.p1.isDead && !this.p2.isDead) {
            this.physics.checkHeroCollision(this.p1, this.p2);
        }
        
        // Awaken Stone update and collision
        if (this.awakenStone && !this.awakenStone.isCollected) {
            this.awakenStone.update(dt);
            if (!this.p1.isDead && this.physics.checkCircleCollision(this.p1, this.awakenStone)) {
                this.collectAwakenStone(this.p1);
            } else if (!this.p2.isDead && this.physics.checkCircleCollision(this.p2, this.awakenStone)) {
                this.collectAwakenStone(this.p2);
            }
        }
        
        this.updateParticles(dt);
        this.updateFloatingTexts(dt);
        
        // 清理实体（这里不再通过 splice 删除，以便持续绘制退场效果，依靠 isDead 标记即可）
        this.checkWinCondition();
        
        if (this.onStateUpdate) {
            this.onStateUpdate(this.p1, this.p2);
        }
    }
    
    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(dt);
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    updateFloatingTexts(dt) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.update(dt);
            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }
    
    draw() {
        this.renderer.clear();
        
        // 绘制竞技场背景/网格
        this.renderer.drawArena();
        
        // 绘制觉醒石
        if (this.awakenStone && !this.awakenStone.isCollected) {
            this.awakenStone.draw(this.ctx);
        }
        
        // 绘制实体
        this.entities.forEach(e => e.draw(this.ctx));
        
        // 绘制全局时停演出（金色能量场扩散）
        if (this.globalFreezeTime > 0) {
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'screen';
            this.ctx.beginPath();
            this.ctx.arc(this.awakenCenter.x, this.awakenCenter.y, this.awakenRadius, 0, Math.PI * 2);
            const grad = this.ctx.createRadialGradient(
                this.awakenCenter.x, this.awakenCenter.y, 0,
                this.awakenCenter.x, this.awakenCenter.y, this.awakenRadius
            );
            grad.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
            grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
            this.ctx.fillStyle = grad;
            this.ctx.fill();
            this.ctx.restore();
        }
        
        // 绘制粒子和飘字
        this.particles.forEach(p => p.draw(this.ctx));
        this.floatingTexts.forEach(ft => ft.draw(this.ctx));
    }
    
    /**
     * 生成觉醒石
     */
    spawnAwakenStone() {
        this.awakenStoneSpawned = true;
        this.awakenStone = new AwakenStone(this.width / 2, this.height / 2);
    }
    
    /**
     * 处理英雄拾取觉醒石
     */
    collectAwakenStone(hero) {
        this.awakenStone.isCollected = true;
        
        // 触发全局时停演出，持续 2 秒
        this.globalFreezeTime = 2.0; 
        this.awakenCenter = { x: hero.x, y: hero.y };
        
        // 生成吸收粒子特效
        for(let i=0; i<30; i++) {
            this.addParticle({
                x: this.awakenStone.x, y: this.awakenStone.y,
                vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200,
                life: 1.5, color: '#ffd700', size: Math.random() * 4 + 2,
                target: hero
            });
        }
        
        // 在时停动画开始的一瞬间，立即让对应英雄播放觉醒音效
        hero.playAwakenAudio();
        
        // 演出结束后，执行对应英雄的觉醒逻辑状态切换
        setTimeout(() => {
            if (!hero.isDead) hero.triggerAwaken();
        }, 2000);
    }
    
    addParticle(config) {
        this.particles.push(new Particle(config));
    }
    
    addFloatingText(x, y, text, color) {
        this.floatingTexts.push(new FloatingText(x, y, text, color));
    }
    
    checkWinCondition() {
        if (this.isGameOver) return;
        
        let winner = null;
        if (this.p1.isDead && !this.p2.isDead) winner = this.p2;
        else if (this.p2.isDead && !this.p1.isDead) winner = this.p1;
        else if (this.p1.isDead && this.p2.isDead) winner = 'draw'; // 同归于尽
        
        if (winner) {
            this.isGameOver = true;
            
            // 触发游戏胜利瞬间的回调（如停止音效、播放喝彩等）
            if (this.onVictory) {
                this.onVictory(winner);
            }
            
            if (winner !== 'draw') {
                winner.isVictorious = true;
                
                // 生成连续的彩带喷发效果
                let confettiCount = 0;
                const confettiInterval = setInterval(() => {
                    for(let i=0; i<15; i++) {
                        this.addParticle({
                            x: this.width/2 + (Math.random() - 0.5) * 200, 
                            y: this.height, // 从底部喷出
                            vx: (Math.random() - 0.5) * 800, 
                            vy: -Math.random() * 800 - 300, // 向上初速度
                            life: 3 + Math.random()*2, 
                            color: `hsl(${Math.random()*360}, 100%, 50%)`, 
                            size: Math.random() * 8 + 4,
                            gravity: 400,
                            rotationSpeed: (Math.random() - 0.5) * 10 // 添加旋转效果的参数(如果需要)
                        });
                    }
                    confettiCount++;
                    if (confettiCount > 20) { // 持续喷发一段时间
                        clearInterval(confettiInterval);
                    }
                }, 100);
            }
            
            // 延迟2秒显示胜利结算 UI，让玩家有时间欣赏胜利和死亡动画
            setTimeout(() => {
                if (this.onGameOver) {
                    this.onGameOver(winner === 'draw' ? '平局！' : `${winner.name} Wins！`);
                }
            }, 2500);
        }
    }
}

/**
 * 粒子特效类
 */
class Particle {
    constructor(c) {
        this.x = c.x; this.y = c.y;
        this.vx = c.vx || 0; this.vy = c.vy || 0;
        this.life = c.life || 1;
        this.maxLife = this.life;
        this.color = c.color || '#fff';
        this.size = c.size || 3;
        this.target = c.target || null;
        this.gravity = c.gravity || 0;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = c.rotationSpeed || 0;
    }
    
    update(dt) {
        this.life -= dt;
        this.rotation += this.rotationSpeed * dt;
        
        if (this.target) {
            // 追踪目标（用于觉醒石吸收）
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 5) {
                this.vx += (dx / dist) * 500 * dt;
                this.vy += (dy / dist) * 500 * dt;
            } else {
                this.life = 0; // 到达目标
            }
        }
        
        // 空气阻力模拟 (特别是纸屑)
        if (this.gravity > 0) {
            this.vx *= 0.98; // 水平减速
        }
        
        this.vy += this.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        
        if (this.rotationSpeed !== 0) {
            // 彩带/纸屑画成矩形
            ctx.fillRect(-this.size/2, -this.size, this.size, this.size*2);
        } else {
            // 默认画圆
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI*2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

/**
 * 伤害数字飘字类
 */
class FloatingText {
    constructor(x, y, text, color) {
        this.x = x; this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.maxLife = 1.0;
        this.vy = -30;
    }
    
    update(dt) {
        this.life -= dt;
        this.y += this.vy * dt; // 向上漂浮
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}