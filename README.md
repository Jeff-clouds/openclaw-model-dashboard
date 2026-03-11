# OpenClaw模型配置管理工具

一个用于远程管理OpenClaw AI模型配置的Web工具，支持通过手机浏览器查看和切换Agent使用的模型。

## 📋 项目概述

本项目提供一个轻量级的Web界面，用于在公网服务器上管理OpenClaw的模型配置。当OpenClaw运行多个Agent时，可以通过手机浏览器便捷地查看所有Agent、选择Agent并切换其使用的模型。

### 核心功能

- ✅ **Agent列表展示** - 查看所有运行的Agent及其当前使用的模型
- ✅ **模型列表查询** - 获取已配置的所有可用模型
- ✅ **模型切换** - 选择Agent并切换到指定的模型
- ✅ **移动端友好** - 响应式设计，适配手机浏览器访问
- ✅ **实时状态** - 显示Agent当前状态和配置信息

## 🏗️ 系统架构

### 整体架构图

```
┌─────────────┐     HTTP/HTTPS     ┌─────────────────────┐
│   手机浏览器  │ ──────────────────> │   Nginx/Caddy (反向代理) │
└─────────────┘                     └─────────────────────┘
                                             │
                                             │ Forward
                                             ▼
                                    ┌─────────────────┐
                                    │  Web服务端口    │
                                    │  (如:8080)      │
                                    └─────────────────┘
                                             │
                                             ▼
                                    ┌─────────────────────┐
                                    │   FastAPI后端服务    │
                                    └─────────────────────┘
                                             │
                     ┌───────────────────────┼───────────────────────┐
                     │                       │                       │
                     ▼                       ▼                       ▼
          ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
          │  Agent管理模块   │    │  模型查询模块   │    │  配置修改模块   │
          └─────────────────┘    └─────────────────┘    └─────────────────┘
                     │                       │                       │
                     └───────────────────────┼───────────────────────┘
                                             │
                                             │ OpenClaw API
                                             ▼
                                    ┌─────────────────────┐
                                    │    OpenClaw核心     │
                                    │  (多Agent运行环境)  │
                                    └─────────────────────┘
                                             │
                                             │ 模型配置
                                             ▼
                                    ┌─────────────────────┐
                                    │   配置文件存储     │
                                    │  (JSON/YAML/DB)    │
                                    └─────────────────────┘
```

### 技术栈选择

#### 后端技术
- **FastAPI** - 高性能Python Web框架
  - 异步支持，适合高并发场景
  - 自动生成API文档
  - 类型提示支持，代码更可靠
- **Pydantic** - 数据验证和序列化
- **Aiohttp** - 异步HTTP客户端(调用OpenClaw API)

#### 前端技术
- **HTML5 + CSS3** - 响应式移动端界面
- **原生JavaScript** - 轻量级，无需构建工具
- **Fetch API** - 异步HTTP请求

#### 部署技术
- **Nginx/Caddy** - 反向代理和HTTPS支持
- **Systemd** - 服务守护进程管理
- **Docker (可选)** - 容器化部署

## 📁 项目结构

```
openclaw-model-manager/
├── backend/                          # 后端服务
│   ├── main.py                      # FastAPI主入口
│   ├── config.py                    # 配置管理
│   ├── services/                    # 业务逻辑层
│   │   ├── __init__.py
│   │   ├── agent_service.py         # Agent管理服务
│   │   ├── model_service.py         # 模型查询服务
│   │   └── config_service.py        # 配置修改服务
│   ├── models/                      # 数据模型
│   │   ├── __init__.py
│   │   ├── agent.py                # Agent数据模型
│   │   └── model.py                # 模型数据模型
│   ├── clients/                     # 外部客户端
│   │   ├── __init__.py
│   │   └── openclaw_client.py      # OpenClaw API客户端
│   └── requirements.txt             # Python依赖
│
├── frontend/                         # 前端界面
│   ├── index.html                   # 主页面
│   ├── css/
│   │   └── style.css                # 样式文件
│   └── js/
│       └── app.js                   # 前端逻辑
│
├── config/                           # 配置文件
│   ├── app_config.yaml              # 应用配置
│   └── openclaw_config.yaml         # OpenClaw连接配置
│
├── deployment/                       # 部署文件
│   ├── nginx.conf                   # Nginx配置
│   ├── app.service                  # Systemd服务配置
│   └── Dockerfile                   # Docker镜像(可选)
│
├── scripts/                          # 工具脚本
│   ├── install.sh                   # 安装脚本
│   ├── start.sh                     # 启动脚本
│   └── stop.sh                      # 停止脚本
│
├── logs/                             # 日志目录
│   └── .gitkeep
│
├── tests/                            # 测试文件
│   ├── test_agent_service.py
│   ├── test_model_service.py
│   └── test_config_service.py
│
└── README.md                         # 项目文档
```

## 🔌 API接口设计

### 1. Agent管理接口

#### 获取所有Agent列表
```
GET /api/v1/agents
```

**响应示例:**
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "agent_001",
      "name": "客服助手",
      "status": "running",
      "current_model": "gpt-4",
      "description": "处理客户咨询",
      "created_at": "2026-03-10T10:00:00Z"
    },
    {
      "id": "agent_002",
      "name": "数据分析",
      "status": "running",
      "current_model": "claude-3-opus",
      "description": "数据分析任务",
      "created_at": "2026-03-10T10:30:00Z"
    }
  ]
}
```

#### 获取单个Agent详情
```
GET /api/v1/agents/{agent_id}
```

### 2. 模型管理接口

#### 获取所有可用模型
```
GET /api/v1/models
```

**响应示例:**
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "provider": "OpenAI",
      "type": "chat",
      "available": true,
      "context_length": 8192,
      "price": "0.03/1K tokens"
    },
    {
      "id": "gpt-3.5-turbo",
      "name": "GPT-3.5 Turbo",
      "provider": "OpenAI",
      "type": "chat",
      "available": true,
      "context_length": 16384,
      "price": "0.002/1K tokens"
    },
    {
      "id": "claude-3-opus",
      "name": "Claude 3 Opus",
      "provider": "Anthropic",
      "type": "chat",
      "available": true,
      "context_length": 200000,
      "price": "0.015/1K tokens"
    }
  ]
}
```

#### 获取Agent当前使用的模型
```
GET /api/v1/agents/{agent_id}/model
```

### 3. 配置修改接口

#### 切换Agent模型
```
PUT /api/v1/agents/{agent_id}/model
```

**请求体:**
```json
{
  "model_id": "gpt-4"
}
```

**响应示例:**
```json
{
  "code": 0,
  "message": "模型切换成功",
  "data": {
    "agent_id": "agent_001",
    "previous_model": "gpt-3.5-turbo",
    "new_model": "gpt-4",
    "switched_at": "2026-03-10T12:30:00Z"
  }
}
```

### 4. 健康检查接口

#### 服务健康检查
```
GET /health
```

**响应示例:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-10T12:30:00Z",
  "version": "1.0.0"
}
```

## 🔐 安全设计

### 认证机制
- **API Key认证** - 请求头携带 `X-API-Key`
- **IP白名单** - 可配置允许访问的IP段
- **HTTPS加密** - 生产环境强制HTTPS

### 权限控制
- **只读模式** - 查询操作无需认证(可选)
- **写入操作** - 修改操作需要认证
- **审计日志** - 记录所有修改操作

## 📱 前端界面设计

### 页面结构

```
┌─────────────────────────────────────┐
│         OpenClaw模型管理            │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │  Agent列表                    │  │
│  │  ○ 客服助手 (gpt-4)          │  │
│  │  ● 数据分析 (claude-3-opus)  │  │
│  │  ○ 代码助手 (gpt-3.5-turbo)  │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  可用模型                     │  │
│  │  ○ GPT-4                      │  │
│  │  ○ GPT-3.5 Turbo             │  │
│  │  ● Claude 3 Opus             │  │
│  └───────────────────────────────┘  │
│                                     │
│  [ 切换模型 ]                        │
└─────────────────────────────────────┘
```

### 交互流程
1. 页面加载时自动获取Agent列表
2. 点击Agent显示其当前使用的模型
3. 显示所有可用模型列表
4. 选择模型后点击"切换"按钮
5. 显示切换结果(成功/失败提示)

## 🚀 部署方案

### 方案A: 直接部署(推荐用于测试)

```bash
# 1. 克隆项目
git clone <repository>
cd openclaw-model-manager

# 2. 安装依赖
cd backend
pip install -r requirements.txt

# 3. 配置应用
cp config/app_config.yaml.example config/app_config.yaml
# 编辑配置文件，填写OpenClaw API地址

# 4. 启动服务
python main.py

# 5. 配置Nginx反向代理(可选)
sudo cp deployment/nginx.conf /etc/nginx/sites-available/openclaw-manager
sudo ln -s /etc/nginx/sites-available/openclaw-manager /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 方案B: Docker部署(推荐用于生产)

```bash
# 1. 构建镜像
docker build -t openclaw-model-manager:latest .

# 2. 运行容器
docker run -d \
  --name openclaw-manager \
  -p 8080:8080 \
  -v $(pwd)/config:/app/config \
  openclaw-model-manager:latest

# 3. 配置Nginx(同方案A)
```

### 方案C: Systemd服务(推荐用于长期运行)

```bash
# 1. 安装服务
sudo cp deployment/app.service /etc/systemd/system/openclaw-manager.service

# 2. 启动服务
sudo systemctl daemon-reload
sudo systemctl enable openclaw-manager
sudo systemctl start openclaw-manager

# 3. 查看状态
sudo systemctl status openclaw-manager
```

## ⚙️ 配置说明

### 应用配置 (config/app_config.yaml)

```yaml
# 服务配置
server:
  host: "0.0.0.0"
  port: 8080
  debug: false

# OpenClaw API配置
openclaw:
  base_url: "http://localhost:8000"  # OpenClaw API地址
  api_key: "your-api-key"            # OpenClaw API密钥
  timeout: 30                         # 请求超时时间(秒)

# 安全配置
security:
  api_key: "your-secret-api-key"     # 本服务API密钥
  enable_auth: true                   # 是否启用认证
  allowed_ips:                        # IP白名单(可选)
    - "192.168.1.0/24"

# 日志配置
logging:
  level: "INFO"
  file: "logs/app.log"
  max_size: "10MB"
  backup_count: 5
```

## 📊 OpenClaw集成说明

### 假设的OpenClaw API接口

本项目需要OpenClaw提供以下API接口(具体需要根据你的OpenClaw实际API调整):

#### 1. 获取Agent列表
```
GET /api/agents
```

#### 2. 获取Agent详情
```
GET /api/agents/{agent_id}
```

#### 3. 获取可用模型列表
```
GET /api/models
```

#### 4. 获取Agent当前模型
```
GET /api/agents/{agent_id}/config/model
```

#### 5. 更新Agent模型配置
```
PUT /api/agents/{agent_id}/config/model
Content-Type: application/json

{
  "model": "gpt-4"
}
```

> **注意**: 如果OpenClaw的API与上述假设不符，需要在 `backend/clients/openclaw_client.py` 中调整具体实现。

## 🔧 开发指南

### 本地开发环境

```bash
# 1. 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate     # Windows

# 2. 安装依赖
pip install -r backend/requirements.txt

# 3. 运行开发服务器
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8080

# 4. 访问前端
# 浏览器打开: http://localhost:8080
```

### 运行测试

```bash
# 安装测试依赖
pip install pytest pytest-asyncio pytest-cov

# 运行所有测试
pytest tests/

# 运行测试并生成覆盖率报告
pytest tests/ --cov=. --cov-report=html
```

## 📝 使用流程

### 典型使用场景

1. **通过手机访问管理页面**
   - 打开手机浏览器
   - 输入公网地址(如: https://your-domain.com)

2. **查看Agent状态**
   - 页面自动加载所有Agent
   - 显示每个Agent的名称和当前模型

3. **切换Agent模型**
   - 选择要修改的Agent
   - 从下拉列表选择新模型
   - 点击"切换"按钮
   - 等待切换结果提示

4. **验证切换结果**
   - Agent列表中显示更新后的模型
   - 刷新页面确认

## 🐛 常见问题

### Q1: 无法连接到OpenClaw服务
- 检查 `config/app_config.yaml` 中的 `openclaw.base_url` 是否正确
- 确认OpenClaw服务是否正常运行
- 检查网络连接和防火墙设置

### Q2: 切换模型后没有生效
- 查看后端日志 (`logs/app.log`)
- 检查OpenClaw API响应
- 确认OpenClaw是否支持热重载配置

### Q3: 手机无法访问页面
- 检查服务器防火墙是否开放端口
- 确认Nginx/Caddy配置正确
- 检查域名DNS解析

## 🔮 后续扩展

### 计划功能
- [ ] 支持Agent的启动/停止操作
- [ ] 支持模型参数配置(temperature, max_tokens等)
- [ ] 添加Agent性能监控
- [ ] 支持批量切换多个Agent的模型
- [ ] 添加操作历史记录和回滚功能
- [ ] 支持Webhook通知
- [ ] 添加使用统计和成本分析

## 📄 许可证

MIT License

## 👥 贡献

欢迎提交Issue和Pull Request!

---

**下一步**: 开始实现后端服务和前端界面
