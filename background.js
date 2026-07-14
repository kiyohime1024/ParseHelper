// ============================================================
// 后台服务 - 管理右键菜单、复制逻辑、设置存储
// ============================================================

const DEFAULT_PARSER_URL = "https://your-worker-domain.workers.dev/parse?url=";

// -------- 获取解析服务器地址 --------
async function getParserUrl() {
  const result = await chrome.storage.sync.get(['parserUrl']);
  return result.parserUrl || DEFAULT_PARSER_URL;
}

// -------- 创建右键菜单 --------
async function createContextMenu() {
  await chrome.contextMenus.removeAll();

  chrome.contextMenus.create({
    id: "copy-bili-parsed-url",
    title: "复制B站解析链接",
    contexts: ["all"]
  });
}

// -------- 复制到剪贴板（通过content script执行） --------
async function copyToClipboardViaScript(text, tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (copyText) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(copyText).then(() => {
            showToast("✅ 已复制解析链接", "success");
          }).catch(() => {
            fallbackCopy(copyText);
          });
        } else {
          fallbackCopy(copyText);
        }

        function fallbackCopy(text) {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
          document.body.appendChild(textarea);
          textarea.select();
          try {
            document.execCommand('copy');
            showToast("✅ 已复制解析链接", "success");
          } catch (e) {
            showToast("❌ 复制失败", "error");
          }
          document.body.removeChild(textarea);
        }

        function showToast(message, type) {
          const toast = document.createElement('div');
          toast.textContent = message;
          const bgColor = type === 'success' ? '#4caf50' : '#f44336';
          toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: ${bgColor};
            color: white;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 15px;
            font-family: system-ui, -apple-system, sans-serif;
            z-index: 999999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            animation: toastFade 2.2s ease forwards;
            pointer-events: none;
            user-select: none;
          `;

          const style = document.createElement('style');
          style.textContent = `
            @keyframes toastFade {
              0% { opacity: 0; transform: translateY(20px); }
              15% { opacity: 1; transform: translateY(0); }
              75% { opacity: 1; transform: translateY(0); }
              100% { opacity: 0; transform: translateY(-10px); }
            }
          `;
          document.head.appendChild(style);
          document.body.appendChild(toast);

          setTimeout(() => {
            toast.remove();
            style.remove();
          }, 2200);
        }
      },
      args: [text]
    });
    return true;
  } catch (err) {
    console.error('复制失败:', err);
    return false;
  }
}

// -------- 从页面获取 BV 和分 P 信息 --------
async function getVideoInfoFromPage(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        const initialState = window.__INITIAL_STATE__;
        const videoData = initialState?.videoData || initialState?.videoInfo || null;

        if (videoData?.bvid) {
          const pValue = initialState?.p ?? videoData?.p ?? null;
          const p = pValue ? Number.parseInt(String(pValue), 10) : null;
          return {
            bvid: videoData.bvid,
            p: Number.isNaN(p) ? null : p
          };
        }

        if (window.__biliVideoInfo && window.__biliVideoInfo.bvid) {
          return window.__biliVideoInfo;
        }

        return {
          bvid: window.__biliBvid || null,
          p: window.__biliP || null
        };
      }
    });
    return results[0]?.result || null;
  } catch (err) {
    return null;
  }
}

// -------- 从URL提取 BV、分P --------
function extractVideoInfoFromUrl(url) {
  if (!url) return { bvid: null, p: null };
  try {
    const parsedUrl = new URL(url);
    const match = parsedUrl.pathname.match(/\/video\/(BV\w+)/i);
    const bvid = match ? match[1] : null;
    const pValue = parsedUrl.searchParams.get('p') || parsedUrl.searchParams.get('page');
    const p = pValue ? Number.parseInt(pValue, 10) : null;
    return {
      bvid,
      p: Number.isNaN(p) ? null : p
    };
  } catch (err) {
    return { bvid: null, p: null };
  }
}

// -------- 拼接解析链接，保留 BV 和 P --------
function buildParsedUrl(parserUrl, bvid, p) {
  const endpoint = parserUrl.trim();
  const url = new URL(endpoint);
  url.searchParams.set('url', bvid);
  if (p !== null && p !== undefined) {
    url.searchParams.set('p', String(p));
  }
  return url.toString();
}

// -------- 监听右键菜单点击 --------
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "copy-bili-parsed-url") return;
  if (!tab || !tab.id) return;

  let videoInfo = await getVideoInfoFromPage(tab.id);
  let bvid = videoInfo?.bvid || null;
  let p = videoInfo?.p || null;

  if (!bvid) {
    const fallbackInfo = extractVideoInfoFromUrl(tab.url);
    bvid = fallbackInfo.bvid;
    p = fallbackInfo.p;
  }

  if (!bvid) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        showToast("⚠️ 未检测到视频，请右键点击视频封面或进入视频页面", "error");
        function showToast(message, type) {
          const toast = document.createElement('div');
          toast.textContent = message;
          const bgColor = type === 'success' ? '#4caf50' : (type === 'error' ? '#f44336' : '#ff9800');
          toast.style.cssText = `
            position: fixed; bottom: 30px; right: 30px;
            background: ${bgColor}; color: white;
            padding: 12px 24px; border-radius: 12px;
            font-size: 15px; font-family: system-ui, sans-serif;
            z-index: 999999; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            animation: toastFade 2.8s ease forwards;
            pointer-events: none; user-select: none;
            max-width: 400px;
          `;
          const style = document.createElement('style');
          style.textContent = `
            @keyframes toastFade {
              0% { opacity: 0; transform: translateY(20px); }
              15% { opacity: 1; transform: translateY(0); }
              75% { opacity: 1; transform: translateY(0); }
              100% { opacity: 0; transform: translateY(-10px); }
            }
          `;
          document.head.appendChild(style);
          document.body.appendChild(toast);
          setTimeout(() => { toast.remove(); style.remove(); }, 2800);
        }
      }
    });
    return;
  }

  const parserUrl = await getParserUrl();
  const parsedUrl = buildParsedUrl(parserUrl, bvid, p);
  await copyToClipboardViaScript(parsedUrl, tab.id);
});

// -------- 初始化 --------
chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
  chrome.storage.sync.get(['parserUrl'], (result) => {
    if (!result.parserUrl) {
      chrome.storage.sync.set({ parserUrl: DEFAULT_PARSER_URL });
    }
  });
});

// 标签页更新时重新创建菜单
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.url?.includes('bilibili.com')) {
    createContextMenu();
  }
});

// 监听设置更新
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "settingsUpdated") {
    createContextMenu();
  }
});
