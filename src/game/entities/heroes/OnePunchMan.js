import { Hero } from '../Hero.js';

const PUNCH_SVG = `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'%3E%3Cg fill='%23ff3333' stroke='%23000' stroke-width='2'%3E%3Cpath d='M30 15 h 40 c 8 0 15 8 15 15 s -7 15 -15 15 h -40 z' /%3E%3Cpath d='M30 15 v 30' stroke-width='3'/%3E%3Cpath d='M70 15 v 30' stroke-width='2' opacity='0.5'/%3E%3C/g%3E%3Cg stroke='%23ff3333' stroke-width='2' stroke-linecap='round'%3E%3Cline x1='5' y1='20' x2='25' y2='20' /%3E%3Cline x1='0' y1='30' x2='25' y2='30' /%3E%3Cline x1='10' y1='40' x2='25' y2='40' /%3E%3C/g%3E%3C/svg%3E`;

const punchImg = new Image();
punchImg.src = PUNCH_SVG;

export class OnePunchMan extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '一拳超人';
        this.color = '#ffff00'; // 明黄色小球
        this.hp = 100;
        this.maxHp = 100;
        this.baseSpeed = 60;
        this.radius = 40;
        
        // 怒气系统
        this.rage = 0;
        this.maxRage = 100;
        this.lastRageTime = 0;
        
        // 技能状态
        this.isPunching = false;
        this.punchProjectile = null;
        
        // 碰撞伤害冷却控制 (2s)
        this.lastCollisionTime = 0;
        
        // 视觉特效
        this.ripples = [];
        this.seriousPunchEffect = null;
    }
    
    takeDamage(amount, sourceX, sourceY) {
        const oldHp = this.hp;
        super.takeDamage(amount, sourceX, sourceY);
        
        // 如果确实受到了伤害，增加怒气
        if (this.hp < oldHp && !this.isDead) {
            const now = Date.now();
            // 怒气增长冷却 1 秒
            if (now - this.lastRageTime >= 1000) {
                this.lastRageTime = now;
                if (!this.isPunching && this.rage < this.maxRage) {
                    const inc = Math.floor(Math.random() * 9) + 2; // 2到10点
                    this.rage = Math.min(this.maxRage, this.rage + inc);
                    
                    // 触发普通一拳
                    if (this.rage >= this.maxRage) {
                        this.triggerNormalPunch();
                    }
                }
            }
        }
    }
    
    onHeroCollision(other) {
        if (this.isDead || other.isDead) return;
        
        const now = Date.now();
        // 对同一目标2秒碰撞伤害结算冷却
        if (!this.lastCollisionTime || now - this.lastCollisionTime > 2000) {
            other.takeDamage(2 * this.damageMultiplier, this.x, this.y);
            this.lastCollisionTime = now;
        }
    }
    
    triggerNormalPunch() {
        this.isPunching = true;
        
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Normal Punch' });
        }
        
        const speed = this.baseSpeed * 5 * 1.2; // 移速的120%
        let angle = 0;
        if (this.enemy) {
            angle = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
        }
        
        this.punchProjectile = {
            x: this.x,
            y: this.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 30,
            active: true,
            angle: angle,
            trail: []
        };
    }
    
    endPunch() {
        this.isPunching = false;
        this.punchProjectile = null;
        this.rage = 0; // 释放完毕后怒气清零
    }
    
    createRipple(x, y, maxRadius = 100) {
        this.ripples.push({ x, y, radius: 10, maxRadius, life: 1.0 });
    }
    
    clearObstacles(p, mode) {
        const enemy = this.enemy;
        if (!enemy) return;
        
        const clearRadius = mode === 'awaken' ? 3000 : (p ? p.radius : 0);
        
        const checkClear = (itemX, itemY) => {
            if (mode === 'awaken') return true;
            if (!p) return false;
            const dx = p.x - itemX;
            const dy = p.y - itemY;
            return Math.hypot(dx, dy) <= clearRadius + 20; // 适当增加判定范围
        };
        
        // 1. 蜘蛛蛛丝
        if (enemy.name === '蜘蛛' && enemy.webs) {
            for (let i = enemy.webs.length - 1; i >= 0; i--) {
                const web = enemy.webs[i];
                if (!web.active) continue;
                
                let hit = false;
                if (mode === 'awaken') {
                    hit = true;
                } else if (p && this.game.physics.checkLineCircleCollision(web.x1, web.y1, web.x2, web.y2, p)) {
                    hit = true;
                }
                
                if (hit) {
                    enemy.webs.splice(i, 1);
                    this.createRipple((web.x1+web.x2)/2, (web.y1+web.y2)/2, 50);
                }
            }
        }
        
        // 2. 马老师松果糖豆
        if (enemy.name === '马老师' && enemy.nuts) {
            for (let i = enemy.nuts.length - 1; i >= 0; i--) {
                const nut = enemy.nuts[i];
                if (checkClear(nut.x, nut.y)) {
                    enemy.nuts.splice(i, 1);
                    this.createRipple(nut.x, nut.y, 50);
                }
            }
        }
        
        // 3. 华强插地砍刀 (可选白名单，加入清除)
        if (enemy.name === '华强' && enemy.machetes) {
            for (let i = enemy.machetes.length - 1; i >= 0; i--) {
                const m = enemy.machetes[i];
                if (checkClear(m.x, m.y)) {
                    enemy.machetes.splice(i, 1);
                    this.createRipple(m.x, m.y, 50);
                }
            }
        }
        
        // 4. 赌徒卡牌
        if (enemy.name === '赌徒' && enemy.cards) {
            for (let i = enemy.cards.length - 1; i >= 0; i--) {
                const c = enemy.cards[i];
                if (checkClear(c.x, c.y)) {
                    enemy.cards.splice(i, 1);
                    this.createRipple(c.x, c.y, 50);
                }
            }
        }
    }
    
    onAwaken() {
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Awaken: Serious Punch' });
        }
        
        // 第一段：清场前摇
        this.createRipple(this.x, this.y, 1000); // 激发气浪
        this.clearObstacles(null, 'awaken'); // 清除全场敌方陷阱
        
        // 第二段：瞬移必杀
        if (this.enemy && !this.enemy.isDead) {
            const angle = Math.atan2(this.y - this.enemy.y, this.x - this.enemy.x); // 从敌人指向自己
            const distance = this.enemy.radius + 12 + this.radius;
            
            // 瞬移至敌方身前 12px
            this.x = this.enemy.x + Math.cos(angle) * distance;
            this.y = this.enemy.y + Math.sin(angle) * distance;
            
            // 视觉特效
            this.seriousPunchEffect = {
                x: this.enemy.x,
                y: this.enemy.y,
                life: 1.0,
                angle: angle + Math.PI // 拳击方向
            };
            
            // 必杀
            this.enemy.hp = 0;
            this.enemy.takeDamage(this.enemy.maxHp * 99, this.x, this.y);
            if (this.enemy.die && !this.enemy.isDead) {
                this.enemy.die();
            }
        }
        
        // 立即结束觉醒状态
        this.isAwakened = false;
        if (this.awakenTimer !== undefined) {
            this.awakenTimer = 0;
        }
    }
    
    updateSpecific(dt) {
        if (this.isDead) return;
        
        // 更新普通一拳
        if (this.punchProjectile && this.punchProjectile.active) {
            const p = this.punchProjectile;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            
            // 拖尾残影
            p.trail.push({ x: p.x, y: p.y, life: 0.3 });
            
            // 出界消失
            if (p.x < 0 || p.x > this.game.width || p.y < 0 || p.y > this.game.height) {
                p.active = false;
                this.endPunch();
            } else {
                // 破障
                this.clearObstacles(p, 'normal');
                
                // 必杀判定
                if (this.enemy && !this.enemy.isDead) {
                    if (this.game.physics.checkCircleCollision(p, this.enemy)) {
                        this.enemy.hp = 0;
                        this.enemy.takeDamage(this.enemy.maxHp * 99, p.x, p.y);
                        if (this.enemy.die && !this.enemy.isDead) {
                            this.enemy.die();
                        }
                        
                        this.createRipple(p.x, p.y, 200);
                        p.active = false;
                        this.endPunch();
                    }
                }
            }
        }
        
        // 更新拖尾残影生命周期
        if (this.punchProjectile && this.punchProjectile.trail) {
            for (let i = this.punchProjectile.trail.length - 1; i >= 0; i--) {
                this.punchProjectile.trail[i].life -= dt;
                if (this.punchProjectile.trail[i].life <= 0) {
                    this.punchProjectile.trail.splice(i, 1);
                }
            }
        }
        
        // 更新气浪特效
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.radius += (r.maxRadius - r.radius) * 5 * dt;
            r.life -= dt;
            if (r.life <= 0) {
                this.ripples.splice(i, 1);
            }
        }
        
        // 更新认真一拳特效
        if (this.seriousPunchEffect) {
            this.seriousPunchEffect.life -= dt;
            if (this.seriousPunchEffect.life <= 0) {
                this.seriousPunchEffect = null;
            }
        }
    }
    
    drawBody(ctx) {
        super.drawBody(ctx);
        
        // 绘制怒气条
        if (!this.isDead) {
            ctx.save();
            
            // 背景环
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 6;
            ctx.stroke();
            
            // 怒气环
            if (this.rage > 0) {
                ctx.beginPath();
                const angle = (this.rage / this.maxRage) * Math.PI * 2;
                ctx.arc(0, 0, this.radius + 10, -Math.PI / 2, -Math.PI / 2 + angle);
                ctx.strokeStyle = this.rage >= this.maxRage ? '#ff0000' : '#ff9900';
                ctx.lineWidth = 6;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
            ctx.restore();
        }
    }
    
    draw(ctx) {
        super.draw(ctx);
        
        if (!this.isDead) {
            // 覆盖原有的白色血量文字，改为黑色以增加在黄色背景上的可读性
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.floor(this.hp)}`, 0, 0);
            ctx.restore();
        }
        
        // 绘制气浪涟漪
        for (const r of this.ripples) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${r.life})`;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
        }
        
        // 绘制普通一拳
        if (this.punchProjectile) {
            const p = this.punchProjectile;
            
            // 拖尾残影
            for (const t of p.trail) {
                ctx.save();
                ctx.translate(t.x, t.y);
                ctx.rotate(p.angle);
                ctx.globalAlpha = t.life;
                ctx.drawImage(punchImg, -40, -25, 80, 50);
                ctx.restore();
            }
            
            // 本体拳头
            if (p.active) {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                ctx.drawImage(punchImg, -50, -30, 100, 60);
                ctx.restore();
            }
        }
        
        // 绘制认真一拳特效
        if (this.seriousPunchEffect) {
            const e = this.seriousPunchEffect;
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.rotate(e.angle);
            ctx.globalAlpha = e.life;
            
            // 巨大的拳影
            ctx.drawImage(punchImg, -100, -60, 200, 120);
            
            // 放射状冲击波
            ctx.beginPath();
            ctx.arc(0, 0, (1 - e.life) * 300, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 0, 0, ${e.life})`;
            ctx.lineWidth = 10;
            ctx.stroke();
            
            ctx.restore();
        }
    }
}
