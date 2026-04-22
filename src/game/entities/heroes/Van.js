import { Hero } from '../Hero.js';

/**
 * 成都之心 (原 Van) 英雄类
 * 特性：急色 (脱战狂暴)，给佬攻击 (瞬移背刺，压制吸附，打桩伤害)，觉醒：力场压制
 */
export class Van extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '成都之心';
        this.color = '#d4b264'; // 外观颜色
        this.hp = 100;
        this.maxHp = 100;
        this.baseSpeed = 70; // 基础移速
        this.radius = 40; // 统一碰撞半径
        
        // 给佬攻击相关状态
        this.isGayAttacking = false;
        this.gayAttackTimer = 0; // 持续时间计时器
        this.gayAttackDuration = 3.0; // 持续 3 秒
        this.gayHitInterval = 0.25; // 每 0.25 秒结算一次
        this.gayHitTimer = 0;
        
        this.gayAttackCooldown = 0; // 3 秒冷却
        this.baseDamagePerHit = 2; // 每次打桩伤害
        this.windupDuration = 0.15; // 蓄力后撤时间
        this.dashDuration = 0.10;   // 前冲时间
        
        // 觉醒相关状态
        this.forceFieldRadius = 0; // 初始化时基于场地大小计算
        this.awakenTimer = 0;
        this.isForceFieldActive = false;
        this.hasTriggeredAwakenAttack = false; // 是否已经触发过觉醒版攻击
        this.forceFieldWarmup = 0; // 前摇展示时间
        
        // “急色”机制相关状态
        this.noContactTimer = 0; // 无接触计时器
        this.isDesperate = false; // 是否处于急色状态
        this.desperateTimer = 0; // 急色状态持续时间计时器
        this.desperateDuration = 3.0; // 持续 3 秒
        
        // 音效配置
        this.grabAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/van/抓到.mp3');
        this.hitAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/common/碰撞.mp3');
        this.awakenAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/van/觉醒.mp3');
    }
    
    playAwakenAudio() {
        if (this.awakenAudio) {
            this.awakenAudio.currentTime = 0;
            this.awakenAudio.play().catch(e => console.warn('Awaken audio play failed:', e));
        }
    }
    
    stopAllAudio() {
        if (this.grabAudio) {
            this.grabAudio.pause();
            this.grabAudio.currentTime = 0;
        }
        if (this.hitAudio) {
            this.hitAudio.pause();
            this.hitAudio.currentTime = 0;
        }
    }
    
    applyPassives() {
        super.applyPassives();
        
        // 急色状态移速提升 100%
        if (this.isDesperate) {
            this.speedMultiplier *= 2.0;
        }
    }
    
    updateSpecific(dt) {
        if (this.isDead) return;
        
        // “急色”机制处理
        if (this.isDesperate) {
            // 处于急色状态，持续 3 秒
            this.desperateTimer += dt;
            
            // 视觉特效：跑动时产生汗水/红色粒子
            if (Math.random() > 0.6) {
                this.game.addParticle({
                    x: this.x + (Math.random() - 0.5) * this.radius,
                    y: this.y - this.radius * 0.5 + (Math.random() - 0.5) * 10,
                    vx: (Math.random() - 0.5) * 20,
                    vy: -Math.random() * 50,
                    color: Math.random() > 0.5 ? '#ff4444' : '#aaddff', // 红色急躁或蓝色汗水
                    life: 0.5,
                    size: Math.random() * 3 + 2
                });
            }
            
            if (this.desperateTimer >= this.desperateDuration) {
                // 3秒结束，重新开始无接触计时
                this.isDesperate = false;
                this.noContactTimer = 0;
            }
        } else {
            // 不在急色状态，也不在给佬攻击中，累加无接触计时
            if (!this.isGayAttacking) {
                this.noContactTimer += dt;
                if (this.noContactTimer >= 3.0) { // 连续 3 秒未接触
                    this.triggerDesperate();
                }
            }
        }
        
        // 处理给佬攻击冷却
        if (!this.isGayAttacking && this.gayAttackCooldown > 0) {
            this.gayAttackCooldown -= dt;
        }
        
        // 初始化觉醒力场半径
        if (this.forceFieldRadius === 0 && this.game) {
            // 假设场地为方形，边长的一半
            this.forceFieldRadius = Math.min(this.game.width, this.game.height) * 0.5;
        }
        
        // 觉醒状态逻辑
        if (this.isAwakened) {
            if (!this.isForceFieldActive) {
                this.isForceFieldActive = true;
                this.awakenTimer = 4.5; // 最多持续 4 秒 + 0.5秒展示前摇
                this.hasTriggeredAwakenAttack = false;
                this.forceFieldWarmup = 0.5; // 0.5秒强制展示特效前摇
            }
            
            this.awakenTimer -= dt;
            
            if (this.forceFieldWarmup > 0) {
                // 前摇期间只展示特效，不触发攻击
                this.forceFieldWarmup -= dt;
            } else if (!this.hasTriggeredAwakenAttack && this.enemy && !this.enemy.isDead) {
                // 检测敌方是否进入力场
                const dx = this.enemy.x - this.x;
                const dy = this.enemy.y - this.y;
                const dist = Math.hypot(dx, dy);
                
                if (dist <= this.forceFieldRadius + this.enemy.radius) {
                    // 敌方进入力场，立即触发觉醒版给佬攻击
                    this.hasTriggeredAwakenAttack = true;
                    this.startGayAttack(true);
                }
            }
            
            // 觉醒自然结束判定
            if (!this.hasTriggeredAwakenAttack && this.awakenTimer <= 0) {
                this.isAwakened = false;
                this.isForceFieldActive = false;
            }
        }
        
        // 给佬攻击执行逻辑
        if (this.isGayAttacking) {
            if (!this.enemy || this.enemy.isDead) {
                this.endGayAttack();
                return;
            }
            
            this.gayAttackTimer += dt;
            this.gayHitTimer += dt;
            
            // 紧贴敌方小球背后
            const targetDist = this.radius + this.enemy.radius;
            // 背后判定基于敌方速度方向，如果敌方静止则默认一个方向
            let enemySpeed = Math.hypot(this.enemy.vx, this.enemy.vy);
            let backDirX, backDirY;
            
            if (enemySpeed > 0.1) {
                backDirX = -this.enemy.vx / enemySpeed;
                backDirY = -this.enemy.vy / enemySpeed;
            } else {
                backDirX = 0;
                backDirY = -1;
            }
            
            // 动画形变与偏移量
            let visualOffsetDist = 0;
            let currentScaleX = 1, currentScaleY = 1;
            let currentRot = 0;
            
            // 如果到达结算时间，先执行结算
            if (this.gayHitTimer >= this.gayHitInterval) {
                this.gayHitTimer -= this.gayHitInterval;
                
                const damage = (this.isAwakened && this.hasTriggeredAwakenAttack) ? 4 : 2;
                this.enemy.takeDamage(damage * this.damageMultiplier, this.x, this.y);
                
                // 播放碰撞音效
                if (this.hitAudio) {
                    this.hitAudio.currentTime = 0;
                    this.hitAudio.play().catch(e => console.warn('Hit audio play failed:', e));
                }
                
                // 触发敌方的受击后仰与滑行反应 (滑行0.3个身位，身宽80，约24px，分布在0.15s内)
                this.enemy.visualHitTimer = 0.15;
                this.enemy.hitDirX = -backDirX; // 打击方向
                this.enemy.hitDirY = -backDirY;
            }
            
            // 动画状态机：蓄力后撤(0.15s) -> 前冲(0.1s)
            if (this.gayHitTimer < this.windupDuration) {
                // 蓄力后撤 (移动 30%~50% 身宽，身宽80 -> 取 30px)
                let p = this.gayHitTimer / this.windupDuration;
                p = p * (2 - p); // ease out
                visualOffsetDist = 30 * p; // 远离敌人
                currentScaleX = 1.1; // 身体后仰/蓄力挤压
                currentScaleY = 0.9;
                currentRot = -15 * Math.PI / 180; // 后仰15度
            } else {
                // 前冲攻击 (越过后撤距离1.5倍以上，30 * 1.5 = 45px，从 30px 到 -20px，总位移50px)
                let p = (this.gayHitTimer - this.windupDuration) / this.dashDuration;
                if (p > 1) p = 1;
                p = p * p; // ease in
                visualOffsetDist = 30 - 50 * p;
                currentScaleX = 0.9; // 身体前倾/拉伸
                currentScaleY = 1.2;
                currentRot = 25 * Math.PI / 180; // 前倾25度
                
                // 运动模糊/拖尾特效
                if (Math.random() > 0.4) {
                    this.game.addParticle({
                        x: this.x, y: this.y,
                        vx: 0, vy: 0,
                        color: this.color, life: 0.15, size: this.radius * 0.8
                    });
                }
            }
            
            // 计算最终理想位置（基础目标位置 + 动画偏移）
            let targetX = this.enemy.x + backDirX * (targetDist + visualOffsetDist);
            let targetY = this.enemy.y + backDirY * (targetDist + visualOffsetDist);
            
            // 出界修正，确保 Van 不会跑到屏幕外面
            const bounds = { w: this.game.width, h: this.game.height };
            targetX = Math.max(this.radius, Math.min(bounds.w - this.radius, targetX));
            targetY = Math.max(this.radius, Math.min(bounds.h - this.radius, targetY));
            
            // 直接设定位置
            this.x = targetX;
            this.y = targetY;
            
            // 设置 Van 的视觉形变
            // 基础旋转基于攻击方向（朝向敌方即 -backDirX, -backDirY）
            let baseRot = Math.atan2(-backDirY, -backDirX);
            this.visualRotation = baseRot + currentRot;
            this.visualScaleX = currentScaleX;
            this.visualScaleY = currentScaleY;
            
            // 速度与敌方同步
            this.vx = this.enemy.vx;
            this.vy = this.enemy.vy;
            
            // 执行敌方受击反应
            if (this.enemy.visualHitTimer && this.enemy.visualHitTimer > 0) {
                this.enemy.visualHitTimer -= dt;
                
                // 1. 后退滑行 0.3 个身位 (总计 24px，分配到 0.15s)
                const slideSpeed = 24 / 0.15; // 160 px/s
                this.enemy.x += this.enemy.hitDirX * slideSpeed * dt;
                this.enemy.y += this.enemy.hitDirY * slideSpeed * dt;
                
                // 修正敌方出界
                this.enemy.x = Math.max(this.enemy.radius, Math.min(bounds.w - this.enemy.radius, this.enemy.x));
                this.enemy.y = Math.max(this.enemy.radius, Math.min(bounds.h - this.enemy.radius, this.enemy.y));
                
                // 2. 身体后仰动画 (15-30度倾斜)
                let ep = this.enemy.visualHitTimer / 0.15; // 1 -> 0
                this.enemy.visualScaleX = 0.9 + 0.1 * ep;
                this.enemy.visualScaleY = 1.1 - 0.1 * ep;
                
                // 敌方原本朝向攻击反方向，受击向后仰
                let eBaseRot = Math.atan2(-this.enemy.hitDirY, -this.enemy.hitDirX);
                this.enemy.visualRotation = eBaseRot - (25 * Math.PI / 180) * ep;
            } else {
                this.enemy.visualScaleX = 1;
                this.enemy.visualScaleY = 1;
                this.enemy.visualRotation = 0;
            }
            
            // 结束判定
            const currentMaxDuration = (this.isAwakened && this.hasTriggeredAwakenAttack) ? 4.0 : this.gayAttackDuration;
            if (this.gayAttackTimer >= currentMaxDuration) {
                this.endGayAttack();
            }
        }
    }
    
    triggerDesperate() {
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Desperate' });
        }
        this.isDesperate = true;
        this.desperateTimer = 0;
        this.noContactTimer = 0;
        
        // 视觉提示
        this.game.addFloatingText(this.x, this.y - 50, "急 色 !", '#ff0000', 24);
        
        // 爆气粒子
        for (let i = 0; i < 15; i++) {
            this.game.addParticle({
                x: this.x, y: this.y,
                vx: (Math.random() - 0.5) * 150, vy: (Math.random() - 0.5) * 150,
                color: '#ff0000', life: 0.8, size: 4
            });
        }
    }
    
    // 接触重置辅助函数
    resetContact() {
        this.noContactTimer = 0;
        if (this.isDesperate) {
            this.isDesperate = false; // 如果接触时正在急色，立刻打断急色
            this.desperateTimer = 0;
        }
    }
    
    onTakeDamage() {
        super.onTakeDamage();
        this.resetContact(); // 受击重置接触
    }
    
    onAwaken() {
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Awaken: Force Field' });
        }
        
        // 觉醒逻辑在 updateSpecific 处理
    }
    
    startGayAttack(isAwakenAttack = false) {
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: isAwakenAttack ? 'Awaken: Force Field Attack' : 'Gay Attack' });
        }
        this.resetContact(); // 触发攻击重置接触
        
        this.isGayAttacking = true;
        this.gayAttackTimer = 0;
        this.gayHitTimer = 0;
        
        // 播放“抓到”前摇音效
        if (this.grabAudio) {
            this.grabAudio.currentTime = 0;
            this.grabAudio.play().catch(e => console.warn('Grab audio play failed:', e));
        }
        
        if (this.enemy) {
            // 给敌方施加压制状态：伤害减半
            // 我们在 Hero 基类 takeDamage 中添加了 suppress_damage buff 的判断逻辑
            // 正确的做法是：Van 自己获得一个减伤 Buff。
            this.addBuff('van_suppress', 'suppress_damage', 0.5, isAwakenAttack ? 4.0 : 3.0);
            
            // 为敌方添加真正的“压制”状态（禁止其远程发射能力） - 仅在觉醒版本生效
            if (isAwakenAttack) {
                this.enemy.addBuff('van_suppressed', 'van_suppressed', 1, 4.0);
            }
            
            // 瞬移视觉效果
            for(let i=0; i<10; i++) {
                this.game.addParticle({
                    x: this.x, y: this.y,
                    vx: (Math.random() - 0.5) * 100, vy: (Math.random() - 0.5) * 100,
                    color: this.color, life: 0.3, size: 2
                });
            }
        }
    }
    
    endGayAttack(interrupted = false) {
        this.isGayAttacking = false;
        this.gayAttackCooldown = 3.0; // 3秒冷却
        
        // 恢复视觉形变
        this.visualScaleX = 1;
        this.visualScaleY = 1;
        this.visualRotation = 0;
        
        // 觉醒版结束则觉醒结束
        if (this.isAwakened && this.hasTriggeredAwakenAttack) {
            this.isAwakened = false;
            this.isForceFieldActive = false;
            this.hasTriggeredAwakenAttack = false;
        }
        
        // 清除自身的减伤 buff
        const buffIndex = this.buffs.findIndex(b => b.id === 'van_suppress');
        if (buffIndex !== -1) {
            this.buffs.splice(buffIndex, 1);
        }
        
        if (this.enemy) {
            // 移除敌方的压制状态
            const suppressedIndex = this.enemy.buffs.findIndex(b => b.id === 'van_suppressed');
            if (suppressedIndex !== -1) {
                this.enemy.buffs.splice(suppressedIndex, 1);
            }
            
            // 恢复敌方视觉形变
            this.enemy.visualScaleX = 1;
            this.enemy.visualScaleY = 1;
            this.enemy.visualRotation = 0;
            this.enemy.visualHitTimer = 0;
            
            // 如果是被打断（比如被混元劲击退），则跳过默认的强制分离逻辑，交由击退逻辑处理位置
            if (!interrupted) {
                // 强制分离：双方相向推开距离 20 并给予相反初速度
                const dx = this.enemy.x - this.x;
                const dy = this.enemy.y - this.y;
                let dist = Math.hypot(dx, dy);
                if (dist === 0) {
                    dist = 1;
                    this.enemy.x += 1;
                }
                
                const dirX = dx / dist;
                const dirY = dy / dist;
                
                // 推开距离 20 (各自 10)
                this.x -= dirX * 10;
                this.y -= dirY * 10;
                this.enemy.x += dirX * 10;
                this.enemy.y += dirY * 10;
                
                // 给予相反初速度 (相当于一次反弹击退)
                const pushSpeed = 300;
                this.vx = -dirX * pushSpeed;
                this.vy = -dirY * pushSpeed;
                this.enemy.vx = dirX * pushSpeed;
                this.enemy.vy = dirY * pushSpeed;
            }
        }
    }
    
    // 暴露一个用于外部打断攻击的方法
    interruptGayAttack() {
        if (this.isGayAttacking) {
            this.endGayAttack(true); // 传入 true 表示是被打断的
            // 爆出被打断的特效
            for (let i = 0; i < 10; i++) {
                this.game.addParticle({
                    x: this.x, y: this.y,
                    vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200,
                    color: '#ffffff', life: 0.5, size: 3
                });
            }
        }
    }
    
    onHeroCollision(other) {
        this.resetContact(); // 只要发生碰撞就重置
        
        if (this.isDead || other.isDead) return;
        
        // 攻击期间暂停普通碰撞反弹
        if (this.isGayAttacking) {
            return;
        }
        
        // 如果在冷却期间被吸血鬼等黏附，则不触发，也不打断（保持吸血鬼的吸血状态）
        // 但如果不在冷却期间，是可以反打并触发给佬攻击的
        if (this.gayAttackCooldown > 0 && other.name === '吸血鬼' && other.isSucking) {
            return;
        }
        
        // 触发给佬攻击
        if (this.gayAttackCooldown <= 0 && !this.isGayAttacking) {
            // 如果对方是吸血鬼且正在吸附，打断它的吸附，避免互相修改坐标导致位置异常
            if (other.name === '吸血鬼' && other.isSucking) {
                other.isSucking = false;
                other.suckTime = other.suckDuration;
            }
            this.startGayAttack(false);
        }
    }
    
    // 我们需要告诉 Physics 引擎在 Van 处于攻击状态时忽略物理碰撞的反弹
    // 在这里添加一个标志供 Physics.js 读取
    get ignoreHeroCollisionBounce() {
        return this.isGayAttacking;
    }
    
    drawBody(ctx) {
        // 如果处于急色状态，给身体加一层红温发光
        if (this.isDesperate) {
            ctx.save();
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 20 + Math.sin(Date.now() / 50) * 10; // 快速呼吸的红光
        }
        
        super.drawBody(ctx);
        
        if (this.isDesperate) {
            ctx.restore();
        }
        
        // 绘制打桩机视觉特效
        if (this.isGayAttacking) {
            ctx.save();
            // 绘制震动残影
            ctx.globalAlpha = 0.5;
            ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
    
    draw(ctx) {
        // 绘制力场
        if (this.isForceFieldActive && !this.hasTriggeredAwakenAttack) {
            ctx.save();
            ctx.translate(this.x, this.y);
            
            // 计算当前半径（前摇期间扩散效果）
            let currentRadius = this.forceFieldRadius;
            let alphaMult = 1.0;
            if (this.forceFieldWarmup > 0) {
                const p = 1.0 - (this.forceFieldWarmup / 0.5); // 0 -> 1
                const easeOut = p * (2 - p);
                currentRadius = this.forceFieldRadius * easeOut;
                alphaMult = p; // 淡入效果
            }
            
            ctx.beginPath();
            ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
            // 半透明偏粉色磁场圈
            ctx.fillStyle = `rgba(255, 105, 180, ${0.15 * alphaMult})`; // 亮粉色 (HotPink) 的半透明填充
            ctx.fill();
            
            ctx.strokeStyle = `rgba(255, 105, 180, ${0.6 * alphaMult})`;
            ctx.lineWidth = 3;
            ctx.setLineDash([15, 15]);
            
            // 旋转特效
            ctx.rotate(Date.now() / 1000);
            ctx.stroke();
            
            // 内部增加一层逆向旋转的虚线圈增强磁场感
            ctx.beginPath();
            ctx.arc(0, 0, currentRadius * 0.8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 20, 147, ${0.4 * alphaMult})`; // 深粉色 (DeepPink)
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 20]);
            ctx.rotate(-Date.now() / 500); // 抵消外层旋转并反转
            ctx.stroke();
            
            ctx.restore();
        }
        
        super.draw(ctx);
    }
}