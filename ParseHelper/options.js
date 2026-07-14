// ============================================================
// 设置页面逻辑
// ============================================================

const DEFAULT_PARSER_URL = "https://your-worker-domain.workers.dev/parse?url=";

const parserUrlInput = document.getElementById('parserUrl');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const statusDiv = document.getElementById('status');

// -------- 显示状态 --------
function showStatus(message, isError = false) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${isError ? 'error' : 'success'}`;
  setTimeout(() => {
    statusDiv.className = 'status';
  }, 3000);
}

// -------- 加载设置 --------
async function loadSettings() {
  const result = await chrome.storage.sync.get(['parserUrl']);
  parserUrlInput.value = result.parserUrl || DEFAULT_PARSER_URL;
}

// -------- 保存设置 --------
async function saveSettings() {
  let parserUrl = parserUrlInput.value.trim();

  if (!parserUrl) {
    showStatus('❌ 请输入解析服务器地址', true);
    return;
  }

  if (!parserUrl.startsWith('http://') && !parserUrl.startsWith('https://')) {
    showStatus('❌ 请输入有效的URL（以 http:// 或 https:// 开头）', true);
    return;
  }

  if (!parserUrl.includes('?url=')) {
    if (parserUrl.includes('?')) {
      parserUrl += '&url=';
    } else {
      parserUrl += '?url=';
    }
  }

  await chrome.storage.sync.set({ parserUrl });
  showStatus('✅ 设置已保存！');

  chrome.runtime.sendMessage({ action: "settingsUpdated" });
}

// -------- 恢复默认 --------
async function resetSettings() {
  await chrome.storage.sync.set({ parserUrl: DEFAULT_PARSER_URL });
  parserUrlInput.value = DEFAULT_PARSER_URL;
  showStatus('✅ 已恢复默认设置');
  chrome.runtime.sendMessage({ action: "settingsUpdated" });
}

// -------- 事件绑定 --------
saveBtn.addEventListener('click', saveSettings);
resetBtn.addEventListener('click', resetSettings);

parserUrlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') saveSettings();
});

// -------- 加载 --------
loadSettings();
