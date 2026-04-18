# 双英雄碰撞对战 (DKGame) - Vue 3 SPA 重构版

本项目已从原生 JS 结合 Vue CDN 的单文件结构，重构为基于 Vue 3 + Vite 的单页应用（SPA）工程化架构。
同时集成了 Vue Router 用于页面路由，以及 Pinia 用于状态管理。

## 特性

* **Vue 3 (Composition API)**
* **Vite** 作为构建工具（快速冷启动与热更新）
* **Vue Router** 实现英雄选择页和对战页分离
* **Pinia** 实现跨页面的全局游戏状态与训练场参数同步
* **模块化**：游戏引擎逻辑、实体类与 Vue 视图完全解耦

## 项目启动流程

1. **安装依赖**

   ```bash
   npm install
   ```

2. **启动本地开发服务器**

   ```bash
   npm run dev
   ```
   默认端口为 `9527`。启动后可通过浏览器访问 `http://localhost:9527`。

3. **生产构建**

   ```bash
   npm run build
   ```
   此命令会使用 Vite 进行生产环境打包并进行体积优化，构建产物将输出至 `dist/` 目录下。

4. **预览构建产物**

   ```bash
   npm run preview
   ```

## 目录结构说明

* `public/assets/`：存放全局音频与静态资源文件
* `src/assets/`：存放全局 CSS 样式
* `src/components/`：存放可复用的 Vue 组件（可按需扩展）
* `src/views/`：存放路由视图组件 (`SelectView.vue`, `BattleView.vue`)
* `src/router/`：Vue Router 配置
* `src/store/`：Pinia 状态管理
* `src/game/`：核心游戏逻辑、引擎类与实体类
