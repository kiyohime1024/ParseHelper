const parserUrlInput = document.getElementById('parserUrl');
const saveBtn = document.getElementById('saveBtn');
const statusDiv = document.getElementById('status');

const DEFAULT_PARSER_URL = 'https://your-worker-domain.workers.dev/parse?url=';

async function loadSettings() {
  const result = await chrome.storage.sync.get(['parserUrl']);
  parserUrlInput.value = result.parserUrl || DEFAULT_PARSER_URL;
}

function showStatus(message) {
  statusDiv.textContent = message;
}

async function saveSettings() {
  let parserUrl = parserUrlInput.value.trim();

  if (!parserUrl) {
    showStatus('请输入解析服务器地址');
    return;
  }

  if (!parserUrl.startsWith('http://') && !parserUrl.startsWith('https://')) {
    showStatus('请输入有效的URL');
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
  showStatus('已保存');
  chrome.runtime.sendMessage({ action: 'settingsUpdated' });
}

saveBtn.addEventListener('click', saveSettings);
parserUrlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') saveSettings();
});

loadSettings();
