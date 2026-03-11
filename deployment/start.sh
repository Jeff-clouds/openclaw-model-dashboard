#!/bin/bash
# OpenClaw Model Manager - 快速启动脚本（开发模式）

set -e

echo "🦞 启动 OpenClaw 模型管理工具（开发模式）..."

cd /root/.openclaw/webchat/backend

# 检查依赖
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "📦 安装依赖..."
    pip3 install -r requirements.txt
fi

# 启动服务
echo "🚀 启动服务..."
echo "访问地址：http://localhost:8080"
echo ""

python3 -m uvicorn main:app --host 0.0.0.0 --port 8080 --reload
