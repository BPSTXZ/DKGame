@echo off
chcp 65001 >nul
title DKGame - Development Server
color 0A

echo ===================================================
echo               正在启动 DKGame 本地开发服务器           
echo ===================================================
echo.

if not exist node_modules (
    echo [系统提示] 未检测到 node_modules，正在自动为您安装依赖，请耐心等待...
    call npm install
    echo 依赖安装完成！
    echo.
)

:: 设置局部环境变量，使用本项目安装的 Node.js 运行 Vite，解决系统 Node 版本过低报错的问题
set PATH=%~dp0node_modules\node\bin;%PATH%

echo [系统提示] 正在启动 Vite 服务，请不要关闭此黑窗口！
echo [系统提示] 游戏将在默认浏览器中自动打开...
echo.

:: 延迟 2 秒后打开浏览器，确保服务已经跑起来
start "" "http://localhost:9527"

call npm run dev --scripts-prepend-node-path=auto

echo.
echo 服务器已停止或发生错误。
pause
