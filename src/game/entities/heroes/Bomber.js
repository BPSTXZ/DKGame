import { Hero } from '../Hero.js';

export class Bomber extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '炸弹人';
        this.color = '#333333'; // 深灰色
        this.hp = 100;
        this.maxHp = 100;
        this.baseSpeed = 60;
        this.radius = 40;
        
        // 炸弹相关状态
        this.bombs = []; // 存储场上所有的炸弹
        this.bombThrowTimer = 0;
        this.bombThrowInterval = 1.5; // 每1.5秒投掷一枚炸弹
        
        // 视觉特效控制
        this.visualRotation = 0;
        
        // 音效配置
        this.throwAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/MaLaoshi/发射.mp3');
        this.warningAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/Bomber/即将爆炸.mp3');
        this.warningAudio.loop = true;
        this.explodeAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/Bomber/爆炸.mp3');
        this.upgradeAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/Bomber/升级.mp3');
        this.awakenAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/Bomber/艺术爆炸.mp3');
    }

    playAwakenAudio() {
        if (this.awakenAudio) {
            this.awakenAudio.currentTime = 0;
            this.awakenAudio.play().catch(e => console.warn('Bomber awaken audio play failed:', e));
        }
    }

    stopAwakenAudio() {
        if (this.awakenAudio) {
            this.awakenAudio.pause();
            this.awakenAudio.currentTime = 0;
        }
    }
    
    stopAllAudio() {
        if (this.throwAudio) { this.throwAudio.pause(); this.throwAudio.currentTime = 0; }
        if (this.warningAudio) { this.warningAudio.pause(); this.warningAudio.currentTime = 0; }
        if (this.explodeAudio) { this.explodeAudio.pause(); this.explodeAudio.currentTime = 0; }
        if (this.upgradeAudio) { this.upgradeAudio.pause(); this.upgradeAudio.currentTime = 0; }
        if (this.awakenAudio) { this.awakenAudio.pause(); this.awakenAudio.currentTime = 0; }
    }
    
    throwBomb(isAwaken = false, preUpgradeLevels = 0, angleOffset = 0) {
        const angle = Math.random() * Math.PI * 2 + angleOffset;
        
        // 基础参数
        let baseDamage = 5;
        let baseRadius = 15;
        let baseWarningRadius = this.game ? this.game.width / 3 / 2 : 100; // 直径三分之一，所以半径是三分之一的一半
        let countdown = isAwaken ? 2.0 : 0; // 如果是觉醒直接设置，飞行状态初始没有倒计时
        
        const bomb = {
            id: Date.now() + Math.random(),
            state: isAwaken ? 'armed' : 'flying', // 'flying' | 'attached' | 'armed'
            x: this.x + Math.cos(angle) * this.radius,
            y: this.y + Math.sin(angle) * this.radius,
            vx: isAwaken ? 0 : Math.cos(angle) * 400, // 初始飞行速度
            vy: isAwaken ? 0 : Math.sin(angle) * 400,
            
            // 属性
            damage: baseDamage,
            radius: baseRadius,
            warningRadius: baseWarningRadius,
            countdown: countdown,
            
            // 升级相关
            upgradeLevel: preUpgradeLevels,
            maxUpgradeLevel: 4,
            cooldownTimer: 0, // 防止重复踩圈升级的CD
            
            // 粘附相关
            target: null,
            offsetX: 0,
            offsetY: 0,
            
            // 视觉特效
            pulseTimer: 0,
            pulseState: 0,

            // 加速机制相关
            accelerated: false, // 是否处于加速状态
            accelerationCooldown: 0 // 加速冷却计时器
        };
        
        // 如果有预升级，应用升级效果
        if (preUpgradeLevels > 0) {
            for (let i = 0; i < preUpgradeLevels; i++) {
                bomb.damage *= 1.6;
                bomb.radius *= 1.2;
                bomb.warningRadius *= 1.2;
            }
        }
        
        // 刚生成时也给一点投掷初速度特效
        if (isAwaken && this.game) {
            // 觉醒直接变为 armed，给一个较快的分散位移
            bomb.state = 'flying'; 
            bomb.isAwakenSetup = true; // 特殊标记，触壁或一段时间后立刻转为 armed
            bomb.vx = Math.cos(angle) * 600;
            bomb.vy = Math.sin(angle) * 600;
        }
        
        this.bombs.push(bomb);
        
        if (this.throwAudio) {
            this.throwAudio.currentTime = 0;
            this.throwAudio.play().catch(e => console.warn('Bomber throw audio play failed:', e));
        }
    }
    
    // 应用预升级效果（用于炸弹人踩圈升级）
    upgradeBomb(bomb) {
        if (bomb.upgradeLevel >= bomb.maxUpgradeLevel) return;
        
        bomb.upgradeLevel++;
        bomb.radius *= 1.2;
        bomb.damage *= 1.6;
        bomb.warningRadius *= 1.2;
        
        // 特殊规则：HP<40时不重置倒计时
        if (this.hp >= 40) {
            bomb.countdown = 6.0;
        }
        
        bomb.cooldownTimer = 2.0; // 冷却2秒
        
        // 升级特效
        if (this.game) {
            // 飘字
            this.game.addFloatingText(bomb.x, bomb.y - 20, "升级!", "#ffcc00");
            
            // 能量波
            this.game.addParticle({
                x: bomb.x, y: bomb.y,
                vx: 0, vy: 0,
                color: 'rgba(255, 165, 0, 0.5)',
                size: bomb.warningRadius * 1.2,
                life: 0.3
            });
            
            // 炸弹本体发光膨胀 (通过 pulseState 控制)
            bomb.pulseState = 1.0;
            
            if (this.upgradeAudio) {
                this.upgradeAudio.currentTime = 0;
                this.upgradeAudio.play().catch(e => console.warn('Bomber upgrade audio play failed:', e));
            }
        }
    }
    
    // 处理炸弹爆炸
    explodeBomb(bomb) {
        if (!this.game) return;
        
        // 播放爆炸音效
        if (this.explodeAudio) {
            const volume = bomb.state === 'attached' 
                ? 0.4 
                : Math.min(1.0, 0.6 + bomb.upgradeLevel * 0.15);
            this.explodeAudio.volume = volume;
            this.explodeAudio.currentTime = 0;
            this.explodeAudio.play().catch(e => console.warn('Bomber explode audio play failed:', e));
        }
        
        let targetX = bomb.x;
        let targetY = bomb.y;
        
        if (bomb.state === 'attached' && bomb.target && !bomb.target.isDead) {
            targetX = bomb.target.x + bomb.offsetX;
            targetY = bomb.target.y + bomb.offsetY;
            bomb.target.takeDamage(bomb.damage * this.damageMultiplier, targetX, targetY);
        } else if (bomb.state === 'armed') {
            if (this.enemy && !this.enemy.isDead) {
                const dist = Math.hypot(this.enemy.x - targetX, this.enemy.y - targetY);
                if (dist <= bomb.warningRadius) {
                    this.enemy.takeDamage(bomb.damage * this.damageMultiplier, targetX, targetY);
                }
            }
        }

        if (this.enemy && this.enemy.isDead && this.game) {
            this.game.victoryDelayTimer = 1.5;
        }
        
        // 爆炸特效分档
        const dmg = bomb.damage * this.damageMultiplier;
        let pCount = 20;
        let pSize = 3;
        let pSpeed = 150;
        let blastColor = '#ff4500';
        
        if (dmg <= 5) {
            // 小爆炸：一圈火焰环
            pCount = 20; pSize = 3; pSpeed = 150;
        } else if (dmg <= 10) {
            // 中爆炸：更密集的火焰冲击
            pCount = 40; pSize = 4; pSpeed = 250;
        } else {
            // 大爆炸：更强闪光 冲击波环
            pCount = 60; pSize = 5; pSpeed = 350;
            blastColor = '#ffffff';
            
            // 冲击波环
            this.game.addParticle({
                x: targetX, y: targetY,
                vx: 0, vy: 0,
                color: 'rgba(255, 255, 255, 0.5)',
                size: bomb.warningRadius,
                life: 0.4
            });
            
            this.game.shakeScreen(0.2, 5);
        }
        
        for (let i = 0; i < pCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * pSpeed + 50;
            this.game.addParticle({
                x: targetX, y: targetY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: Math.random() > 0.3 ? blastColor : '#ff0000',
                size: Math.random() * pSize + 2,
                life: 0.4 + Math.random() * 0.3
            });
        }
    }
    
    updateSpecific(dt) {
        if (this.isDead) return;
        
        // 面向敌人
        if (this.enemy && !this.enemy.isDead) {
            this.visualRotation = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
        }
        
        // 投弹逻辑
        if (!this.game || this.game.globalFreezeTime <= 0) {
            this.bombThrowTimer -= dt;
            if (this.bombThrowTimer <= 0) {
                this.throwBomb();
                this.bombThrowTimer = this.bombThrowInterval;
            }
        }
        
        // 检查炸弹升级 (自己进入地雷警示圈)
        let insideAnyWarning = false;
        
        // 更新所有炸弹
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const bomb = this.bombs[i];
            let shouldRemove = false;
            
            if (bomb.cooldownTimer > 0) bomb.cooldownTimer -= dt;
            if (bomb.pulseState > 0) bomb.pulseState -= dt * 2;
            
            if (bomb.state === 'flying') {
                // 飞行状态物理更新
                bomb.x += bomb.vx * dt;
                bomb.y += bomb.vy * dt;
                
                // 速度衰减 (空气阻力)
                bomb.vx *= 0.98;
                bomb.vy *= 0.98;
                
                const speed = Math.hypot(bomb.vx, bomb.vy);
                
                // 觉醒预设的快速炸弹，飞行一小段后立即转为 armed
                if (bomb.isAwakenSetup && speed < 200) {
                    bomb.state = 'armed';
                    bomb.vx = 0; bomb.vy = 0;
                }
                
                // 碰撞判定：优先判断命中敌方
                if (this.enemy && !this.enemy.isDead && this.game) {
                    const hitEnemy = this.game.physics.checkCircleCollision(
                        { x: bomb.x, y: bomb.y, radius: bomb.radius }, 
                        this.enemy
                    );
                    
                    if (hitEnemy && !bomb.isAwakenSetup) {
                        // 命中敌方，转为粘附
                        bomb.state = 'attached';
                        bomb.target = this.enemy;
                        bomb.countdown = 2.0; // 粘附倒计时2秒
                        
                        // 计算粘附偏移量
                        const angle = Math.atan2(bomb.y - this.enemy.y, bomb.x - this.enemy.x);
                        bomb.offsetX = Math.cos(angle) * this.enemy.radius;
                        bomb.offsetY = Math.sin(angle) * this.enemy.radius;
                    }
                }
                
                // 如果没有命中敌方，检测边界碰撞
                if (bomb.state === 'flying' && this.game) {
                    let bounced = false;
                    if (bomb.x < bomb.radius) { bomb.x = bomb.radius; bomb.vx *= -1; bounced = true; }
                    else if (bomb.x > this.game.width - bomb.radius) { bomb.x = this.game.width - bomb.radius; bomb.vx *= -1; bounced = true; }
                    
                    if (bomb.y < bomb.radius) { bomb.y = bomb.radius; bomb.vy *= -1; bounced = true; }
                    else if (bomb.y > this.game.height - bomb.radius) { bomb.y = this.game.height - bomb.radius; bomb.vy *= -1; bounced = true; }
                    
                    // 第一次碰撞边框后，反弹并立刻转为地雷
                    if (bounced && !bomb.isAwakenSetup) {
                        bomb.state = 'armed';
                        bomb.countdown = 6.0;
                        bomb.vx = 0; bomb.vy = 0;
                    }
                }
                
                // 如果速度衰减到极低，也自动落地变为地雷
                if (bomb.state === 'flying' && speed < 10 && !bomb.isAwakenSetup) {
                    bomb.state = 'armed';
                    bomb.countdown = 6.0;
                }
                
            } else if (bomb.state === 'attached') {
                // 粘附状态
                if (bomb.target && !bomb.target.isDead) {
                    bomb.x = bomb.target.x + bomb.offsetX;
                    bomb.y = bomb.target.y + bomb.offsetY;
                } else {
                    // 目标死亡，炸弹落地变为地雷
                    bomb.state = 'armed';
                    bomb.target = null;
                }
                
                bomb.countdown -= dt;
                if (bomb.countdown <= 0) {
                    this.explodeBomb(bomb);
                    shouldRemove = true;
                }
                
            } else if (bomb.state === 'armed') {
                // 地雷状态
                
                // 更新加速冷却计时器
                if (bomb.accelerationCooldown > 0) {
                    bomb.accelerationCooldown -= dt;
                }
                
                // 检查敌方是否在范围内
                let enemyInRange = false;
                if (this.enemy && !this.enemy.isDead) {
                    const distToEnemy = Math.hypot(this.enemy.x - bomb.x, this.enemy.y - bomb.y);
                    enemyInRange = distToEnemy <= bomb.warningRadius;
                    
                    if (enemyInRange) {
                        // 在圈内，施加减速 buff (基础40%，满级60%减速，不可叠加可刷新)
                        // 使用固定ID确保不可叠加，只刷新时间
                        const slowRatio = bomb.upgradeLevel >= 4 ? 0.8 : 0.5;
                        this.enemy.addBuff('bomber_slow', 'slow', slowRatio, 0.2);
                        
                        // 如果冷却结束且未处于加速状态，触发加速
                        if (bomb.accelerationCooldown <= 0 && !bomb.accelerated) {
                            bomb.accelerated = true;
                        }

                        // 新增：踩踏即刻爆炸判定 (20% 概率)
                        if (!bomb.hasCheckedStepOn && this.game.physics.checkCircleCollision({ x: bomb.x, y: bomb.y, radius: bomb.radius }, this.enemy)) {
                            bomb.hasCheckedStepOn = true;
                            if (Math.random() < 0.2) {
                                this.explodeBomb(bomb);
                                shouldRemove = true;
                            }
                        } else if (!this.game.physics.checkCircleCollision({ x: bomb.x, y: bomb.y, radius: bomb.radius }, this.enemy)) {
                            // 离开本体范围后重置判定标记，允许下次踩入再次判定
                            bomb.hasCheckedStepOn = false;
                        }
                    }
                }
                
                // 如果敌方离开范围且处于加速状态，取消加速并开始冷却
                if (!enemyInRange && bomb.accelerated) {
                    bomb.accelerated = false;
                    bomb.accelerationCooldown = 1.0; // 冷却1秒
                }
                
                // 根据加速状态调整倒计时速度
                const countdownSpeed = bomb.accelerated ? 1.5 : 1.0;
                bomb.countdown -= dt * countdownSpeed;
                
                // 检查自己是否在圈内用于升级
                const distToSelf = Math.hypot(this.x - bomb.x, this.y - bomb.y);
                const isInside = distToSelf <= bomb.warningRadius;
                
                if (isInside) {
                    if (bomb.cooldownTimer <= 0) {
                        this.upgradeBomb(bomb);
                    }
                }
                
                if (bomb.countdown <= 0) {
                    this.explodeBomb(bomb);
                    shouldRemove = true;
                }
            }
            
            if (shouldRemove) {
                this.bombs.splice(i, 1);
            }
        }
        
        // 警告音效：有武装炸弹进入2秒倒计时时循环播放
        const hasWarningBomb = this.bombs.some(b => b.state === 'armed' && b.countdown <= 2.0);
        if (hasWarningBomb && this.warningAudio && this.warningAudio.paused) {
            this.warningAudio.play().catch(e => console.warn('Bomber warning audio play failed:', e));
        } else if (!hasWarningBomb && this.warningAudio && !this.warningAudio.paused) {
            this.warningAudio.pause();
            this.warningAudio.currentTime = 0;
        }
    }
    
    onAwaken() {
        // 觉醒：艺术就是爆炸
        // 同时掷出3枚已强化2次的快速地雷炸弹
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: '艺术就是爆炸' });
        }
        
        const baseAngle = this.enemy ? Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x) : 0;
        
        // 120度分布
        this.throwBomb(true, 2, baseAngle);
        this.throwBomb(true, 2, baseAngle + Math.PI * 2 / 3);
        this.throwBomb(true, 2, baseAngle - Math.PI * 2 / 3);
        
        // 觉醒只是一瞬间的投掷，不需要维持状态
        this.isAwakened = false;
    }
    
    drawBody(ctx) {
        // 炸弹人外观：深灰球体 橙红警示条纹
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制橙红警示条纹
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.clip(); // 限制在球体内
        
        ctx.fillStyle = '#ff4500';
        ctx.rotate(Math.PI / 4); // 倾斜条纹
        for (let i = -this.radius; i <= this.radius; i += 20) {
            ctx.fillRect(i, -this.radius, 10, this.radius * 2);
        }
        ctx.restore();
        
        // 描边
        ctx.lineWidth = 3;
        ctx.strokeStyle = this.playerId === 1 ? '#ff4444' : '#4444ff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    drawOverlay(ctx) {
        super.drawOverlay(ctx);
        
        // 绘制所有炸弹
        for (const bomb of this.bombs) {
            ctx.save();
            ctx.translate(bomb.x, bomb.y);
            
            // 如果是地雷，绘制警示圈
            if (bomb.state === 'armed') {
                ctx.beginPath();
                ctx.arc(0, 0, bomb.warningRadius, 0, Math.PI * 2);
                
                // 半透明橙黄色填充
                ctx.fillStyle = 'rgba(255, 165, 0, 0.15)';
                ctx.fill();
                
                // 脉冲波纹
                bomb.pulseTimer = (bomb.pulseTimer || 0) + 0.016;
                const pulseAlpha = (Math.sin(bomb.pulseTimer * 5) + 1) / 2;
                
                // 边缘描边
                ctx.lineWidth = bomb.upgradeLevel > 0 ? 3 : 1.5;
                ctx.strokeStyle = `rgba(255, 69, 0, ${0.5 + pulseAlpha * 0.5})`;
                ctx.stroke();
            }
            
            // 炸弹闪烁逻辑
            let shouldFlash = false;
            if ((bomb.state === 'attached' || bomb.state === 'armed') && bomb.countdown <= 2.0) {
                const time = Date.now();
                if (bomb.countdown > 1.0) {
                    // 每0.25秒闪一次 (频率 = 1000 / 0.25 = 4000?) -> 直接用余数算
                    shouldFlash = (time % 250) < 125;
                } else {
                    // 每0.12秒闪一次
                    shouldFlash = (time % 120) < 60;
                }
            }
            
            // 炸弹本体
            const currentRadius = bomb.radius * (1 + (Math.max(0, bomb.pulseState || 0) * 0.2)); // 升级时的膨胀
            
            ctx.beginPath();
            ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
            ctx.fillStyle = shouldFlash ? '#ffffff' : '#333333';
            ctx.fill();
            
            ctx.lineWidth = 2;
            ctx.strokeStyle = shouldFlash ? '#ff0000' : '#ff4500';
            ctx.stroke();
            
            // 绘制文字信息 (伤害与倒计时)
            if (bomb.state === 'attached' || bomb.state === 'armed') {
                // 伤害在中心
                if (!shouldFlash) {
                    ctx.fillStyle = bomb.upgradeLevel > 0 ? '#ffcc00' : '#ff4500';
                    ctx.font = `bold ${currentRadius * 0.8}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(Math.floor(bomb.damage), 0, 0);
                }
                
                // 倒计时在头顶
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                
                let cdColor = '#ffffff';
                if (bomb.countdown <= 2) cdColor = '#ffaa00';
                if (bomb.countdown <= 1) cdColor = '#ff0000';
                
                ctx.fillStyle = cdColor;
                ctx.fillText(bomb.countdown.toFixed(1), 0, -currentRadius - 5);
            }
            
            ctx.restore();
        }
    }
}
