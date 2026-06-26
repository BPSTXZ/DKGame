import { Hero } from '../Hero.js';

export class Kettle extends Hero {
    constructor(x, y, playerId) {
        super(x, y, playerId);
        this.name = '烧水壶';
        this.maxHp = 100;
        this.hp = 100;
        this.baseSpeed = 60;
        this.color = '#666666'; 
        
        // 图片素材
        this.imgNormal = new Image();
        this.imgNormal.src = import.meta.env.BASE_URL + 'assets/img/Kettle/1.png';
        this.imgBoil = new Image();
        this.imgBoil.src = import.meta.env.BASE_URL + 'assets/img/Kettle/2.png';
        
        // 水温机制
        this.temperature = 27; // 基础水温
        this.maxTemp = 100;
        this.timeElapsed = 0; // 累计时间
        this.isBoiling = false; // 沸腾姿态
        
        // 碰撞
        this.lastCollisionTime = 0;
        
        // 溅射粒子
        this.splashParticles = [];
        
        // 技能一：喝开水吗？倒水状态
        this.pourTimer = 0;
        this.isPouring = false;
        this.pourActive = false;
        this.pourCooldown = 0; // 倒水冷却（2s），期间不会再次触发X轴锁定
        
        // 觉醒计时
        this.awakenTimer = 0;
        this.preAwakenTemp = 27;
        
        // 沸腾水花
        this.boilSparks = [];
        
        // 抖动
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        
        // 音效配置
        this.heatAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/Kettle/持续烧水.mp3');
        this.heatAudio.loop = true;
        this.heatAudio.volume = 0;
        this.heatStarted = false;
        
        this.pourAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/Kettle/倒水.mp3');
        
        this.boilPreAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/Kettle/沸腾前奏.mp3');
        this.boilPrePlayed = false;
        
        this.boilAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/Kettle/沸腾.mp3');
        this.boilAudio.loop = true;
        this.boilAudioStarted = false;
    }
    
    /**
     * 获取当前基于水温的伤害加成
     * 基础伤害1，最高8
     */
    getCurrentDamage() {
        if (this.temperature <= 27) return 4;
        const ratio = (this.temperature - 27) / (100 - 27);
        return Math.min(12, 4 + ratio * (12 - 4));
    }
    
    /**
     * 获取溅射伤害（当前伤害的一半）
     */
    getSplashDamage() {
        return this.getCurrentDamage() / 2;
    }
    
    /**
     * 触发溅射效果
     */
    triggerSplash(x, y) {
        if (!this.game) return;
        
        // 热水溅射粒子
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 50 + 20;
            this.game.addParticle({
                x: x + Math.cos(angle) * dist * 0.3,
                y: y + Math.sin(angle) * dist * 0.3,
                vx: Math.cos(angle) * 120,
                vy: Math.sin(angle) * 120 - 30,
                color: this.isBoiling ? '#ff4500' : '#00bfff',
                life: 0.4 + Math.random() * 0.2,
                size: Math.random() * 5 + 3,
                alpha: 0.6
            });
        }
        
        // 蒸汽上升
        for (let i = 0; i < 6; i++) {
            this.game.addParticle({
                x: x + (Math.random() - 0.5) * 20,
                y: y - Math.random() * 10,
                vx: (Math.random() - 0.5) * 30,
                vy: -Math.random() * 60 - 20,
                color: 'rgba(255, 255, 255, 0.3)',
                life: 0.5 + Math.random() * 0.3,
                size: Math.random() * 8 + 4
            });
        }
        
        // 对周围敌方的溅射伤害
        if (this.enemy && !this.enemy.isDead) {
            const dist = Math.hypot(this.enemy.x - x, this.enemy.y - y);
            if (dist < 100) {
                this.enemy.takeDamage(this.getSplashDamage() * this.damageMultiplier, x, y);
            }
        }
    }
    
    onHeroCollision(other) {
        super.onHeroCollision(other);
        if (this.isDead || other.isDead) return;
        
        const now = Date.now();
        if (now - this.lastCollisionTime > 1000) {
            this.lastCollisionTime = now;
            
            // 碰撞伤害
            other.takeDamage(this.getCurrentDamage() * this.damageMultiplier, this.x, this.y);
            
            // 热水溅射
            const midX = (this.x + other.x) / 2;
            const midY = (this.y + other.y) / 2;
            this.triggerSplash(midX, midY);
            
            // 震动
            if (this.game && this.game.shakeScreen) {
                this.game.shakeScreen(0.05, 3);
            }
        }
    }
    
    updateSpecific(dt) {
        if (this.isDead) return;
        
        // === 觉醒倒计时 ===
        if (this.isAwakened && this.awakenTimer > 0) {
            this.awakenTimer -= dt;
            // 觉醒期间强制显示100°
            this.temperature = 100;
            if (this.awakenTimer <= 0) {
                // 觉醒结束：恢复到觉醒前的水温
                this.temperature = this.preAwakenTemp;
                this.isBoiling = this.temperature >= 100;
                this.isAwakened = false;
                // 停止沸腾音效，根据温度决定是否恢复加热音效
                if (this.boilAudio) { this.boilAudio.pause(); this.boilAudio.currentTime = 0; }
                this.boilAudioStarted = false;
                if (this.temperature < 100) {
                    this.boilPrePlayed = false;
                    if (this.temperature > 27) {
                        this.heatStarted = false; // 下次循环自动恢复
                    }
                }
            }
        }
        
        // === 水温更新（非觉醒期间） ===
        if (!this.isAwakened) {
            this.timeElapsed += dt;
            if (this.timeElapsed <= 10) {
                this.temperature = Math.min(27 + this.timeElapsed * 2, 100);
            } else {
                this.temperature = Math.min(27 + 20 + (this.timeElapsed - 10) * 3, 100);
            }
        }
        
        // 沸腾姿态判断
        if (this.temperature >= 100 && !this.isBoiling) {
            this.isBoiling = true;
            // 沸腾音效
            if (this.heatAudio) { this.heatAudio.pause(); this.heatAudio.currentTime = 0; }
            if (this.boilAudio && !this.boilAudioStarted) {
                this.boilAudioStarted = true;
                this.boilAudio.currentTime = 0;
                this.boilAudio.play().catch(() => {});
            }
            // 进入沸腾特效
            if (this.game) {
                for (let i = 0; i < 20; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    this.game.addParticle({
                        x: this.x + (Math.random()-0.5)*this.radius,
                        y: this.y - this.radius,
                        vx: Math.cos(angle) * 100,
                        vy: -Math.random() * 150 - 50,
                        color: '#ff4500',
                        life: 0.6, size: 5
                    });
                }
            }
        }
        
        // === 音效更新 ===
        // 1. 持续烧水音效（温度音量）
        if (this.temperature > 27 && !this.isBoiling && this.heatAudio) {
            if (!this.heatStarted) {
                this.heatStarted = true;
                this.heatAudio.currentTime = 0;
                this.heatAudio.play().catch(() => {});
            }
            this.heatAudio.volume = (this.temperature - 27) / (100 - 27);
        }
        // 2. 即将沸腾前3S（温度≥91）播放沸腾前奏
        if (this.temperature >= 91 && !this.boilPrePlayed && this.boilPreAudio && !this.isAwakened) {
            this.boilPrePlayed = true;
            this.boilPreAudio.currentTime = 0;
            this.boilPreAudio.play().catch(() => {});
        }
        
        // 沸腾持续抖动
        if (this.isBoiling) {
            this.shakeOffsetX = (Math.random() - 0.5) * 4;
            this.shakeOffsetY = (Math.random() - 0.5) * 4;
            
            // 沸腾水花向上喷射并扩散AOE
            if (this.game && Math.random() < 0.5) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * 80 + 20;
                this.game.addParticle({
                    x: this.x,
                    y: this.y - this.radius,
                    vx: Math.cos(angle) * 150,
                    vy: -Math.random() * 200 - 100,
                    color: Math.random() > 0.5 ? '#ff4500' : '#ff6347',
                    life: 0.5 + Math.random() * 0.3,
                    size: Math.random() * 6 + 3,
                    alpha: 0.7
                });
            }
            
            // 沸腾持续向四周溅射水花并造成伤害（当前伤害的一半）
            this.boilSplashTimer = (this.boilSplashTimer || 0) + dt;
            if (this.boilSplashTimer >= 0.15 && this.game) {
                this.boilSplashTimer -= 0.15;
                const splashAngle = Math.random() * Math.PI * 2;
                const splashDist = Math.random() * 60 + 40;
                const sx = this.x + Math.cos(splashAngle) * splashDist;
                const sy = this.y + Math.sin(splashAngle) * splashDist;
                // 溅射水花粒子
                this.game.addParticle({
                    x: sx, y: sy,
                    vx: Math.cos(splashAngle) * 40,
                    vy: Math.sin(splashAngle) * 40 - 20,
                    color: '#ff4500',
                    life: 0.3,
                    size: Math.random() * 4 + 2,
                    alpha: 0.6
                });
                // 溅射伤害
                if (this.enemy && !this.enemy.isDead) {
                    const ed = Math.hypot(this.enemy.x - sx, this.enemy.y - sy);
                    if (ed < 80) {
                        this.enemy.takeDamage(this.getSplashDamage() * this.damageMultiplier, sx, sy);
                    }
                }
            }
            
            // 沸腾AOE伤害（每0.5秒）
            this.boilTickTimer = (this.boilTickTimer || 0) + dt;
            if (this.boilTickTimer >= 0.5 && this.enemy && !this.enemy.isDead) {
                this.boilTickTimer -= 0.5;
                const dist = Math.hypot(this.enemy.x - this.x, this.enemy.y - this.y);
                if (dist < 120) {
                    this.enemy.takeDamage((this.getCurrentDamage() / 3) * this.damageMultiplier, this.x, this.y);
                }
            }
        }
        
        // === 技能一：喝开水吗？ ===
        // 冷却递减
        if (this.pourCooldown > 0) {
            this.pourCooldown -= dt;
        }
        
        if (this.enemy && !this.enemy.isDead && !this.isAwakened) {
            const enemyBelow = this.enemy.y > this.y && Math.abs(this.enemy.x - this.x) < 80;
            if (enemyBelow && !this.isPouring && this.pourCooldown <= 0) {
                // 开始倒水，总持续1.2S，水柱向下不再跟踪敌方
                this.isPouring = true;
                this.pourTimer = 1.2;
                this.pourTickTimer = 0;
                this.pourTotalDamage = this.getCurrentDamage();
                this.pourDamageLeft = this.pourTotalDamage * this.damageMultiplier;
                // 倒水音效
                if (this.pourAudio) {
                    this.pourAudio.currentTime = 0;
                    this.pourAudio.play().catch(() => {});
                }
            }
            
            if (this.isPouring) {
                this.pourTimer -= dt;

                // 横向跟踪敌方移动
                const dx = this.enemy.x - this.x;
                this.vx = dx * 3;
                this.vy = 0;

                // 水柱动态长度：从壶嘴延伸到敌方下方
                const pourX = this.x - this.radius * 0.6;
                const pourY = this.y + this.radius * 0.3;
                const dynamicLength = Math.max(80, this.enemy.y - pourY + this.enemy.radius);
                
                // 每0.2S结算一次伤害（水柱垂直向下）
                this.pourTickTimer += dt;
                if (this.pourTickTimer >= 0.2) {
                    this.pourTickTimer -= 0.2;
                    const tickDmg = (this.pourTotalDamage / 6) * this.damageMultiplier;
                    this.pourDamageLeft -= tickDmg;
                    // 敌方在水柱范围内则受伤害
                    const inWaterColumn = this.enemy.x > pourX - 40 && this.enemy.x < pourX + 40
                        && this.enemy.y > pourY && this.enemy.y < pourY + dynamicLength;
                    if (inWaterColumn) {
                        this.enemy.takeDamage(tickDmg, pourX, pourY);
                        
                        // 热水命中敌方视觉效果
                        if (this.game) {
                            this.game.shakeScreen(0.03, 2);
                            const hitX = this.enemy.x;
                            const hitY = this.enemy.y;
                            const hitColor = this.isBoiling ? '#ff4500' : '#00bfff';
                            // 命中爆发粒子
                            for (let i = 0; i < 10; i++) {
                                const a = Math.random() * Math.PI * 2;
                                this.game.addParticle({
                                    x: hitX, y: hitY,
                                    vx: Math.cos(a) * (60 + Math.random() * 80),
                                    vy: Math.sin(a) * (60 + Math.random() * 80) - 30,
                                    color: hitColor,
                                    life: 0.3 + Math.random() * 0.2,
                                    size: Math.random() * 5 + 3,
                                    alpha: 0.8
                                });
                            }
                            // 蒸汽上升
                            for (let i = 0; i < 6; i++) {
                                this.game.addParticle({
                                    x: hitX + (Math.random() - 0.5) * 30,
                                    y: hitY - Math.random() * 20,
                                    vx: (Math.random() - 0.5) * 20,
                                    vy: -Math.random() * 60 - 30,
                                    color: 'rgba(255, 255, 255, 0.4)',
                                    life: 0.4 + Math.random() * 0.3,
                                    size: Math.random() * 6 + 3
                                });
                            }
                            // 水花浇灌效果：水流冲击敌方身体，向四周溅射并沿身体流下
                            const hitEnemy = this.enemy;
                            const eRadius = hitEnemy.radius || this.radius;
                            for (let i = 0; i < 20; i++) {
                                const splashAngle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI; // 向下半圆溅射
                                const splashSpeed = 40 + Math.random() * 100;
                                this.game.addParticle({
                                    x: hitX, y: hitY,
                                    vx: Math.cos(splashAngle) * splashSpeed,
                                    vy: Math.sin(splashAngle) * splashSpeed,
                                    color: hitColor,
                                    life: 0.25 + Math.random() * 0.2,
                                    size: Math.random() * 4 + 2,
                                    alpha: 0.75
                                });
                            }
                            // 沿敌方身体流下的水滴
                            for (let i = 0; i < 8; i++) {
                                const dripAngle = Math.random() * Math.PI * 2;
                                const dripX = hitX + Math.cos(dripAngle) * eRadius * 0.7;
                                const dripY = hitY + Math.sin(dripAngle) * eRadius * 0.3;
                                this.game.addParticle({
                                    x: dripX, y: dripY,
                                    vx: (Math.random() - 0.5) * 30,
                                    vy: 40 + Math.random() * 80,
                                    color: hitColor,
                                    life: 0.35 + Math.random() * 0.25,
                                    size: Math.random() * 3 + 2,
                                    alpha: 0.65
                                });
                            }
                            // 地面溅起的小水花
                            for (let i = 0; i < 10; i++) {
                                const groundX = hitX + (Math.random() - 0.5) * 50;
                                this.game.addParticle({
                                    x: groundX, y: hitY + eRadius * 0.9,
                                    vx: (Math.random() - 0.5) * 60,
                                    vy: -Math.random() * 50 - 10,
                                    color: 'rgba(255, 255, 255, 0.5)',
                                    life: 0.2 + Math.random() * 0.15,
                                    size: Math.random() * 3 + 2,
                                    alpha: 0.5
                                });
                            }
                        }
                    }
                    
                    // 水柱下落粒子（沿水柱路径）
                    if (this.game) {
                        const color = this.isBoiling ? '#ff4500' : '#00bfff';
                        for (let i = 0; i < 15; i++) {
                            const px = pourX + (Math.random() - 0.5) * 20;
                            const py = pourY + Math.random() * 60;
                            this.game.addParticle({
                                x: px, y: py,
                                vx: (Math.random() - 0.5) * 15,
                                vy: Math.random() * 80 + 120,
                                color: color,
                                life: 0.3 + Math.random() * 0.2,
                                size: Math.random() * 5 + 3,
                                alpha: 0.7
                            });
                        }
                    }
                }
                
                if (this.pourTimer <= 0) {
                    this.isPouring = false;
                    this.pourCooldown = 2.0; // 冷却2s，避免重复X轴锁定
                    this.randomizeDirection();
                }
            }
        }
        
        // === 觉醒效果：全场水花溅射 ===
        if (this.isAwakened && this.awakenTimer > 0 && this.enemy && !this.enemy.isDead && this.game) {
            this.awakenSplashTimer = (this.awakenSplashTimer || 0) + dt;
            if (this.awakenSplashTimer >= 0.5) {
                this.awakenSplashTimer -= 0.5;
                // 全场覆盖：从壶体向全场喷射大量水花粒子
                const fieldW = this.game.width;
                const fieldH = this.game.height;
                for (let i = 0; i < 30; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 80 + Math.random() * 400;
                    this.game.addParticle({
                        x: this.x + Math.cos(angle) * 20,
                        y: this.y + Math.sin(angle) * 20,
                        vx: Math.cos(angle) * dist,
                        vy: Math.sin(angle) * dist - 50 + Math.random() * 100,
                        color: Math.random() > 0.5 ? '#ff4500' : '#ff6347',
                        life: 0.5 + Math.random() * 0.5,
                        size: Math.random() * 6 + 4,
                        alpha: 0.7
                    });
                }
                // 蒸汽弥漫全场
                for (let i = 0; i < 12; i++) {
                    const steamX = Math.random() * fieldW;
                    const steamY = fieldH * 0.5 + Math.random() * fieldH * 0.5;
                    this.game.addParticle({
                        x: steamX, y: steamY,
                        vx: (Math.random() - 0.5) * 30,
                        vy: -Math.random() * 80 - 40,
                        color: 'rgba(255, 255, 255, 0.3)',
                        life: 0.6 + Math.random() * 0.5,
                        size: Math.random() * 10 + 6
                    });
                }
                // 敌方必定受到溅射烫伤（伤害为当前伤害的10%）
                this.enemy.takeDamage(
                    this.getCurrentDamage() * 0.1 * this.damageMultiplier,
                    this.enemy.x,
                    this.enemy.y
                );
                // 敌方命中视觉效果
                this.game.shakeScreen(0.03, 2);
                const hitColor = '#ff4500';
                const ex = this.enemy.x;
                const ey = this.enemy.y;
                for (let i = 0; i < 12; i++) {
                    const a = Math.random() * Math.PI * 2;
                    this.game.addParticle({
                        x: ex, y: ey,
                        vx: Math.cos(a) * (80 + Math.random() * 120),
                        vy: Math.sin(a) * (80 + Math.random() * 120) - 40,
                        color: hitColor,
                        life: 0.3 + Math.random() * 0.2,
                        size: Math.random() * 6 + 3,
                        alpha: 0.85
                    });
                }
            }
        }
        
        // 更新溅射粒子生命周期
        for (let i = this.splashParticles.length - 1; i >= 0; i--) {
            this.splashParticles[i].life -= dt;
            if (this.splashParticles[i].life <= 0) {
                this.splashParticles.splice(i, 1);
            }
        }
    }
    
    randomizeDirection() {
        const angle = Math.random() * Math.PI * 2;
        const speed = this.getSpeed();
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
    }
    
    onAwaken() {
        // 保存觉醒前水温，觉醒期间强制100°
        this.preAwakenTemp = this.temperature;
        this.temperature = 100;
        this.isBoiling = true;
        this.awakenTimer = 5.0; // 觉醒持续5秒
        
        // 停止加热音效，播放沸腾
        if (this.heatAudio) { this.heatAudio.pause(); this.heatAudio.currentTime = 0; }
        if (this.boilAudio && !this.boilAudioStarted) {
            this.boilAudioStarted = true;
            this.boilAudio.currentTime = 0;
            this.boilAudio.play().catch(() => {});
        }
        
        if (this.game) {
            this.game.logEvent('skill', { heroId: this.playerId, skill: 'Awaken: 瞬时沸腾' });
            this.game.shakeScreen(0.2, 8);
            
            // 华丽爆发
            for (let i = 0; i < 40; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * 150 + 50;
                this.game.addParticle({
                    x: this.x, y: this.y,
                    vx: Math.cos(angle) * dist,
                    vy: Math.sin(angle) * dist - 50,
                    color: Math.random() > 0.5 ? '#ff4500' : '#ff0000',
                    life: 0.8, size: Math.random() * 8 + 4,
                    alpha: 0.8
                });
            }
        }
    }
    
    drawBody(ctx) {
        ctx.save();
        
        // 应用抖动偏移
        if (this.isBoiling) {
            ctx.translate(this.shakeOffsetX, this.shakeOffsetY);
        }
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.clip();
        
        const currentImg = this.isBoiling ? this.imgBoil : this.imgNormal;
        if (currentImg.complete) {
            ctx.drawImage(currentImg, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
        } else {
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.playerId === 1 ? '#ff4444' : '#4444ff';
        ctx.stroke();
        
        // 如果正在倒水，绘制倾斜效果（通过旋转实现）
        // 倾斜由 drawWeapon 处理，这里只做外观
        
        ctx.restore();
    }
    
    /**
     * 绘制武器（壶嘴倾斜倒水效果）
     */
    drawWeapon(ctx) {
        // 倒水状态：壶体轻微倾斜，向下浇水
        // 实际倾斜由 drawBody 中通过 visualRotation 控制，这里绘制倒出的水柱
    }
    
    draw(ctx) {
        // 倒水时壶体倾斜：壶嘴（左侧）向下倾斜30度，模拟倒水效果
        if (this.isPouring && !this.isDead) {
            this.visualRotation = -Math.PI / 6; // 向左倾斜30度（壶嘴侧朝下）
        } else if (!this.isDead) {
            this.visualRotation = 0;
        }
        super.draw(ctx);
    }
    
    drawOverlay(ctx) {
        super.drawOverlay(ctx);
        
        // 绘制倒水水流（从壶嘴垂直向下，长度随敌方距离动态变化）
        if (this.isPouring && !this.isDead && this.enemy && !this.enemy.isDead) {
            ctx.save();
            const spoutX = this.x - this.radius * 0.6;
            const spoutY = this.y + this.radius * 0.3;
            // 水柱动态长度：从壶嘴延伸到敌方位置，最低80
            const waterLength = Math.max(80, this.enemy.y - spoutY + this.enemy.radius);

            ctx.translate(spoutX, spoutY);

            // 水柱颜色随水温渐变：低温蓝色 → 高温红色
            const tRatio = Math.min(1, Math.max(0, (this.temperature - 27) / (100 - 27)));
            const wr = Math.round(0 + 255 * tRatio);
            const wg = Math.round(191 - 191 * tRatio);
            const wb = Math.round(255 - 255 * tRatio);
            const waterColor = `rgba(${wr}, ${wg}, ${wb}, `;
            const now = Date.now() / 1000;

            // === 外层宽水柱（扇形扩散） ===
            const outerGrad = ctx.createLinearGradient(0, 0, 0, waterLength);
            outerGrad.addColorStop(0, waterColor + '0.5)');
            outerGrad.addColorStop(0.3, waterColor + '0.3)');
            outerGrad.addColorStop(0.7, waterColor + '0.1)');
            outerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = outerGrad;
            ctx.beginPath();
            ctx.moveTo(-5, 0);
            ctx.lineTo(-55, waterLength);
            ctx.lineTo(55, waterLength);
            ctx.lineTo(5, 0);
            ctx.closePath();
            ctx.fill();

            // === 内层核心水流（带波动） ===
            const innerGrad = ctx.createLinearGradient(0, 0, 0, waterLength);
            innerGrad.addColorStop(0, waterColor + '0.9)');
            innerGrad.addColorStop(0.3, waterColor + '0.6)');
            innerGrad.addColorStop(0.8, waterColor + '0.1)');
            innerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = innerGrad;
            ctx.beginPath();
            // 核心水流带正弦波动，模拟水柱摆动
            ctx.moveTo(-2, 0);
            for (let i = 0; i <= 20; i++) {
                const t = i / 20;
                const y = t * waterLength;
                const waveX = Math.sin(y * 0.04 + now * 8) * 4 * t + Math.sin(y * 0.07 + now * 5) * 3 * t;
                ctx.lineTo(-4 + waveX, y);
            }
            for (let i = 20; i >= 0; i--) {
                const t = i / 20;
                const y = t * waterLength;
                const waveX = Math.sin(y * 0.04 + now * 8) * 4 * t + Math.sin(y * 0.07 + now * 5) * 3 * t;
                ctx.lineTo(4 + waveX, y);
            }
            ctx.closePath();
            ctx.fill();

            // === 水流波纹高光段（沿水柱分布） ===
            const flowSpeed = waterLength * 0.8; // 流速适配水柱长度
            const flowDist = (now * flowSpeed) % waterLength;
            for (let i = 0; i < 8; i++) {
                const ty = (flowDist + i * 25) % waterLength;
                const tRatio = ty / waterLength;
                ctx.fillStyle = `rgba(255, 255, 255, ${0.35 - tRatio * 0.3})`;
                ctx.beginPath();
                ctx.ellipse(0, ty, 4 + tRatio * 8, 2, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // === 侧面细小水珠（左右飞溅） ===
            for (let i = 0; i < 6; i++) {
                const ty = (i / 6) * waterLength * (0.4 + Math.sin(now * 3 + i) * 0.3);
                const sideX = (i % 2 === 0 ? 1 : -1) * (3 + Math.sin(now * 7 + i) * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.beginPath();
                ctx.arc(sideX * (1 + ty / waterLength * 5), ty, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // === 水流命中处：水团与蒸汽 ===
            const hitY = waterLength;
            const hitColor = this.isBoiling ? 'rgba(255, 69, 0, ' : 'rgba(0, 191, 255, ';
            // 水团溅射（向两侧飞出）
            for (let i = 0; i < 10; i++) {
                const sx = (Math.random() - 0.5) * 60;
                const sy = Math.random() * 15 - 5;
                const blobR = Math.random() * 5 + 3;
                ctx.fillStyle = hitColor + `${0.5 - blobR * 0.06})`;
                ctx.beginPath();
                ctx.arc(sx, hitY + sy, blobR, 0, Math.PI * 2);
                ctx.fill();
            }
            // 底部积水团
            for (let i = 0; i < 5; i++) {
                const bx = (Math.random() - 0.5) * 35;
                const by = hitY + Math.random() * 8;
                const br = Math.random() * 8 + 5;
                const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
                grad.addColorStop(0, hitColor + '0.6)');
                grad.addColorStop(0.5, hitColor + '0.3)');
                grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(bx, by, br, 0, Math.PI * 2);
                ctx.fill();
            }
            // 命中处蒸汽上升
            for (let i = 0; i < 5; i++) {
                const sx = (Math.random() - 0.5) * 50;
                const sy = hitY - Math.random() * 30;
                const steamGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.random() * 12 + 6);
                steamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
                steamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = steamGrad;
                ctx.beginPath();
                ctx.arc(sx, sy, Math.random() * 12 + 6, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
        
        // 绘制壶体上方蒸汽（强度随水温变化）
        if (!this.isDead && this.game && Math.random() < 0.3) {
            const steamX = this.x + (Math.random() - 0.5) * 20;
            const steamY = this.y - this.radius - Math.random() * 10;
            const intensity = (this.temperature - 27) / (100 - 27); // 0~1
            const alpha = 0.05 + intensity * 0.2;
            this.game.addParticle({
                x: steamX, y: steamY,
                vx: (Math.random() - 0.5) * 15,
                vy: -20 - intensity * 40,
                color: this.isBoiling ? '#ffffff' : `rgba(255, 255, 255, ${alpha})`,
                life: 0.6 + intensity * 0.5,
                size: 8 + intensity * 12
            });
        }
        
        // 绘制当前温度标识
        ctx.save();
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        // 温度越高颜色越红
        const tRatio = (this.temperature - 27) / (100 - 27);
        const r = Math.round(100 + 155 * tRatio);
        const g = Math.round(200 - 150 * tRatio);
        const b = Math.round(255 - 200 * tRatio);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        const labelY = this.y - this.radius - 18;
        ctx.strokeText(`${Math.round(this.temperature)}°C`, this.x, labelY);
        ctx.fillText(`${Math.round(this.temperature)}°C`, this.x, labelY);
        ctx.restore();
    }
    
    stopAllAudio() {
        if (this.heatAudio) { this.heatAudio.pause(); this.heatAudio.currentTime = 0; }
        if (this.pourAudio) { this.pourAudio.pause(); this.pourAudio.currentTime = 0; }
        if (this.boilPreAudio) { this.boilPreAudio.pause(); this.boilPreAudio.currentTime = 0; }
        if (this.boilAudio) { this.boilAudio.pause(); this.boilAudio.currentTime = 0; }
    }
    
    playAwakenAudio() {
        // 时停动画开始立即播放沸腾前奏
        if (this.boilPreAudio) {
            this.boilPreAudio.currentTime = 0;
            this.boilPreAudio.play().catch(() => {});
        }
    }
    
    stopAwakenAudio() {
        if (this.boilPreAudio) { this.boilPreAudio.pause(); this.boilPreAudio.currentTime = 0; }
        if (this.boilAudio) { this.boilAudio.pause(); this.boilAudio.currentTime = 0; }
    }
}
