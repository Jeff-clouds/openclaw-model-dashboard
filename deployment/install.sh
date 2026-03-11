#!/bin/bash
# OpenClaw Model Manager - 安装脚本

set -e

echo "🦞 开始安装 OpenClaw 模型管理工具..."

# 1. 安装 Python 依赖
echo "📦 安装 Python 依赖..."
cd /root/.openclaw/webchat/backend
pip3 install -r requirements.txt

# 2. 安装 Systemd 服务
echo "🔧 安装 Systemd 服务..."
cp /root/.openclaw/webchat/deployment/app.service /etc/systemd/system/openclaw-model-manager.service
systemctl daemon-reload
systemctl enable openclaw-model-manager

# 3. 启动服务
echo "🚀 启动服务..."
systemctl start openclaw-model-manager

# 4. 检查状态
echo "📊 检查服务状态..."
systemctl status openclaw-model-manager --no-pager

echo ""
echo "✅ 安装完成！"
echo ""
echo "访问地址：http://你的服务器 IP:8080"
echo ""
echo "常用命令："
echo "  启动：systemctl start openclaw-model-manager"
echo "  停止：systemctl stop openclaw-model-manager"
echo "  重启：systemctl restart openclaw-model-manager"
echo "  日志：journalctl -u openclaw-model-manager -f"
echo ""
