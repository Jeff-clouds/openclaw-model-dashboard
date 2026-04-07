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
  // 主题切换持久化
  try {
    const saved = localStorage.getItem('oc-theme');
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (e) {}

  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme') || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      try { localStorage.setItem('oc-theme', next); } catch (e) {}
      // 切换图标
      toggle.innerHTML = next === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    });
  }

  await loadData();
});

/**
 * 加载数据
 */
async function loadData() {
  showLoading();
  
  try {
    // 并行加载 Agent、模型列表和会话模型信息
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
    
    // 加载会话模型信息（不阻塞主页面显示）
    loadSessionsModels();
    
    showMain();
    
  } catch (error) {
    showError(error.message);
  }
}

/**
 * 加载会话模型信息
 */
async function loadSessionsModels() {
  const countEl = document.getElementById('sessionsCount');
  const listEl = document.getElementById('sessionsList');
  const distEl = document.getElementById('modelDistribution');
  
  countEl.textContent = '加载中...';
  listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">加载中...</div>';
  
  try {
    const response = await fetch(`${API_BASE}/api/sessions/models`);
    if (!response.ok) throw new Error('获取会话模型信息失败');
    
    const data = await response.json();
    if (data.code !== 0) throw new Error(data.message);
    
    const { total, sessions, model_distribution } = data.data;
    
    // 更新统计
    countEl.textContent = `共 ${total} 个活跃会话（24小时内）`;
    
    // 渲染会话列表
    renderSessionsList(sessions);
    
    // 渲染模型分布
    renderModelDistribution(model_distribution);
    
  } catch (error) {
    countEl.textContent = '加载失败';
    listEl.innerHTML = `<div style="text-align:center;padding:20px;color:#e74c3c;">❌ ${error.message}</div>`;
  }
}

/**
 * 渲染会话列表
 */
function renderSessionsList(sessions) {
  const container = document.getElementById('sessionsList');
  container.innerHTML = '';
  
  if (sessions.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">暂无活跃会话（24小时内）</div>';
    return;
  }
  
  // 保持后端返回的时间顺序（从新到旧），不重新排序
  sessions.forEach(session => {
    const item = document.createElement('div');
    item.className = 'session-item';
    
    // 格式化 kind 显示
    const kindMap = {
      'group': '群聊',
      'other': '其他',
      'direct': '私聊'
    };
    const kindText = kindMap[session.kind] || session.kind;
    
    // 显示年龄信息
    const ageText = session.age ? ` · ${session.age}前` : '';
    
    item.innerHTML = `
      <div class="session-info">
        <span class="session-agent">${session.agent}</span>
        <span class="session-meta">${kindText}${ageText} · ${session.session_id}</span>
      </div>
      <span class="session-model">${session.model}</span>
    `;
    
    container.appendChild(item);
  });
}

/**
 * 渲染模型分布统计
 */
function renderModelDistribution(distribution) {
  const container = document.getElementById('modelDistribution');
  
  // 按使用数量排序
  const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  
  const itemsHtml = sorted.map(([model, count]) => `
    <div class="distribution-item">
      <span class="model-name">${model}</span>
      <span class="model-count">${count}</span>
    </div>
  `).join('');
  
  container.innerHTML = `
    <h3>📈 模型分布</h3>
    <div class="distribution-list">
      ${itemsHtml}
    </div>
  `;
}

// 存储待保存的模型变更
window.pendingModelChanges = {};

/**
 * 渲染 Agent 列表（带模型选择下拉框）
 */
function renderAgents() {
  const container = document.getElementById('agentList');
  container.innerHTML = '';
  
  if (agents.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#999;">暂无 Agent</p>';
    return;
  }
  
  // 按 Provider 分组模型（用于下拉框）
  const groupedModels = {};
  models.forEach(model => {
    const provider = model.provider || 'other';
    if (!groupedModels[provider]) {
      groupedModels[provider] = [];
    }
    groupedModels[provider].push(model);
  });
  
  agents.forEach(agent => {
    const item = document.createElement('div');
    item.className = 'agent-item';
    
    const emoji = agent.identityEmoji || agent.emoji || '🤖';
    // 优先使用 openclaw.json 中的 name，其次是 identityName，最后是 id
    const name = agent.name || agent.identityName || agent.id;
    const currentModel = agent.model || '未设置';
    
    // 检查是否有待保存的变更
    const pendingModel = window.pendingModelChanges[agent.id];
    const displayModel = pendingModel || currentModel;
    const hasChange = pendingModel && pendingModel !== currentModel;
    
    // 创建模型选择下拉框
    let modelSelectHtml = `<select class="agent-model-select" data-agent-id="${agent.id}" onchange="onAgentModelChange(this)">`;
    modelSelectHtml += `<option value="">${currentModel}</option>`;
    
    Object.keys(groupedModels).sort().forEach(provider => {
      modelSelectHtml += `<optgroup label="${provider}">`;
      groupedModels[provider].forEach(model => {
        const selected = pendingModel === model.key ? 'selected' : '';
        modelSelectHtml += `<option value="${model.key}" ${selected}>${model.name}</option>`;
      });
      modelSelectHtml += `</optgroup>`;
    });
    modelSelectHtml += `</select>`;
    
    // 提取 workspace 名称（从路径中提取最后一部分）
    const workspacePath = agent.workspace || '';
    const workspaceName = workspacePath.split('/').pop() || 'default';
    
    // 显示代码名称（id）和 workspace
    const codeName = agent.id || 'unknown';
    
    item.innerHTML = `
      <div class="agent-info">
        <span class="agent-emoji">${emoji}</span>
        <div class="agent-details">
          <div class="agent-name-row">
            <span class="agent-name">${name}</span>
            <span class="agent-meta">
              <span class="agent-code-name">${codeName}</span>
              <span class="agent-workspace">📁 ${workspaceName}</span>
            </span>
          </div>
          <div class="agent-model-select-wrapper full-width">
            ${modelSelectHtml}
            ${hasChange ? '<span class="change-indicator">●</span>' : ''}
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(item);
  });
  
  // 添加统一保存按钮
  renderSaveButton();
}

/**
 * Agent 模型变更处理
 */
function onAgentModelChange(select) {
  const agentId = select.dataset.agentId;
  const newModel = select.value;
  
  if (newModel) {
    window.pendingModelChanges[agentId] = newModel;
  } else {
    delete window.pendingModelChanges[agentId];
  }
  
  // 重新渲染以显示变更标记
  renderAgents();
}

/**
 * 渲染统一保存按钮
 */
function renderSaveButton() {
  const container = document.getElementById('agentList');
  const changeCount = Object.keys(window.pendingModelChanges).length;

  // 移除旧的保存栏
  const old = document.getElementById('saveAllModelsBtn');
  if (old) old.remove();

  if (changeCount > 0) {
    const bar = document.createElement('div');
    bar.id = 'saveAllModelsBtn';
    bar.className = 'floating-savebar';
    bar.innerHTML = `
      <div class="savebar-text">
        <span class="dot"></span>
        已选择 <strong>${changeCount}</strong> 个 Agent 的模型变更
      </div>
      <button class="btn btn-primary" onclick="saveAllModelChanges()">
        <i class="fa-solid fa-floppy-disk"></i> 保存所有变更
      </button>
    `;
    document.body.appendChild(bar);
  }
}

/**
 * 保存所有模型变更
 */
async function saveAllModelChanges() {
  const changes = window.pendingModelChanges;
  const changeCount = Object.keys(changes).length;
  
  if (changeCount === 0) {
    alert('没有待保存的变更');
    return;
  }
  
  // 显示加载状态
  const saveBtn = document.querySelector('#saveAllModelsBtn .btn-primary');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 保存中...';
  }
  
  const results = [];
  const errors = [];
  
  // 逐个保存变更
  for (const [agentId, modelId] of Object.entries(changes)) {
    try {
      const response = await fetch(`${API_BASE}/api/agents/${agentId}/model`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ modelId: modelId })
      });
      
      const result = await response.json();
      
      if (response.ok && result.code === 0) {
        results.push(`${agentId}: ${result.data.previous_model} → ${result.data.new_model}`);
      } else {
        errors.push(`${agentId}: ${result.message || '保存失败'}`);
      }
    } catch (error) {
      errors.push(`${agentId}: ${error.message}`);
    }
  }
  
  // 清空待保存变更
  window.pendingModelChanges = {};
  
  // 重新加载数据
  await loadData();
  
  // 显示结果
  if (errors.length === 0) {
    showSuccess(`✅ 成功保存 ${results.length} 个变更！`);
  } else {
    showError(`部分保存失败。成功：${results.length} 个；失败：${errors.length} 个。`);
    console.warn('保存失败详情：', errors);
  }
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
  
  // 按 Provider 分组
  const groupedModels = {};
  models.forEach(model => {
    const provider = model.provider || 'other';
    if (!groupedModels[provider]) {
      groupedModels[provider] = [];
    }
    groupedModels[provider].push(model);
  });
  
  // 存储 provider 展开状态
  window.providerExpanded = window.providerExpanded || {};
  
  // 添加全局展开/收起按钮到 section-tools
  const allExpanded = Object.values(window.providerExpanded).every(v => v !== false);
  const modelCount = document.getElementById('modelCount');
  if (modelCount) {
    modelCount.textContent = `${models.length} 个模型`;
  }
  const toolsDiv = document.querySelector('.model-list ~ .section-tools, #modelList .section-tools');
  const existingBtn = document.querySelector('#modelList + .section-tools button');
  if (!existingBtn) {
    const headerDiv = document.createElement('div');
    headerDiv.innerHTML = `
      <button class="btn btn-secondary" onclick="toggleAllProviders(${allExpanded ? 'false' : 'true'})">
        ${allExpanded ? '📥 全部收起' : '📤 全部展开'}
      </button>
    `;
    const toolsContainer = document.querySelector('.section-card:nth-of-type(3) .section-tools');
    if (toolsContainer && !toolsContainer.querySelector('button')) {
      toolsContainer.appendChild(headerDiv.firstElementChild);
    }
  }
  container.style.marginTop = '0';
  
  // 渲染每个 Provider 的模型
  Object.keys(groupedModels).sort().forEach(provider => {
    const providerModels = groupedModels[provider];
    const isExpanded = window.providerExpanded[provider] !== false; // 默认展开
    
    // Provider 标题
    const providerTitle = document.createElement('div');
    providerTitle.className = 'provider-title';
    providerTitle.innerHTML = `<span class="arrow">${isExpanded ? '▼' : '▶'}</span><strong>${provider}</strong> (${providerModels.length}个模型)`;
    providerTitle.onclick = () => toggleProvider(provider, providerTitle, grid);
    container.appendChild(providerTitle);
    
    // 模型网格
    const grid = document.createElement('div');
    grid.className = 'model-list';
    grid.setAttribute('data-provider', provider);
    grid.style.display = isExpanded ? 'grid' : 'none';
    
    providerModels.forEach(model => {
      const item = document.createElement('div');
      item.className = 'model-item';
      
      const tags = model.tags || [];
      const tagsHtml = tags.map(tag => `<span class="model-tag">${tag}</span>`).join('');
      
      item.innerHTML = `
        <div class="model-name">${model.name}</div>
        <div class="model-id">${model.key}</div>
        <div class="model-info">
          ${model.contextWindow ? '上下文：' + (model.contextWindow / 1000).toFixed(0) + 'K' : ''}
        </div>
        ${tagsHtml}
      `;
      
      grid.appendChild(item);
    });
    
    container.appendChild(grid);
  });
}

/**
 * 一键展开/收起所有 Provider
 */
function toggleAllProviders(expand) {
  // 获取所有 provider
  const providerTitles = document.querySelectorAll('.provider-title');
  const modelGrids = document.querySelectorAll('.model-list[data-provider]');
  
  providerTitles.forEach((title, index) => {
    const provider = title.querySelector('strong').textContent;
    window.providerExpanded[provider] = expand;
    
    const arrow = title.querySelector('.arrow');
    arrow.textContent = expand ? '▼' : '▶';
    
    if (modelGrids[index]) {
      modelGrids[index].style.display = expand ? 'grid' : 'none';
    }
  });
  
  // 重新渲染以更新按钮文字
  renderModels();
}

/**
 * 切换 Provider 展开/收起
 */
function toggleProvider(provider, titleEl, gridEl) {
  const isExpanded = window.providerExpanded[provider] !== false;
  window.providerExpanded[provider] = !isExpanded;
  
  // 切换箭头
  const arrow = titleEl.querySelector('.arrow');
  arrow.textContent = !isExpanded ? '▼' : '▶';
  
  // 切换 grid 显示
  gridEl.style.display = !isExpanded ? 'grid' : 'none';
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
  
  // 填充模型选择器（按 Provider 分组显示）
  modelSelect.innerHTML = '';
  
  // 按 Provider 分组
  const groupedModels = {};
  models.forEach(model => {
    const provider = model.provider || 'other';
    if (!groupedModels[provider]) {
      groupedModels[provider] = [];
    }
    groupedModels[provider].push(model);
  });
  
  // 添加选项（分组显示）
  Object.keys(groupedModels).sort().forEach(provider => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = `${provider} (${groupedModels[provider].length})`;
    
    groupedModels[provider].forEach(model => {
      const option = document.createElement('option');
      option.value = model.key;
      option.textContent = model.name;
      if (model.key === agent.model) {
        option.selected = true;
      }
      optgroup.appendChild(option);
    });
    
    modelSelect.appendChild(optgroup);
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
  errorEl.className = 'alert alert-error';
  errorEl.textContent = '❌ ' + message;
  errorEl.style.display = 'block';
}

/**
 * 显示成功提示
 */
function showSuccess(message) {
  const successEl = document.createElement('div');
  successEl.className = 'alert alert-success';
  successEl.textContent = message;

  const main = document.getElementById('main');
  main.parentNode.insertBefore(successEl, main);

  // 3 秒后自动消失
  setTimeout(() => { successEl.remove(); }, 3000);
}

/**
 * 重启 Gateway
 */
async function restartGateway() {
  // 确认对话框
  if (!confirm('确定要重启 OpenClaw Gateway 吗？\n\n重启期间服务将暂时不可用。')) {
    return;
  }
  
  showLoading();
  
  try {
    const response = await fetch(`${API_BASE}/api/restart-gateway`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    
    if (data.code === 0) {
      showSuccess('✅ Gateway 重启指令已发送，请稍后刷新页面查看状态');
      showMain();
    } else {
      showError(data.message || '重启失败');
      // 错误时显示主内容，但错误提示会保留
      document.getElementById('main').style.display = 'block';
    }
  } catch (error) {
    showError('重启请求失败: ' + error.message);
    // 错误时显示主内容，但错误提示会保留
    document.getElementById('main').style.display = 'block';
  }
}
