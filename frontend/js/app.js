/**
 * OpenClaw 模型管理工具 - 前端逻辑
 * 功能：获取 Agent 列表、模型列表，切换模型
 */

// API 基础 URL（生产环境应配置）
const API_BASE = window.location.origin;

// 全局状态
let agents = [];
let models = [];
let currentSwitchAgent = null;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
});

/**
 * 加载数据
 */
async function loadData() {
  showLoading();
  
  try {
    // 并行加载 Agent 和模型列表
    const [agentsRes, modelsRes] = await Promise.all([
      fetch(`${API_BASE}/api/agents`),
      fetch(`${API_BASE}/api/models`)
    ]);
    
    if (!agentsRes.ok) throw new Error('获取 Agent 列表失败');
    if (!modelsRes.ok) throw new Error('获取模型列表失败');
    
    const agentsData = await agentsRes.json();
    const modelsData = await modelsRes.json();
    
    if (agentsData.code !== 0) throw new Error(agentsData.message);
    if (modelsData.code !== 0) throw new Error(modelsData.message);
    
    agents = agentsData.data;
    models = modelsData.data;
    
    renderAgents();
    renderModels();
    showMain();
    
  } catch (error) {
    showError(error.message);
  }
}

/**
 * 渲染 Agent 列表
 */
function renderAgents() {
  const container = document.getElementById('agentList');
  container.innerHTML = '';
  
  if (agents.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#999;">暂无 Agent</p>';
    return;
  }
  
  agents.forEach(agent => {
    const item = document.createElement('div');
    item.className = 'agent-item';
    item.onclick = () => showSwitchPanel(agent);
    
    const emoji = agent.identityEmoji || agent.emoji || '🤖';
    const name = agent.identityName || agent.name || agent.id;
    const model = agent.model || '未设置';
    
    item.innerHTML = `
      <div class="agent-info">
        <span class="agent-emoji">${emoji}</span>
        <div class="agent-details">
          <span class="agent-name">${name}</span>
          <span class="agent-model">当前模型：${model}</span>
        </div>
      </div>
      <span class="agent-status">运行中</span>
    `;
    
    container.appendChild(item);
  });
}

/**
 * 渲染模型列表
 */
function renderModels() {
  const container = document.getElementById('modelList');
  container.innerHTML = '';
  
  if (models.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#999;">暂无模型</p>';
    return;
  }
  
  models.forEach(model => {
    const item = document.createElement('div');
    item.className = 'model-item';
    
    const tags = model.tags || [];
    const tagsHtml = tags.map(tag => `<span class="model-tag">${tag}</span>`).join('');
    
    item.innerHTML = `
      <div class="model-name">${model.name}</div>
      <div class="model-info">
        ${model.input ? '输入：' + model.input : ''}
        ${model.contextWindow ? ' | 上下文：' + (model.contextWindow / 1000).toFixed(0) + 'K' : ''}
      </div>
      ${tagsHtml}
    `;
    
    container.appendChild(item);
  });
}

/**
 * 显示切换面板
 */
function showSwitchPanel(agent) {
  currentSwitchAgent = agent;
  
  const panel = document.getElementById('switchPanel');
  const agentNameEl = document.getElementById('switchAgentName');
  const currentModelEl = document.getElementById('switchCurrentModel');
  const modelSelect = document.getElementById('modelSelect');
  
  // 设置 Agent 信息
  const name = agent.identityName || agent.name || agent.id;
  agentNameEl.textContent = name;
  currentModelEl.textContent = `当前：${agent.model || '未设置'}`;
  
  // 填充模型选择器
  modelSelect.innerHTML = '';
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model.key;
    option.textContent = model.name;
    if (model.key === agent.model) {
      option.selected = true;
    }
    modelSelect.appendChild(option);
  });
  
  // 显示面板
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth' });
}

/**
 * 取消切换
 */
function cancelSwitch() {
  currentSwitchAgent = null;
  document.getElementById('switchPanel').style.display = 'none';
}

/**
 * 切换模型
 */
async function switchModel() {
  if (!currentSwitchAgent) return;
  
  const modelSelect = document.getElementById('modelSelect');
  const newModel = modelSelect.value;
  
  if (!newModel) {
    alert('请选择模型');
    return;
  }
  
  // 禁用按钮防止重复点击
  const btns = document.querySelectorAll('.switch-actions .btn');
  btns.forEach(btn => btn.disabled = true);
  
  try {
    const response = await fetch(`${API_BASE}/api/agents/${currentSwitchAgent.id}/model`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ modelId: newModel })
    });
    
    const result = await response.json();
    
    if (response.ok && result.code === 0) {
      // 切换成功
      showSuccess(`✅ ${result.message}\n${currentSwitchAgent.identityName || currentSwitchAgent.name} 已从 ${result.data.previous_model} 切换到 ${result.data.new_model}`);
      
      // 重新加载数据
      await loadData();
      cancelSwitch();
    } else {
      throw new Error(result.message || '切换失败');
    }
    
  } catch (error) {
    alert('❌ 切换失败：' + error.message);
  } finally {
    btns.forEach(btn => btn.disabled = false);
  }
}

/**
 * 显示加载状态
 */
function showLoading() {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('main').style.display = 'none';
  document.getElementById('error').style.display = 'none';
}

/**
 * 显示主内容
 */
function showMain() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('main').style.display = 'block';
  document.getElementById('error').style.display = 'none';
}

/**
 * 显示错误
 */
function showError(message) {
  document.getElementById('loading').style.display = 'none';
  const errorEl = document.getElementById('error');
  errorEl.textContent = '❌ ' + message;
  errorEl.style.display = 'block';
}

/**
 * 显示成功提示
 */
function showSuccess(message) {
  const successEl = document.createElement('div');
  successEl.className = 'success-message';
  successEl.textContent = message;
  
  const main = document.getElementById('main');
  main.insertBefore(successEl, main.firstChild);
  
  // 3 秒后自动消失
  setTimeout(() => {
    successEl.remove();
  }, 3000);
}
