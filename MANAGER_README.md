# OpenClaw 模型配置管理工具

一个轻量级 Web 界面，用于在手机上远程管理 OpenClaw Agent 的模型配置。

## 📋 功能特性

- ✅ **Agent 列表展示** - 查看所有 Agent 及当前使用的模型
- ✅ **模型列表查询** - 获取所有可用模型
- ✅ **一键切换模型** - 为 Agent 切换到指定模型
- ✅ **移动端友好** - 响应式设计，适配手机浏览器
- ✅ **实时生效** - Gateway 自动热重载，无需重启

## 🏗️ 项目结构

```
webchat/
├── backend/                    # 后端服务
│   ├── main.py                # FastAPI 主入口
│   └── requirements.txt       # Python 依赖
├── frontend/                   # 前端界面
│   ├── index.html             # 主页面
│   ├── css/style.css          # 样式
│   └── js/app.js              # 前端逻辑
└── deployment/                 # 部署文件
    ├── app.service            # Systemd 服务配置
    ├── nginx.conf             # Nginx 配置
    ├── install.sh             # 安装脚本
    └── start.sh               # 启动脚本
```

## 🚀 快速启动

### 方式一：开发模式（快速测试）

```bash
cd /root/.openclaw/webchat/deployment
chmod +x start.sh
./start.sh
```

访问：http://localhost:8080

### 方式二：Systemd 服务（长期运行）

```bash
cd /root/.openclaw/webchat/deployment
chmod +x install.sh
sudo ./install.sh
```

访问：http://你的服务器 IP:8080

## 🔧 手动部署

### 1. 安装依赖

```bash
cd /root/.openclaw/webchat/backend
pip3 install -r requirements.txt
```

### 2. 启动服务

```bash
cd /root/.openclaw/webchat/backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8080
```

### 3. 配置 Nginx（可选，用于公网访问）

```bash
# 复制配置
sudo cp /root/.openclaw/webchat/deployment/nginx.conf /etc/nginx/sites-available/openclaw-model-manager

# 修改域名（编辑文件中的 server_name）
sudo nano /etc/nginx/sites-available/openclaw-model-manager

# 启用站点
sudo ln -s /etc/nginx/sites-available/openclaw-model-manager /etc/nginx/sites-enabled/

# 测试并重载
sudo nginx -t
sudo systemctl reload nginx
```

## 📱 使用流程

1. **打开手机浏览器**
   - 输入服务器地址（如：http://192.168.1.100:8080）

2. **查看 Agent 列表**
   - 页面自动加载所有 Agent
   - 显示每个 Agent 的名称、Emoji、当前模型

3. **切换模型**
   - 点击要修改的 Agent
   - 从下拉列表选择新模型
   - 点击"确认切换"
   - 等待切换成功提示

4. **验证结果**
   - Agent 列表显示更新后的模型
   - 刷新页面确认

## 🔌 API 接口

### 获取 Agent 列表
```
GET /api/agents
```

### 获取模型列表
```
GET /api/models
```

### 切换 Agent 模型
```
PUT /api/agents/{agent_id}/model
Content-Type: application/json

{
  "model_id": "bailian/qwen3.5-plus"
}
```

### 健康检查
```
GET /health
```

## 🛠️ 技术栈

- **后端**: FastAPI + Uvicorn
- **前端**: HTML5 + CSS3 + 原生 JavaScript
- **部署**: Systemd + Nginx（可选）

## 📝 注意事项

1. **Gateway 热重载**: 修改配置后，Gateway 会自动热重载（约 300ms），无需重启
2. **权限**: 运行服务的用户需要有读取/写入 `~/.openclaw/openclaw.json` 的权限
3. **安全**: 生产环境建议配置 Nginx HTTPS 和访问控制
4. **CORS**: 当前允许所有来源，生产环境应限制 `allow_origins`

## 🐛 常见问题

### Q: 服务启动失败
检查 Python 依赖是否安装：
```bash
pip3 install fastapi uvicorn pydantic
```

### Q: 切换模型后没生效
等待 300ms 让 Gateway 热重载，或刷新页面确认。

### Q: 手机无法访问
检查防火墙是否开放 8080 端口：
```bash
sudo ufw allow 8080
```

## 🔮 后续扩展

- [ ] 添加认证（API Key）
- [ ] 支持 Agent 启动/停止
- [ ] 支持模型参数配置
- [ ] 添加操作历史记录
- [ ] 支持批量切换

---

**版本**: 1.0.0  
**作者**: 代码龙虾 🦞
