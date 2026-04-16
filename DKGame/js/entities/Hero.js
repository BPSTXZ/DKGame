/**
 * Hero 基类
 * 所有的英雄都应该继承自此类，提供基础的移动、受击、生命值管理和状态处理逻辑
 */
export class Hero {
    constructor(x, y, playerId) {
        this.x = x;
        this.y = y;
        this.playerId = playerId; // 1 为左侧玩家，2 为右侧玩家
        this.enemy = null; // 指向对手的引用
        this.game = null; // 指向 Game 引擎的引用
        
        // 基础属性 (可被子类覆盖)
        this.maxHp = 100;
        this.hp = 100;
        this.baseSpeed = 60; // 基础移速大幅提升，从 20 改为 60
        this.damageMultiplier = 1.0; // 攻击力倍率 (用于训练场调整伤害)
        this.radius = 40; // Increased from 20 to 40
        this.color = '#ffffff';
        this.name = 'Base Hero';
        
        // 状态相关
        this.vx = 0;
        this.vy = 0;
        this.rotation = 0;
        this.isDead = false;
        this.deathTimer = 1.0; // 死亡动画时长
        this.isVictorious = false;
        
        // 视觉效果
        this.damageBlinkTime = 0; // 受击闪烁计时器
        
        // Buff与状态
        this.buffs = [];
        this.speedMultiplier = 1.0; // 当前移速倍率
        this.invincibleTime = 0; // 无敌时间
        
        // 觉醒状态
        this.isAwakened = false;
        
        // 初始化时给予一个随机的移动方向
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle);
        this.vy = Math.sin(angle);
    }
    
    /**
     * 获取最终的实际移动速度
     */
    getSpeed() {
        return this.baseSpeed * 5 * this.speedMultiplier; // 乘以 5 放大至适合屏幕的像素级速度
    }
    
    /**
     * 规范化当前速度向量，确保合速度等于设定的速度值
     */
    normalizeSpeed() {
        const speed = Math.hypot(this.vx, this.vy);
        if (speed === 0) {
            this.vx = 1; this.vy = 0;
        } else {
            const targetSpeed = this.getSpeed();
            this.vx = (this.vx / speed) * targetSpeed;
            this.vy = (this.vy / speed) * targetSpeed;
        }
    }
    
    /**
     * 每帧更新实体状态
     */
    update(dt) {
        if (this.isDead) {
            this.deathTimer -= dt;
            return;
        }
        
        // 处理和衰减 Buff
        this.speedMultiplier = 1.0; // 每帧重置倍率
        for (let i = this.buffs.length - 1; i >= 0; i--) {
            const b = this.buffs[i];
            b.time -= dt;
            if (b.type === 'slow') {
                this.speedMultiplier *= (1 - b.value); // 减速叠加处理
            } else if (b.type === 'speed') {
                this.speedMultiplier *= (1 + b.value); // 加速叠加处理
            } else if (b.type === 'vampire_drain') {
                // 吸血 Buff (由牙齿命中触发)
                const drainAmount = b.value * dt;
                this.hp -= drainAmount; // 自己扣血
                if (b.source && !b.source.isDead) {
                    b.source.hp += drainAmount; // 来源回血，不设上限
                    
                    // 动态血液粒子流向吸血鬼
                    // 每秒大概生成 10 个粒子，可以随时间分布
                    if (Math.random() < 10 * dt) {
                        const fx = this.x + Math.cos(b.hitAngle || 0) * this.radius;
                        const fy = this.y + Math.sin(b.hitAngle || 0) * this.radius;
                        this.game.addParticle({
                            x: fx, y: fy,
                            vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50,
                            color: '#ff0000',
                            size: Math.random() * 3 + 2,
                            life: 1.0,
                            target: b.source
                        });
                    }
                }
                
                // 每0.5秒触发一次伤害/治疗数值跳字
                b.tickTimer = (b.tickTimer || 0) + dt;
                if (b.tickTimer >= 0.5) {
                    b.tickTimer -= 0.5;
                    const tickDamage = b.value * 0.5;
                    this.game.addFloatingText(this.x, this.y - 30, `-${tickDamage}`, '#ff4444');
                    if (b.source && !b.source.isDead) {
                        this.game.addFloatingText(b.source.x, b.source.y - 30, `+${tickDamage}`, '#4caf50');
                    }
                }
            }
            // 移除过期 Buff
            if (b.time <= 0) {
                this.buffs.splice(i, 1);
            }
        }
        
        // 应用子类的被动技能（可能会修改速度倍率）
        this.applyPassives();
        
        this.normalizeSpeed();
        
        if (this.invincibleTime > 0) this.invincibleTime -= dt;
        if (this.damageBlinkTime > 0) this.damageBlinkTime -= dt;
        
        // 更新位置
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // 执行子类的特殊逻辑更新
        this.updateSpecific(dt);
        
        // 确保各种直接操作血量（如吸血）导致的归零能够触发死亡
        if (this.hp <= 0 && !this.isDead) {
            this.die();
        }
    }
    
    // 子类钩子函数（待覆盖）
    applyPassives() {}
    updateSpecific(dt) {}
    onWallBounce() {}
    onHeroCollision(other) {}
    
    /**
     * 承受伤害
     * @param {number} amount 伤害数值
     * @param {number} sourceX 伤害来源 X 坐标（用于计算受击粒子喷射方向）
     * @param {number} sourceY 伤害来源 Y 坐标
     */
    takeDamage(amount, sourceX, sourceY) {
        if (this.isDead || this.invincibleTime > 0) return;
        
        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;
        
        this.damageBlinkTime = 0.2; // 开启闪烁
        
        // 显示扣血飘字
        this.game.addFloatingText(this.x, this.y - 30, `-${amount}`, '#ff4444');
        
        // 生成受击反向扩散的粒子效果
        const angle = Math.atan2(this.y - sourceY, this.x - sourceX);
        for(let i=0; i<10; i++) {
            const spread = angle + (Math.random() - 0.5);
            const speed = Math.random() * 100 + 50;
            this.game.addParticle({
                x: this.x - Math.cos(angle)*this.radius,
                y: this.y - Math.sin(angle)*this.radius,
                vx: Math.cos(spread) * speed,
                vy: Math.sin(spread) * speed,
                color: this.color,
                life: 0.5 + Math.random()*0.5,
                size: Math.random()*3 + 1
            });
        }
        
        this.onTakeDamage();
        
        if (this.hp <= 0) {
            this.die();
        }
    }
    
    // 子类钩子函数
    onTakeDamage() {}
    
    /**
     * 恢复生命值
     */
    heal(amount) {
        if (this.isDead) return;
        this.hp += amount; // 取消上限限制
        this.game.addFloatingText(this.x, this.y - 30, `+${amount}`, '#4caf50');
    }
    
    /**
     * 死亡处理
     */
    die() {
        this.isDead = true;
        this.hp = 0;
        this.deathTimer = 1.0; // 重置死亡动画时长为1秒
        
        // 停止所有正在播放的专属音效
        this.stopAllAudio();
        
        // 生成死亡散开粒子
        for(let i=0; i<30; i++) {
            this.game.addParticle({
                x: this.x, y: this.y,
                vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200,
                color: this.color, life: 1.0, size: 4
            });
        }
    }
    
    /**
     * 停止所有音效（由子类覆盖具体实现）
     */
    stopAllAudio() {}
    
    /**
     * 触发觉醒状态
     */
    triggerAwaken() {
        this.isAwakened = true;
        this.game.addFloatingText(this.x, this.y - 40, "AWAKEN!", '#ffd700');
        
        this.onAwaken();
    }
    
    /**
     * 播放觉醒音效（由子类覆盖）
     */
    playAwakenAudio() {}
    
    // 子类钩子函数
    onAwaken() {}
    
    /**
     * 添加状态 Buff
     */
    addBuff(id, type, value, time, extra = {}) {
        // 如果处于无敌/无法选中状态，免疫所有负面效果（如减速、吸血）
        if (this.invincibleTime > 0 && (type === 'slow' || type === 'vampire_drain')) {
            return;
        }
        
        const existing = this.buffs.find(b => b.id === id);
        if (existing) {
            existing.time = time; // 如果存在同ID的buff，则刷新时间
            existing.value = value;
            Object.assign(existing, extra);
        } else {
            this.buffs.push({ id, type, value, time, ...extra });
        }
    }
    
    /**
     * 清除所有负面状态（通常在开启无敌/觉醒时调用）
     */
    cleanseDebuffs() {
        this.buffs = this.buffs.filter(b => b.type !== 'slow' && b.type !== 'vampire_drain');
    }
    
    /**
     * 渲染自身
     */
    draw(ctx) {
        if (this.isDead && this.deathTimer <= 0) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // 死亡渐隐和缩小效果
        if (this.isDead) {
            ctx.globalAlpha = Math.max(0, this.deathTimer); // deathTimer 从 1 变 0
            ctx.scale(this.deathTimer, this.deathTimer);
        }
        
        // 受击闪烁
        if (this.damageBlinkTime > 0 && !this.isDead) {
            ctx.globalAlpha = (Math.sin(this.damageBlinkTime * 30) * 0.5 + 0.5);
        }
        
        // 无敌发光
        if (this.invincibleTime > 0 && !this.isDead) {
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 15;
        }
        
        // 胜利者高亮发光
        if (this.isVictorious) {
            ctx.shadowColor = '#ffd700'; // 金色光芒
            ctx.shadowBlur = 30 + Math.sin(Date.now() / 150) * 10; // 呼吸光
        }
        
        // 绘制本体
        this.drawBody(ctx);
        
        // 绘制血量数值 (水平显示)
        ctx.shadowBlur = 0; // 移除文字阴影
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.floor(this.hp).toString(), 0, 0);
        
        // 绘制附着的尖牙（针对 vampire_drain 状态）
        this.buffs.forEach(b => {
            if (b.type === 'vampire_drain' && b.hitAngle !== undefined) {
                ctx.save();
                // 沿着受击角度平移到实体边缘
                const fx = Math.cos(b.hitAngle) * this.radius;
                const fy = Math.sin(b.hitAngle) * this.radius;
                ctx.translate(fx, fy);
                // 按照牙齿飞行角度旋转，使其表现为“插入”状态
                ctx.rotate(b.fangAngle);
                
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.moveTo(-10, -6);
                ctx.lineTo(20, 0);
                ctx.lineTo(-10, 6);
                ctx.fill();
                
                ctx.restore();
            }
        });
        
        ctx.restore();
    }
    
    drawBody(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.playerId === 1 ? '#ff4444' : '#4444ff';
        ctx.stroke();
    }
}
