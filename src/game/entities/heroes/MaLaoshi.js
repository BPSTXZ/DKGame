import { Hero } from '../Hero.js';

/**
 * 混元太极 马老师
 */
export class MaLaoshi extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '马老师';
        this.color = '#cccccc'; // 浅灰色
        this.radius = 40; // 统一标准尺寸 (与基类一致)
        
        this.hp = 100;
        this.maxHp = 100;
        this.baseSpeed = 60;
        
        // 攻击机制一：松果糖豆劲 (每 2 秒一次)
        this.nutBeanTimer = 2.0;
        this.projectiles = []; // 存储场上的松果和糖豆
        
        // 攻击机制二：三维立体混元劲 (血量阈值触发)
        this.hunyuanThresholds = [80, 60, 40, 20];
        this.hunyuanWaves = []; // 场上扩算的能量波
        
        // 觉醒机制：闪电五连鞭
        this.whipMaxCount = 5;
        this.whipCurrentCount = 0;
        this.whipInterval = 1.5;
        this.whipTimer = 0;
        this.isWhipping = false;
        
        // 专属音效
        this.nutBeanFirstAudioSrc = import.meta.env.BASE_URL + 'assets/audio/MaLaoshi/松果糖豆劲.mp3';
        this.nutBeanNormalAudioSrc = import.meta.env.BASE_URL + 'assets/audio/MaLaoshi/发射.mp3';
        this.hasPlayedFirstNutBean = false;
        
        this.hitAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/common/碰撞.mp3');
        this.hunyuanAudioSrcs = [
            import.meta.env.BASE_URL + 'assets/audio/MaLaoshi/防出去.mp3',
            import.meta.env.BASE_URL + 'assets/audio/MaLaoshi/化劲.mp3',
            import.meta.env.BASE_URL + 'assets/audio/MaLaoshi/婷婷.mp3'
        ];
        this.lastHunyuanAudioIndex = -1;
        
        this.awakenAudioSrc = import.meta.env.BASE_URL + 'assets/audio/MaLaoshi/觉醒闪电鞭.mp3';
        this.whipAudioSrcs = [
            import.meta.env.BASE_URL + 'assets/audio/MaLaoshi/一鞭.mp3',
            import.meta.env.BASE_URL + 'assets/audio/MaLaoshi/两鞭.mp3',
            import.meta.env.BASE_URL + 'assets/audio/MaLaoshi/三鞭.mp3',
            import.meta.env.BASE_URL + 'assets/audio/MaLaoshi/四鞭.mp3',
            import.meta.env.BASE_URL + 'assets/audio/MaLaoshi/五鞭.mp3'
        ];
        this.currentWhipAudio = null;
        this.whipHitAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/common/碰撞.mp3');
        
        this.victoryAudioSrc = import.meta.env.BASE_URL + 'assets/audio/MaLaoshi/胜利宣言.mp3';
        this.hasPlayedVictory = false;
    }

    applyPassives() {
        super.applyPassives();
        // 觉醒时不提供直接的被动移速加成，而是通过五连鞭机制压制对手
    }

    updateSpecific(dt) {
        if (this.isDead) {
            if (this.currentWhipAudio) {
                this.currentWhipAudio.pause();
                this.currentWhipAudio = null;
            }
            return;
        }
        
        // ====== 机制一：松果糖豆劲 ======
        if (!this.isAwakened && !this.isSuppressed) {
            this.nutBeanTimer -= dt;
            if (this.nutBeanTimer <= 0) {
                this.shootNutAndBean();
                this.nutBeanTimer = 2.0;
            }
        }
        
        // 更新投射物
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.life -= dt;
            if (proj.life <= 0) {
                this.projectiles.splice(i, 1);
                continue;
            }
            
            // 计算线性速度衰减
            if (proj.currentSpeed > 0) {
                proj.currentSpeed -= proj.decayRate * dt;
                if (proj.currentSpeed < 0) proj.currentSpeed = 0;
                
                // 维持原有方向，更新 vx 和 vy
                const currentAngle = Math.atan2(proj.vy, proj.vx);
                proj.vx = Math.cos(currentAngle) * proj.currentSpeed;
                proj.vy = Math.sin(currentAngle) * proj.currentSpeed;
            }
            
            proj.x += proj.vx * dt;
            proj.y += proj.vy * dt;
            proj.angle += proj.rotSpeed * dt;
            
            // 边缘反弹检测 (假设场地尺寸挂载在 this.game 上)
            if (proj.x - proj.radius < 0) {
                proj.x = proj.radius;
                proj.vx = -proj.vx;
            } else if (proj.x + proj.radius > this.game.width) {
                proj.x = this.game.width - proj.radius;
                proj.vx = -proj.vx;
            }
            if (proj.y - proj.radius < 0) {
                proj.y = proj.radius;
                proj.vy = -proj.vy;
            } else if (proj.y + proj.radius > this.game.height) {
                proj.y = this.game.height - proj.radius;
                proj.vy = -proj.vy;
            }
            
            // 命中检测
            if (this.enemy && !this.enemy.isDead && this.enemy.invincibleTime <= 0) {
                if (this.game.physics.checkCircleCollision(proj, this.enemy)) {
                    this.onProjectileHit(this.enemy, proj);
                    this.projectiles.splice(i, 1);
                }
            }
        }
        
        // ====== 机制二：三维立体混元劲 ======
        for (let i = 0; i < this.hunyuanThresholds.length; i++) {
            const threshold = this.hunyuanThresholds[i];
            if (this.hp <= threshold) {
                this.triggerHunyuanWave();
                this.hunyuanThresholds.splice(i, 1); // 移除已触发的阈值
                break; // 每次只触发一个，防止瞬间大量掉血时重叠
            }
        }
        
        // 更新能量波动画
        for (let i = this.hunyuanWaves.length - 1; i >= 0; i--) {
            const wave = this.hunyuanWaves[i];
            wave.time -= dt;
            wave.radius += 500 * dt; // 扩散速度
            if (wave.time <= 0) {
                this.hunyuanWaves.splice(i, 1);
            }
        }
        
        // ====== 觉醒：闪电五连鞭 ======
        if (this.isAwakened && !this.isSuppressed) {
            if (this.enemy && this.enemy.isDead) {
                this.isAwakened = false; // 敌方死亡立即停止鞭击
                this.isWhipping = false;
                
                // 中断连招音效并清空队列
                if (this.currentWhipAudio) {
                    this.currentWhipAudio.pause();
                    this.currentWhipAudio = null;
                }
            } else {
                this.whipTimer -= dt;
                
                // 鞭击持续动画 0.3s
                if (this.whipTimer < this.whipInterval - 0.3) {
                    this.isWhipping = false;
                    // 如果5鞭已经打完，并且动画播放完毕，则结束觉醒状态
                    if (this.whipCurrentCount >= this.whipMaxCount) {
                        this.isAwakened = false;
                    }
                } else if (this.isWhipping) {
                    // 在鞭子挥出的中间时刻（假设在 0.15s 左右）结算伤害，而不是刚启动时
                    if (!this.hasDealtWhipDamage && this.whipTimer <= this.whipInterval - 0.15) {
                        this.hasDealtWhipDamage = true;
                        if (this.enemy && !this.enemy.isDead) {
                            // 100% 必中
                            this.enemy.takeDamage(5, this.x, this.y);
                            
                            // 施加麻痹效果：降低 80% 移速，持续 2 秒
                            this.enemy.addBuff('malaoshi_paralyze', 'paralyze', 0.8, 2.0);
                            
                            if (this.whipHitAudio) {
                                const snd = new Audio(this.whipHitAudio.src);
                                snd.play().catch(e => {});
                            }
                        }
                    }
                }
                
                if (this.whipTimer <= 0 && this.isAwakened) {
                    this.triggerLightningWhip();
                    this.whipCurrentCount++;
                    this.whipTimer = this.whipInterval;
                }
            }
        }
    }
    
    /**
     * 发射松果和糖豆 (新机制：锁定敌方后发射，带有线性速度衰减，体现“有劲”)
     */
    shootNutAndBean() {
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Nut Bean' });
        }
        const audioSrc = this.hasPlayedFirstNutBean ? this.nutBeanNormalAudioSrc : this.nutBeanFirstAudioSrc;
        this.hasPlayedFirstNutBean = true;
        
        if (audioSrc) {
            const snd = new Audio(audioSrc);
            snd.play().catch(e => {});
        }
        
        // 确保有敌方目标，否则回退到从自己身上随机发射
        if (this.enemy && !this.enemy.isDead) {
            // 计算从马老师指向敌方的向量
            const dx = this.enemy.x - this.x;
            const dy = this.enemy.y - this.y;
            let dist = Math.hypot(dx, dy);
            if (dist === 0) dist = 1; // 防除零
            
            const dirX = dx / dist;
            const dirY = dy / dist;
            
            // 设定初始高速度（体现“有劲”）
            const initialSpeed = 800; 
            
            // 为了增加视觉丰富度，稍微给方向加一点随机偏移（散布角）
            const angleOffset1 = (Math.random() - 0.5) * 0.5; // -0.25 到 0.25 弧度
            const angleOffset2 = (Math.random() - 0.5) * 0.5;
            
            const baseAngle = Math.atan2(dirY, dirX);
            const angle1 = baseAngle + angleOffset1;
            const angle2 = baseAngle + angleOffset2;

            this.projectiles.push({
                type: 'nut',
                x: this.x, y: this.y,
                vx: Math.cos(angle1) * initialSpeed, vy: Math.sin(angle1) * initialSpeed,
                radius: 16, life: 12.0, angle: 0, rotSpeed: 15, // 增大体积：radius 从 8 改为 16，持续时间延长至 12.0
                initialSpeed: initialSpeed, currentSpeed: initialSpeed,
                decayRate: 400 // 每秒衰减的速度值，2秒后速度降为0
            });
            
            this.projectiles.push({
                type: 'bean',
                x: this.x, y: this.y,
                vx: Math.cos(angle2) * initialSpeed, vy: Math.sin(angle2) * initialSpeed,
                radius: 12, life: 12.0, angle: 0, rotSpeed: 10, // 增大体积：radius 从 6 改为 12，持续时间延长至 12.0
                initialSpeed: initialSpeed, currentSpeed: initialSpeed,
                decayRate: 400
            });
        } else {
            // 没有目标时的后备逻辑
            const speed = 300; 
            const angle1 = Math.random() * Math.PI * 2;
            this.projectiles.push({
                type: 'nut',
                x: this.x, y: this.y,
                vx: Math.cos(angle1) * speed, vy: Math.sin(angle1) * speed,
                radius: 16, life: 12.0, angle: 0, rotSpeed: 15, // 持续时间延长至 12.0
                initialSpeed: speed, currentSpeed: speed, decayRate: 150
            });
            
            const angle2 = Math.random() * Math.PI * 2;
            this.projectiles.push({
                type: 'bean',
                x: this.x, y: this.y,
                vx: Math.cos(angle2) * speed, vy: Math.sin(angle2) * speed,
                radius: 12, life: 12.0, angle: 0, rotSpeed: 10, // 持续时间延长至 12.0
                initialSpeed: speed, currentSpeed: speed, decayRate: 150
            });
        }
    }
    
    onProjectileHit(target, proj) {
        if (this.hitAudio) {
            const snd = new Audio(this.hitAudio.src);
            snd.play().catch(e => {});
        }
        target.takeDamage(3, this.x, this.y); // 各自造成3点伤害
        this.spawnHitParticles(target.x, target.y, proj.type === 'nut' ? '#8b4513' : '#ff69b4');
    }
    
    /**
     * 触发三维立体混元劲
     */
    triggerHunyuanWave() {
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Hunyuan Wave' });
        }
        
        if (this.hunyuanAudioSrcs && this.hunyuanAudioSrcs.length > 0) {
            let index;
            do {
                index = Math.floor(Math.random() * this.hunyuanAudioSrcs.length);
            } while (index === this.lastHunyuanAudioIndex && this.hunyuanAudioSrcs.length > 1);
            
            this.lastHunyuanAudioIndex = index;
            const snd = new Audio(this.hunyuanAudioSrcs[index]);
            snd.play().catch(e => {});
        }
        
        // 视觉表现：全图能量波
        this.hunyuanWaves.push({
            x: this.x, y: this.y,
            radius: this.radius,
            time: 0.5, // 0.5秒扩散演出
            maxTime: 0.5
        });
        
        // 逻辑表现：对敌方造成 2 点伤害 + 击退
        if (this.enemy && !this.enemy.isDead && this.enemy.invincibleTime <= 0) {
            // 如果敌方是“成都之心”且正在使用给佬攻击，打断他
            if (this.enemy.name === '成都之心' && this.enemy.isGayAttacking) {
                this.enemy.interruptGayAttack();
            }
            
            this.enemy.takeDamage(2, this.x, this.y);
            
            // 高优先级打断：强制清除敌方可能存在的吸血鬼吸附状态 (vampire_drain) 或其他控制状态
            // 以及如果敌方是吸血鬼本身，也应该被推开，所以我们清理它身上的增益和控制
            this.enemy.buffs = this.enemy.buffs.filter(b => b.type !== 'vampire_drain');
            // 如果自己身上被吸血鬼吸附了，也被震开
            this.buffs = this.buffs.filter(b => b.type !== 'vampire_drain');
            
            // 计算击退方向 (从马老师指向敌方)
            const dx = this.enemy.x - this.x;
            const dy = this.enemy.y - this.y;
            
            // 触发强力击退，速度为 500，持续 0.15 秒（总击退距离 75 像素）
            this.enemy.knockback(dx, dy, 500, 0.15);
        }
    }
    
    /**
     * 觉醒逻辑：重置五连鞭状态
     */
    onAwaken() {
        this.whipCurrentCount = 0;
        this.whipTimer = 0; // 立即触发第一鞭
        this.isWhipping = false;
        
        if (this.currentWhipAudio) {
            this.currentWhipAudio.pause();
            this.currentWhipAudio = null;
        }

        // 清理一下原有的投射物
        this.projectiles = [];
    }
    
    triggerLightningWhip() {
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: `Lightning Whip ${this.whipCurrentCount + 1}` });
        }
        
        this.isWhipping = true;
        this.whipAngle = Math.random() * Math.PI * 2; // 鞭子的视觉旋转起始角度
        this.hasDealtWhipDamage = false; // 标记本鞭尚未造成伤害
        
        // 停止上一鞭的声音（防重叠），并播放当前鞭
        if (this.currentWhipAudio) {
            this.currentWhipAudio.pause();
            this.currentWhipAudio.currentTime = 0;
            this.currentWhipAudio = null;
        }
        
        if (this.whipAudioSrcs && this.whipCurrentCount >= 0 && this.whipCurrentCount < this.whipAudioSrcs.length) {
            this.currentWhipAudio = new Audio(this.whipAudioSrcs[this.whipCurrentCount]);
            this.currentWhipAudio.play().catch(e => {});
        }
    }

    onCollide(other) {
        if (other.isDead || other.invincibleTime > 0) return;
        
        const now = performance.now();
        if (!this.lastMeleeHitTime || now - this.lastMeleeHitTime > 200) {
            other.takeDamage(2, this.x, this.y); // 基础碰撞 2 点伤害
            this.spawnHitParticles(other.x, other.y, '#fff');
            this.lastMeleeHitTime = now;
        }
    }
    
    spawnHitParticles(x, y, color) {
        for (let i = 0; i < 5; i++) {
            this.game.addParticle({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 100, vy: (Math.random() - 0.5) * 100,
                color: color, life: 0.5, size: 3
            });
        }
    }

    playAwakenAudio() {
        if (this.awakenAudioSrc) {
            const snd = new Audio(this.awakenAudioSrc);
            snd.play().catch(e => {});
        }
    }

    playVictoryAudio() {
        if (this.victoryAudioSrc) {
            const snd = new Audio(this.victoryAudioSrc);
            snd.play().catch(e => {});
        }
    }

    stopAllAudio() {
        if (this.currentWhipAudio) {
            this.currentWhipAudio.pause();
            this.currentWhipAudio.currentTime = 0;
            this.currentWhipAudio = null;
        }
    }

    draw(ctx) {
        // 先画能量波（在底层）
        for (const wave of this.hunyuanWaves) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
            
            // 淡蓝色透明度衰减
            const alpha = Math.max(0, wave.time / wave.maxTime) * 0.5;
            ctx.fillStyle = `rgba(135, 206, 250, ${alpha})`;
            ctx.fill();
            
            // 边缘光晕
            ctx.lineWidth = 4;
            ctx.strokeStyle = `rgba(173, 216, 230, ${alpha * 1.5})`;
            ctx.stroke();
            ctx.restore();
        }
        
        super.draw(ctx);
        
        ctx.save();
        
        // 绘制投射物 (松果和糖豆)
        for (const proj of this.projectiles) {
            ctx.save();
            ctx.translate(proj.x, proj.y);
            ctx.rotate(proj.angle);
            
            if (proj.type === 'nut') {
                // 平面风格松果：两色分层椭圆 + 扁平化鳞片
                // 底色主体 (较深的棕色)
                ctx.fillStyle = '#7a3e14';
                ctx.beginPath();
                ctx.ellipse(0, 0, proj.radius, proj.radius * 1.3, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // 亮部主体 (较浅的棕色，形成扁平化阴影效果)
                ctx.fillStyle = '#a0522d';
                ctx.beginPath();
                ctx.ellipse(-proj.radius * 0.15, -proj.radius * 0.15, proj.radius * 0.85, proj.radius * 1.1, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // 顶部的小把儿 (茎)
                ctx.fillStyle = '#4a250c';
                ctx.fillRect(-proj.radius * 0.15, -proj.radius * 1.4, proj.radius * 0.3, proj.radius * 0.4);

                // 扁平化的鳞片 (使用实心半圆)
                ctx.fillStyle = '#5c3317';
                const scales = [
                    {x: 0, y: -proj.radius * 0.4, r: proj.radius * 0.4},
                    {x: -proj.radius * 0.4, y: 0, r: proj.radius * 0.35},
                    {x: proj.radius * 0.4, y: 0, r: proj.radius * 0.35},
                    {x: -proj.radius * 0.2, y: proj.radius * 0.5, r: proj.radius * 0.3},
                    {x: proj.radius * 0.2, y: proj.radius * 0.5, r: proj.radius * 0.3}
                ];
                for (const scale of scales) {
                    ctx.beginPath();
                    ctx.arc(scale.x, scale.y, scale.r, 0, Math.PI); // 向下的半圆
                    ctx.fill();
                }
            } else {
                // 平面风格糖果：圆形带两边包装纸包装纸的经典糖果造型
                const candyRadius = proj.radius * 0.8; // 糖果主体半径
                const wrapperWidth = proj.radius * 0.9; // 包装纸宽度
                const wrapperHeight = proj.radius * 0.7; // 包装纸高度
                const offsetX = -proj.radius * 0.15; // 亮部偏移
                const offsetY = -proj.radius * 0.15; // 亮部偏移
                
                // 1. 绘制左侧包装纸（三角形）
                ctx.fillStyle = '#d81b60'; // 暗粉色
                ctx.beginPath();
                ctx.moveTo(-candyRadius + 2, 0);
                ctx.lineTo(-candyRadius - wrapperWidth, -wrapperHeight);
                ctx.lineTo(-candyRadius - wrapperWidth, wrapperHeight);
                ctx.closePath();
                ctx.fill();
                
                ctx.fillStyle = '#ff69b4'; // 亮粉色
                ctx.beginPath();
                ctx.moveTo(-candyRadius + 2 + offsetX, offsetY);
                ctx.lineTo(-candyRadius - wrapperWidth + offsetX, -wrapperHeight + offsetY);
                ctx.lineTo(-candyRadius - wrapperWidth + offsetX, wrapperHeight + offsetY);
                ctx.closePath();
                ctx.fill();

                // 2. 绘制右侧包装纸（三角形）
                ctx.fillStyle = '#d81b60'; // 暗粉色
                ctx.beginPath();
                ctx.moveTo(candyRadius - 2, 0);
                ctx.lineTo(candyRadius + wrapperWidth, -wrapperHeight);
                ctx.lineTo(candyRadius + wrapperWidth, wrapperHeight);
                ctx.closePath();
                ctx.fill();
                
                ctx.fillStyle = '#ff69b4'; // 亮粉色
                ctx.beginPath();
                ctx.moveTo(candyRadius - 2 + offsetX, offsetY);
                ctx.lineTo(candyRadius + wrapperWidth + offsetX, -wrapperHeight + offsetY);
                ctx.lineTo(candyRadius + wrapperWidth + offsetX, wrapperHeight + offsetY);
                ctx.closePath();
                ctx.fill();

                // 3. 绘制中间糖果球主体
                // 底色暗粉色
                ctx.fillStyle = '#d81b60';
                ctx.beginPath();
                ctx.arc(0, 0, candyRadius, 0, Math.PI * 2);
                ctx.fill();
                
                // 亮色亮粉色
                ctx.fillStyle = '#ff69b4';
                ctx.beginPath();
                ctx.arc(offsetX, offsetY, candyRadius * 0.95, 0, Math.PI * 2);
                ctx.fill();
                
                // 4. 绘制糖果上的白色螺旋纹理 (棒棒糖/薄荷糖经典纹理)
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = candyRadius * 0.4;
                ctx.lineCap = 'round';
                ctx.beginPath();
                // 简单的S型曲线作为花纹
                ctx.moveTo(offsetX - candyRadius * 0.5, offsetY - candyRadius * 0.5);
                ctx.bezierCurveTo(
                    offsetX + candyRadius * 0.5, offsetY - candyRadius * 0.5,
                    offsetX - candyRadius * 0.5, offsetY + candyRadius * 0.5,
                    offsetX + candyRadius * 0.5, offsetY + candyRadius * 0.5
                );
                ctx.stroke();
                
                // 5. 锐利的扁平高光
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.ellipse(offsetX - candyRadius * 0.3, offsetY - candyRadius * 0.4, candyRadius * 0.3, candyRadius * 0.15, -Math.PI / 6, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        
        // 绘制闪电五连鞭
        if (this.isAwakened && this.isWhipping && this.enemy && !this.enemy.isDead) {
            ctx.save();
            ctx.strokeStyle = '#00ffff'; // 亮青色电光
            ctx.lineWidth = 3;
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 10;
            
            // 鞭子起始点为马老师中心，终点为敌方中心
            const startX = this.x;
            const startY = this.y;
            const endX = this.enemy.x;
            const endY = this.enemy.y;
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            
            // 增加几个中间节点生成折线闪电段，并带入一个旋转偏移形成挥舞观感
            const segments = 5;
            // 通过剩余时间产生快速抖动的相位
            const phase = (this.whipTimer * 20) % (Math.PI * 2); 
            
            for (let i = 1; i < segments; i++) {
                const t = i / segments;
                let midX = startX + (endX - startX) * t;
                let midY = startY + (endY - startY) * t;
                
                // 旋转偏移 (随着 t 增加，偏移变大)
                const offset = Math.sin(phase + t * Math.PI) * 40 * t;
                const angle = Math.atan2(endY - startY, endX - startX) + Math.PI / 2;
                
                midX += Math.cos(angle) * offset;
                midY += Math.sin(angle) * offset;
                
                // 随机电击抖动
                midX += (Math.random() - 0.5) * 10;
                midY += (Math.random() - 0.5) * 10;
                
                ctx.lineTo(midX, midY);
            }
            ctx.lineTo(endX, endY);
            ctx.stroke();
            ctx.restore();
        }
        
        ctx.restore();
    }
}
