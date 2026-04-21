/**
 * 物理引擎类
 * 处理所有的碰撞检测与反弹逻辑
 */
export class Physics {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.wallHitAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/common/碰撞.mp3');
        this.lastWallHitTime = 0;
    }
    
    /**
     * 处理英雄与场地边缘的碰撞与反弹
     */
    handleWallCollision(hero) {
        let bounced = false;
        
        // 左右边界
        if (hero.x - hero.radius <= 0 && hero.vx < 0) {
            hero.x = hero.radius;
            hero.vx = Math.abs(hero.vx);
            bounced = true;
        } else if (hero.x + hero.radius >= this.width && hero.vx > 0) {
            hero.x = this.width - hero.radius;
            hero.vx = -Math.abs(hero.vx);
            bounced = true;
        }
        
        // 上下边界
        if (hero.y - hero.radius <= 0 && hero.vy < 0) {
            hero.y = hero.radius;
            hero.vy = Math.abs(hero.vy);
            bounced = true;
        } else if (hero.y + hero.radius >= this.height && hero.vy > 0) {
            hero.y = this.height - hero.radius;
            hero.vy = -Math.abs(hero.vy);
            bounced = true;
        }
        
        if (bounced) {
            hero.onWallBounce();
            
            const now = performance.now();
            
            // 为每个英雄单独记录边缘碰撞时间戳，设置 300ms 冷却时间防止连续接触时重复触发
            if (!hero.lastWallHitTime || now - hero.lastWallHitTime > 300) {
                // 保留全局 50ms 冷却，防止多角色同帧撞墙导致爆音重叠
                if (now - this.lastWallHitTime > 50) {
                    this.wallHitAudio.currentTime = 0;
                    this.wallHitAudio.play().catch(e => console.warn('Wall hit audio play failed:', e));
                    this.lastWallHitTime = now;
                }
                hero.lastWallHitTime = now;
            }
        }
    }
    
    /**
     * 圆形与圆形的碰撞检测
     */
    checkCircleCollision(c1, c2) {
        const dx = c1.x - c2.x;
        const dy = c1.y - c2.y;
        const distSq = dx * dx + dy * dy;
        const radSum = c1.radius + c2.radius;
        return distSq < radSum * radSum;
    }
    
    /**
     * 线段与圆形的碰撞检测（用于蜘蛛侠的蛛网）
     */
    checkLineCircleCollision(x1, y1, x2, y2, circle) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        
        let param = 0;
        if (lenSq !== 0) {
            param = ((circle.x - x1) * dx + (circle.y - y1) * dy) / lenSq;
        }
        
        let nearestX, nearestY;
        if (param < 0) {
            nearestX = x1;
            nearestY = y1;
        } else if (param > 1) {
            nearestX = x2;
            nearestY = y2;
        } else {
            nearestX = x1 + param * dx;
            nearestY = y1 + param * dy;
        }
        
        const distSq = (circle.x - nearestX) ** 2 + (circle.y - nearestY) ** 2;
        return distSq <= circle.radius * circle.radius;
    }
    
    /**
     * 处理两个英雄之间的碰撞
     * 包含动量守恒的弹性碰撞反弹与重叠分离
     */
    checkHeroCollision(h1, h2) {
        if (this.checkCircleCollision(h1, h2)) {
            // 触发各自的碰撞事件回调
            h1.onHeroCollision(h2);
            h2.onHeroCollision(h1);
            
            // 检查是否有英雄要求忽略反弹（如 Van 处于给佬攻击状态）
            const ignoreBounce1 = h1.ignoreHeroCollisionBounce === true;
            const ignoreBounce2 = h2.ignoreHeroCollisionBounce === true;
            
            if (ignoreBounce1 || ignoreBounce2) {
                // 如果任意一方处于压制/紧贴状态，则跳过物理分离与反弹
                return;
            }
            
            // 弹性碰撞计算
            const dx = h2.x - h1.x;
            const dy = h2.y - h1.y;
            const dist = Math.hypot(dx, dy);
            
            // 最小安全距离以防止两个单位粘连
            const minDist = h1.radius + h2.radius;
            
            if (dist === 0) return; // 极小概率位置完全重合
            
            // 分离重叠部分
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            
            // 将两个英雄互相推开
            h1.x -= nx * overlap / 2;
            h1.y -= ny * overlap / 2;
            h2.x += nx * overlap / 2;
            h2.y += ny * overlap / 2;
            
            // 速度解析
            // 计算相对速度
            const dvx = h2.vx - h1.vx;
            const dvy = h2.vy - h1.vy;
            
            // 沿法线方向的速度
            const velAlongNormal = dvx * nx + dvy * ny;
            
            // 如果两个物体正在相互远离，则不进行速度反弹
            if (velAlongNormal > 0) return;
            
            // 检查吸血鬼是否正处于黏附吸血状态，如果是，则取消速度反弹，让它们保持贴合
            let shouldBounce = true;
            if ((h1.name === 'Vampire' && h1.isSucking) || (h2.name === 'Vampire' && h2.isSucking)) {
                shouldBounce = false;
            }
            
            if (shouldBounce) {
                // 恢复系数 (bounciness) - 1.0 为完全弹性碰撞
                const e = 1.0; 
                
                // 冲量标量（假设质量相等为 1）
                const j = -(1 + e) * velAlongNormal / 2; 
                
                // 应用冲量
                const impulseX = j * nx;
                const impulseY = j * ny;
                
                h1.vx -= impulseX;
                h1.vy -= impulseY;
                h2.vx += impulseX;
                h2.vy += impulseY;
            }
            
            // 重新归一化速度以保持英雄设定的恒定移速
            h1.normalizeSpeed();
            h2.normalizeSpeed();
        }
    }
}
