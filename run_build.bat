@echo off
chcp 65001 >nul
title DKGame - Build Project
color 0B

echo ===================================================
echo               正在构建 DKGame 生产环境包           
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

echo [系统提示] 正在执行 Vite 打包编译，请稍候...
echo.

call npm run build --scripts-prepend-node-path=auto

echo.
echo ===================================================
echo 构建完成！所有静态文件已输出到目录下的 [dist] 文件夹。
echo 可以将 [dist] 文件夹直接部署到任意静态 Web 服务器。
echo ===================================================
pause
