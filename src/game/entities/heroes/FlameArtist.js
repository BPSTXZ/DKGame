import { Hero } from '../Hero.js';

export class FlameArtist extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '戏炎师';
        this.color = '#ff4500'; // 橙红色
        this.hp = 100;
        this.maxHp = 100;
        this.baseSpeed = 60;
        this.radius = 40;
        
        // 碰撞伤害冷却控制 (0.5s)
        this.lastCollisionTime = 0;
        
        // 喷火技能参数
        this.fireCooldown = 2.0;
        this.fireTimer = 0;
        this.isFiring = false;
        this.fireDuration = 1.0;
        this.currentFireTime = 0;
        this.fireAngle = 0;
        this.fireConeAngle = 40 * Math.PI / 180; // 扩大扇形角度至 40度
        this.fireRange = 350; // 稍微提升射程
        this.fireDamagePerSec = 10.0; // 喷火伤害从 3.0 提升到 10.0
        this.fireTickInterval = 0.2;
        this.fireTickTimer = 0;
        
        // 火种系统
        this.sparks = []; // {x, y, life, maxLife, id}
        this.maxSparks = 20;
        
        // 觉醒参数
        this.awakenDuration = 2.0;
        this.awakenTimer = 0;
        this.awakenRotation = 0;
        this.awakenSparksToSpawn = 0;
        this.awakenSparkSpawnTimer = 0;
        
        // 自身回血冷却
        this.lastHealTime = 0;

        // 音效配置
        this.fireAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/FlameArtist/普通喷火.mp3');
        this.fireAudio.loop = true;
        this.igniteAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/FlameArtist/引燃.mp3');
        this.awakenAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/FlameArtist/觉醒喷火.mp3');
    }
    
    stopAllAudio() {
        if (this.fireAudio) { this.fireAudio.pause(); this.fireAudio.currentTime = 0; }
        if (this.igniteAudio) { this.igniteAudio.pause(); this.igniteAudio.currentTime = 0; }
        if (this.awakenAudio) { this.awakenAudio.pause(); this.awakenAudio.currentTime = 0; }
    }

    stopAwakenAudio() {
        if (this.awakenAudio) {
            this.awakenAudio.pause();
            this.awakenAudio.currentTime = 0;
        }
    }

    playAwakenAudio() {
        if (this.awakenAudio) {
            this.awakenAudio.currentTime = 0;
            this.awakenAudio.play().catch(e => console.warn('FlameArtist awaken audio play failed:', e));
        }
    }

    onHeroCollision(other) {
        if (this.isDead || other.isDead) return;
        
        // 碰撞伤害 1点，冷却0.5秒
        const now = Date.now();
        if (!this.lastCollisionTime || now - this.lastCollisionTime > 500) {
            other.takeDamage(1 * this.damageMultiplier, this.x, this.y);
            this.lastCollisionTime = now;
        }
    }

    // 辅助函数：判断点是否在扇形内
    isPointInSector(px, py, cx, cy, radius, startAngle, endAngle) {
        const dx = px - cx;
        const dy = py - cy;
        const distSq = dx * dx + dy * dy;
        
        if (distSq > radius * radius) return false;
        
        let angle = Math.atan2(dy, dx);
        // 标准化角度到 0 - 2PI
        if (angle < 0) angle += 2 * Math.PI;
        
        let sAngle = startAngle;
        while (sAngle < 0) sAngle += 2 * Math.PI;
        sAngle = sAngle % (2 * Math.PI);
        
        let eAngle = endAngle;
        while (eAngle < 0) eAngle += 2 * Math.PI;
        eAngle = eAngle % (2 * Math.PI);
        
        if (sAngle < eAngle) {
            return angle >= sAngle && angle <= eAngle;
        } else {
            return angle >= sAngle || angle <= eAngle;
        }
    }

    // 辅助函数：生成不重叠的火种
    spawnSparks(count, cx, cy, radius, startAngle, endAngle) {
        let spawned = 0;
        let attempts = 0;
        const maxAttempts = count * 10;
        
        while (spawned < count && attempts < maxAttempts) {
            attempts++;
            
            // 随机半径 (偏向外侧一点)
            const r = radius * (0.3 + 0.7 * Math.sqrt(Math.random()));
            // 随机角度
            const a = startAngle + Math.random() * (endAngle - startAngle);
            
            const sx = cx + Math.cos(a) * r;
            const sy = cy + Math.sin(a) * r;
            
            // 检查边界
            if (sx < 10 || sx > this.game.width - 10 || sy < 10 || sy > this.game.height - 10) continue;
            
            // 检查与其他火种的距离 (最小间距10)
            let tooClose = false;
            for (const spark of this.sparks) {
                const distSq = (spark.x - sx) * (spark.x - sx) + (spark.y - sy) * (spark.y - sy);
                if (distSq < 100) { // 10 * 10
                    tooClose = true;
                    break;
                }
            }
            
            if (!tooClose) {
                this.addSpark(sx, sy);
                spawned++;
            }
        }
    }

    addSpark(x, y) {
        if (this.sparks.length >= this.maxSparks) {
            this.sparks.shift(); // 移除最旧的
        }
        this.sparks.push({
            id: Date.now() + Math.random(),
            x: x,
            y: y,
            life: 6.0,
            maxLife: 6.0,
            pulseOffset: Math.random() * Math.PI * 2
        });
    }

    startFire() {
        this.isFiring = true;
        this.currentFireTime = 0;
        this.fireTickTimer = 0;
        
        // 锁定敌方方向
        if (this.enemy && !this.enemy.isDead) {
            this.fireAngle = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
        } else {
            this.fireAngle = Math.random() * Math.PI * 2;
        }

        if (this.fireAudio) {
            this.fireAudio.currentTime = 0;
            this.fireAudio.play().catch(e => console.warn('FlameArtist fire audio play failed:', e));
        }
    }

    endFire() {
        this.isFiring = false;
        
        if (this.fireAudio) {
            this.fireAudio.pause();
            this.fireAudio.currentTime = 0;
        }
        
        // 喷火结束，生成5个火种
        const startAngle = this.fireAngle - this.fireConeAngle / 2;
        const endAngle = this.fireAngle + this.fireConeAngle / 2;
        this.spawnSparks(5, this.x, this.y, this.fireRange, startAngle, endAngle);
    }

    triggerIgnite(target) {
        // 清除或重置相关 buff
        const markBuff = target.buffs.find(b => b.id === 'flame_mark');
        if (markBuff) markBuff.time = 0; // 移除标记
        
        // 触发引燃瞬间造成一段爆发伤害
        target.takeDamage(3.0 * this.damageMultiplier, target.x, target.y);

        // 触发引燃状态 (持续伤害由 4.0 降至 2.0)
        target.addBuff('flame_ignite', 'burn', 2.0 * this.damageMultiplier, 3.0, { ignite: true });
        
        // 视觉表现
        if (this.game) {
            this.game.addFloatingText(target.x, target.y - 40, "引燃!", '#ff0000');
            
            // 爆燃环
            this.game.addParticle({
                x: target.x, y: target.y,
                vx: 0, vy: 0,
                color: 'rgba(255, 69, 0, 0.6)',
                size: target.radius * 2.5,
                life: 0.3
            });
            
            // 播放爆燃音效
            if (this.igniteAudio) {
                const snd = new Audio(this.igniteAudio.src);
                snd.play().catch(e => console.warn('FlameArtist ignite audio play failed:', e));
            }
        }
    }

    updateSpecific(dt) {
        if (this.isDead) return;
        
        const now = Date.now();

        // 觉醒状态逻辑
        if (this.isAwakened) {
            this.awakenTimer -= dt;
            
            // 旋转速度曲线: 慢 -> 快 -> 慢
            // 使用正弦波来调制转速
            const progress = 1 - (this.awakenTimer / this.awakenDuration); // 0 -> 1
            const spinSpeed = (Math.sin(progress * Math.PI) + 0.5) * 10; // 慢快慢
            this.awakenRotation += spinSpeed * dt;
            
            // 觉醒喷火伤害结算
            this.fireTickTimer -= dt;
            if (this.fireTickTimer <= 0) {
                this.fireTickTimer = this.fireTickInterval;
                
                if (this.enemy && !this.enemy.isDead && this.enemy.invincibleTime <= 0) {
                    const dmg = 15.0 * this.fireTickInterval * this.damageMultiplier; // 觉醒喷火伤害大幅提升至 15.0 DPS
                    
                    // 检查两个对称的扇形
                    const angle1 = this.awakenRotation;
                    const angle2 = this.awakenRotation + Math.PI;
                    
                    const inCone1 = this.isPointInSector(this.enemy.x, this.enemy.y, this.x, this.y, 1000, angle1 - this.fireConeAngle/2, angle1 + this.fireConeAngle/2);
                    const inCone2 = this.isPointInSector(this.enemy.x, this.enemy.y, this.x, this.y, 1000, angle2 - this.fireConeAngle/2, angle2 + this.fireConeAngle/2);
                    
                    if (inCone1 || inCone2) {
                        this.enemy.takeDamage(dmg, this.x, this.y);
                    }
                }
            }
            
            // 分帧生成火种 (15个)
            if (this.awakenSparksToSpawn > 0) {
                this.awakenSparkSpawnTimer -= dt;
                if (this.awakenSparkSpawnTimer <= 0) {
                    this.awakenSparkSpawnTimer = 0.1;
                    
                    // 随机选一个当前的喷火方向
                    const angle = Math.random() > 0.5 ? this.awakenRotation : this.awakenRotation + Math.PI;
                    const startAngle = angle - this.fireConeAngle / 2;
                    const endAngle = angle + this.fireConeAngle / 2;
                    
                    this.spawnSparks(1, this.x, this.y, 400, startAngle, endAngle); // 范围稍微限制一下，避免全屏太散
                    this.awakenSparksToSpawn--;
                }
            }
            
            if (this.awakenTimer <= 0) {
                this.isAwakened = false;
                
                if (this.awakenAudio) {
                    this.awakenAudio.pause();
                    this.awakenAudio.currentTime = 0;
                }
                
                // 大范围热浪扩散环
                if (this.game) {
                    this.game.addParticle({
                        x: this.x, y: this.y,
                        vx: 0, vy: 0,
                        color: 'rgba(255, 100, 0, 0.4)',
                        size: 600,
                        life: 0.5
                    });
                }
            }
        } 
        // 正常喷火逻辑
        else if (this.isFiring) {
            this.currentFireTime += dt;
            this.fireTickTimer -= dt;
            
            // 持续追踪敌方方向
            if (this.enemy && !this.enemy.isDead) {
                this.fireAngle = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
            }
            
            if (this.fireTickTimer <= 0) {
                this.fireTickTimer = this.fireTickInterval;
                
                // 结算伤害
                if (this.enemy && !this.enemy.isDead && this.enemy.invincibleTime <= 0) {
                    const startAngle = this.fireAngle - this.fireConeAngle / 2;
                    const endAngle = this.fireAngle + this.fireConeAngle / 2;
                    
                    if (this.isPointInSector(this.enemy.x, this.enemy.y, this.x, this.y, this.fireRange, startAngle, endAngle)) {
                        const dmg = this.fireDamagePerSec * this.fireTickInterval * this.damageMultiplier;
                        this.enemy.takeDamage(dmg, this.x, this.y);
                    }
                }
            }
            
            if (this.currentFireTime >= this.fireDuration) {
                this.endFire();
            }
        } 
        // 冷却逻辑
        else if (!this.isSuppressed) {
            this.fireTimer -= dt;
            if (this.fireTimer <= 0) {
                this.fireTimer = this.fireCooldown;
                this.startFire();
            }
        }

        // 火种逻辑更新
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const spark = this.sparks[i];
            spark.life -= dt;
            
            if (spark.life <= 0) {
                this.sparks.splice(i, 1);
                continue;
            }
            
            // 敌方拾取判定
            if (this.enemy && !this.enemy.isDead && this.enemy.invincibleTime <= 0) {
                const distSq = (this.enemy.x - spark.x) * (this.enemy.x - spark.x) + (this.enemy.y - spark.y) * (this.enemy.y - spark.y);
                if (distSq < (this.enemy.radius + 15) * (this.enemy.radius + 15)) {
                    // 触碰火种
                    this.sparks.splice(i, 1);
                    
                    // 检查是否已处于引燃状态
                    const igniteBuff = this.enemy.buffs.find(b => b.id === 'flame_ignite');
                    if (igniteBuff) {
                        igniteBuff.time = 3.0; // 刷新引燃持续时间
                    } else {
                        // 添加/刷新标记层数
                        let markBuff = this.enemy.buffs.find(b => b.id === 'flame_mark');
                        if (!markBuff) {
                            this.enemy.addBuff('flame_mark', 'burn', 1.0 * this.damageMultiplier, 3.0, { stacks: 1 }); // 降低火种单层伤害至1.0点
                            markBuff = this.enemy.buffs.find(b => b.id === 'flame_mark');
                        } else {
                            markBuff.time = 3.0;
                            markBuff.stacks = Math.min(6, (markBuff.stacks || 1) + 1);
                            markBuff.value = markBuff.stacks * 1.0 * this.damageMultiplier; // 降低回每层1点
                        }
                        
                        // 检查是否触发引燃
                        if (markBuff && markBuff.stacks >= 4) {
                            this.triggerIgnite(this.enemy);
                        }
                    }
                    continue; // 已经被吃掉，跳过自身拾取判定
                }
            }
            
            // 自身拾取判定
            if (!this.isDead) {
                const distSq = (this.x - spark.x) * (this.x - spark.x) + (this.y - spark.y) * (this.y - spark.y);
                if (distSq < (this.radius + 15) * (this.radius + 15)) {
                    if (now - this.lastHealTime > 100) { // 0.1s 冷却
                        this.sparks.splice(i, 1);
                        // 由回血改为增加移速：+20% 持续 2秒
                        this.addBuff('flame_pickup_speed', 'speed', 0.2, 2.0);
                        this.lastHealTime = now;
                    }
                }
            }
        }
    }

    onAwaken() {
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: '焚天炼狱' });
        }
        
        // 如果正在普通喷火，中断它
        if (this.isFiring) {
            this.endFire();
        }
        
        this.isAwakened = true;
        this.awakenTimer = this.awakenDuration;
        this.awakenRotation = Math.random() * Math.PI * 2;
        this.awakenSparksToSpawn = 15;
        this.awakenSparkSpawnTimer = 0;
        this.fireTickTimer = 0; // 立即触发一次伤害结算

        // 播放觉醒旋转喷火专属音效
        if (this.awakenAudio) {
            this.awakenAudio.currentTime = 0;
            this.awakenAudio.play().catch(e => console.warn('FlameArtist awaken fire audio play failed:', e));
        }
    }

    drawBody(ctx) {
        // 外观：橙红色球体 表面流动火焰纹理 用正弦波噪声模拟摇曳 边缘轻微发光描边
        
        const time = Date.now() / 200;
        
        // 发光描边
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff4500';
        
        // 基础球体
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        ctx.shadowBlur = 0;
        
        // 摇曳纹理 (在球体内)
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.clip();
        
        ctx.fillStyle = '#ff8c00';
        ctx.beginPath();
        for (let x = -this.radius; x <= this.radius; x += 5) {
            const yOffset = Math.sin(x * 0.1 + time) * 10 + Math.sin(x * 0.05 - time * 0.5) * 5;
            if (x === -this.radius) ctx.moveTo(x, yOffset);
            else ctx.lineTo(x, yOffset);
        }
        ctx.lineTo(this.radius, this.radius);
        ctx.lineTo(-this.radius, this.radius);
        ctx.fill();
        
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        for (let x = -this.radius; x <= this.radius; x += 5) {
            const yOffset = Math.sin(x * 0.15 - time * 1.2) * 8 + Math.sin(x * 0.08 + time * 0.8) * 4 + 10;
            if (x === -this.radius) ctx.moveTo(x, yOffset);
            else ctx.lineTo(x, yOffset);
        }
        ctx.lineTo(this.radius, this.radius);
        ctx.lineTo(-this.radius, this.radius);
        ctx.fill();
        
        ctx.restore();
        
        // 边缘描边
        ctx.lineWidth = 3;
        ctx.strokeStyle = this.playerId === 1 ? '#ff4444' : '#4444ff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // 绘制血量数值 (强制水平显示)
        ctx.save();
        // 撤销为了本体旋转（如果有的话）所做的旋转
        if (this.visualRotation) {
            ctx.rotate(-this.visualRotation);
        }
        ctx.shadowBlur = 0; 
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.ceil(this.hp).toString(), 0, 0);
        ctx.restore();
    }

    drawOverlay(ctx) {
        super.drawOverlay(ctx);
        
        const time = Date.now() / 1000;
        
        // 绘制火种 (不受英雄坐标系平移影响，因为火种是绝对坐标)
        for (const spark of this.sparks) {
            ctx.save();
            ctx.translate(spark.x, spark.y);
            
            // 闪烁逻辑
            let scale = 1.0;
            let alpha = 1.0;
            if (spark.life < 1.0) {
                // 剩余时间小于1秒时火种闪烁加快并缩小熄灭
                const flashFreq = 20;
                alpha = (Math.sin(time * flashFreq) + 1) / 2;
                scale = spark.life; // 逐渐缩小
            } else {
                // 轻微呼吸闪烁
                scale = 1.0 + Math.sin(time * 5 + spark.pulseOffset) * 0.15;
            }
            
            ctx.scale(scale, scale);
            
            // 外围发光晕染 (新增)
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff4500';
            
            // 底层灼烧区域指示 (新增)
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 69, 0, ${alpha * 0.2})`;
            ctx.fill();
            
            // 外圈暗 (增大体积)
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 69, 0, ${alpha * 0.8})`;
            ctx.fill();
            
            // 中圈亮 (增大体积)
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 140, 0, ${alpha})`;
            ctx.fill();
            
            // 中心白炽 (新增层次)
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fill();
            
            ctx.shadowBlur = 0; // 重置阴影以免影响其他绘制
            
            // 小火苗形状 (增大体积，向上延伸更多)
            ctx.beginPath();
            ctx.moveTo(-6, 0);
            ctx.quadraticCurveTo(0, -20, 6, 0);
            ctx.fillStyle = `rgba(255, 200, 0, ${alpha})`;
            ctx.fill();
            
            ctx.restore();
        }
        
        // 绘制喷火扇形 (正常喷火)
        if (this.isFiring && !this.isAwakened) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.fireAngle);
            
            // 起手渐强，收尾渐弱
            let alpha = 0.8; // 提升基础透明度以增加压迫感
            if (this.currentFireTime < 0.1) {
                alpha = 0.8 * (this.currentFireTime / 0.1);
            } else if (this.fireDuration - this.currentFireTime < 0.1) {
                alpha = 0.8 * ((this.fireDuration - this.currentFireTime) / 0.1);
            }
            
            // 多层渐变面叠加以产生强烈的火焰感
            // 底层：深橙红外焰，较宽，模拟热浪外围
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, this.fireRange, -this.fireConeAngle/2 - 0.1, this.fireConeAngle/2 + 0.1);
            ctx.closePath();
            
            const gradientBase = ctx.createRadialGradient(0, 0, this.radius, 0, 0, this.fireRange);
            gradientBase.addColorStop(0, `rgba(255, 140, 0, ${alpha * 0.9})`);
            gradientBase.addColorStop(0.6, `rgba(255, 69, 0, ${alpha * 0.6})`);
            gradientBase.addColorStop(1, `rgba(255, 0, 0, 0)`);
            ctx.fillStyle = gradientBase;
            ctx.fill();

            // 中层：明亮内焰，稍窄
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, this.fireRange * 0.8, -this.fireConeAngle/2 + 0.05, this.fireConeAngle/2 - 0.05);
            ctx.closePath();
            
            const gradientMid = ctx.createRadialGradient(0, 0, this.radius, 0, 0, this.fireRange * 0.8);
            gradientMid.addColorStop(0, `rgba(255, 255, 255, ${alpha})`); // 核心白炽
            gradientMid.addColorStop(0.4, `rgba(255, 215, 0, ${alpha * 0.8})`); // 浅黄白
            gradientMid.addColorStop(1, `rgba(255, 140, 0, 0)`);
            ctx.fillStyle = gradientMid;
            ctx.fill();

            // 动态热浪扭曲纹理
            ctx.strokeStyle = `rgba(255, 100, 0, ${alpha * 0.4})`;
            ctx.lineWidth = 4;
            // 使用多条带有复合正弦波噪声的弧线模拟热空气扭曲
            for (let r = 80; r < this.fireRange; r += 40) {
                ctx.beginPath();
                const noise1 = Math.sin(time * 15 + r * 0.05) * 0.1;
                const noise2 = Math.cos(time * 8 - r * 0.1) * 0.05;
                const offset = noise1 + noise2;
                ctx.arc(0, 0, r + (Math.sin(time*20+r)*5), -this.fireConeAngle/2 + offset, this.fireConeAngle/2 + offset);
                ctx.stroke();
            }
            
            ctx.restore();
            
            // 高级喷火粒子生成 (大量、发散、带轻微抖动)
            if (this.game) {
                // 每帧生成 2-4 个粒子
                const particleCount = Math.floor(Math.random() * 3) + 2;
                for (let i = 0; i < particleCount; i++) {
                    const spread = (Math.random() - 0.5) * this.fireConeAngle * 0.9; // 限制在锥角内稍微收缩一点
                    // 粒子初始速度高，后续在粒子系统中受阻力减速，体现喷射感
                    const speed = Math.random() * 300 + 200; 
                    
                    // 移除会导致越界的大幅度切向速度，改为极小的随机抖动
                    const tangentAngle = this.fireAngle + spread + Math.PI / 2;
                    const slightJitter = (Math.random() - 0.5) * 20;

                    this.game.addParticle({
                        x: this.x + Math.cos(this.fireAngle + spread) * this.radius, // 出生点也加上发散角
                        y: this.y + Math.sin(this.fireAngle + spread) * this.radius,
                        vx: Math.cos(this.fireAngle + spread) * speed + Math.cos(tangentAngle) * slightJitter,
                        vy: Math.sin(this.fireAngle + spread) * speed + Math.sin(tangentAngle) * slightJitter,
                        color: Math.random() > 0.4 ? '#ff4500' : (Math.random() > 0.5 ? '#ffd700' : '#ffffff'),
                        size: Math.random() * 6 + 3,
                        life: Math.random() * 0.4 + 0.2,
                        gravity: 0 // 无重力，依靠 vx/vy 和 Game.js 里的空气阻力
                    });
                }
            }
        }
        
        // 绘制觉醒喷火 (双向全屏旋转)
        if (this.isAwakened) {
            ctx.save();
            ctx.translate(this.x, this.y);
            
            // 本体爆发光晕
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 2, 0, Math.PI * 2);
            const bodyGlow = ctx.createRadialGradient(0, 0, this.radius, 0, 0, this.radius * 2);
            bodyGlow.addColorStop(0, `rgba(255, 255, 255, 0.8)`);
            bodyGlow.addColorStop(0.4, `rgba(255, 100, 0, 0.5)`);
            bodyGlow.addColorStop(1, `rgba(255, 0, 0, 0)`);
            ctx.fillStyle = bodyGlow;
            ctx.fill();

            ctx.rotate(this.awakenRotation);
            
            const awakenRange = 1000; // 覆盖全场
            // 根据觉醒时间实现起手渐强和收尾渐弱
            let alpha = 0.85; 
            const timePassed = this.awakenDuration - this.awakenTimer;
            if (timePassed < 0.2) {
                alpha = 0.85 * (timePassed / 0.2);
            } else if (this.awakenTimer < 0.2) {
                alpha = 0.85 * (this.awakenTimer / 0.2);
            }
            
            for (let i = 0; i < 2; i++) {
                ctx.save();
                if (i === 1) ctx.rotate(Math.PI); // 反向
                
                // 底层：深色宽扇形热浪
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, awakenRange, -this.fireConeAngle/2 - 0.2, this.fireConeAngle/2 + 0.2);
                ctx.closePath();
                
                const gradientBase = ctx.createRadialGradient(0, 0, this.radius, 0, 0, awakenRange * 0.8);
                gradientBase.addColorStop(0, `rgba(255, 140, 0, ${alpha * 0.9})`);
                gradientBase.addColorStop(0.5, `rgba(255, 69, 0, ${alpha * 0.6})`);
                gradientBase.addColorStop(1, `rgba(255, 0, 0, 0)`);
                ctx.fillStyle = gradientBase;
                ctx.fill();

                // 中层：明亮核心白炽火焰
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, awakenRange * 0.9, -this.fireConeAngle/2 + 0.05, this.fireConeAngle/2 - 0.05);
                ctx.closePath();
                
                const gradientMid = ctx.createRadialGradient(0, 0, this.radius, 0, 0, awakenRange * 0.7);
                gradientMid.addColorStop(0, `rgba(255, 255, 255, ${alpha})`); 
                gradientMid.addColorStop(0.3, `rgba(255, 215, 0, ${alpha * 0.8})`); 
                gradientMid.addColorStop(1, `rgba(255, 100, 0, 0)`);
                ctx.fillStyle = gradientMid;
                ctx.fill();
                
                // 动态热浪扭曲纹理
                ctx.strokeStyle = `rgba(255, 100, 0, ${alpha * 0.5})`;
                ctx.lineWidth = 5;
                for (let r = 100; r < awakenRange; r += 80) {
                    ctx.beginPath();
                    const noise1 = Math.sin(time * 20 + r * 0.02) * 0.15;
                    const noise2 = Math.cos(time * 10 - r * 0.05) * 0.08;
                    const offset = noise1 + noise2;
                    ctx.arc(0, 0, r + (Math.sin(time*25+r)*10), -this.fireConeAngle/2 + offset, this.fireConeAngle/2 + offset);
                    ctx.stroke();
                }

                // 旋转残影 (稍微滞后的淡色扇形)
                // 假设是逆时针旋转，所以残影在顺时针方向。速度随时间变化，所以残影大小给一个固定近似值
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, awakenRange * 0.7, -this.fireConeAngle/2 - 0.4, -this.fireConeAngle/2);
                ctx.closePath();
                const shadowGrad = ctx.createRadialGradient(0, 0, this.radius, 0, 0, awakenRange * 0.7);
                shadowGrad.addColorStop(0, `rgba(255, 100, 0, ${alpha * 0.4})`);
                shadowGrad.addColorStop(1, `rgba(255, 0, 0, 0)`);
                ctx.fillStyle = shadowGrad;
                ctx.fill();
                
                ctx.restore();
            }
            
            ctx.restore();
            
            // 高级觉醒喷火粒子
            if (this.game) {
                // 生成数量大幅增加
                for(let i=0; i<6; i++) {
                    const dir = Math.random() > 0.5 ? this.awakenRotation : this.awakenRotation + Math.PI;
                    const spread = (Math.random() - 0.5) * this.fireConeAngle * 0.9;
                    const speed = Math.random() * 600 + 300; // 更高的初速
                    
                    const tangentAngle = dir + spread + Math.PI / 2;
                    const slightJitter = (Math.random() - 0.5) * 30;

                    this.game.addParticle({
                        x: this.x + Math.cos(dir + spread) * this.radius,
                        y: this.y + Math.sin(dir + spread) * this.radius,
                        vx: Math.cos(dir + spread) * speed + Math.cos(tangentAngle) * slightJitter,
                        vy: Math.sin(dir + spread) * speed + Math.sin(tangentAngle) * slightJitter,
                        color: Math.random() > 0.4 ? '#ff4500' : (Math.random() > 0.5 ? '#ffd700' : '#ffffff'),
                        size: Math.random() * 8 + 4,
                        life: Math.random() * 0.6 + 0.3,
                        gravity: 0
                    });
                }
            }
        }

        // 绘制敌方身上的火种标记UI
        if (this.enemy && !this.enemy.isDead) {
            const markBuff = this.enemy.buffs.find(b => b.id === 'flame_mark');
            const igniteBuff = this.enemy.buffs.find(b => b.id === 'flame_ignite');
            
            if (igniteBuff) {
                // 引燃状态：强火焰燃烧
                ctx.save();
                ctx.translate(this.enemy.x, this.enemy.y);
                
                // 给敌方整体罩上一层强烈的发红/发光效果 (覆盖在敌方上层)
                ctx.beginPath();
                ctx.arc(0, 0, this.enemy.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 69, 0, ${0.3 + Math.sin(time * 20) * 0.1})`;
                ctx.fill();

                // 外部强光晕染
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#ff0000';
                ctx.strokeStyle = `rgba(255, 0, 0, 0.8)`;
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.shadowBlur = 0; // 重置
                
                // 脚下大火圈 (带收缩扩张动画)
                const pulseScale = 1.0 + Math.sin(time * 15) * 0.15;
                ctx.beginPath();
                ctx.arc(0, 0, (this.enemy.radius + 15) * pulseScale, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 140, 0, 0.8)`;
                ctx.lineWidth = 4;
                ctx.stroke();
                
                // 绘制几簇附着在身上的猛烈火苗
                for (let i = 0; i < 4; i++) {
                    ctx.save();
                    ctx.rotate(time * 2 + (i * Math.PI / 2));
                    ctx.translate(this.enemy.radius * 0.8, 0);
                    
                    const flameHeight = 15 + Math.random() * 10;
                    ctx.beginPath();
                    ctx.moveTo(-5, 0);
                    ctx.quadraticCurveTo(0, -flameHeight, 5, 0);
                    ctx.fillStyle = Math.random() > 0.5 ? '#ff4500' : '#ffff00';
                    ctx.fill();
                    ctx.restore();
                }

                // 持续生成的向上升腾的火焰粒子交由 Particle 系统
                if (Math.random() < 0.8 && this.game) {
                    for(let i = 0; i < 2; i++) {
                        this.game.addParticle({
                            x: this.enemy.x + (Math.random() - 0.5) * this.enemy.radius * 1.8,
                            y: this.enemy.y + (Math.random() - 0.5) * this.enemy.radius * 1.8,
                            vx: (Math.random() - 0.5) * 20, 
                            vy: -80 - Math.random() * 60, // 快速向上升腾
                            color: Math.random() > 0.4 ? '#ff4500' : '#ffff00', 
                            size: Math.random() * 6 + 3, 
                            life: Math.random() * 0.4 + 0.2
                        });
                    }
                }
                
                ctx.restore();
            } else if (markBuff && markBuff.stacks > 0) {
                // 标记状态：环绕小火星和层数数字
                const stacks = markBuff.stacks;
                ctx.save();
                ctx.translate(this.enemy.x, this.enemy.y);
                
                // 环绕火星
                const orbitSpeed = 3;
                for (let i = 0; i < stacks; i++) {
                    const angle = time * orbitSpeed + (i * Math.PI * 2 / stacks);
                    const orbitR = this.enemy.radius + 10;
                    const px = Math.cos(angle) * orbitR;
                    const py = Math.sin(angle) * orbitR;
                    
                    ctx.beginPath();
                    ctx.arc(px, py, 3, 0, Math.PI * 2);
                    ctx.fillStyle = '#ff8c00';
                    ctx.fill();
                }
                
                // 头顶数字
                ctx.fillStyle = '#ff4500';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(stacks.toString(), 0, -this.enemy.radius - 15);
                
                ctx.restore();
            }
        }
    }
}
