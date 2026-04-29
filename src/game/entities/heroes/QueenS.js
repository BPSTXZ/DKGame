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
        this.engageDistance = 20; // 边缘距离
        this.lockDistance = 18;   // 边缘距离
        this.slapCooldown = 0;
        this.slapTimer = 0;
        this.slapCount = 0;
        this.hitInterval = 0.2;
        this.slapDamage = 1.5;
        
        // 技能二（小狗狗给我过来）参数
        this.timeSinceLastSlap = 0;
        
        // 觉醒（爱的惩戒）参数
        this.whipInterval = 0.28; // 0.25~0.3s
        this.whipDamage = 5;
        this.whipCount = 0;
        this.whipTimer = 0;
        
        // 状态机
        this.state = 'normal'; 
        // 状态：'normal', 'slapping', 'chain_charging', 'chain_throwing', 'chain_pulling', 'awaken_chain_charging', 'awaken_chain_throwing', 'awaken_chain_pulling', 'awaken_whipping'
        
        // 链条状态
        this.chain = { active: false, length: 0, angle: 0, chargeTime: 0, throwAngle: 0, targetEnemy: false };
        
        // 视觉特效
        this.visualEffects = [];
    }

    onHeroCollision(other) {
        // 碰撞攻击：无
    }

    knockback(kx, ky, speed, duration) {
        // 觉醒期间动作不可被打断（免疫击退）
        if (this.state.startsWith('awaken_')) return;
        super.knockback(kx, ky, speed, duration);
    }

    onAwaken() {
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Awaken: Punishment of Love' });
        }
        this.startChain('awaken');
    }

    startChain(mode) {
        this.state = mode === 'awaken' ? 'awaken_chain_charging' : 'chain_charging';
        this.chain.active = true;
        this.chain.chargeTime = 0;
        this.chain.angle = 0;
        this.chain.length = 0;
    }

    startSlapping() {
        this.state = 'slapping';
        this.slapCount = 0;
        this.slapTimer = 0;
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Rewarding Slap' });
        }
    }

    endSlapping() {
        this.state = 'normal';
        this.slapCooldown = 2.0;
        this.timeSinceLastSlap = 0;

        if (this.enemy && !this.enemy.isDead) {
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
    }

    endAwaken() {
        this.isAwakened = false;
        this.state = 'normal';
        this.slapCooldown = 2.0;
        this.timeSinceLastSlap = 0;
        
        if (this.awakenTimer !== undefined) {
            this.awakenTimer = 0;
        }
        
        if (this.enemy && !this.enemy.isDead) {
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
                    } else if (this.timeSinceLastSlap >= 3.0) {
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

            case 'awaken_whipping':
                this.updateWhipping(dt);
                break;
        }

        // 更新特效
        for (let i = this.visualEffects.length - 1; i >= 0; i--) {
            const e = this.visualEffects[i];
            e.life -= dt;
            if (e.type === 'heart') {
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
        const targetDist = this.radius + this.enemy.radius + targetGap;
        
        let ex = this.x + Math.cos(angle) * targetDist;
        let ey = this.y + Math.sin(angle) * targetDist;
        
        ex = Math.max(this.enemy.radius, Math.min(this.game.width - this.enemy.radius, ex));
        ey = Math.max(this.enemy.radius, Math.min(this.game.height - this.enemy.radius, ey));
        
        this.enemy.x = ex;
        this.enemy.y = ey;
        this.enemy.vx = 0;
        this.enemy.vy = 0;
        
        return angle;
    }

    updateSlapping(dt) {
        const angle = this.forceEnemyPosition(this.lockDistance);
        if (angle === false) {
            this.endSlapping();
            return;
        }

        this.slapTimer += dt;
        if (this.slapTimer >= this.hitInterval) {
            this.slapTimer -= this.hitInterval;
            this.slapCount++;
            
            this.enemy.takeDamage(this.slapDamage, this.x, this.y);
            
            const isLeft = this.slapCount % 2 === 0;
            this.createSlapEffect(this.enemy.x, this.enemy.y, angle, isLeft);
            
            if (this.slapCount >= 6) {
                this.endSlapping();
            }
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
                this.state = this.state === 'awaken_chain_throwing' ? 'awaken_chain_pulling' : 'chain_pulling';
                return;
            }
        }
        
        // 失败判定
        const maxChainLength = Math.hypot(this.game.width, this.game.height);
        if (this.chain.length >= maxChainLength || chainTipX < 0 || chainTipX > this.game.width || chainTipY < 0 || chainTipY > this.game.height) {
            this.state = 'normal';
            this.chain.active = false;
            this.timeSinceLastSlap = 0; // 回收消失，重新进入计时
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
        const targetDist = this.radius + this.enemy.radius + this.lockDistance;
        
        if (dist <= targetDist) {
            // 拉到位
            this.chain.active = false;
            if (this.state === 'awaken_chain_pulling') {
                this.startWhipping();
            } else {
                this.startSlapping();
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

    updateWhipping(dt) {
        const angle = this.forceEnemyPosition(this.lockDistance);
        if (angle === false) {
            this.endAwaken();
            return;
        }

        this.whipTimer += dt;
        if (this.whipTimer >= this.whipInterval) {
            this.whipTimer -= this.whipInterval;
            this.whipCount++;
            
            this.enemy.takeDamage(this.whipDamage, this.x, this.y);
            
            this.createWhipEffect(this.enemy.x, this.enemy.y, angle);
            this.createHeartEffect(this.enemy.x, this.enemy.y);
            
            if (this.whipCount >= 6) {
                this.endAwaken();
            }
        }
    }

    createSlapEffect(x, y, angle, isLeft) {
        const offsetAngle = angle + (isLeft ? -Math.PI/2 : Math.PI/2);
        const startX = x + Math.cos(offsetAngle) * 40;
        const startY = y + Math.sin(offsetAngle) * 40;
        
        this.visualEffects.push({
            type: 'slap',
            x: startX, y: startY,
            targetX: x, targetY: y,
            life: 0.15, maxLife: 0.15
        });
        
        this.visualEffects.push({
            type: 'shockwave',
            x: x, y: y,
            life: 0.2, maxLife: 0.2,
            maxRadius: 50
        });
    }

    createWhipEffect(x, y, angle) {
        this.visualEffects.push({
            type: 'whip',
            startX: this.x, startY: this.y,
            endX: x, endY: y,
            life: 0.3, maxLife: 0.3
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
        ctx.strokeStyle = '#1a001a';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
    }

    draw(ctx) {
        super.draw(ctx);
        
        if (this.isDead) return;

        // 绘制链条
        if (this.chain.active) {
            ctx.save();
            ctx.strokeStyle = '#a9a9a9'; // 银色链条
            ctx.lineWidth = 4;
            ctx.beginPath();
            
            if (this.state === 'chain_charging' || this.state === 'awaken_chain_charging') {
                const cx = this.x + Math.cos(this.chain.angle) * (this.radius + 15);
                const cy = this.y + Math.sin(this.chain.angle) * (this.radius + 15);
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(cx, cy);
                ctx.stroke();
                
                // 绘制项圈末端
                ctx.beginPath();
                ctx.fillStyle = '#333';
                ctx.arc(cx, cy, 8, 0, Math.PI * 2);
                ctx.fill();
            } else {
                const cx = this.x + Math.cos(this.chain.throwAngle) * this.chain.length;
                const cy = this.y + Math.sin(this.chain.throwAngle) * this.chain.length;
                
                // 甩动过程中的摆动形变
                if (this.state === 'chain_throwing' || this.state === 'awaken_chain_throwing') {
                    const midX = (this.x + cx) / 2;
                    const midY = (this.y + cy) / 2;
                    const wobble = Math.sin(Date.now() / 50) * 30;
                    const perpAngle = this.chain.throwAngle + Math.PI / 2;
                    ctx.moveTo(this.x, this.y);
                    ctx.quadraticCurveTo(
                        midX + Math.cos(perpAngle) * wobble, 
                        midY + Math.sin(perpAngle) * wobble, 
                        cx, cy
                    );
                } else {
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(cx, cy);
                }
                ctx.stroke();
                
                ctx.beginPath();
                ctx.fillStyle = '#333';
                ctx.arc(cx, cy, 8, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // 绘制特效
        for (const e of this.visualEffects) {
            if (e.type === 'slap') {
                ctx.save();
                ctx.strokeStyle = `rgba(255, 255, 255, ${e.life / e.maxLife})`;
                ctx.lineWidth = 8;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(e.targetX, e.targetY);
                ctx.stroke();
                ctx.restore();
            } else if (e.type === 'shockwave') {
                ctx.save();
                ctx.strokeStyle = `rgba(255, 255, 255, ${e.life / e.maxLife})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                const r = (1 - e.life / e.maxLife) * e.maxRadius;
                ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            } else if (e.type === 'whip') {
                ctx.save();
                ctx.strokeStyle = `rgba(139, 0, 0, ${e.life / e.maxLife})`;
                ctx.lineWidth = 6;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(e.startX, e.startY);
                const midX = (e.startX + e.endX) / 2;
                const midY = (e.startY + e.endY) / 2 - 80;
                ctx.quadraticCurveTo(midX, midY, e.endX, e.endY);
                ctx.stroke();
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
