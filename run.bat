@echo off
chcp 65001 >nul
title DKGame Local Server
color 0A

echo ===================================================
echo               正在启动 DKGame 本地服务器           
echo ===================================================
echo.
echo 注意：请不要关闭此黑窗口，关闭它将停止游戏运行！
echo.

echo 正在尝试打开浏览器...
start "" "http://127.0.0.1:8080"

echo 正在通过 npx http-server 启动服务...
npx http-server -p 8080 -c-1

echo.
echo 服务器已停止或发生错误。
pause
