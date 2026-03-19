#!/usr/bin/env python3
"""
OpenClaw 模型配置管理工具 - 后端服务
功能：查看 Agent 列表、模型列表，切换 Agent 使用的模型
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import json
import subprocess
from pathlib import Path
from typing import List, Optional

app = FastAPI(title="OpenClaw Model Manager")

# CORS 配置（允许所有来源，生产环境应限制）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 前端静态文件目录（绝对路径）
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

# 挂载静态文件（CSS、JS 等）
app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")

# OpenClaw 配置文件路径
CONFIG_PATH = Path.home() / ".openclaw" / "openclaw.json"


@app.get("/")
def serve_frontend():
    """提供前端首页"""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    raise HTTPException(status_code=404, detail="Frontend not found")


class ModelSwitchRequest(BaseModel):
    modelId: str
    
    model_config = {"protected_namespaces": ()}


@app.get("/health")
def health_check():
    """健康检查"""
    return {"status": "healthy", "version": "1.0.0"}


@app.get("/api/agents")
def get_agents():
    """
    获取所有 Agent 列表及当前使用的模型
    直接从配置文件读取 agents.list
    """
    try:
        if not CONFIG_PATH.exists():
            return {"code": 404, "message": "Config not found", "data": []}
        
        config = json.loads(CONFIG_PATH.read_text())
        agents_list = config.get("agents", {}).get("list", [])
        
        # 格式化 agent 数据
        formatted_agents = []
        for agent in agents_list:
            agent_id = agent.get("id", "unknown")
            agent_name = agent.get("name", agent_id)
            model = agent.get("model", "default")
            
            # 处理 model 可能是字符串或对象的情况
            if isinstance(model, dict):
                model = model.get("primary", "unknown")
            
            workspace = agent.get("workspace", config.get("agents", {}).get("defaults", {}).get("workspace", "/root/.openclaw/workspace"))
            
            formatted_agents.append({
                "id": agent_id,
                "name": agent_name,
                "model": model,
                "workspace": workspace,
                "enabled": True
            })
        
        return {"code": 0, "message": "success", "data": formatted_agents}
    
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/models")
def get_models():
    """
    获取所有可用模型列表
    直接从配置文件读取 models.providers 中的所有模型
    """
    try:
        if not CONFIG_PATH.exists():
            return {"code": 404, "message": "Config not found", "data": []}
        
        config = json.loads(CONFIG_PATH.read_text())
        providers = config.get("models", {}).get("providers", {})
        
        all_models = []
        for provider_name, provider_config in providers.items():
            provider_models = provider_config.get("models", [])
            for model in provider_models:
                model_key = f"{provider_name}/{model.get('id', '')}"
                all_models.append({
                    "key": model_key,
                    "name": model.get('name', model.get('id', '')),
                    "provider": provider_name,
                    "input": model.get('input', 'text'),
                    "contextWindow": model.get('contextWindow', 0),
                    "local": model.get('local', False),
                    "available": True,
                    "tags": []
                })
        
        # 如果配置文件没有 models.providers，fallback 到 CLI
        if not all_models:
            result = subprocess.run(
                ["openclaw", "models", "list", "--json"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                models_data = json.loads(result.stdout)
                all_models = models_data.get("models", [])
        
        return {"code": 0, "message": "success", "data": all_models}
    
    except Exception as e:
        return {"code": 500, "message": f"Error: {str(e)}", "data": []}


@app.put("/api/agents/{agent_id}/model")
def set_agent_model(agent_id: str, request: ModelSwitchRequest):
    """
    切换 Agent 使用的模型
    直接修改 ~/.openclaw/openclaw.json 配置文件
    Gateway 会自动热重载（约 300ms）
    """
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    try:
        # 读取配置文件
        if not CONFIG_PATH.exists():
            return {"code": 404, "message": "Config file not found", "data": None}
        
        config_text = CONFIG_PATH.read_text()
        config = json.loads(config_text)
        
        # 查找 Agent 并更新模型
        agents_list = config.get("agents", {}).get("list", [])
        
        if not agents_list:
            logger.error("No agents found in config")
            return {"code": 404, "message": "No agents in config", "data": None}
        
        agent_found = False
        previous_model = None
        
        logger.info(f"Searching for agent: {agent_id} in {len(agents_list)} agents")
        
        for i, agent in enumerate(agents_list):
            agent_id_in_config = agent.get("id")
            logger.info(f"Checking agent[{i}]: {agent_id_in_config}")
            
            if agent_id_in_config == agent_id:
                previous_model = agent.get("model")
                if isinstance(previous_model, dict):
                    previous_model = previous_model.get("primary", str(previous_model))
                config["agents"]["list"][i]["model"] = request.modelId
                agent_found = True
                break
        
        if not agent_found:
            logger.error(f"Agent '{agent_id}' not found. Available: {[a.get('id') for a in agents_list]}")
            return {"code": 404, "message": f"Agent '{agent_id}' not found", "data": None}
        
        # 写回配置文件（Gateway 自动热重载）
        CONFIG_PATH.write_text(json.dumps(config, indent=2, ensure_ascii=False))
        logger.info(f"Successfully switched {agent_id} to {request.modelId}")
        
        return {
            "code": 0,
            "message": "模型切换成功",
            "data": {
                "agent_id": agent_id,
                "previous_model": previous_model,
                "new_model": request.modelId
            }
        }
    
    except json.JSONDecodeError as e:
        logger.error(f"Config parse error: {e}")
        return {"code": 500, "message": f"Config parse error: {str(e)}", "data": None}
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return {"code": 500, "message": f"Error: {str(e)}", "data": None}


@app.get("/api/config")
def get_config_info():
    """获取配置基本信息"""
    try:
        if not CONFIG_PATH.exists():
            return {"code": 1, "message": "Config not found", "data": {}}
        
        config = json.loads(CONFIG_PATH.read_text())
        
        return {
            "code": 0,
            "message": "success",
            "data": {
                "configPath": str(CONFIG_PATH),
                "agentsCount": len(config.get("agents", {}).get("list", [])),
                "gatewayPort": config.get("gateway", {}).get("port", 18789)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def parse_age_to_minutes(age_str):
    """将年龄字符串转换为分钟数，用于过滤不活跃会话"""
    try:
        # 处理格式: 3m, 43m, 11h, 4d, 7d
        if age_str.endswith('m'):
            return int(age_str[:-1])
        elif age_str.endswith('h'):
            return int(age_str[:-1]) * 60
        elif age_str.endswith('d'):
            return int(age_str[:-1]) * 60 * 24
        elif age_str == 'now':
            return 0
        else:
            return float('inf')  # 未知格式视为不活跃
    except:
        return float('inf')


@app.get("/api/sessions/models")
def get_sessions_models(max_age_hours: int = 24):
    """
    获取当前活跃会话使用的模型信息
    优先读取 CLI 的真实会话信息；CLI 不可用时回退到配置文件。
    """
    try:
        model_info = []
        cli_errors = []

        def normalize_session(item: dict):
            session_id = item.get("session_id") or item.get("id") or item.get("sessionId") or "unknown"
            kind = item.get("kind") or item.get("chat_type") or item.get("channel_type") or "other"
            agent_id = item.get("agent") or item.get("agent_id") or item.get("name") or item.get("display_name") or session_id
            agent_name = item.get("agent_name") or item.get("display_name") or item.get("name") or agent_id
            full_model = item.get("full_model") or item.get("model") or item.get("model_id") or "default"
            if isinstance(full_model, dict):
                full_model = full_model.get("primary", full_model.get("id", "unknown"))
            model_short = full_model.split("/")[-1] if isinstance(full_model, str) and "/" in full_model else full_model
            age = item.get("age") or item.get("age_str") or item.get("last_seen") or "active"
            return {
                "agent": agent_id,
                "agent_name": agent_name,
                "kind": kind,
                "model": model_short,
                "full_model": full_model,
                "session_id": session_id,
                "age": age,
                "channel": item.get("channel", "feishu"),
                "display_name": agent_name,
            }

        # Try the correct CLI command: openclaw sessions --json
        try:
            result = subprocess.run(["openclaw", "sessions", "--json"], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                payload = json.loads(result.stdout or "{}")
                items = payload.get("sessions", [])
                if items:
                    # Parse ageMs to human readable format
                    def format_age(age_ms):
                        if age_ms is None:
                            return "unknown"
                        minutes = age_ms // 60000
                        if minutes < 60:
                            return f"{minutes}m"
                        hours = minutes // 60
                        if hours < 24:
                            return f"{hours}h"
                        days = hours // 24
                        return f"{days}d"

                    # Map CLI format to our format
                    for item in items:
                        if not isinstance(item, dict):
                            continue
                        agent_id = item.get("agentId", "unknown")
                        kind = item.get("kind", "other")
                        model = item.get("model", "default")
                        provider = item.get("modelProvider", "")
                        full_model = f"{provider}/{model}" if provider else model
                        session_id = item.get("sessionId", "unknown")
                        age_ms = item.get("ageMs")
                        age = format_age(age_ms) if age_ms is not None else "unknown"

                        # Extract channel from key (e.g., "agent:main:feishu:direct:...")
                        key = item.get("key", "")
                        channel = "feishu"
                        if ":feishu:" in key:
                            channel = "feishu"
                        elif ":lightclawbot:" in key:
                            channel = "lightclawbot"
                        elif ":telegram:" in key:
                            channel = "telegram"
                        elif ":discord:" in key:
                            channel = "discord"

                        model_info.append({
                            "agent": agent_id,
                            "agent_name": agent_id,
                            "kind": kind,
                            "model": model,
                            "full_model": full_model,
                            "session_id": session_id[:8] + "..." if len(session_id) > 8 else session_id,
                            "age": age,
                            "channel": channel,
                            "display_name": agent_id,
                        })
            else:
                cli_errors.append(f"openclaw sessions --json: {result.stderr.strip() or 'non-zero exit'}")
        except Exception as e:
            cli_errors.append(f"openclaw sessions --json: {e}")

        if not model_info:
            if not CONFIG_PATH.exists():
                return {"code": 404, "message": "Config not found", "data": {"total": 0, "sessions": []}}

            config = json.loads(CONFIG_PATH.read_text())
            agents_list = config.get("agents", {}).get("list", [])
            for agent in agents_list:
                agent_id = agent.get("id", "unknown")
                agent_name = agent.get("name", agent_id)
                model = agent.get("model", "default")
                if isinstance(model, dict):
                    model = model.get("primary", "unknown")
                model_short = model.split("/")[-1] if isinstance(model, str) and "/" in model else model
                model_info.append({
                    "agent": agent_id,
                    "agent_name": agent_name,
                    "kind": "other",
                    "model": model_short,
                    "full_model": model,
                    "session_id": "n/a",
                    "age": "config",
                    "channel": "feishu",
                    "display_name": agent_name,
                })

        from collections import Counter
        model_counts = Counter([s["full_model"] for s in model_info])

        return {
            "code": 0,
            "message": "success",
            "data": {
                "total": len(model_info),
                "max_age_hours": max_age_hours,
                "sessions": model_info,
                "model_distribution": dict(model_counts),
                "note": "CLI preferred; config fallback used if CLI unavailable",
                "cli_errors": cli_errors,
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/restart-gateway")
def restart_gateway():
    """重启 OpenClaw Gateway"""
    try:
        import logging
        logger = logging.getLogger(__name__)
        logger.info("Restarting OpenClaw Gateway...")
        
        # 执行重启命令
        result = subprocess.run(
            ["openclaw", "gateway", "restart"],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            logger.info("Gateway restarted successfully")
            return {
                "code": 0,
                "message": "Gateway 重启成功",
                "data": {"output": result.stdout}
            }
        else:
            logger.error(f"Gateway restart failed: {result.stderr}")
            return {
                "code": 500,
                "message": f"重启失败: {result.stderr}",
                "data": None
            }
    except subprocess.TimeoutExpired:
        return {"code": 500, "message": "重启超时", "data": None}
    except Exception as e:
        return {"code": 500, "message": f"错误: {str(e)}", "data": None}


if __name__ == "__main__":
    import uvicorn
    # 启动服务：0.0.0.0:8080
    uvicorn.run(app, host="0.0.0.0", port=8080)
