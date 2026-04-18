import { Hero } from '../Hero.js';

/**
 * 赌徒英雄类
 */
export class Gambler extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '赌徒';
        this.color = '#2e8b57'; // 深绿色赌场桌布质感
        this.hp = 100;
        this.maxHp = 100;
        this.baseSpeed = 65;
        
        // 赌徒特有属性
        this.cards = [];
        
        // 投掷相关计时器
        this.rollTimer = 4.0; // 默认 4 秒投掷一次
        this.isRolling = false;
        this.rollAnimationTime = 0;
        this.currentRollValue = 0;
        
        // 连点机制
        this.lastRollValue = 0;
        this.streak = 0;
        
        // 单发卡牌发射队列
        this.singleCardQueue = [];
        this.cardEmitTimer = 0;
        
        // 音效
        this.rollAudio = new Audio('/assets/audio/Gambler/摇骰子.mp3'); 
        this.cardShootAudioSrc = '/assets/audio/Gambler/发射卡牌.mp3';
        this.cardHitAudioSrc = '/assets/audio/Gambler/卡牌命中.mp3';
        this.awakenAudio = new Audio('/assets/audio/Gambler/赌神.mp3');
        this.victoryAudio = new Audio('/assets/audio/Gambler/擦皮鞋.mp3');
    }

    /**
     * 被动技能：觉醒持续 6 秒
     */
    applyPassives() {
        super.applyPassives();
        if (this.isAwakened) {
            this.awakenTimer -= this.game.lastDt;
            if (this.awakenTimer <= 0) {
                this.isAwakened = false;
            }
        }
    }

    /**
     * 更新赌徒特有逻辑
     */
    updateSpecific(dt) {
        if (this.isDead) return;
        
        // 处理投掷冷却
        if (!this.isRolling && this.rollTimer > 0) {
            this.rollTimer -= dt;
            if (this.rollTimer <= 0) {
                this.startRolling();
            }
        }
        
        // 处理投掷动画期间
        if (this.isRolling) {
            let prevTime = this.rollAnimationTime;
            this.rollAnimationTime += dt;
            
            // 在 0.8s 完成滚动并锁定点数，此时开始发射卡牌
            if (prevTime < 0.8 && this.rollAnimationTime >= 0.8) {
                this.queueCards();
                this.game.addFloatingText(this.x, this.y - 50, `点数: ${this.currentRollValue} (连击x${this.streak})`, '#fff');
            }
            
            // 动画总时长 1.1s (0.1等待 + 0.7滚动 + 0.3展示)
            if (this.rollAnimationTime >= 1.1) {
                this.isRolling = false;
                // 扣除动画已消耗的 1.1s，使得总周期（冷却 + 动画）严格等于 4s 或 2s
                this.rollTimer = (this.isAwakened ? 2.0 : 4.0) - 1.1;
            }
        }
        
        // 处理卡牌单发队列
        if (this.singleCardQueue.length > 0) {
            this.cardEmitTimer -= dt;
            if (this.cardEmitTimer <= 0) {
                const cardInfo = this.singleCardQueue.shift();
                this.emitSingleCard(cardInfo.isSix);
                this.cardEmitTimer = 0.08; // 单张卡牌发射间隔 0.08 秒
            }
        }
        
        // 更新飞行中的卡牌
        for (let i = this.cards.length - 1; i >= 0; i--) {
            const card = this.cards[i];
            
            // 卡牌 100% 追踪必中逻辑
            if (this.enemy && !this.enemy.isDead) {
                const dx = this.enemy.x - card.x;
                const dy = this.enemy.y - card.y;
                const dist = Math.hypot(dx, dy);
                
                // 距离小于一定值或接近命中时减速并吸附
                const timeToHit = dist / card.speed;
                if (timeToHit <= 0.1) {
                    card.speed = Math.max(card.speed * 0.8, 100);
                }
                
                const angle = Math.atan2(dy, dx);
                card.vx = Math.cos(angle) * card.speed;
                card.vy = Math.sin(angle) * card.speed;
                
                // 碰撞检测
                if (this.game.physics.checkCircleCollision(card, this.enemy)) {
                    this.onCardHit(this.enemy, card);
                    this.cards.splice(i, 1);
                    continue;
                }
            }
            
            card.x += card.vx * dt;
            card.y += card.vy * dt;
            card.angle += 15 * dt; // 旋转动画
            
            // 清除飞出屏幕的卡牌
            if (card.x < 0 || card.x > this.game.width || card.y < 0 || card.y > this.game.height) {
                this.cards.splice(i, 1);
            }
        }
    }
    
    startRolling() {
        this.isRolling = true;
        this.rollAnimationTime = 0; // 投掷动画时间轴归零
        
        // 预先决定投掷点数
        let d = Math.floor(Math.random() * 6) + 1; // 1~6
        
        // 觉醒状态下必定为6
        if (this.isAwakened && this.awakenRollsLeft > 0) {
            d = 6;
            this.awakenRollsLeft--;
        }
        this.currentRollValue = d;
        
        // 连点机制判断
        if (d === this.lastRollValue) {
            this.streak = Math.min(this.streak + 1, 3);
        } else {
            this.streak = 1;
        }
        this.lastRollValue = d;
        
        // 播放投掷音效
        if (this.rollAudio) {
            this.rollAudio.currentTime = 0;
            this.rollAudio.play().catch(e => console.warn('Roll audio failed:', e));
        }
    }
    
    queueCards() {
        // 压入发射队列
        for (let s = 0; s < this.streak; s++) {
            for (let i = 0; i < this.currentRollValue; i++) {
                this.singleCardQueue.push({ isSix: this.currentRollValue === 6 });
            }
        }
        // 重置发射计时器，使得首张卡牌能在极短时间内（0.1s内）发出
        this.cardEmitTimer = 0.05; 
    }
    
    emitSingleCard(isSix) {
        if (!this.enemy || this.enemy.isDead) return;
        
        // 水平初速度为基础，垂直随机偏移±5°
        const baseAngle = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
        const offsetAngle = (Math.random() * 10 - 5) * Math.PI / 180;
        const finalAngle = baseAngle + offsetAngle;
        
        // 发射音效 (动态创建 Audio 实例以支持高并发多实例重叠播放)
        const shootSnd = new Audio(this.cardShootAudioSrc);
        shootSnd.play().catch(e => console.warn('Card shoot audio play failed:', e));
        
        this.cards.push({
            x: this.x,
            y: this.y,
            vx: Math.cos(finalAngle) * 450,
            vy: Math.sin(finalAngle) * 450,
            speed: 450,
            radius: 10,
            angle: finalAngle,
            isSix: isSix
        });
    }
    
    onCardHit(target, card) {
        if (target.isDead || target.invincibleTime > 0) return;
        
        // 击中音效 (动态创建以支持多卡牌同时命中时叠加播放)
        const hitSnd = new Audio(this.cardHitAudioSrc);
        hitSnd.play().catch(e => console.warn('Card hit audio play failed:', e));
        
        // 基础伤害恒定：自身血量在 40 以下时为 4 点，否则为 3 点
        const damage = this.hp < 40 ? 4 : 3;
        target.takeDamage(damage, this.x, this.y);
        this.spawnHitParticles(target.x, target.y);
        
        // 点数 6 附加减速效果
        if (card.isSix) {
            // 线性衰减：移速-20%，持续1s，每次刷新持续时间
            target.addBuff('gambler_slow', 'slow', 0.2, 1.0, { decay: true });
        }
    }

    /**
     * 觉醒逻辑
     */
    onAwaken() {
        super.onAwaken();
        this.awakenTimer = 6.0; // 持续 6 秒
        this.awakenRollsLeft = 3; // 接下来的 3 次投掷必定为 6
        
        // 如果正在冷却中，立刻缩短剩余冷却时间适应觉醒的 2 秒节奏
        if (!this.isRolling) {
            // 如果剩余冷却时间大于 0.9秒 (2.0-1.1)，强制截断为 0.9秒，让他能马上接上下一次投掷
            if (this.rollTimer > 0.9) {
                this.rollTimer = 0.9;
            }
        }
    }
    
    playAwakenAudio() {
        if (this.awakenAudio) {
            this.awakenAudio.currentTime = 0;
            this.awakenAudio.play().catch(e => console.warn('Audio play failed:', e));
        }
    }
    
    playVictoryAudio() {
        if (this.victoryAudio) {
            this.victoryAudio.currentTime = 0;
            this.victoryAudio.play().catch(e => console.warn('Victory audio play failed:', e));
        }
    }
    
    stopAllAudio() {
        if (this.rollAudio) {
            this.rollAudio.pause();
            this.rollAudio.currentTime = 0;
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

    /**
     * 基础碰撞：对敌方造成 1 点伤害
     */
    onCollide(other) {
        if (other.isDead || other.invincibleTime > 0) return;
        
        // 增加内置冷却防止一帧内高频触发导致瞬杀
        const now = performance.now();
        if (!this.lastMeleeHitTime || now - this.lastMeleeHitTime > 200) {
            other.takeDamage(1 * this.damageMultiplier, this.x, this.y);
            this.spawnHitParticles(other.x, other.y);
            this.lastMeleeHitTime = now;
        }
    }
    
    spawnHitParticles(x, y) {
        for (let i = 0; i < 5; i++) {
            this.game.addParticle({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 100, vy: (Math.random() - 0.5) * 100,
                color: '#fff', life: 0.5, size: 2
            });
        }
    }

    /**
     * 绘制赌徒及其卡牌/骰子
     */
    draw(ctx) {
        super.draw(ctx);
        
        ctx.save();
        // 绘制飞行中的卡牌
        for (const card of this.cards) {
            ctx.translate(card.x, card.y);
            ctx.rotate(card.angle);
            
            // 重新设计卡牌贴图：降低饱和度，加入浅浮雕花纹
            ctx.fillStyle = card.isSix ? '#cdae5a' : '#d0d0d0'; // 降低饱和度的主色
            ctx.fillRect(-8, -12, 16, 24);
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
            ctx.strokeRect(-8, -12, 16, 24);
            
            // 浅浮雕中央对称纹样
            ctx.fillStyle = card.isSix ? '#a88a40' : '#a0a0a0';
            ctx.beginPath();
            ctx.moveTo(0, -6);
            ctx.lineTo(4, 0);
            ctx.lineTo(0, 6);
            ctx.lineTo(-4, 0);
            ctx.fill();
            
            ctx.rotate(-card.angle);
            ctx.translate(-card.x, -card.y);
        }
        
        // 绘制头顶的骰子独立特效
        if (this.isRolling && !this.isDead) {
            ctx.translate(this.x, this.y - 40);
            
            let scale = 1;
            let rotX = 0, rotY = 0, rotZ = 0;
            let showResult = false;
            
            // 0 ~ 0.1s: 准备/放大阶段
            if (this.rollAnimationTime < 0.1) {
                scale = this.rollAnimationTime / 0.1;
            } 
            // 0.1s ~ 0.8s: 3D立体滚动阶段
            else if (this.rollAnimationTime < 0.8) {
                const t = (this.rollAnimationTime - 0.1) / 0.7; // 归一化 0~1
                rotX = t * Math.PI * 8; // 多圈旋转
                rotY = t * Math.PI * 6;
                rotZ = t * Math.PI * 4;
                
                const jumpHeight = Math.sin(t * Math.PI) * 20;
                ctx.translate(0, -jumpHeight);
            } 
            // 0.8s ~ 1.1s: 定格、放大+发光展示最终点数
            else {
                showResult = true;
                const t = (this.rollAnimationTime - 0.8) / 0.3; // 归一化 0~1
                scale = 1 + Math.sin(t * Math.PI) * 0.5; // 放大展示
                
                // 仅在前一半时间显示发光
                if (t < 0.5) {
                    ctx.shadowColor = '#fff';
                    ctx.shadowBlur = 20 * Math.sin(t * Math.PI);
                }
                
                // 定格最终点数的角度（平视）
                rotX = 0;
                rotY = 0;
                rotZ = 0;
            }
            
            ctx.scale(scale, scale);
            
            // ==========================================
            // 3D 骰子渲染逻辑 (使用简易的投射几何实现伪 3D)
            // ==========================================
            const s = 15; // 骰子半边长
            
            // 预定义一个标准的 3D 立方体的 8 个顶点和 6 个面
            const vertices = [
                {x: -s, y: -s, z: -s}, {x: s, y: -s, z: -s}, {x: s, y: s, z: -s}, {x: -s, y: s, z: -s}, // 前面 0 1 2 3
                {x: -s, y: -s, z: s},  {x: s, y: -s, z: s},  {x: s, y: s, z: s},  {x: -s, y: s, z: s}   // 后面 4 5 6 7
            ];
            
            const faces = [
                { id: 1, v: [0, 1, 2, 3] }, // 前 (点数1/最终点数)
                { id: 6, v: [5, 4, 7, 6] }, // 后
                { id: 2, v: [4, 0, 3, 7] }, // 左
                { id: 5, v: [1, 5, 6, 2] }, // 右
                { id: 3, v: [4, 5, 1, 0] }, // 上
                { id: 4, v: [3, 2, 6, 7] }  // 下
            ];
            
            // 根据当前的角度进行 3D 旋转计算
            const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
            const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
            const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);
            
            const projectedVertices = vertices.map(v => {
                // 绕 X 轴
                let y1 = v.y * cosX - v.z * sinX;
                let z1 = v.y * sinX + v.z * cosX;
                // 绕 Y 轴
                let x2 = v.x * cosY + z1 * sinY;
                let z2 = -v.x * sinY + z1 * cosY;
                // 绕 Z 轴
                let x3 = x2 * cosZ - y1 * sinZ;
                let y3 = x2 * sinZ + y1 * cosZ;
                
                return { x: x3, y: y3, z: z2 };
            });
            
            // 计算面的法向量 (Z轴朝向)，并按 Z 深度排序实现画家算法
            faces.forEach(face => {
                const p0 = projectedVertices[face.v[0]];
                const p1 = projectedVertices[face.v[1]];
                const p2 = projectedVertices[face.v[2]];
                // 计算法线 Z 分量 (叉乘)
                face.nz = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
                // 计算中心深度用于排序
                face.depth = (p0.z + p1.z + p2.z + projectedVertices[face.v[3]].z) / 4;
            });
            
            faces.sort((a, b) => b.depth - a.depth);
            
            // 绘制所有朝向屏幕的面 (nz > 0)
            faces.forEach(face => {
                if (face.nz > 0) {
                    ctx.beginPath();
                    ctx.moveTo(projectedVertices[face.v[0]].x, projectedVertices[face.v[0]].y);
                    for (let i = 1; i < 4; i++) {
                        ctx.lineTo(projectedVertices[face.v[i]].x, projectedVertices[face.v[i]].y);
                    }
                    ctx.closePath();
                    
                    // 添加一点深度光影感，背面偏灰
                    const brightness = Math.min(255, 200 + face.nz / 50);
                    ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
                    ctx.fill();
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    
                    // 绘制面上的点数
                    ctx.save();
                    
                    // 根据前三个点建立变换矩阵，把 2D 点数映射到 3D 面上
                    const p0 = projectedVertices[face.v[0]];
                    const p1 = projectedVertices[face.v[1]];
                    const p3 = projectedVertices[face.v[3]]; // 左上角
                    
                    // 计算面上局部坐标系的基向量
                    const vx = { x: (p1.x - p0.x) / (2 * s), y: (p1.y - p0.y) / (2 * s) };
                    const vy = { x: (p3.x - p0.x) / (2 * s), y: (p3.y - p0.y) / (2 * s) };
                    
                    // 将坐标系原点移至面的中心
                    const cx = (p0.x + projectedVertices[face.v[2]].x) / 2;
                    const cy = (p0.y + projectedVertices[face.v[2]].y) / 2;
                    
                    ctx.transform(vx.x, vx.y, vy.x, vy.y, cx, cy);
                    
                    ctx.fillStyle = '#000';
                    // 如果展示结果且是正面（id=1），就画最终点数，否则画随机或者面id对应的点数
                    let dotVal = face.id;
                    if (showResult && face.id === 1) dotVal = this.currentRollValue;
                    else if (!showResult) dotVal = (face.id + Math.floor(this.rollAnimationTime * 20)) % 6 + 1;
                    
                    this.drawDiceDots(ctx, dotVal);
                    
                    ctx.restore();
                }
            });
            
            ctx.restore();
        } else {
            ctx.restore();
        }
    }
    
    /**
     * 辅助方法：绘制对应点数的骰子圆点
     */
    drawDiceDots(ctx, val) {
        const dots = [];
        if (val === 1) dots.push([0, 0]);
        if (val === 2) dots.push([-6, -6], [6, 6]);
        if (val === 3) dots.push([-6, -6], [0, 0], [6, 6]);
        if (val === 4) dots.push([-6, -6], [6, -6], [-6, 6], [6, 6]);
        if (val === 5) dots.push([-6, -6], [6, -6], [0, 0], [-6, 6], [6, 6]);
        if (val === 6) dots.push([-6, -8], [6, -8], [-6, 0], [6, 0], [-6, 8], [6, 8]);
        
        for (let pos of dots) {
            ctx.beginPath();
            ctx.arc(pos[0], pos[1], 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
