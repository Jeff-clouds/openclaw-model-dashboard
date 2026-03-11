const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 18790;

// 配置文件路径
const CONFIG_PATH = '/root/.openclaw/openclaw.json';
const GATEWAY_RESTART_CMD = 'openclaw gateway restart';

// 中间件
app.use(express.json());
app.use(express.static(__dirname + '/public'));

// 读取配置
function readConfig() {
  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

// 保存配置
function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

// 获取所有可用模型列表
function getAllModels(config) {
  const models = [];
  const providers = config.models?.providers || {};
  
  for (const [providerId, provider] of Object.entries(providers)) {
    if (provider.models && Array.isArray(provider.models)) {
      for (const model of provider.models) {
        const modelId = model.id || model.name;
        if (modelId) {
          models.push(`${providerId}/${modelId}`);
        }
      }
    }
  }
  
  return [...new Set(models)];
}

// API: 获取所有 agent 列表及其当前模型
app.get('/api/agents', async (req, res) => {
  try {
    const config = readConfig();
    if (!config) {
      return res.status(500).json({ error: 'Failed to read config' });
    }

    const agents = [];
    const defaultModel = config.agents?.defaults?.model?.primary || 'stepfun/step-3.5-flash';
    const defaultFallbacks = config.agents?.defaults?.model?.fallbacks || [];

    // 遍历 agent 列表
    for (const agent of config.agents?.list || []) {
      // 获取 agent 的模型配置
      let agentModel = defaultModel;
      let agentFallbacks = defaultFallbacks;
      
      if (agent.model) {
        agentModel = agent.model.primary || agent.model;
        agentFallbacks = agent.model.fallbacks || agentFallbacks;
      }

      agents.push({
        id: agent.id,
        name: agent.name || agent.id,
        model: agentModel,
        fallbacks: agentFallbacks,
        workspace: agent.workspace || config.agents?.defaults?.workspace
      });
    }

    res.json({
      agents,
      defaultModel,
      allModels: getAllModels(config)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: 更新指定 agent 的模型（直接修改配置文件）
app.post('/api/update-model', async (req, res) => {
  try {
    const { agentId, model } = req.body;
    if (!agentId || !model) {
      return res.status(400).json({ error: 'agentId and model are required' });
    }

    const config = readConfig();
    if (!config) {
      return res.status(500).json({ error: 'Failed to read config' });
    }

    // 验证 agent 是否存在
    const agent = config.agents?.list?.find(a => a.id === agentId);
    if (!agent) {
      return res.status(404).json({ error: `Agent '${agentId}' not found` });
    }

    // 验证模型是否可用
    const allModels = getAllModels(config);
    if (!allModels.includes(model)) {
      return res.status(400).json({ error: `Model '${model}' is not available` });
    }

    // 直接修改配置文件中的 agent 模型
    // 支持两种格式：agent.model (字符串) 或 agent.model.primary (对象)
    if (!config.agents.list) {
      config.agents.list = [];
    }

    const agentIndex = config.agents.list.findIndex(a => a.id === agentId);
    if (agentIndex === -1) {
      // 添加新 agent（不应该发生）
      config.agents.list.push({ id: agentId, model: model });
    } else {
      // 更新现有 agent
      config.agents.list[agentIndex].model = model;
    }

    // 保存配置
    writeConfig(config);

    // 重启 Gateway 以应用配置
    await new Promise((resolve, reject) => {
      exec(GATEWAY_RESTART_CMD, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve(stdout);
        }
      });
    });

    // 读取更新后的配置以返回最新状态
    const updatedConfig = readConfig();
    const updatedAgent = updatedConfig.agents.list.find(a => a.id === agentId);
    const updatedModel = updatedAgent?.model?.primary || updatedAgent?.model || model;

    res.json({
      success: true,
      agentId,
      model: updatedModel,
      message: `Agent ${agentId} model updated to ${model}. Gateway restarted.`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: 查询用量（通过 models.list）
app.get('/api/usage', async (req, res) => {
  try {
    // 直接调用 CLI 获取用量
    const token = readConfig()?.gateway?.auth?.token || '';
    const cmd = `openclaw gateway call models.list --params '{}' --url ws://127.0.0.1:18789 --token "${token}" 2>&1`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ error: stderr || error.message });
      }
      try {
        // 提取 JSON
        const firstBrace = stdout.indexOf('{');
        const lastBrace = stdout.lastIndexOf('}');
        let jsonStr;
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = stdout.substring(firstBrace, lastBrace + 1);
        } else {
          jsonStr = stdout;
        }
        const result = JSON.parse(jsonStr);
        res.json(result);
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse usage: ' + e.message });
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: 获取当前配置信息
app.get('/api/config', (req, res) => {
  try {
    const config = readConfig();
    if (!config) {
      return res.status(500).json({ error: 'Failed to read config' });
    }
    res.json({
      gatewayToken: config.gateway?.auth?.token ? '***' + config.gateway.auth.token.slice(-4) : null,
      models: getAllModels(config),
      defaultModel: config.agents?.defaults?.model?.primary
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`OpenClaw WebChat (Config Manager) running at http://0.0.0.0:${PORT}`);
  console.log(`Gateway: ws://127.0.0.1:18789`);
});
