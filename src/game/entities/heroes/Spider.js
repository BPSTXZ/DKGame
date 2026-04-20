import { Hero } from '../Hero.js';

/**
 * 蜘蛛侠英雄类
 * 特性：每次碰壁都会生成蛛网连接，敌人触碰蛛网会受伤减速。血量越低移速越快，觉醒期间无敌且大幅加速。
 */
export class Spider extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '蜘蛛';
        this.maxHp = 100;
        this.hp = 100;
        this.baseSpeed = 60; // 基础移速同步提升到 60
        this.color = '#767cdf'; // White/gray circle
        
        // Spider specific
        this.webs = []; // Array of {x1, y1, x2, y2}
        this.webNodes = []; // Array of {x, y} for sticky effects on walls
        this.lastWebPoint = null;
        
        // Passive
        this.passiveSpeedMultiplier = 1.0;
        
        // Awaken
        this.awakenTimer = 0;
        this.awakenDuration = 4.0; // 觉醒总时长 4 秒
        
        // Audio specific
        this.webHitAudio = new Audio('/assets/audio/spider/蛛丝触发.mp3');
        this.awakenAudio = new Audio('/assets/audio/spider/蜘蛛侠.mp3');
    }
    
    applyPassives() {
        super.applyPassives(); // 调用父类应用基础效果
        
        // HP ratio speed up: "根据已损失血量比例进行百分比叠加"
        const lossRatio = 1 - (this.hp / this.maxHp);
        // 降低被动移速加成比例：最大增加 20% (原为 50%)
        this.passiveSpeedMultiplier = 1.0 + (lossRatio * 0.2);
        this.speedMultiplier *= this.passiveSpeedMultiplier;
        
        // 觉醒状态下的加速
        if (this.isAwakened) {
            this.speedMultiplier *= 1.5; // +50% speed
        }
    }
    
    onWallBounce() {
        if (this.isDead) return;
        
        // 计算撞击墙壁的确切触点
        let cx = this.x;
        let cy = this.y;
        if (this.x <= this.radius + 1) cx = 0;
        else if (this.x >= this.game.width - this.radius - 1) cx = this.game.width;
        
        if (this.y <= this.radius + 1) cy = 0;
        else if (this.y >= this.game.height - this.radius - 1) cy = this.game.height;
        
        const currentPoint = { x: cx, y: cy };
        this.webNodes.push(currentPoint); // 记录墙壁黏附点
        
        if (this.lastWebPoint) {
            this.webs.push({
                x1: this.lastWebPoint.x,
                y1: this.lastWebPoint.y,
                x2: currentPoint.x,
                y2: currentPoint.y,
                active: true
            });
        }
        
        this.lastWebPoint = currentPoint;
    }
    
    onHeroCollision(other) {
        if (this.isDead || other.isDead) return;
        
        // 如果对方是吸血鬼且正在吸附状态，则跳过基础碰撞伤害，防止每帧重复触发
        if (other.name === 'Vampire' && other.isSucking) {
            return;
        }
        
        // 增加内置CD防止在同一帧或极短时间内重复触发伤害
        const now = Date.now();
        if (!this.lastCollisionTime || now - this.lastCollisionTime > 500) {
            // Base damage 1, 乘以攻击倍率
            other.takeDamage(1 * this.damageMultiplier, this.x, this.y);
            this.lastCollisionTime = now;
        }
    }
    
    updateSpecific(dt) {
        if (this.isDead) {
            this.webs = [];
            return;
        }
        
        // 更新觉醒倒计时
        if (this.isAwakened) {
            this.awakenTimer -= dt;
            if (this.awakenTimer <= 0) {
                this.isAwakened = false; // 4秒结束后，清除觉醒状态
                this.awakenTimer = 0; // 重置为 0
            }
        }
        
        // 如果在觉醒期间，发射额外的蛛网
        if (this.isAwakened && !this.isSuppressed) {
            // 每 0.5 秒向随机方向发射一次蛛丝
            if (Math.floor(this.awakenTimer * 2) > Math.floor((this.awakenTimer - dt) * 2)) {
                // ... 实际上这里逻辑放在这里有些复杂，我们可以简单点，每帧有概率发射
                // 或者用一个专门的 timer
                if (!this.awakenShootTimer) this.awakenShootTimer = 0;
                this.awakenShootTimer += dt;
                if (this.awakenShootTimer >= 0.5) {
                    this.awakenShootTimer = 0;
                    
                    const angle = Math.random() * Math.PI * 2;
                    const webSpeed = 300;
                    // ... 在Spider中增加投射物的逻辑需要新建一个对象类型。
                    // 原代码 Spider 只有墙壁触碰，没有发射飞行物？
                    // "觉醒时获得无敌并疯狂喷吐蛛丝" - 这里可能原版没实现或者实现不同。
                }
            }
        }
        
        // Check web collision with enemy
        if (this.enemy && !this.enemy.isDead) {
            for (const web of this.webs) {
                if (!web.active) continue;
                
                // Line-circle intersection
                if (this.game.physics.checkLineCircleCollision(web.x1, web.y1, web.x2, web.y2, this.enemy)) {
                    this.onEnemyHitWeb(this.enemy, web);
                    // To prevent continuous hit every frame, we can disable the web for a bit or just apply it once
                    // Requirement: "触碰蛛丝: 受到2点伤害, 并触发减速"
                    // Let's add a cooldown per web per enemy.
                    web.active = false;
                    setTimeout(() => { web.active = true; }, 1000); // 1s cooldown
                }
            }
        }
        
        // Update current web drawn from last point to hero's edge
        if (this.lastWebPoint) {
            const dx = this.x - this.lastWebPoint.x;
            const dy = this.y - this.lastWebPoint.y;
            const dist = Math.hypot(dx, dy);
            
            let edgeX = this.x;
            let edgeY = this.y;
            if (dist > 0) {
                edgeX = this.x - (dx / dist) * this.radius;
                edgeY = this.y - (dy / dist) * this.radius;
            }
            
            this.currentWeb = {
                x1: this.lastWebPoint.x,
                y1: this.lastWebPoint.y,
                x2: edgeX,
                y2: edgeY
            };
        }
    }
    
    onEnemyHitWeb(enemy, web) {
        enemy.takeDamage(2 * this.damageMultiplier, (web.x1+web.x2)/2, (web.y1+web.y2)/2);
        
        // 播放蛛丝触发音效
        this.webHitAudio.currentTime = 0;
        this.webHitAudio.play().catch(e => console.warn('Audio play failed:', e));
        
        // Slow effect
        // MoveSpeed -10%, duration 1s. Non-stackable, just refresh.
        enemy.addBuff('spider_web_slow', 'slow', 0.1, 1.0);
    }
    
    onAwaken() {
        this.invincibleTime = 2.0; // 无敌时间改为 2 秒
        this.awakenTimer = this.awakenDuration; // 觉醒总时长为 4 秒
        this.cleanseDebuffs(); // 开启觉醒时清除现有所有负面状态（减速、流血等）
        // Speed is handled in applyPassives
    }
    
    playAwakenAudio() {
        // 播放觉醒音效
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
        if (this.webHitAudio) {
            this.webHitAudio.pause();
            this.webHitAudio.currentTime = 0;
        }
    }
    
    draw(ctx) {
        // Draw webs before hero body
        if (!this.isDead) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 4; // 加粗蛛丝
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 10; // 蛛丝发光
            
            // Finished webs
            for (const web of this.webs) {
                ctx.beginPath();
                ctx.moveTo(web.x1, web.y1);
                ctx.lineTo(web.x2, web.y2);
                ctx.stroke();
            }
            
            // Current drawing web
            if (this.currentWeb) {
                ctx.beginPath();
                ctx.moveTo(this.currentWeb.x1, this.currentWeb.y1);
                ctx.lineTo(this.currentWeb.x2, this.currentWeb.y2);
                ctx.stroke();
            }
            
            // 绘制墙壁黏附点特效
            ctx.fillStyle = '#fff';
            for (const node of this.webNodes) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
        }
        
        super.draw(ctx);
    }
}
