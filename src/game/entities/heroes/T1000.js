import { Hero } from '../Hero.js';

/**
 * T1000 英雄类
 * 特性：液态金属自愈、变形穿刺、液态碎片标记与追踪爆发
 */
export class T1000 extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = 'T1000';
        this.color = '#c0c0c0'; // 液态银灰
        this.hp = 100;
        this.maxHp = 100;
        this.baseSpeed = 60;
        this.radius = 40;
        
        // 碰撞伤害冷却
        this.lastCollisionTime = 0;
        
        // 技能一：变形刺刃
        this.bladeTimer = 2.5;
        this.bladeState = 'idle'; // 'idle', 'extend', 'hold', 'retract'
        this.bladeActiveTime = 0;
        this.bladeDirection = 0;
        this.bladeLength = 0;
        this.maxBladeLength = 220; // 进一步提升刺刃最大长度
        this.bladeHit = false;
        
        // 技能二：液态自愈
        this.liquefyCooldown = 0;
        this.liquefyTime = 0;
        this.liquefyRippleTime = 0;
        
        // 防多段伤害判定窗口 (类似猴哥的金刚不坏机制)
        this.comboHitTimer = 0;
        this.comboHitWindow = 0.5; // 0.5秒内的连续受击被视为同一套连段攻击
        this.isLiquefyTriggeredInCombo = false; // 记录当前连段是否已经触发过液化
        
        // 技能三：液态碎片
        this.fragments = []; // 存储所有的碎片 {x, y, state, timer, shootDelay, vx, vy, ...}
        this.enemyMarkStacks = 0;
        this.enemyMarkTime = 0;
        
        // 提升 T1000 的渲染层级，使其变形刺刃等效果能遮挡（穿透）敌方模型
        this.zIndex = 10;
        
        // 音效配置 (暂不配置专属音效，使用通用逻辑或保持静音)
    }
    
    /**
     * 覆盖父类的受击逻辑，实现20%概率液化免疫
     * 加入防多段伤害机制，避免连续攻击导致 100% 触发
     */
    takeDamage(amount, sourceX, sourceY) {
        if (this.isDead || this.invincibleTime > 0) return;
        
        // 连段攻击窗口判定
        // 如果在0.5秒内连续受到攻击，并且本次连段已经触发过液化，则后续攻击直接扣血不再触发判定
        if (this.comboHitTimer > 0 && this.isLiquefyTriggeredInCombo) {
            this.comboHitTimer = this.comboHitWindow; // 刷新连段窗口时间
            super.takeDamage(amount, sourceX, sourceY);
            return;
        }
        
        // 如果是一次新的攻击（脱离了连段窗口），重置触发标记
        if (this.comboHitTimer <= 0) {
            this.isLiquefyTriggeredInCombo = false;
        }
        
        // 刷新当前的连段窗口时间
        this.comboHitTimer = this.comboHitWindow;
        
        // 液态自愈：20%概率触发，3秒冷却
        if (this.liquefyCooldown <= 0 && Math.random() < 0.2) {
            this.isLiquefyTriggeredInCombo = true; // 标记当前这套连段已经触发过液化
            this.triggerLiquefy();
            // 触发瞬间，本次伤害也减半
            super.takeDamage(amount * 0.5, sourceX, sourceY);
            return; 
        }
        
        // 如果当前处于液化状态（触发后的0.6秒内），所有受到的伤害减半
        if (this.liquefyTime > 0) {
            amount *= 0.5;
        }
        
        // 正常扣血（或减半扣血）
        super.takeDamage(amount, sourceX, sourceY);
    }
    
    triggerLiquefy() {
        this.liquefyCooldown = 3.0;
        this.liquefyTime = 0.6;
        // 移除无敌逻辑
        // this.invincibleTime = Math.max(this.invincibleTime, 0.6); 
        this.ignoreHeroCollisionBounce = true; // 穿体而过不反弹
        
        if (this.game) {
            this.game.addFloatingText(this.x, this.y - 40, "液态化!", '#a0a0a0');
        }
    }
    
    onHeroCollision(other) {
        if (this.isDead || other.isDead) return;
        
        const now = Date.now();
        if (!this.lastCollisionTime || now - this.lastCollisionTime > 3000) {
            // 造成 2 点基础碰撞伤害
            other.takeDamage(2 * this.damageMultiplier, this.x, this.y);
            this.lastCollisionTime = now;
        }
    }
    
    onAwaken() {
        // 觉醒：液态风暴
        // 激活所有处于粘黏状态的碎片
        let activatedCount = 0;
        this.fragments.forEach(f => {
            if (f.state === 'sticky') {
                f.awakenDelay = Math.random() * 1.0; // 0到1秒随机延迟激活
                activatedCount++;
            }
        });
        
        // 增加100%移速，通过添加 buff 实现
        this.addBuff('t1000_awaken_speed', 'speed', 1.0, 999);
    }
    
    updateSpecific(dt) {
        if (this.isDead) return;
        
        // 更新液化状态
        if (this.liquefyCooldown > 0) {
            this.liquefyCooldown -= dt;
        }
        
        // 更新连段伤害判定窗口时间
        if (this.comboHitTimer > 0) {
            this.comboHitTimer -= dt;
        }
        
        if (this.liquefyTime > 0) {
            this.liquefyTime -= dt;
            if (this.liquefyTime <= 0) {
                // 液化结束
                this.ignoreHeroCollisionBounce = false;
                this.liquefyRippleTime = 1.0; // 回流波纹特效持续1秒
                
                // 立刻回复5点血量（不超过最大HP）
                const healAmount = Math.min(5, this.maxHp - this.hp);
                if (healAmount > 0) {
                    this.hp += healAmount;
                    if (this.game) {
                        this.game.addFloatingText(this.x, this.y - 30, `+${Math.round(healAmount)}`, '#4caf50');
                    }
                }
                
                // 生成2个液态碎片
                this.spawnFragments();
            }
        }
        
        if (this.liquefyRippleTime > 0) this.liquefyRippleTime -= dt;
        
        // 更新标记持续时间
        if (this.enemyMarkTime > 0) {
            this.enemyMarkTime -= dt;
            if (this.enemyMarkTime <= 0) {
                this.enemyMarkStacks = 0;
            }
        }
        
        // 处理敌方的流血Buff (手动扣血逻辑)
        if (this.enemy && !this.enemy.isDead) {
            const bleedBuff = this.enemy.buffs.find(b => b.id === 't1000_bleed');
            if (bleedBuff) {
                bleedBuff.tickTimer = (bleedBuff.tickTimer || 0) + dt;
                if (bleedBuff.tickTimer >= 1.0) {
                    bleedBuff.tickTimer -= 1.0;
                    this.enemy.hp -= 1 * this.damageMultiplier;
                    if (this.game) {
                        this.game.addFloatingText(this.enemy.x, this.enemy.y - 30, "-1", '#ff0000');
                    }
                    if (this.enemy.hp <= 0 && !this.enemy.isDead) this.enemy.die();
                }
            }
        }
        
        this.updateBlade(dt);
        this.updateFragments(dt);
        this.updateAwaken(dt);
    }
    
    updateBlade(dt) {
        if (this.bladeState === 'idle') {
            this.bladeTimer -= dt;
            if (this.bladeTimer <= 0) {
                this.bladeState = 'extend';
                this.bladeActiveTime = 0;
                this.bladeTimer = 2.5; // 重置冷却
                this.bladeHit = false;
                if (this.enemy && !this.enemy.isDead) {
                    this.bladeDirection = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
                } else {
                    this.bladeDirection = Math.random() * Math.PI * 2;
                }
            }
        } else {
            this.bladeActiveTime += dt;
            // 时长调整：伸出 0.25s, 保持 0.2s, 缩回 0.15s
            const extendTime = 0.25;
            const holdTime = 0.20;
            const retractTime = 0.15;
            const totalTime = extendTime + holdTime + retractTime;
            
            if (this.bladeActiveTime <= extendTime) {
                this.bladeState = 'extend';
                // 匀速伸出至最大长度
                const progress = this.bladeActiveTime / extendTime;
                this.bladeLength = this.maxBladeLength * progress;
                
                // 伸出期间始终追踪敌方方向
                if (this.enemy && !this.enemy.isDead) {
                    this.bladeDirection = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
                }
            } else if (this.bladeActiveTime <= extendTime + holdTime) {
                this.bladeState = 'hold';
                // 保持最大长度
                this.bladeLength = this.maxBladeLength;
                
                // 保持期间也追踪敌方方向
                if (this.enemy && !this.enemy.isDead) {
                    this.bladeDirection = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
                }
            } else if (this.bladeActiveTime <= totalTime) {
                this.bladeState = 'retract';
                // 缩回
                const progress = (this.bladeActiveTime - extendTime - holdTime) / retractTime;
                this.bladeLength = this.maxBladeLength * (1 - progress);
            } else {
                this.bladeState = 'idle';
                this.bladeLength = 0;
                this.bladeActiveTime = 0;
            }
            
            // 刺刃碰撞检测
            if (!this.bladeHit && this.enemy && !this.enemy.isDead && this.enemy.invincibleTime <= 0) {
                const tipX = this.x + Math.cos(this.bladeDirection) * (this.radius + this.bladeLength);
                const tipY = this.y + Math.sin(this.bladeDirection) * (this.radius + this.bladeLength);
                const baseX = this.x + Math.cos(this.bladeDirection) * this.radius;
                const baseY = this.y + Math.sin(this.bladeDirection) * this.radius;
                
                if (this.game && this.game.physics.checkLineCircleCollision(baseX, baseY, tipX, tipY, this.enemy)) {
                    this.bladeHit = true;
                    // 伤害计算：4 + 1 * 标记层数
                    const dmg = 4 + 1 * this.enemyMarkStacks;
                    this.enemy.takeDamage(dmg * this.damageMultiplier, this.x, this.y);
                    
                    // 如果消耗了标记，生成爆裂特效
                    if (this.enemyMarkStacks > 0 && this.game) {
                        this.game.addFloatingText(this.enemy.x, this.enemy.y - 50, "标记引爆!", '#ffd700'); // 金色暴击提示
                        
                        // 生成液态金属爆裂粒子
                        for (let i = 0; i < 15 + this.enemyMarkStacks * 5; i++) {
                            const angle = Math.random() * Math.PI * 2;
                            const speed = Math.random() * 200 + 100;
                            this.game.addParticle({
                                x: this.enemy.x, 
                                y: this.enemy.y,
                                vx: Math.cos(angle) * speed, 
                                vy: Math.sin(angle) * speed,
                                color: '#a0a0a0',
                                life: 0.5 + Math.random() * 0.3,
                                size: Math.random() * 4 + 2
                            });
                        }
                    }
                    
                    // 命中后清除标记
                    this.enemyMarkStacks = 0;
                    this.enemyMarkTime = 0;
                    
                    // 附加流血 (不可叠加但刷新持续时间)
                    this.enemy.addBuff('t1000_bleed', 'bleed', 1, 3.0);
                }
            }
        }
    }
    
    spawnFragments() {
        for (let i = 0; i < 2; i++) {
            this.fragments.push({
                id: Math.random(),
                state: 'orbit',
                timer: 0.8, // 环绕 0.8 秒
                shootDelay: i * 0.25, // 依次发射延迟
                x: this.x,
                y: this.y,
                angle: Math.PI * i, // 分布在两侧
                vx: 0,
                vy: 0
            });
        }
    }
    
    addMark() {
        this.enemyMarkStacks = Math.min(6, this.enemyMarkStacks + 1);
        this.enemyMarkTime = 5.0; // 持续时间改为 5 秒
    }
    
    updateFragments(dt) {
        for (let i = this.fragments.length - 1; i >= 0; i--) {
            const f = this.fragments[i];
            
            if (f.state === 'orbit') {
                f.timer -= dt;
                f.angle += 5 * dt; // 环绕角速度
                f.x = this.x + Math.cos(f.angle) * (this.radius + 20);
                f.y = this.y + Math.sin(f.angle) * (this.radius + 20);
                
                if (f.timer <= 0) {
                    if (f.shootDelay > 0) {
                        f.shootDelay -= dt;
                    } else {
                        f.state = 'chase';
                        const speed = 800; // 较快的发射速度
                        if (this.enemy && !this.enemy.isDead) {
                            const angle = Math.atan2(this.enemy.y - f.y, this.enemy.x - f.x);
                            f.vx = Math.cos(angle) * speed;
                            f.vy = Math.sin(angle) * speed;
                        } else {
                            f.vx = speed; 
                            f.vy = 0;
                        }
                    }
                }
            } else if (f.state === 'chase' || f.state === 'homing') {
                if (f.state === 'homing' && this.enemy && !this.enemy.isDead) {
                    // 追踪效果：先快后慢的冲击感
                    f.homingTimer += dt;
                    // 初始速度 1200，随时间快速衰减到 300
                    const speed = Math.max(300, 1200 - 1500 * f.homingTimer);
                    
                    const targetAngle = Math.atan2(this.enemy.y - f.y, this.enemy.x - f.x);
                    const currentAngle = Math.atan2(f.vy, f.vx);
                    let diff = targetAngle - currentAngle;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    
                    const turnSpeed = 8 * dt; // 追踪转向灵敏度
                    const newAngle = currentAngle + Math.sign(diff) * Math.min(Math.abs(diff), turnSpeed);
                    
                    f.vx = Math.cos(newAngle) * speed;
                    f.vy = Math.sin(newAngle) * speed;
                }
                
                f.x += f.vx * dt;
                f.y += f.vy * dt;
                
                // 墙壁碰撞检测
                if (this.game) {
                    if (f.x < 0 || f.x > this.game.width || f.y < 0 || f.y > this.game.height) {
                        if (f.state === 'chase') {
                            f.state = 'sticky';
                            f.x = Math.max(0, Math.min(this.game.width, f.x));
                            f.y = Math.max(0, Math.min(this.game.height, f.y));
                        } else {
                            // 追踪弹如果超出边界（一般是被挤出去），直接消失
                            this.fragments.splice(i, 1);
                            continue;
                        }
                    }
                }
                
                // 命中敌方检测
                if (this.enemy && !this.enemy.isDead && this.enemy.invincibleTime <= 0) {
                    const dist = Math.hypot(this.enemy.x - f.x, this.enemy.y - f.y);
                    if (dist < this.enemy.radius + 10) { // 碎片半径约 10
                        if (f.state === 'chase') {
                            this.enemy.takeDamage(3 * this.damageMultiplier, f.x, f.y);
                            this.addMark();
                        } else if (f.state === 'homing') {
                            this.enemy.takeDamage(2 * this.damageMultiplier, f.x, f.y);
                            this.addMark();
                            // 附加减速10%，叠加上限80%，持续2秒
                            const slowBuff = this.enemy.buffs.find(b => b.id === 't1000_slow');
                            const currentSlow = slowBuff ? slowBuff.value : 0;
                            const newSlow = Math.min(0.8, currentSlow + 0.1);
                            this.enemy.addBuff('t1000_slow', 'slow', newSlow, 2.0);
                        }
                        this.fragments.splice(i, 1);
                        continue;
                    }
                }
            } else if (f.state === 'sticky') {
                // 敌方碰到粘黏碎片
                if (this.enemy && !this.enemy.isDead && this.enemy.invincibleTime <= 0) {
                    const dist = Math.hypot(this.enemy.x - f.x, this.enemy.y - f.y);
                    if (dist < this.enemy.radius + 10) {
                        this.enemy.takeDamage(3 * this.damageMultiplier, f.x, f.y);
                        this.addMark();
                        this.fragments.splice(i, 1);
                        continue;
                    }
                }
            }
        }
    }
    
    updateAwaken(dt) {
        if (!this.isAwakened) return;
        
        let hasActiveFragments = false;
        
        this.fragments.forEach(f => {
            if (f.state === 'sticky' && f.awakenDelay !== undefined) {
                hasActiveFragments = true;
                f.awakenDelay -= dt;
                if (f.awakenDelay <= 0) {
                    f.state = 'homing';
                    f.homingTimer = 0;
                    f.awakenDelay = undefined;
                    // 初始朝向敌方
                    if (this.enemy && !this.enemy.isDead) {
                        const angle = Math.atan2(this.enemy.y - f.y, this.enemy.x - f.x);
                        f.vx = Math.cos(angle) * 1200;
                        f.vy = Math.sin(angle) * 1200;
                    } else {
                        f.vx = 1200; f.vy = 0;
                    }
                }
            } else if (f.state === 'homing') {
                hasActiveFragments = true;
            }
        });
        
        // 觉醒结束条件：所有追踪碎片都结束（不存在 sticky+awakenDelay 和 homing 的碎片）
        if (!hasActiveFragments) {
            this.isAwakened = false;
            // 移除觉醒加速 buff
            const buffIndex = this.buffs.findIndex(b => b.id === 't1000_awaken_speed');
            if (buffIndex !== -1) {
                this.buffs.splice(buffIndex, 1);
            }
        }
    }
    
    drawBody(ctx) {
        // 1. 绘制液态金属基础球体 (银灰镜面渐变)
        const grad = ctx.createRadialGradient(-this.radius*0.3, -this.radius*0.3, this.radius*0.1, 0, 0, this.radius);
        grad.addColorStop(0, '#ffffff'); // 高光
        grad.addColorStop(0.4, '#a0a0a0'); // 中间调
        grad.addColorStop(1, '#404040'); // 暗部边缘
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 2. 绘制流动波纹噪声 (用随时间变化的弧线模拟)
        const time = Date.now() / 1000;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        for(let i=0; i<3; i++) {
            ctx.beginPath();
            const r = this.radius * (0.5 + 0.3 * Math.sin(time * 2 + i));
            ctx.arc(0, 0, r, time + i, time + i + Math.PI);
            ctx.stroke();
        }
        
        // 3. 绘制变形刺刃 (使用 Canvas 贝塞尔曲线模拟高质量金属质感路径)
        if (this.bladeActiveTime > 0) {
            ctx.save();
            ctx.rotate(this.bladeDirection);
            
            // 质感线性渐变
            const bladeGrad = ctx.createLinearGradient(this.radius, 0, this.radius + this.bladeLength, 0);
            bladeGrad.addColorStop(0, '#e6e9ef');
            bladeGrad.addColorStop(0.5, '#a0a6b8');
            bladeGrad.addColorStop(1, '#5d6470');
            
            ctx.fillStyle = bladeGrad;
            ctx.beginPath();
            
            // 刺刃根部宽度
            const baseWidth = 15;
            // 尖端宽度趋近于 1px
            const tipWidth = 1;
            
            // 使用二次贝塞尔曲线平滑过渡根部到尖端
            // 控制点放在延伸长度的中点，靠近中心轴线，形成“剑刃”特有的弧度收缩
            const cpX = this.radius + this.bladeLength * 0.4;
            const tipX = this.radius + this.bladeLength;
            
            ctx.moveTo(this.radius * 0.6, -baseWidth);
            // 上侧曲线
            ctx.quadraticCurveTo(cpX, -tipWidth, tipX, -tipWidth);
            // 尖端闭合
            ctx.lineTo(tipX, tipWidth);
            // 下侧曲线回连
            ctx.quadraticCurveTo(cpX, tipWidth, this.radius * 0.6, baseWidth);
            
            ctx.closePath();
            ctx.fill();
            
            // 1px 半透明高光边增强立体感
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.restore();
        }
        
        // 5. 绘制液态自愈回流波纹特效
        if (this.liquefyRippleTime > 0) {
            const progress = 1 - this.liquefyRippleTime; // 0 -> 1
            ctx.strokeStyle = `rgba(192, 192, 192, ${this.liquefyRippleTime})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            const r = this.radius + progress * 60; // 波纹扩散
            ctx.arc(0, 0, r, 0, Math.PI*2);
            ctx.stroke();
        }
        
        // 6. 绘制所有状态的碎片 (注意转换坐标系)
        this.fragments.forEach(f => {
            ctx.save();
            ctx.translate(f.x - this.x, f.y - this.y); // 相对于本体的偏移
            
            if (f.state === 'sticky') {
                // 粘黏状态：长方体金属圆角块 (金属质感渐变)
                const width = 30; // 还原尺寸
                const height = 15;
                const radius = 5; // 圆角
                
                // 旋转一定角度使其显得随意
                ctx.rotate(f.id * Math.PI); // 使用 id 作为固定随机角度
                
                const stickyGrad = ctx.createLinearGradient(-width/2, -height/2, width/2, height/2);
                stickyGrad.addColorStop(0, '#e6e9ef');
                stickyGrad.addColorStop(0.5, '#a0a6b8');
                stickyGrad.addColorStop(1, '#5d6470');
                ctx.fillStyle = stickyGrad;
                
                ctx.beginPath();
                ctx.moveTo(-width/2 + radius, -height/2);
                ctx.lineTo(width/2 - radius, -height/2);
                ctx.quadraticCurveTo(width/2, -height/2, width/2, -height/2 + radius);
                ctx.lineTo(width/2, height/2 - radius);
                ctx.quadraticCurveTo(width/2, height/2, width/2 - radius, height/2);
                ctx.lineTo(-width/2 + radius, height/2);
                ctx.quadraticCurveTo(-width/2, height/2, -width/2, height/2 - radius);
                ctx.lineTo(-width/2, -height/2 + radius);
                ctx.quadraticCurveTo(-width/2, -height/2, -width/2 + radius, -height/2);
                ctx.closePath();
                ctx.fill();
                
                // 1px 半透明高光边增强立体感
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.lineWidth = 1;
                ctx.stroke();
            } else {
                // 其他状态：液态金属小球
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, 10, 0, Math.PI*2);
                ctx.fill();
            }
            
            // 碎片拖尾效果
            if (f.state === 'chase' || f.state === 'homing') {
                const speed = Math.hypot(f.vx, f.vy);
                if (speed > 10) {
                    const dirX = f.vx / speed;
                    const dirY = f.vy / speed;
                    ctx.strokeStyle = 'rgba(192, 192, 192, 0.5)';
                    ctx.lineWidth = 6;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(-dirX * 30, -dirY * 30);
                    ctx.stroke();
                }
            }
            ctx.restore();
        });
        
        // 7. 绘制敌方身上的液态标记
        if (this.enemyMarkStacks > 0 && this.enemy && !this.enemy.isDead) {
            ctx.save();
            ctx.translate(this.enemy.x - this.x, this.enemy.y - this.y); // 转移到敌方位置
            const orbitRadius = this.enemy.radius + 20; // 加大环绕半径，避免和敌方身体重叠过多
            const orbitSpeed = 4; // 标记环绕速度
            
            for(let i=0; i<this.enemyMarkStacks; i++) {
                const angle = time * orbitSpeed + (Math.PI * 2 / this.enemyMarkStacks) * i;
                ctx.fillStyle = '#a0a0a0'; // 银灰液滴
                ctx.beginPath();
                ctx.arc(Math.cos(angle)*orbitRadius, Math.sin(angle)*orbitRadius, 8, 0, Math.PI*2); // 半径由 5 增大至 8
                ctx.fill();
                // 液滴高光
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(Math.cos(angle)*orbitRadius - 2, Math.sin(angle)*orbitRadius - 2, 2.5, 0, Math.PI*2); // 高光同比例增大
                ctx.fill();
            }
            ctx.restore();
        }
    }
}
