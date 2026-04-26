import { Hero } from '../Hero.js';

const punchImg = new Image();
punchImg.src = import.meta.env.BASE_URL + 'assets/img/punch.png';

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
        this.isChargingNormalPunch = false;
        this.chargeEffectStartTime = 0;
        this.punchProjectile = null;
        
        // 觉醒领域状态
        this.isDomainActive = false;
        this.domainRadius = 250;
        this.domainWarmup = 0;
        this.hasTriggeredSeriousPunch = false;
        
        // 碰撞伤害冷却控制 (2s)
        this.lastCollisionTime = 0;
        
        // 视觉特效
        this.ripples = [];
        this.seriousPunchEffect = null;
    }
    
    getDamageReduction() {
        // 先获取基类可能存在的减伤（如果有其他buff）
        let baseReduction = super.getDamageReduction();
        
        // 加上一拳超人专属的怒气减伤（最高40%）
        const rageReduction = (this.rage / this.maxRage) * 0.4;
        
        // 叠加计算减伤，例如：1 - (1 - 0.5) * (1 - 0.5) = 0.75
        // 或者直接取最大值，这里采取直接相加但封顶在 0.9 比较合理，或者按加法取最大
        return Math.min(0.9, baseReduction + rageReduction);
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
                if (!this.isPunching && !this.isChargingNormalPunch && this.rage < this.maxRage) {
                    const inc = Math.floor(Math.random() * 9) + 2; // 2到10点
                    this.rage = Math.min(this.maxRage, this.rage + inc);
                    
                    // 触发普通一拳蓄力动画
                    if (this.rage >= this.maxRage) {
                        this.startChargingNormalPunch();
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
    
    startChargingNormalPunch() {
        // 如果当前已经在蓄力中，不重复触发
        if (this.isChargingNormalPunch) return;
        
        this.isChargingNormalPunch = true;
        // 关键修复：蓄力特效的开始时间必须同步获取，或者基于剩余 globalFreezeTime 来计算，
        // 我们直接在这里设定初始时间
        this.chargeEffectStartTime = Date.now();
        
        if (this.game) {
            // 触发全屏时停 1 秒
            // 必须强制设定一个 1 秒的时停时间，并清空原有的时停（防止觉醒触发时的时停叠加）
            this.game.globalFreezeTime = 1.0;
            this.game.awakenCenter = { x: this.x, y: this.y };
            this.game.awakenRadius = 0; // 确保特效从 0 开始扩散
            
            // 能量汇聚特效：生成大量向自身汇聚的红色/橙色能量粒子
            for (let i = 0; i < 40; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 150 + Math.random() * 200; // 初始随机分布在周围
                const px = this.x + Math.cos(angle) * dist;
                const py = this.y + Math.sin(angle) * dist;
                
                // 由于 target 设置为 this，Game引擎会自动为粒子计算向心速度，并追踪角色
                this.game.addParticle({
                    x: px, y: py,
                    vx: 0, vy: 0,
                    life: 1.0, // 粒子存活 1 秒，恰好与时停同步
                    color: Math.random() > 0.5 ? '#ff3333' : '#ff9900', 
                    size: Math.random() * 5 + 3,
                    target: this
                });
            }
        }
    }
    
    triggerNormalPunch() {
        this.isPunching = true;
        
        // 区分是觉醒触发的还是普通触发的
        // 如果是从领域触发的觉醒版，增加一点伤害或效果（可选，目前完全按要求走普通一拳效果）
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Normal Punch' });
        }
        
        // 挥拳初始速度调整为基础移速的 12 倍（约 720px/s），赋予极强的爆发初速度
        // 不再吃当前的实时 buff (减速等)，保证这一拳打出的初始爆发力
        const initialSpeed = this.baseSpeed * 12;
        let angle = 0;
        if (this.enemy) {
            angle = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
        }
        
        this.punchProjectile = {
            x: this.x,
            y: this.y,
            vx: Math.cos(angle) * initialSpeed,
            vy: Math.sin(angle) * initialSpeed,
            radius: this.isDomainActive ? 150 : 60, // 认真一拳范围更大
            active: true,
            angle: angle,
            trail: [],
            life: 1.0,
            speed: initialSpeed,
            baseAngleX: Math.cos(angle),
            baseAngleY: Math.sin(angle)
        };
    }
    
    endPunch() {
        this.isPunching = false;
        this.punchProjectile = null;
        // 只有普通触发（满怒气时）才清空怒气，如果是觉醒触发（怒气可能没满），按需也可以不清空
        // 但安全起见，只要出拳结束，就重置状态
        this.rage = 0; 
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
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Awaken: Serious Punch Domain' });
        }
        
        // 第一段：清场前摇
        this.createRipple(this.x, this.y, 1000); // 激发气浪
        this.clearObstacles(null, 'awaken'); // 清除全场敌方陷阱
        
        // 启动“认真领域”
        this.isDomainActive = true;
        this.domainRadius = 300; // 领域半径300
        this.awakenTimer = 6.0; // 领域持续6秒
        this.hasTriggeredSeriousPunch = false;
        this.domainWarmup = 0.5; // 0.5秒展开前摇
    }
    
    executeSeriousPunch() {
        if (this.enemy && !this.enemy.isDead) {
            // 敌方进入领域，立即瞬移到敌方面前，留出至少一个身位的距离（例如 100 像素）
            // 这样能清晰地看到蓄力特效和出拳动作
            const angle = Math.atan2(this.y - this.enemy.y, this.x - this.enemy.x);
            // 敌方半径 + 己方半径 + 1个身位 (约 80~100)
            const distance = this.enemy.radius + this.radius + 100;
            
            this.x = this.enemy.x + Math.cos(angle) * distance;
            this.y = this.enemy.y + Math.sin(angle) * distance;
            
            // 瞬移后，直接执行与普通一拳完全相同的蓄力与挥拳逻辑
            this.startChargingNormalPunch();
            
        }
        
        // 瞬移贴脸并开始普通一拳蓄力后，立即关闭领域与觉醒状态
        // 这样在 1 秒蓄力结束后，触发的 triggerNormalPunch 会发出普通一拳
        this.isDomainActive = false;
        // 觉醒状态不能立刻 false，否则会丢失无敌判定等，我们只把计时器清空，
        // 真正结束放在 endPunch 里面或者等蓄力打完。
        // 但为了兼容，保持 false，只需要确保蓄力动作能正确执行即可。
        this.isAwakened = false;
        if (this.awakenTimer !== undefined) {
            this.awakenTimer = 0;
        }
    }
    
    updateSpecific(dt) {
        if (this.isDead) return;
        
        // 觉醒领域逻辑
        if (this.isAwakened && this.isDomainActive) {
            this.awakenTimer -= dt;
            
            if (this.domainWarmup > 0) {
                // 领域展开前摇，不触发必杀
                this.domainWarmup -= dt;
            } else if (!this.hasTriggeredSeriousPunch && this.enemy && !this.enemy.isDead) {
                // 判定敌方是否进入领域
                const dx = this.enemy.x - this.x;
                const dy = this.enemy.y - this.y;
                const dist = Math.hypot(dx, dy);
                
                if (dist <= this.domainRadius + this.enemy.radius) {
                    this.hasTriggeredSeriousPunch = true;
                    this.executeSeriousPunch();
                }
            }
            
            // 觉醒时间结束，自然关闭领域
            if (!this.hasTriggeredSeriousPunch && this.awakenTimer <= 0) {
                this.isDomainActive = false;
                this.isAwakened = false;
            }
        }
        
        // 游戏引擎时停结束后（即 1 秒蓄力完成），恢复逻辑更新的第一帧
        // 此时正式触发普通一拳攻击逻辑，实现无缝衔接
        if (this.isChargingNormalPunch && (!this.game || this.game.globalFreezeTime <= 0)) {
            this.isChargingNormalPunch = false;
            this.triggerNormalPunch();
        }
        
        // 更新普通一拳
        if (this.punchProjectile && this.punchProjectile.active) {
            const p = this.punchProjectile;
            
            // 应用非线性摩擦力/衰减 (先快后慢，突出力量感)
            // 每一帧将速度按比例衰减，直到降至一个较低的基础速度
            const minSpeed = this.baseSpeed * 2; // 最低保留 2 倍移速的惯性
            if (p.speed > minSpeed) {
                p.speed -= p.speed * 4.0 * dt; // 阻力系数 4.0，速度衰减极快
                if (p.speed < minSpeed) p.speed = minSpeed;
                
                // 重新计算 vx 和 vy
                p.vx = p.baseAngleX * p.speed;
                p.vy = p.baseAngleY * p.speed;
            }
            
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            
            // 拖尾残影
            p.trail.push({ x: p.x, y: p.y, life: 0.3 });
            
            // 出界消失 (略微延迟消失以保证效果)
            if (p.x < -100 || p.x > this.game.width + 100 || p.y < -100 || p.y > this.game.height + 100) {
                p.active = false;
                this.endPunch();
            } else {
                // 实时清除路径上的障碍（每帧检测），避免穿透
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
            
            // 怒气条底槽外边框（增强与任何背景的对比度）
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = 8;
            ctx.stroke();
            
            // 动态时间计算
            const time = Date.now();
            
            // 怒气条底槽内轨（增加微弱的呼吸感）
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
            const emptyBreath = (Math.sin(time / 500) + 1) / 2; // 0-1平缓波动
            ctx.strokeStyle = `rgba(150, 150, 150, ${0.3 + emptyBreath * 0.3})`;
            ctx.lineWidth = 4;
            ctx.stroke();
            
            // 怒气环（实际进度）
            if (this.rage > 0) {
                ctx.beginPath();
                const angle = (this.rage / this.maxRage) * Math.PI * 2;
                ctx.arc(0, 0, this.radius + 10, -Math.PI / 2, -Math.PI / 2 + angle);
                
                // 动态特效
                if (this.rage >= this.maxRage) {
                    // 满怒：高频闪烁及光晕发光效果
                    const pulse = (Math.sin(time / 100) + 1) / 2;
                    ctx.strokeStyle = `rgb(255, ${Math.floor(pulse * 100)}, 0)`; // 红色与橙红交替
                    ctx.shadowColor = '#ff0000';
                    ctx.shadowBlur = 10 + pulse * 15;
                    ctx.lineWidth = 6 + pulse * 3; // 微微变粗
                } else {
                    // 攒怒：平缓的呼吸光晕
                    const breath = (Math.sin(time / 300) + 1) / 2;
                    ctx.strokeStyle = '#ff9900';
                    ctx.shadowColor = '#ff9900';
                    ctx.shadowBlur = 5 + breath * 8;
                    ctx.lineWidth = 6;
                }
                
                ctx.lineCap = 'round';
                ctx.stroke();
                
                // 清除阴影防止影响其他元素的绘制
                ctx.shadowBlur = 0;
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
        
        // 绘制必杀领域
        if (this.isDomainActive && !this.hasTriggeredSeriousPunch) {
            ctx.save();
            ctx.translate(this.x, this.y);
            
            let currentRadius = this.domainRadius;
            let alphaMult = 1.0;
            if (this.domainWarmup > 0) {
                // 0.5秒展开特效
                const p = 1.0 - (this.domainWarmup / 0.5);
                const easeOut = p * (2 - p); // ease out
                currentRadius = this.domainRadius * easeOut;
                alphaMult = p;
            }
            
            // 绘制领域背景
            ctx.beginPath();
            ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 50, 50, ${0.15 * alphaMult})`; // 红色半透明
            ctx.fill();
            
            // 绘制领域边缘警戒线
            ctx.strokeStyle = `rgba(255, 0, 0, ${0.8 * alphaMult})`;
            ctx.lineWidth = 4;
            ctx.setLineDash([15, 15]);
            ctx.rotate(Date.now() / -1000); // 逆时针缓慢旋转
            ctx.stroke();
            
            // 绘制内层警告标志
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(0, 0, currentRadius * 0.95, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 100, 100, ${0.4 * alphaMult})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.restore();
        }
        
        // 绘制蓄力时停动画特效
        if (this.isChargingNormalPunch) {
            // 这里修改逻辑，直接绑定 game.globalFreezeTime 如果存在的话，这样在时停变快/慢时也能同步。
            // 但如果引擎不支持，我们依然用系统时间，为了确保动画效果不提前结束，
            // 设定 progress 最大为 1。
            let progress = 0;
            if (this.game && this.game.globalFreezeTime !== undefined) {
                // globalFreezeTime 会从 1.0 倒数到 0
                progress = Math.max(0, Math.min(1.0 - this.game.globalFreezeTime, 1.0));
            } else {
                const elapsed = Date.now() - this.chargeEffectStartTime; 
                progress = Math.min(elapsed / 1000, 1.0); 
            }
            
            ctx.save();
            ctx.translate(this.x, this.y);
            
            // 红色能量场收缩特效
            ctx.beginPath();
            const radius = this.radius + 100 - progress * 100; // 半径从 140 收缩到 40 (角色本身半径)
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 51, 51, ${progress})`; // 越来越清晰
            ctx.lineWidth = 15 * progress;
            ctx.stroke();
            
            // 最后 0.3 秒的高频白光闪烁，强化即将释放的爆发感
            if (progress > 0.7 && Math.random() > 0.4) {
                ctx.beginPath();
                ctx.arc(0, 0, this.radius * 3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, 0.5)`;
                ctx.fill();
            }
            
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
                // 原图片拳头是向右的，绘制时居中调整
                ctx.drawImage(punchImg, -40, -40, 80, 80);
                ctx.restore();
            }
            
            // 本体拳头
            if (p.active) {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                // 调整绘制尺寸和偏移以适应新的 png 图片比例
                ctx.drawImage(punchImg, -60, -60, 120, 120);
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
            ctx.drawImage(punchImg, -150, -150, 300, 300);
            
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
