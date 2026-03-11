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
    使用 openclaw agents list --json 命令
    """
    try:
        result = subprocess.run(
            ["openclaw", "agents", "list", "--json"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"CLI error: {result.stderr}")
        
        agents = json.loads(result.stdout)
        return {"code": 0, "message": "success", "data": agents}
    
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="CLI timeout")
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


if __name__ == "__main__":
    import uvicorn
    # 启动服务：0.0.0.0:8080
    uvicorn.run(app, host="0.0.0.0", port=8080)
