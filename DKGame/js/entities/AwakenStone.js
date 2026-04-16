/**
 * AwakenStone 觉醒石类
 * 游戏进行中当一方血量降低到阈值时生成的道具
 */
export class AwakenStone {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.isCollected = false; // 是否已被拾取
        this.time = 0; // 用于计算动画的时间累加器
    }
    
    update(dt) {
        this.time += dt;
    }
    
    draw(ctx) {
        if (this.isCollected) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // 呼吸放大缩小效果
        const scale = 1 + Math.sin(this.time * 5) * 0.1;
        ctx.scale(scale, scale);
        
        // 外围发光
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 20 + Math.sin(this.time * 10) * 10;
        
        // 绘制菱形水晶外观
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.closePath();
        
        ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 内部高光
        ctx.beginPath();
        ctx.moveTo(0, -this.radius * 0.5);
        ctx.lineTo(this.radius * 0.5, 0);
        ctx.lineTo(0, this.radius * 0.5);
        ctx.lineTo(-this.radius * 0.5, 0);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fill();
        
        ctx.restore();
    }
}
