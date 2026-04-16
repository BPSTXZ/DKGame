/**
 * 渲染器类
 * 负责画布的清理与基础环境的绘制
 */
export class Renderer {
    constructor(ctx, width, height) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;
    }
    
    /**
     * 清理画布，填充深色背景
     */
    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
    
    /**
     * 绘制竞技场背景网格
     */
    drawArena() {
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for(let i=0; i<this.width; i+=50) {
            this.ctx.moveTo(i, 0);
            this.ctx.lineTo(i, this.height);
            this.ctx.moveTo(0, i);
            this.ctx.lineTo(this.width, i);
        }
        this.ctx.stroke();
    }
}
