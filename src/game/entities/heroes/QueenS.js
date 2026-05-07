import { Hero } from '../Hero.js';

export class QueenS extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = 'S女王';
        this.color = '#800080'; // 紫黑作为基础色，具体渲染在 drawBody 中实现
        this.hp = 100;
        this.maxHp = 100;
        this.baseSpeed = 65;
        this.radius = 40;
        
        // 技能一（赏赐耳光）参数
        this.engageDistance = 20;
        this.lockDistance = 18;
        this.slapCooldown = 0;
        this.slapDamage = 2;
        this.slapRound = 0;
        this.slapPhase = null;
        this.slapPhaseTimer = 0;
        
        // 技能二（小狗狗给我过来）参数
        this.timeSinceLastSlap = 0;
        
        // 觉醒（鞭笞惩戒）参数
        this.whipInterval = 0.28;
        this.whipDamage = 5;
        this.whipCount = 0;
        this.whipTimer = 0;
        
        // 状态机
        this.state = 'normal';
        
        // 链条状态
        this.chain = { active: false, length: 0, angle: 0, chargeTime: 0, throwAngle: 0, targetEnemy: false };
        
        // 视觉特效
        this.visualEffects = [];
        
        // 音效
        this.slapLeftAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/QueenS/正扇.mp3');
        this.slapRightAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/QueenS/反扇.mp3');
        this.chainSwingAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/QueenS/挥舞绳子.mp3');
        this.chainRetractAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/QueenS/回收绳子.mp3');
        this.whipAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/QueenS/鞭子.mp3');
        this.chainHitAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/QueenS/牵狗.mp3');
        this.awakenHitAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/QueenS/趴下.mp3');
        this.awakenAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/QueenS/觉醒.mp3');
        this.victoryAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/QueenS/胜利.mp3');
    }

    onHeroCollision(other) {
        // 碰撞攻击：无
    }

    knockback(kx, ky, speed, duration) {
        // 觉醒期间动作不可被打断（免疫击退）
        if (this.state.startsWith('awaken_')) return;
        super.knockback(kx, ky, speed, duration);
    }

    stopAllAudio() {
        if (this.slapLeftAudio) {
            this.slapLeftAudio.pause();
            this.slapLeftAudio.currentTime = 0;
        }
        if (this.slapRightAudio) {
            this.slapRightAudio.pause();
            this.slapRightAudio.currentTime = 0;
        }
        if (this.chainSwingAudio) {
            this.chainSwingAudio.pause();
            this.chainSwingAudio.currentTime = 0;
        }
        if (this.chainRetractAudio) {
            this.chainRetractAudio.pause();
            this.chainRetractAudio.currentTime = 0;
        }
        if (this.chainHitAudio) {
            this.chainHitAudio.pause();
            this.chainHitAudio.currentTime = 0;
        }
        if (this.awakenHitAudio) {
            this.awakenHitAudio.pause();
            this.awakenHitAudio.currentTime = 0;
        }
        if (this.whipAudio) {
            this.whipAudio.pause();
            this.whipAudio.currentTime = 0;
        }
        if (this.awakenAudio) {
            this.awakenAudio.pause();
            this.awakenAudio.currentTime = 0;
        }
        if (this.victoryAudio) {
            this.victoryAudio.pause();
            this.victoryAudio.currentTime = 0;
        }
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
            this.awakenAudio.play().catch(e => console.warn('Awaken audio play failed:', e));
        }
    }

    playVictoryAudio() {
        if (this.victoryAudio) {
            this.victoryAudio.currentTime = 0;
            this.victoryAudio.play().catch(e => console.warn('Victory audio play failed:', e));
            // 返回音频时长（如果有），如果没有加载好默认返回预估时间
            return this.victoryAudio.duration && !isNaN(this.victoryAudio.duration) ? this.victoryAudio.duration : 3.0;
        }
        return 0;
    }

    onAwaken() {
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Awaken: Punishment of Love' });
        }
        this.startChain('awaken');
    }

    onVictory() {
        // 如果在任何技能状态下获胜，立即中断并清理链条和特效
        this.state = 'normal';
        this.chain.active = false;
        this.isAwakened = false;
        this.absoluteControl = false;
        
        // 停止相关的持续音效
        if (this.chainSwingAudio) {
            this.chainSwingAudio.pause();
            this.chainSwingAudio.currentTime = 0;
        }
        if (this.whipAudio) {
            this.whipAudio.pause();
            this.whipAudio.currentTime = 0;
        }
        if (this.awakenAudio) {
            this.awakenAudio.pause();
            this.awakenAudio.currentTime = 0;
        }
        
        // 立即清理正在渲染的鞭子和链条相关特效
        this.visualEffects = this.visualEffects.filter(e => 
            e.type !== 'whip' && 
            e.type !== 'whip_slash' && 
            e.type !== 'whip_blood' && 
            e.type !== 'slap_arc' && 
            e.type !== 'slap_particle'
        );
    }
    
    updateVictorious(dt) {
        // 游戏结束时，继续更新残留的视觉特效（如爱心），使其自然消散而不是冻结在画面上
        for (let i = this.visualEffects.length - 1; i >= 0; i--) {
            const e = this.visualEffects[i];
            e.life -= dt;
            if (e.type === 'heart' || e.type === 'slap_particle' || e.type === 'whip_blood') {
                e.x += e.vx * dt;
                e.y += e.vy * dt;
            }
            if (e.life <= 0) {
                this.visualEffects.splice(i, 1);
            }
        }
    }

    startChain(mode) {
        this.state = mode === 'awaken' ? 'awaken_chain_charging' : 'chain_charging';
        this.chain.active = true;
        this.chain.chargeTime = 0;
        this.chain.angle = 0;
        this.chain.length = 0;
        
        if (this.chainSwingAudio) {
            this.chainSwingAudio.currentTime = 0;
            this.chainSwingAudio.play().catch(e => console.warn('Chain swing audio play failed:', e));
        }
    }

    startSlapping(isFromChain = false) {
        this.state = 'slapping';
        this.slapRound = 0;
        this.slapPhase = 'left';
        this.slapPhaseTimer = 0;
        this.isCountered = false;
        // 如果是由狗链拉过来触发的耳光，则附加不可被反制的强控标记
        this.absoluteControl = isFromChain;
        
        this.dealSlapDamage('left');
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Rewarding Slap' });
        }
    }
    
    dealSlapDamage(side) {
        if (!this.enemy || this.enemy.isDead) return;
        const angle = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
        this.enemy.takeDamage(this.slapDamage, this.x, this.y);
        
        this.createSlapArcEffect(this.enemy.x, this.enemy.y, angle, side);
        this.createSlapParticles(this.enemy.x, this.enemy.y, angle, side);
        
        if (side === 'left') {
            this.enemy.headTwistAngle = -25 * Math.PI / 180;
            this.enemy.hitTiltDir = -1;
        } else {
            this.enemy.headTwistAngle = 25 * Math.PI / 180;
            this.enemy.hitTiltDir = 1;
        }
        // 由于打击频率加快，受击形变和歪头的持续时间也需要缩短以匹配节奏
        this.enemy.headTwistTime = 0.15; // 从 0.25 缩短到 0.15
        this.enemy.visualHitTimer = 0.12; // 从 0.15 缩短到 0.12
        
        if (this.game && this.game.screenShakeIntensity !== undefined) {
            this.game.screenShakeTimer = Math.max(this.game.screenShakeTimer, 0.1);
            this.game.screenShakeIntensity = 0.4;
        }
        
        if (side === 'left' && this.slapLeftAudio) {
            this.slapLeftAudio.currentTime = 0;
            this.slapLeftAudio.play().catch(e => console.warn('Slap audio play failed:', e));
        } else if (side === 'right' && this.slapRightAudio) {
            this.slapRightAudio.currentTime = 0;
            this.slapRightAudio.play().catch(e => console.warn('Slap audio play failed:', e));
        }
    }

    endSlapping() {
        this.state = 'normal';
        this.slapCooldown = 2.0;
        this.timeSinceLastSlap = 0;
        this.absoluteControl = false;
        
        // 如果是由链条触发的耳光，结束时一起收回链条
        if (this.chain.active) {
            this.chain.active = false;
        }

        if (this.enemy && !this.enemy.isDead) {
            // 清除敌方的头部扭转效果
            this.enemy.headTwistTime = 0;
            this.enemy.headTwistAngle = 0;
            
            // 清除敌方受击形变
            this.enemy.visualHitTimer = 0;
            this.enemy.visualScaleX = 1;
            this.enemy.visualScaleY = 1;
            this.enemy.visualRotation = 0;
            
            // 强制分离：女王与敌方沿连线方向推开距离20 并给予相反初速度
            const angle = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
            this.x -= Math.cos(angle) * 10;
            this.y -= Math.sin(angle) * 10;
            this.enemy.x += Math.cos(angle) * 10;
            this.enemy.y += Math.sin(angle) * 10;
            
            const pushSpeed = 200;
            this.vx = -Math.cos(angle) * pushSpeed;
            this.vy = -Math.sin(angle) * pushSpeed;
            this.enemy.vx = Math.cos(angle) * pushSpeed;
            this.enemy.vy = Math.sin(angle) * pushSpeed;
        }
    }

    startWhipping() {
        this.state = 'awaken_whipping';
        this.whipCount = 0;
        this.whipTimer = 0;
        this.isCountered = false;
        // 觉醒抽鞭子必定是由狗链拉过来触发的，赋予绝对强控
        this.absoluteControl = true;
    }

    endAwaken() {
        this.isAwakened = false;
        this.state = 'normal';
        this.slapCooldown = 2.0;
        this.timeSinceLastSlap = 0;
        this.absoluteControl = false;
        this.chain.active = false;
        
        if (this.awakenTimer !== undefined) {
            this.awakenTimer = 0;
        }
        
        if (this.enemy && !this.enemy.isDead) {
            // 清除敌方的头部扭转效果
            this.enemy.headTwistTime = 0;
            this.enemy.headTwistAngle = 0;
            
            // 清除敌方受击形变
            this.enemy.visualHitTimer = 0;
            this.enemy.visualScaleX = 1;
            this.enemy.visualScaleY = 1;
            this.enemy.visualRotation = 0;
            
            const angle = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
            this.x -= Math.cos(angle) * 10;
            this.y -= Math.sin(angle) * 10;
            this.enemy.x += Math.cos(angle) * 10;
            this.enemy.y += Math.sin(angle) * 10;
            
            const pushSpeed = 200;
            this.vx = -Math.cos(angle) * pushSpeed;
            this.vy = -Math.sin(angle) * pushSpeed;
            this.enemy.vx = Math.cos(angle) * pushSpeed;
            this.enemy.vy = Math.sin(angle) * pushSpeed;
        }
    }

    updateSpecific(dt) {
        if (this.isDead) return;

        switch (this.state) {
            case 'normal':
                if (this.slapCooldown > 0) {
                    this.slapCooldown -= dt;
                } else {
                    this.timeSinceLastSlap += dt;
                }

                if (this.slapCooldown <= 0 && this.enemy && !this.enemy.isDead) {
                    const dist = Math.hypot(this.enemy.x - this.x, this.enemy.y - this.y);
                    const engageTotalDist = this.radius + this.enemy.radius + this.engageDistance;
                    if (dist <= engageTotalDist) {
                        this.startSlapping();
                    } else if (this.timeSinceLastSlap >= 2.0) {
                        this.startChain('normal');
                    }
                }
                break;

            case 'slapping':
                this.updateSlapping(dt);
                break;

            case 'chain_charging':
            case 'awaken_chain_charging':
                this.updateChainCharging(dt);
                break;

            case 'chain_throwing':
            case 'awaken_chain_throwing':
                this.updateChainThrowing(dt);
                break;

            case 'chain_pulling':
            case 'awaken_chain_pulling':
                this.updateChainPulling(dt);
                break;
                
            case 'chain_delay':
                this.updateChainDelay(dt);
                break;

            case 'awaken_whipping':
                this.updateWhipping(dt);
                break;
        }

        // 更新特效
        for (let i = this.visualEffects.length - 1; i >= 0; i--) {
            const e = this.visualEffects[i];
            e.life -= dt;
            if (e.type === 'heart' || e.type === 'slap_particle' || e.type === 'whip_blood') {
                e.x += e.vx * dt;
                e.y += e.vy * dt;
            }
            if (e.life <= 0) {
                this.visualEffects.splice(i, 1);
            }
        }
    }

    forceEnemyPosition(targetGap) {
        if (!this.enemy || this.enemy.isDead) return false;
        
        const angle = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
        
        // 【平衡性调整】近战反制机制
        // 如果敌方成功发动了近身缠斗技能（如吸血、打桩），且女王未处于狗链拉回后的“绝对强控”状态
        // 绝对距离锁定将失效，不再强行覆盖敌方坐标
        if (!this.absoluteControl && (this.enemy.isSucking || this.enemy.isGayAttacking)) {
            this.isCountered = true;
            return angle;
        }
        
        // 如果处于绝对强控状态，强行打断敌方的吸血和打桩状态
        if (this.absoluteControl) {
            if (this.enemy.isSucking) {
                this.enemy.isSucking = false;
                this.enemy.suckTime = this.enemy.suckDuration;
            }
            if (this.enemy.isGayAttacking && typeof this.enemy.endGayAttack === 'function') {
                this.enemy.endGayAttack(true);
            }
        }
        
        // 如果之前被反制过，且现在反制结束（如吸血时间到并弹开），则女王的强控也应顺势中断，不再强行拉回
        if (this.isCountered) {
            this.isCountered = false;
            return false;
        }
        
        const targetDist = this.radius + this.enemy.radius + targetGap;
        
        let ex = this.x + Math.cos(angle) * targetDist;
        let ey = this.y + Math.sin(angle) * targetDist;
        
        ex = Math.max(this.enemy.radius, Math.min(this.game.width - this.enemy.radius, ex));
        ey = Math.max(this.enemy.radius, Math.min(this.game.height - this.enemy.radius, ey));
        
        this.enemy.x = ex;
        this.enemy.y = ey;
        this.enemy.vx = 0;
        this.enemy.vy = 0;
        
        // 补偿机制：虽然物理上没有发生重叠，但给予近战英雄反制的机会
        // 强控期间主动触发他们的碰撞判定，让他们有机会发动近身技能挣脱控制
        // 注意：如果在绝对强控期间（被狗链拉回），则剥夺此补偿机制
        if (!this.absoluteControl && (this.enemy.name === '吸血鬼' || this.enemy.name === '成都之心')) {
            if (typeof this.enemy.onHeroCollision === 'function') {
                this.enemy.onHeroCollision(this);
            }
        }
        
        return angle;
    }

    updateSlapping(dt) {
        // 如果敌方死亡，立即停止扇耳光
        if (!this.enemy || this.enemy.isDead) {
            this.endSlapping();
            return;
        }

        const angle = this.forceEnemyPosition(this.lockDistance);
        if (angle === false) {
            this.endSlapping();
            return;
        }

        if (this.enemy.headTwistTime > 0) {
            this.enemy.headTwistTime -= dt;
            if (this.enemy.headTwistTime <= 0) {
                this.enemy.headTwistAngle = 0;
                this.enemy.headTwistTime = 0; // 确保彻底清零
            }
        }

        // 敌方身体受击形变与倾斜动画
        if (this.enemy.visualHitTimer && this.enemy.visualHitTimer > 0) {
            this.enemy.visualHitTimer -= dt;
            let ep = this.enemy.visualHitTimer / 0.12; // 从 0.15 匹配到 0.12
            
            // 压扁形变
            this.enemy.visualScaleX = 0.9 + 0.1 * ep;
            this.enemy.visualScaleY = 1.1 - 0.1 * ep;
            
            // 身体倾斜：朝受击方向倾斜
            const tiltMaxAngle = 25 * Math.PI / 180;
            let eBaseRot = angle + Math.PI; // 敌方面向女王
            this.enemy.visualRotation = eBaseRot + this.enemy.hitTiltDir * tiltMaxAngle * ep;
        } else {
            this.enemy.visualScaleX = 1;
            this.enemy.visualScaleY = 1;
            this.enemy.visualRotation = 0;
        }

        this.slapPhaseTimer += dt;

        switch (this.slapPhase) {
            case 'left':
                if (this.slapPhaseTimer >= 0.12) { // 从 0.2 加快到 0.12
                    this.slapPhaseTimer = 0;
                    this.slapPhase = 'between';
                }
                break;
            case 'between':
                if (this.slapPhaseTimer >= 0.03) { // 从 0.05 加快到 0.03
                    this.slapPhaseTimer = 0;
                    this.slapPhase = 'right';
                    this.dealSlapDamage('right');
                }
                break;
            case 'right':
                if (this.slapPhaseTimer >= 0.12) { // 从 0.2 加快到 0.12
                    this.slapPhaseTimer = 0;
                    this.slapRound++;
                    if (this.slapRound >= 4) { // 从 3 轮（6下）提升到 4 轮（8下）
                        this.endSlapping();
                    } else {
                        this.slapPhase = 'round_pause';
                    }
                }
                break;
            case 'round_pause':
                if (this.slapPhaseTimer >= 0.15) { // 轮间停顿从 0.3 加快到 0.15
                    this.slapPhaseTimer = 0;
                    this.slapPhase = 'left';
                    this.dealSlapDamage('left');
                }
                break;
        }
    }

    updateChainCharging(dt) {
        this.chain.chargeTime += dt;
        this.chain.angle += Math.PI * 2 * (dt / 0.6); // 0.6秒转一圈
        if (this.chain.chargeTime >= 0.6) {
            this.state = this.state === 'awaken_chain_charging' ? 'awaken_chain_throwing' : 'chain_throwing';
            this.chain.length = 0;
            this.chain.throwAngle = this.enemy ? Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x) : 0;
            this.chain.targetEnemy = this.state === 'awaken_chain_throwing';
            
            if (this.game) {
                this.game.logEvent('skill', { heroId: this.playerId, skill: this.state === 'awaken_chain_throwing' ? 'Awaken Chain Throw' : 'Chain Throw' });
            }
        }
    }

    updateChainThrowing(dt) {
        const throwSpeed = 1200; // 链条甩出速度
        this.chain.length += throwSpeed * dt;
        
        if (this.chain.targetEnemy && this.enemy && !this.enemy.isDead) {
            // 追踪必中：不断修正角度
            this.chain.throwAngle = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
        }
        
        const chainTipX = this.x + Math.cos(this.chain.throwAngle) * this.chain.length;
        const chainTipY = this.y + Math.sin(this.chain.throwAngle) * this.chain.length;
        
        // 命中判定
        if (this.enemy && !this.enemy.isDead) {
            const dist = Math.hypot(this.enemy.x - chainTipX, this.enemy.y - chainTipY);
            if (dist <= this.enemy.radius + 20) {
                // 狗绳命中瞬间造成 10 点爆发伤害
                this.enemy.takeDamage(10 * this.damageMultiplier, this.x, this.y);
                
                if (this.enemy.isDead) {
                    this.state = 'normal';
                    this.chain.active = false;
                    this.isAwakened = false;
                    if (this.chainSwingAudio) {
                        this.chainSwingAudio.pause();
                        this.chainSwingAudio.currentTime = 0;
                    }
                    return;
                }
                
                if (this.chainRetractAudio) {
                    this.chainSwingAudio.pause();
                    this.chainSwingAudio.currentTime = 0;
                    this.chainRetractAudio.currentTime = 0;
                    this.chainRetractAudio.play().catch(e => console.warn('Chain retract audio play failed:', e));
                }
                
                if (this.state === 'awaken_chain_throwing') {
                    if (this.awakenHitAudio) {
                        this.awakenHitAudio.currentTime = 0;
                        this.awakenHitAudio.play().catch(e => console.warn('Awaken hit audio play failed:', e));
                    }
                } else {
                    if (this.chainHitAudio) {
                        this.chainHitAudio.currentTime = 0;
                        this.chainHitAudio.play().catch(e => console.warn('Chain hit audio play failed:', e));
                    }
                }
                
                this.state = this.state === 'awaken_chain_throwing' ? 'awaken_chain_pulling' : 'chain_pulling';
                return;
            }
        }
        
        // 失败判定
        const maxChainLength = Math.hypot(this.game.width, this.game.height);
        if (this.chain.length >= maxChainLength || chainTipX < 0 || chainTipX > this.game.width || chainTipY < 0 || chainTipY > this.game.height) {
            if (this.chainSwingAudio) {
                this.chainSwingAudio.pause();
                this.chainSwingAudio.currentTime = 0;
            }
            this.state = 'normal';
            this.chain.active = false;
            this.timeSinceLastSlap = 0;
        }
    }

    updateChainPulling(dt) {
        if (!this.enemy || this.enemy.isDead) {
            this.state = 'normal';
            this.chain.active = false;
            return;
        }
        
        const pullSpeed = 800; // 拉回速度
        const dx = this.x - this.enemy.x;
        const dy = this.y - this.enemy.y;
        const dist = Math.hypot(dx, dy);
        
        // 觉醒状态下拉过来的距离（表现鞭打）加长，普通状态下（扇耳光）距离不变
        const currentLockDist = this.state === 'awaken_chain_pulling' ? this.lockDistance + 45 : this.lockDistance;
        const targetDist = this.radius + this.enemy.radius + currentLockDist;
        
        if (dist <= targetDist) {
            // 拉到位
            if (this.state === 'awaken_chain_pulling') {
                this.chain.active = false;
                this.startWhipping();
            } else {
                // 普通狗链拉回后，维持 chain.active 为 true，保留视觉连结
                this.state = 'chain_delay';
                this.chainDelayTimer = 1.5;
                this.chainDamageTickTimer = 0; // 新增伤害计时器
                this.absoluteControl = true; // 在 delay 期间就赋予绝对强控
            }
        } else {
            // 将敌方拉至身前
            const angle = Math.atan2(dy, dx);
            this.enemy.x += Math.cos(angle) * pullSpeed * dt;
            this.enemy.y += Math.sin(angle) * pullSpeed * dt;
            
            // 更新链条视觉长度
            this.chain.length = dist;
            this.chain.throwAngle = Math.atan2(-dy, -dx);
        }
    }
    
    updateChainDelay(dt) {
        if (!this.enemy || this.enemy.isDead) {
            this.state = 'normal';
            this.chain.active = false;
            return;
        }

        // 强行锁住敌方位置
        const angle = this.forceEnemyPosition(this.lockDistance);
        if (angle === false) {
            this.state = 'normal';
            this.chain.active = false;
            return;
        }
        
        // 更新链条视觉
        const dx = this.x - this.enemy.x;
        const dy = this.y - this.enemy.y;
        this.chain.length = Math.hypot(dx, dy);
        this.chain.throwAngle = Math.atan2(-dy, -dx);
        
        // 每 0.5 秒造成 1 点伤害
        this.chainDamageTickTimer += dt;
        if (this.chainDamageTickTimer >= 0.5) {
            this.chainDamageTickTimer -= 0.5;
            this.enemy.takeDamage(1 * this.damageMultiplier, this.x, this.y);
            
            // 简单的受击形变与颜色反馈
            this.enemy.visualHitTimer = 0.1;
            
            if (this.enemy.isDead) {
                this.state = 'normal';
                this.chain.active = false;
                return;
            }
        }

        this.chainDelayTimer -= dt;
        if (this.chainDelayTimer <= 0) {
            this.startSlapping(true); // 传入 true 表示是从狗链拉过来的，附加绝对强控
        }
    }

    updateWhipping(dt) {
        // 如果敌方死亡，停止鞭笞
        if (!this.enemy || this.enemy.isDead) {
            this.endAwaken();
            return;
        }

        // 觉醒状态下的控制身位距离加长
        const currentLockDist = this.lockDistance + 45;
        const angle = this.forceEnemyPosition(currentLockDist);
        if (angle === false) {
            this.endAwaken();
            return;
        }

        if (this.enemy.headTwistTime > 0) {
            this.enemy.headTwistTime -= dt;
            if (this.enemy.headTwistTime <= 0) {
                this.enemy.headTwistAngle = 0;
                this.enemy.headTwistTime = 0; // 确保彻底清零
            }
        }

        // 敌方身体受击形变与倾斜动画
        if (this.enemy.visualHitTimer && this.enemy.visualHitTimer > 0) {
            this.enemy.visualHitTimer -= dt;
            let ep = this.enemy.visualHitTimer / 0.15; // 匹配 0.15 的初始值
            
            // 压扁形变
            this.enemy.visualScaleX = 0.9 + 0.1 * ep;
            this.enemy.visualScaleY = 1.1 - 0.1 * ep;
            
            // 身体倾斜：朝受击方向倾斜
            const tiltMaxAngle = 25 * Math.PI / 180;
            let eBaseRot = angle + Math.PI; // 敌方面向女王
            this.enemy.visualRotation = eBaseRot + this.enemy.hitTiltDir * tiltMaxAngle * ep;
        } else {
            this.enemy.visualScaleX = 1;
            this.enemy.visualScaleY = 1;
            this.enemy.visualRotation = 0;
        }

        this.whipTimer += dt;
        if (this.whipTimer >= this.whipInterval) {
            this.whipTimer -= this.whipInterval;
            this.whipCount++;
            
            this.enemy.takeDamage(this.whipDamage, this.x, this.y);
            
            if (this.enemy.isDead) {
                this.visualEffects = this.visualEffects.filter(e => e.type !== 'whip' && e.type !== 'whip_blood');
                if (this.whipAudio) {
                    this.whipAudio.pause();
                    this.whipAudio.currentTime = 0;
                }
                this.endAwaken();
                return;
            }
            
            // 添加强烈的屏幕震动
            if (this.game && this.game.screenShakeIntensity !== undefined) {
                this.game.screenShakeTimer = Math.max(this.game.screenShakeTimer || 0, 0.15);
                this.game.screenShakeIntensity = 0.6; // 震动更强烈，表现狠辣
            }
            
            // 敌方受击扭曲与形变，表现被抽打的痛苦
            this.enemy.headTwistAngle = (Math.random() > 0.5 ? 1 : -1) * 35 * Math.PI / 180;
            this.enemy.headTwistTime = 0.2;
            this.enemy.visualHitTimer = 0.15;
            this.enemy.hitTiltDir = Math.random() > 0.5 ? 1 : -1;
            
            if (this.whipAudio) {
                this.whipAudio.currentTime = 0;
                this.whipAudio.play().catch(e => console.warn('Whip audio play failed:', e));
            }
            
            this.createWhipEffect(this.enemy.x, this.enemy.y, angle);
            this.createHeartEffect(this.enemy.x, this.enemy.y);
            
            // 生成鲜血/猩红火花溅射特效
            for (let i = 0; i < 12; i++) {
                const burstAngle = angle + (Math.random() - 0.5) * Math.PI;
                const speed = 150 + Math.random() * 200;
                this.visualEffects.push({
                    type: 'whip_blood',
                    x: this.enemy.x, y: this.enemy.y,
                    vx: Math.cos(burstAngle) * speed,
                    vy: Math.sin(burstAngle) * speed,
                    life: 0.2 + Math.random() * 0.2, maxLife: 0.4,
                    size: 3 + Math.random() * 4
                });
            }
            
            if (this.whipCount >= 6) {
                this.endAwaken();
            }
        }
    }

    createSlapArcEffect(ex, ey, queenAngle, side) {
        // 增大左右起手的角度偏移，从 PI/4 (45度) 扩大到 PI/2.5 (约72度)
        // 这样扇巴掌的弧度范围会变得更大
        const startOffsetAngle = side === 'left' ? Math.PI / 2.5 : -Math.PI / 2.5;
        const endOffsetAngle = side === 'left' ? -Math.PI / 2.5 : Math.PI / 2.5;
        const arcRadius = 40; // 从 35 略微增大到 40，配合更大的弧度
        
        const midRatio = 0.45;
        const arcCenterX = this.x + (ex - this.x) * midRatio;
        const arcCenterY = this.y + (ey - this.y) * midRatio;
        
        this.visualEffects.push({
            type: 'slap_arc',
            startX: arcCenterX + Math.cos(queenAngle + startOffsetAngle) * arcRadius,
            startY: arcCenterY + Math.sin(queenAngle + startOffsetAngle) * arcRadius,
            endX: arcCenterX + Math.cos(queenAngle + endOffsetAngle) * arcRadius,
            endY: arcCenterY + Math.sin(queenAngle + endOffsetAngle) * arcRadius,
            life: 0.2, maxLife: 0.2,
            side: side,
            queenAngle: queenAngle
        });
        
        this.visualEffects.push({
            type: 'shockwave',
            x: ex, y: ey,
            life: 0.15, maxLife: 0.15,
            maxRadius: 65
        });
    }

    createSlapParticles(ex, ey, queenAngle, side) {
        const burstAngle = queenAngle + (side === 'left' ? -Math.PI / 2 : Math.PI / 2);
        for (let i = 0; i < 8; i++) {
            const angle = burstAngle + (Math.random() - 0.5) * Math.PI * 0.6;
            const speed = 60 + Math.random() * 80;
            this.visualEffects.push({
                type: 'slap_particle',
                x: ex, y: ey,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.15, maxLife: 0.15,
                size: 2 + Math.random() * 3
            });
        }
    }

    createWhipEffect(x, y, angle) {
        // 交替挥鞭方向，表现左右开弓
        this.whipSide = this.whipSide === 1 ? -1 : 1;
        const dist = Math.hypot(x - this.x, y - this.y);
        
        this.visualEffects.push({
            type: 'whip',
            startX: this.x, startY: this.y,
            endX: x, endY: y,
            angle: angle,
            side: this.whipSide,
            dist: dist,
            life: 0.35, maxLife: 0.35 // 稍微延长一点寿命让动画更饱满
        });
        
        // 增加空间撕裂的抓痕特效，提升打击的狂暴感
        this.visualEffects.push({
            type: 'whip_slash',
            x: x + (Math.random() - 0.5) * 40,
            y: y + (Math.random() - 0.5) * 40,
            angle: angle + Math.PI/2 + (Math.random() - 0.5) * Math.PI/3,
            life: 0.2, maxLife: 0.2
        });
    }

    createHeartEffect(x, y) {
        this.visualEffects.push({
            type: 'heart',
            x: x + (Math.random() - 0.5) * 40,
            y: y + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 50,
            vy: -50 - Math.random() * 50,
            life: 1.0, maxLife: 1.0,
            size: 15 + Math.random() * 10
        });
    }

    drawBody(ctx) {
        ctx.save();
        // 紫黑玫红渐变配色
        const grad = ctx.createLinearGradient(-this.radius, -this.radius, this.radius, this.radius);
        grad.addColorStop(0, '#2d004d'); // 紫黑
        grad.addColorStop(1, '#ff007f'); // 玫红
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        
        // 增加阵营边框区分
        ctx.strokeStyle = this.playerId === 1 ? '#ec9a9aff' : '#e49bbdff';
        ctx.lineWidth = 4; // 稍微加粗一点边框使其更明显
        ctx.stroke();
        ctx.restore();
    }

    draw(ctx) {
        super.draw(ctx);
        
        if (this.isDead) return;

        // 绘制链条
        if (this.chain.active) {
            ctx.save();
            
            let startX = this.x, startY = this.y;
            let endX, endY, ctrlX, ctrlY;
            let curveLen = 0;

            if (this.state === 'chain_charging' || this.state === 'awaken_chain_charging') {
                const orbitRadius = this.radius + 35;
                endX = this.x + Math.cos(this.chain.angle) * orbitRadius;
                endY = this.y + Math.sin(this.chain.angle) * orbitRadius;
                
                const lagAngle = this.chain.angle + Math.PI / 3;
                const ctrlRadius = orbitRadius * 0.8;
                ctrlX = this.x + Math.cos(lagAngle) * ctrlRadius;
                ctrlY = this.y + Math.sin(lagAngle) * ctrlRadius;
                
                curveLen = orbitRadius * 1.2;
            } else if (this.state === 'slapping' || this.state === 'chain_delay') {
                // 在扇耳光阶段或等待阶段，链条紧绷在女王和被控制的敌方之间
                if (this.enemy && !this.enemy.isDead) {
                    endX = this.enemy.x;
                    endY = this.enemy.y;
                    curveLen = Math.hypot(endX - startX, endY - startY);
                    ctrlX = (startX + endX) / 2;
                    ctrlY = (startY + endY) / 2;
                    
                    // 让链条在两人之间有轻微的下垂弧度
                    const perpAngle = Math.atan2(endY - startY, endX - startX) + Math.PI / 2;
                    ctrlX += Math.cos(perpAngle) * 15;
                    ctrlY += Math.sin(perpAngle) * 15;
                } else {
                    this.chain.active = false;
                    ctx.restore();
                    return;
                }
            } else {
                endX = this.x + Math.cos(this.chain.throwAngle) * this.chain.length;
                endY = this.y + Math.sin(this.chain.throwAngle) * this.chain.length;
                curveLen = this.chain.length;
                
                if (this.state === 'chain_throwing' || this.state === 'awaken_chain_throwing') {
                    const midX = (this.x + endX) / 2;
                    const midY = (this.y + endY) / 2;
                    const wobble = Math.sin(Date.now() / 50) * 30;
                    const perpAngle = this.chain.throwAngle + Math.PI / 2;
                    ctrlX = midX + Math.cos(perpAngle) * wobble;
                    ctrlY = midY + Math.sin(perpAngle) * wobble;
                } else {
                    ctrlX = (startX + endX) / 2;
                    ctrlY = (startY + endY) / 2;
                }
            }

            // 绘制锁扣链条
            const linkSpacing = 10; // 每个锁扣的间距
            const steps = Math.max(2, Math.floor(curveLen / linkSpacing));
            
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const x = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * ctrlX + Math.pow(t, 2) * endX;
                const y = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * ctrlY + Math.pow(t, 2) * endY;
                
                // 计算当前点切线方向，用于旋转锁扣
                const dx = 2 * (1 - t) * (ctrlX - startX) + 2 * t * (endX - ctrlX);
                const dy = 2 * (1 - t) * (ctrlY - startY) + 2 * t * (endY - ctrlY);
                const angle = Math.atan2(dy, dx);
                
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle);
                
                ctx.beginPath();
                if (i % 2 === 0) {
                    // 正面圆环锁扣
                    ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2);
                    ctx.strokeStyle = '#a9a9a9';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                } else {
                    // 侧面实心锁扣
                    ctx.rect(-4, -1.5, 8, 3);
                    ctx.fillStyle = '#666';
                    ctx.fill();
                    ctx.strokeStyle = '#222';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
                ctx.restore();
            }

            // 绘制项圈末端
            ctx.beginPath();
            ctx.fillStyle = '#333';
            ctx.arc(endX, endY, 8, 0, Math.PI * 2);
            ctx.fill();
            // 项圈上的金属环细节
            ctx.beginPath();
            ctx.arc(endX, endY, 4, 0, Math.PI * 2);
            ctx.strokeStyle = '#a9a9a9';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.restore();
        }

        // 绘制敌方头部扭转效果
        if (this.enemy && !this.enemy.isDead && this.enemy.headTwistAngle && this.enemy.headTwistTime > 0) {
            ctx.save();
            ctx.translate(this.enemy.x, this.enemy.y);
            const twist = this.enemy.headTwistAngle * (this.enemy.headTwistTime / 0.15); // 从 0.25 匹配到 0.15
            ctx.rotate(twist);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, -this.enemy.radius * 0.4, 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 绘制特效
        for (const e of this.visualEffects) {
            if (e.type === 'slap_arc') {
                ctx.save();
                const progress = 1 - e.life / e.maxLife;
                // 提升整体透明度下限，使其在大部分时间里保持高可见度
                const alpha = 0.3 + 0.7 * Math.sin(progress * Math.PI);
                
                const arcAmount = Math.sin(progress * Math.PI);
                const midX = (e.startX + e.endX) / 2;
                const midY = (e.startY + e.endY) / 2;
                const perpAngle = e.queenAngle + Math.PI / 2;
                const bendX = midX - Math.cos(perpAngle) * arcAmount * 25;
                const bendY = midY - Math.sin(perpAngle) * arcAmount * 25;
                
                const t = progress;
                const cx = (1 - t) * (1 - t) * e.startX + 2 * (1 - t) * t * bendX + t * t * e.endX;
                const cy = (1 - t) * (1 - t) * e.startY + 2 * (1 - t) * t * bendY + t * t * e.endY;
                
                // 再次增大巴掌尺寸，使其更有视觉冲击力
                const handWidth = 24;  // 从 18 增大到 24
                const handHeight = 42; // 从 34 增大到 42
                const cornerRadius = 8; // 从 6 增大到 8
                
                const travelAngle = Math.atan2(e.endY - e.startY, e.endX - e.startX);
                
                ctx.translate(cx, cy);
                // 增大巴掌挥舞时的自转幅度，从 0.3 弧度 增大到 0.8 弧度，让巴掌看起来像是在用力“甩”出去
                ctx.rotate(travelAngle + (e.side === 'left' ? 0.8 : -0.8) * Math.sin(progress * Math.PI));
                
                // 添加强烈的霓虹发光效果
                ctx.shadowColor = '#ff007f';
                ctx.shadowBlur = 20 * alpha;
                
                // 使用高亮渐变：玫红到亮白粉色，抛弃暗沉的紫黑
                const grad = ctx.createLinearGradient(-handWidth / 2, -handHeight / 2, handWidth / 2, handHeight / 2);
                grad.addColorStop(0, `rgba(255, 0, 127, ${alpha})`); // #ff007f (玫红)
                grad.addColorStop(1, `rgba(255, 200, 220, ${alpha})`); // 亮白粉
                
                ctx.fillStyle = grad;
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`; // 纯白描边提亮边缘
                ctx.lineWidth = 2.5;
                
                ctx.beginPath();
                ctx.moveTo(-handWidth / 2 + cornerRadius, -handHeight / 2);
                ctx.lineTo(handWidth / 2 - cornerRadius, -handHeight / 2);
                ctx.arcTo(handWidth / 2, -handHeight / 2, handWidth / 2, -handHeight / 2 + cornerRadius, cornerRadius);
                ctx.lineTo(handWidth / 2, handHeight / 2 - cornerRadius);
                ctx.arcTo(handWidth / 2, handHeight / 2, handWidth / 2 - cornerRadius, handHeight / 2, cornerRadius);
                ctx.lineTo(-handWidth / 2 + cornerRadius, handHeight / 2);
                ctx.arcTo(-handWidth / 2, handHeight / 2, -handWidth / 2, handHeight / 2 - cornerRadius, cornerRadius);
                ctx.lineTo(-handWidth / 2, -handHeight / 2 + cornerRadius);
                ctx.arcTo(-handWidth / 2, -handHeight / 2, -handWidth / 2 + cornerRadius, -handHeight / 2, cornerRadius);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`; // 掌纹纯白发光
                ctx.lineWidth = 1.5;
                for (let i = -1; i <= 1; i++) {
                    ctx.beginPath();
                    ctx.moveTo(-handWidth / 2 + 6, i * handHeight / 6);
                    ctx.lineTo(handWidth / 2 - 6, i * handHeight / 6);
                    ctx.stroke();
                }
                
                ctx.restore();
            } else if (e.type === 'slap_particle') {
                ctx.save();
                ctx.globalAlpha = e.life / e.maxLife;
                ctx.fillStyle = '#ffffff'; // 粒子核心变白
                ctx.shadowColor = '#ff007f'; // 附加粉色光晕
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else if (e.type === 'shockwave') {
                ctx.save();
                ctx.strokeStyle = `rgba(255, 105, 180, ${e.life / e.maxLife})`; // 冲击波改为亮粉色
                ctx.shadowColor = '#ff007f';
                ctx.shadowBlur = 15;
                ctx.lineWidth = 4; // 加粗冲击波
                ctx.beginPath();
                const r = (1 - e.life / e.maxLife) * e.maxRadius;
                ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            } else if (e.type === 'whip') {
                ctx.save();
                const progress = e.life / e.maxLife; // 1.0 -> 0.0
                
                // 侧边偏移量，表现鞭子从左右两侧宽大挥出的轨迹
                const sideOffset = e.side * (120 + 60 * Math.sin(progress * Math.PI)); 
                
                // 控制点1：靠近女王，起始弧度较大
                const cp1X = e.startX + Math.cos(e.angle + Math.PI/3 * e.side) * (e.dist * 0.4);
                const cp1Y = e.startY + Math.sin(e.angle + Math.PI/3 * e.side) * (e.dist * 0.4);

                // 控制点2：控制鞭子中段的弯曲
                const perpAngle = e.angle + Math.PI/2;
                const cp2X = (e.startX + e.endX) / 2 + Math.cos(perpAngle) * sideOffset;
                const cp2Y = (e.startY + e.endY) / 2 + Math.sin(perpAngle) * sideOffset;

                // 鞭子尖端：表现抽打的瞬间爆发和穿透
                let tipX, tipY;
                if (progress > 0.8) {
                    // 刚挥出的前摇帧（鞭子还在半空）
                    const preT = (1 - progress) / 0.2; // 0 -> 1
                    tipX = e.startX + Math.cos(e.angle - Math.PI/4 * e.side) * (e.dist * preT);
                    tipY = e.startY + Math.sin(e.angle - Math.PI/4 * e.side) * (e.dist * preT);
                } else {
                    // 击中并顺势抽出穿透敌方身体
                    const postT = (0.8 - progress) / 0.8; // 0 -> 1
                    // 鞭尖在敌方身后继续延伸
                    tipX = e.endX + Math.cos(e.angle + (Math.random()-0.5)*0.2) * (80 * postT);
                    tipY = e.endY + Math.sin(e.angle + (Math.random()-0.5)*0.2) * (80 * postT);
                }

                // 发光与颜色
                ctx.shadowColor = '#ff003c';
                ctx.shadowBlur = 20 + 10 * Math.sin(progress * Math.PI);
                
                // 外层残影（暗红，最粗）
                ctx.strokeStyle = `rgba(150, 0, 20, ${progress * 0.6})`;
                ctx.lineWidth = 15;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(e.startX, e.startY);
                ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, tipX, tipY);
                ctx.stroke();

                // 中层（鲜红）
                ctx.strokeStyle = `rgba(255, 20, 60, ${progress * 0.9})`;
                ctx.lineWidth = 8;
                ctx.stroke();

                // 内芯（亮白粉，极具爆发力，只在挥击最猛烈时最亮）
                const coreAlpha = progress > 0.3 ? progress : progress * 2;
                ctx.strokeStyle = `rgba(255, 200, 220, ${coreAlpha})`;
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.restore();
            } else if (e.type === 'whip_slash') {
                ctx.save();
                const p = e.life / e.maxLife; // 1.0 -> 0.0
                ctx.translate(e.x, e.y);
                ctx.rotate(e.angle);
                
                // 长度随时间拉伸表现出撕裂的动感
                const len = 200 + 100 * (1 - p); 
                const width = 15 * Math.sin(p * Math.PI); // 两头尖，中间宽
                
                ctx.shadowColor = '#ff003c';
                ctx.shadowBlur = 15 * p;
                
                // 渐变色：中间亮白，边缘猩红
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, len/2);
                grad.addColorStop(0, `rgba(255, 255, 255, ${p})`);
                grad.addColorStop(0.3, `rgba(255, 20, 60, ${p * 0.8})`);
                grad.addColorStop(1, `rgba(150, 0, 20, 0)`);
                
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.ellipse(0, 0, len/2, width/2, 0, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
            } else if (e.type === 'whip_blood') {
                ctx.save();
                ctx.globalAlpha = e.life / e.maxLife;
                ctx.fillStyle = '#ff003c'; // 鲜血/火花颜色
                ctx.shadowColor = '#ff0000';
                ctx.shadowBlur = 10;
                
                // 绘制拉长的飞溅形状
                const speed = Math.hypot(e.vx, e.vy);
                const angle = Math.atan2(e.vy, e.vx);
                ctx.translate(e.x, e.y);
                ctx.rotate(angle);
                
                ctx.beginPath();
                ctx.ellipse(0, 0, e.size * 2 + speed * 0.05, e.size, 0, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
            } else if (e.type === 'heart') {
                ctx.save();
                ctx.translate(e.x, e.y);
                ctx.globalAlpha = e.life / e.maxLife;
                ctx.fillStyle = '#ff69b4';
                const size = e.size;
                ctx.beginPath();
                ctx.moveTo(0, size / 4);
                ctx.bezierCurveTo(0, 0, -size / 2, 0, -size / 2, size / 4);
                ctx.bezierCurveTo(-size / 2, size / 2, 0, size * 3 / 4, 0, size);
                ctx.bezierCurveTo(0, size * 3 / 4, size / 2, size / 2, size / 2, size / 4);
                ctx.bezierCurveTo(size / 2, 0, 0, 0, 0, size / 4);
                ctx.fill();
                ctx.restore();
            }
        }
    }
}
