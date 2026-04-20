import { Hero } from '../Hero.js';

/**
 * 华强 HuaQiang 英雄类
 * 特性：砍刀攻击与场地陷阱，磁吸回收
 */
export class HuaQiang extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '华强';
        this.color = '#26272d';
        this.hp = 100;
        this.maxHp = 100;
        this.baseSpeed = 65; // 基础移速 65
        this.radius = 40; // 统一碰撞半径
        
        // 碰撞伤害冷却控制 (0.2s)
        this.lastCollisionTime = 0;
        
        // 砍刀生成机制
        this.machetes = []; // 存储所有砍刀 { x, y, vx, vy, angle, state: 'flying' | 'stuck' | 'returning', lastHitTime: 0 }
        this.macheteTimer = 1.0; // 默认 2 秒发射一把
        this.maxMachetes = 30;
        
        // 磁吸回收 (觉醒)
        this.isRetrieving = false; // 是否正在回收
        this.magnet = null; // { x, y, vx, vy, active }
    }
    
    applyPassives() {
        super.applyPassives();
    }
    
    updateSpecific(dt) {
        if (this.isDead) return;
        
        // 觉醒状态判定
        if (this.isAwakened) {
            // 觉醒触发瞬间，开始回收
            if (!this.isRetrieving) {
                this.isRetrieving = true;
                
                // 发射吸铁石向敌方
                let magAngle = 0;
                if (this.enemy) {
                    const dx = this.enemy.x - this.x;
                    const dy = this.enemy.y - this.y;
                    magAngle = Math.atan2(dy, dx);
                }
                const magSpeed = this.baseSpeed * 5 * 1.5 * 1.5; // 吸铁石飞行速度提升约50%
                this.magnet = {
                    x: this.x,
                    y: this.y,
                    vx: Math.cos(magAngle) * magSpeed,
                    vy: Math.sin(magAngle) * magSpeed,
                    active: true,
                    attached: false // 是否已黏附在敌人身上
                };
                
                // 将所有砍刀状态改为 wait_return，并分配一个随机的启动延迟 (0~2s)
                for (const m of this.machetes) {
                    m.state = 'wait_return';
                    m.returnDelay = Math.random() * 2.0; // 0-2秒均匀分布
                    m.lastHitTime = 0; // 重置命中冷却用于回收伤害
                }
            }
            
            // 更新吸铁石位置
            if (this.magnet && this.magnet.active) {
                if (this.magnet.attached && this.enemy && !this.enemy.isDead) {
                    // 黏附状态：随目标移动而同步位移
                    this.magnet.x = this.enemy.x;
                    this.magnet.y = this.enemy.y;
                } else {
                    // 飞行状态
                    this.magnet.x += this.magnet.vx * dt;
                    this.magnet.y += this.magnet.vy * dt;
                    
                    // 检查是否命中敌方单位（触发黏附）
                    if (this.enemy && !this.enemy.isDead && this.enemy.invincibleTime <= 0) {
                        if (this.game.physics.checkCircleCollision({x: this.magnet.x, y: this.magnet.y, radius: 15}, this.enemy)) {
                            this.magnet.attached = true;
                            this.magnet.vx = 0;
                            this.magnet.vy = 0;
                        }
                    }
                    
                    // 检查吸铁石是否出界
                    if (!this.magnet.attached) {
                        const bounds = { w: this.game.width, h: this.game.height };
                        if (this.magnet.x < 0 || this.magnet.x > bounds.w || this.magnet.y < 0 || this.magnet.y > bounds.h) {
                            this.magnet.vx = 0;
                            this.magnet.vy = 0;
                            // 钳制在边界内一点
                            this.magnet.x = Math.max(10, Math.min(bounds.w - 10, this.magnet.x));
                            this.magnet.y = Math.max(10, Math.min(bounds.h - 10, this.magnet.y));
                        }
                    }
                }
            }
            
            // 检查是否所有砍刀回收完毕
            if (this.machetes.length === 0) {
                this.isAwakened = false;
                this.isRetrieving = false;
                this.magnet = null; // 砍刀回收完毕吸铁石消失
            }
        }
        
        // 正常状态生成砍刀
        if (!this.isRetrieving && !this.isSuppressed) {
            this.macheteTimer -= dt;
            if (this.macheteTimer <= 0) {
                this.macheteTimer = 3.0;
                this.fireMachete();
            }
        }
        
        // 更新砍刀逻辑
        this.updateMachetes(dt);
    }
    
    fireMachete() {
        if (!this.enemy) return;
        
        // 朝向敌方单位方向
        const dx = this.enemy.x - this.x;
        const dy = this.enemy.y - this.y;
        let angle = Math.atan2(dy, dx);
        
        // 初始高速度，体现“有劲”
        const initialSpeed = 800; 
        
        this.machetes.push({
            x: this.x,
            y: this.y,
            vx: Math.cos(angle) * initialSpeed,
            vy: Math.sin(angle) * initialSpeed,
            angle: angle,
            state: 'flying',
            lastHitTime: 0,
            currentSpeed: initialSpeed,
            decayRate: 400 // 每秒衰减的速度值，参考马老师
        });
        
        // 检查数量上限
        if (this.machetes.length > this.maxMachetes) {
            // 优先移除最早插地的砍刀
            const stuckIndex = this.machetes.findIndex(m => m.state === 'stuck');
            if (stuckIndex !== -1) {
                this.machetes.splice(stuckIndex, 1);
            } else {
                // 如果没有插地的，移除最早生成的
                this.machetes.shift();
            }
        }
    }
    
    updateMachetes(dt) {
        const now = Date.now();
        
        for (let i = this.machetes.length - 1; i >= 0; i--) {
            const m = this.machetes[i];
            
            if (m.state === 'flying') {
                // 计算线性速度衰减
                if (m.currentSpeed > 0) {
                    m.currentSpeed -= m.decayRate * dt;
                    if (m.currentSpeed < 0) m.currentSpeed = 0;
                    
                    m.vx = Math.cos(m.angle) * m.currentSpeed;
                    m.vy = Math.sin(m.angle) * m.currentSpeed;
                }
                
                m.x += m.vx * dt;
                m.y += m.vy * dt;
                
                // 碰撞检测（敌人）
                if (this.enemy && !this.enemy.isDead && this.enemy.invincibleTime <= 0) {
                    if (this.game.physics.checkCircleCollision({x: m.x, y: m.y, radius: 15}, this.enemy)) {
                        // 0.3秒冷却
                        if (now - m.lastHitTime > 300) {
                            this.enemy.takeDamage(4 * this.damageMultiplier, m.x, m.y);
                            m.lastHitTime = now;
                        }
                    }
                }
                
                // 边界检测（变成陷阱）
                const bounds = { w: this.game.width, h: this.game.height };
                let hitWall = false;
                
                // 假设砍刀长 60，插入深度为一半即 30，这里简单将坐标停在边界上，后续绘制时调整偏移
                if (m.x < 0) { m.x = 0; hitWall = true; }
                if (m.x > bounds.w) { m.x = bounds.w; hitWall = true; }
                if (m.y < 0) { m.y = 0; hitWall = true; }
                if (m.y > bounds.h) { m.y = bounds.h; hitWall = true; }
                
                if (hitWall) {
                    m.state = 'stuck';
                }
                
            } else if (m.state === 'stuck') {
                // 陷阱碰撞检测
                if (this.enemy && !this.enemy.isDead && this.enemy.invincibleTime <= 0) {
                    if (this.game.physics.checkCircleCollision({x: m.x, y: m.y, radius: 20}, this.enemy)) {
                        if (now - m.lastHitTime > 500) {
                            this.enemy.takeDamage(4 * this.damageMultiplier, m.x, m.y);
                            m.lastHitTime = now;
                            
                            // 反弹敌人
                            const bounceAngle = Math.atan2(this.enemy.y - m.y, this.enemy.x - m.x);
                            this.enemy.knockback(Math.cos(bounceAngle), Math.sin(bounceAngle), 300, 0.2);
                        }
                    }
                }
            } else if (m.state === 'wait_return') {
                // 等待回收倒计时
                m.returnDelay -= dt;
                if (m.returnDelay <= 0) {
                    m.state = 'returning';
                }
            } else if (m.state === 'returning') {
                // 回收逻辑，指向吸铁石
                if (!this.magnet) continue;
                
                const dx = this.magnet.x - m.x;
                const dy = this.magnet.y - m.y;
                const dist = Math.hypot(dx, dy);
                
                if (dist < 30) {
                    // 到达吸铁石，移除
                    this.machetes.splice(i, 1);
                    continue;
                }
                
                // 回收速度：本体速度的2倍
                const returnSpeed = this.baseSpeed * 5 * 2;
                m.vx = (dx / dist) * returnSpeed;
                m.vy = (dy / dist) * returnSpeed;
                
                // 回收时砍刀方向指向吸铁石，由于砍刀默认是刀刃朝向右上方，我们需要它刀刃朝前飞回。
                // Math.atan2(m.vy, m.vx) 会让刀尖（原飞行前方）指向目标。
                // 这里我们直接保持指向目标即可，即刀刃朝前，刀柄朝后。
                m.angle = Math.atan2(m.vy, m.vx);
                
                m.x += m.vx * dt;
                m.y += m.vy * dt;
                
                // 回收过程中的碰撞检测
                if (this.enemy && !this.enemy.isDead && this.enemy.invincibleTime <= 0) {
                    if (this.game.physics.checkCircleCollision({x: m.x, y: m.y, radius: 15}, this.enemy)) {
                        // 每把砍刀最多结算一次
                        if (m.lastHitTime === 0) {
                            this.enemy.takeDamage(4 * this.damageMultiplier, m.x, m.y);
                            m.lastHitTime = now; // 标记为已命中
                        }
                    }
                }
            }
        }
    }
    
    onHeroCollision(other) {
        if (this.isDead || other.isDead) return;
        
        // 本体碰撞伤害：2点，冷却 0.2s
        const now = Date.now();
        if (now - this.lastCollisionTime > 200) {
            other.takeDamage(2 * this.damageMultiplier, this.x, this.y);
            this.lastCollisionTime = now;
        }
    }
    
    onAwaken() {
        // 觉醒触发逻辑在 updateSpecific 处理，以便每次更新都能检索
    }
    
    drawBody(ctx) {
        super.drawBody(ctx);
    }
    
    draw(ctx) {
        // 绘制觉醒发射出去的吸铁石
        if (this.isAwakened && this.magnet) {
            ctx.save();
            ctx.translate(this.magnet.x, this.magnet.y);
            
            // 绘制磁铁
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.arc(0, 0, 15, Math.PI, 0); // 上半圆
            ctx.lineTo(15, 10);
            ctx.moveTo(-15, 0);
            ctx.lineTo(-15, 10);
            ctx.stroke();
            
            // 磁铁两极
            ctx.fillStyle = '#ccc';
            ctx.fillRect(11, 10, 8, 5);
            ctx.fillRect(-19, 10, 8, 5);
            
            // 磁场波纹
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            const time = Date.now() / 200;
            for (let i = 0; i < 3; i++) {
                const r = 20 + ((time + i) % 3) * 10;
                ctx.beginPath();
                ctx.arc(0, 0, r, Math.PI + 0.5, 2 * Math.PI - 0.5);
                ctx.stroke();
            }
            ctx.restore();
        }
        
        // 绘制砍刀（在底层，不跟随本体的 transform）
        ctx.save();
        for (const m of this.machetes) {
            ctx.save();
            ctx.translate(m.x, m.y);
            
            // 飞行和回收状态指向运动方向
            // 插地状态维持最后的角度，但由于是陷阱，这里让它看起来像插入
            if (m.state === 'stuck') {
                ctx.rotate(m.angle);
                // 向后平移，使插入深度变浅，原本刀的长度大约是 80，缩放 0.8 后是 64，
                // 如果我们要插入 1/3，也就是向回拉一段距离
                // 这里用 -10 来让刀大部分露在墙外
                ctx.translate(-10, 0); 
            } else {
                ctx.rotate(m.angle);
            }
            
            // 绘制砍刀 SVG 类似形状
            this.drawMachete(ctx);
            
            ctx.restore();
        }
        ctx.restore();
        
        super.draw(ctx);
    }
    
    drawMachete(ctx) {
        ctx.scale(0.8, 0.8); // 放大一点
        
        // 刀柄
        ctx.fillStyle = '#8b4513'; // 棕色
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.roundRect(-40, -5, 30, 10, 5);
        ctx.fill();
        ctx.stroke();
        
        // 刀柄上的铆钉
        ctx.fillStyle = '#d2b48c';
        ctx.beginPath(); ctx.arc(-30, 0, 2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(-18, 0, 2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        
        // 刀身
        ctx.fillStyle = '#a9a9a9'; // 灰色
        ctx.beginPath();
        ctx.moveTo(-10, -10);
        ctx.lineTo(30, -10);
        // 刀背圆弧
        ctx.quadraticCurveTo(45, -10, 40, 15);
        ctx.lineTo(-10, 15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // 刀刃高光/分界线
        ctx.strokeStyle = '#696969';
        ctx.beginPath();
        ctx.moveTo(-10, 5);
        ctx.lineTo(38, 5);
        ctx.stroke();
        
        // 血迹
        ctx.fillStyle = '#8b0000';
        ctx.beginPath();
        ctx.moveTo(25, 15);
        ctx.lineTo(35, 15);
        ctx.quadraticCurveTo(38, 5, 30, 0);
        ctx.quadraticCurveTo(25, 5, 20, 5);
        ctx.closePath();
        ctx.fill();
        
        // 散落血点
        ctx.beginPath(); ctx.arc(22, -2, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(18, 2, 1, 0, Math.PI*2); ctx.fill();
    }
}
