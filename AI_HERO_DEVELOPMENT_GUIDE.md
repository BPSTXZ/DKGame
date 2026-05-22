# DKGame 新英雄开发指南 (AI 专用)

本文档旨在规范 `DKGame` 项目中新英雄的开发流程、架构约定以及注意事项。AI 在开发新英雄时，请务必严格遵循以下指南。

## 1. 核心架构设计
游戏基于原生 Canvas + Vue 3 架构。
*   **渲染与逻辑**：在 `Game.js` 中通过 `requestAnimationFrame` 进行主循环。物理逻辑采用固定时间步长（Fixed DT）。
*   **实体基类**：所有英雄继承自 `Hero` ([Hero.js](file:///h:/txz/DKGame/src/game/entities/Hero.js))。
*   **UI 状态**：通过 Vue 组件 `BattleView.vue` ([BattleView.vue](file:///h:/txz/DKGame/src/views/BattleView.vue)) 与全局 Store 响应式绑定展示血量、移速、状态（如怒气、隐忍）。

## 2. 新英雄开发流程 (步骤拆解)

### Step 1: 配置文件注册
在 `src/config/heroes.js` ([heroes.js](file:///h:/txz/DKGame/src/config/heroes.js)) 中新增英雄配置对象。
```javascript
{
  id: 'newhero', 
  name: '新英雄名称', 
  class: 'NewHero', // 必须与类名完全一致
  iconColor: '#xxxxxx', // 主题色
  quote: '"台词..."',
  traits: '特性描述',
  stats: 'HP: 100 | 移速: 60',
  skill: { name: '技能名', desc: '技能描述。觉醒：觉醒技能描述。' },
  audioSrc: import.meta.env.BASE_URL + 'assets/audio/newhero/选择.mp3', // 或 null
  isSpecial: false
}
```

### Step 2: 视图注册
在 `src/views/BattleView.vue` 中导入并注册该英雄类。
```javascript
import { NewHero } from '@/game/entities/heroes/NewHero.js';
const classes = {
  // ... 其他英雄
  'NewHero': NewHero
};
```

### Step 3: 创建英雄实体类
在 `src/game/entities/heroes/` 目录下创建 `NewHero.js`。继承 `Hero` 类并实现生命周期钩子。

## 3. 英雄生命周期与核心 Hook

在 `NewHero.js` 中，你可以覆盖以下核心方法：

### 基础属性与构造 (Constructor)
```javascript
constructor(x, y, playerId) {
    super(x, y, playerId);
    this.name = '英雄名称';
    this.color = '#xxxxxx';
    this.hp = 100;
    this.maxHp = 100;
    this.baseSpeed = 60; // 基础移速，引擎内会放大8倍
    this.radius = 40;    // 标准碰撞半径
    
    // 初始化自定义属性和音频
    this.skillAudio = new Audio(import.meta.env.BASE_URL + 'assets/audio/newhero/skill.mp3');
}
```

### 帧更新 (updateSpecific & applyPassives)
*   `applyPassives()`: 专门用于处理被动带来的移速修改 (`this.speedMultiplier *= ...`) 等。
*   `updateSpecific(dt)`: 帧逻辑更新，用于处理技能冷却、召唤物位置、持续性伤害。

### 交互与受击 (Collision & Damage)
*   `onHeroCollision(other)`: 当与敌方英雄发生物理碰撞时触发，通常用于近战伤害或施加 Debuff (`other.takeDamage(...)`, `other.addBuff(...)`)。
*   `takeDamage(amount, sourceX, sourceY)`: 重写以拦截受击事件（如受击积攒怒气/隐忍值），**必须调用 `super.takeDamage(amount, sourceX, sourceY)`**。

### 觉醒演出 (Awaken)
当英雄拾取觉醒石时：
1.  `Game.js` 触发 `game.globalFreezeTime = 2.0` (全局时停)。
2.  调用英雄的 `playAwakenAudio()`。
3.  时停期间，`Game.js` 会持续调用英雄的 `updateAwakenAnimation(dt)` 钩子，可在此处编写时停期间的汇聚粒子特效。
4.  时停结束后，调用英雄的 `onAwaken()`。
5.  **注意**：如果有觉醒状态（如持续时间、变身），请妥善处理状态流转和恢复。

### 渲染与特效 (Draw)
*   `drawBody(ctx)`: 绘制英雄本体及专属 UI（如环绕的进度条、表情）。不要忘记 `super.drawBody(ctx)`。
*   `draw(ctx)`: 绘制英雄脚下的特效、召唤物或飞行道具（如神针、飞刀）。
*   `drawOverlay(ctx)`: **强制约束**：覆盖在所有英雄主体之上的特效（如斩痕、全屏光环）必须在此钩子中绘制。

### 死亡与胜利清理
*   `stopAllAudio()`: 死亡或回合结束时，停止所有常规技能音效。
*   `stopAwakenAudio()`: 停止觉醒音效。
*   `onVictory()`: 胜利瞬间调用，用于停止技能、切换笑脸等。
*   `playVictoryAudio()`: 返回胜利音频的时长（秒），用于引擎控制彩带时机。

## 4. 引擎能力调用 (Game.js API)
在英雄类中，可以通过 `this.game` 访问引擎能力：
*   **粒子生成**: `this.game.addParticle({ x, y, vx, vy, color, life, size, target, gravity, rotationSpeed, isLine })`
*   **飘字**: `this.game.addFloatingText(x, y, "文本", "#color")`
*   **屏幕震动**: `this.game.shakeScreen(intensity, duration)` (如 0.3, 8)
*   **碰撞检测**: `this.game.physics.checkCircleCollision(circleA, circleB)`
*   **时停控制**: `this.game.globalFreezeTime = 2.5` (手动触发全场时停)

## 5. 开发硬约束与偏好 (Hard Constraints)
1.  **禁止自动构建**: 开发或修复 Bug 后，**绝对禁止**主动运行 `npm run build` 或 `node -c` 进行检查，除非用户明确要求。
2.  **特效克制**: Canvas 动画偏好“动漫感”（如向心螺旋、法阵、屏幕震动），但拒绝过度夸张的特效。
3.  **UI 连贯性**: 英雄的特殊数值（怒气、隐忍）如果要在外部显示，需确保 `BattleView.vue` 中的逻辑与英雄内部状态 (`this.rage`, `this.endurance`) 对齐。通常在英雄本体外部绘制 Canvas 圆环进度条更为直观。
4.  **状态颜色约定**: 例如未满值使用暗色调（如 `#8b8b00`），满值使用明亮高光（如 `#ffd700`）。
5.  **代码参考引用**: 回复用户时，必须使用 Markdown Link Basename 格式提供代码引用，如 `[Game.js](file:///绝对路径)`。

---
**本指南由 AI 自动生成，作为后续开发“敬请期待”新英雄的知识基准。**
