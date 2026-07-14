// ============================================================
// 内容脚本 - 检测右键点击的视频元素，提取 BV 和分 P
// ============================================================

console.log("🎬 B站视频解析助手已加载");

function extractVideoInfoFromPageState() {
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

  if (window.__videoInfo?.bvid) {
    const pValue = window.__videoInfo?.p ?? null;
    const p = pValue ? Number.parseInt(String(pValue), 10) : null;
    return {
      bvid: window.__videoInfo.bvid,
      p: Number.isNaN(p) ? null : p
    };
  }

  return { bvid: null, p: null };
}

function extractVideoInfoFromUrl(url) {
  if (!url) return { bvid: null, p: null };

  try {
    const parsedUrl = new URL(url, window.location.href);
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

function extractVideoInfoFromElement(element) {
  let current = element;
  let maxDepth = 20;

  while (current && maxDepth-- > 0) {
    const bvid = current.getAttribute('data-bvid') || current.getAttribute('data-bv');
    if (bvid && bvid.startsWith('BV')) {
      return { bvid, p: null };
    }

    const href = current.href || current.getAttribute('href') || current.getAttribute('data-href');
    if (href) {
      const info = extractVideoInfoFromUrl(href);
      if (info.bvid) return info;
    }

    const dataSrc = current.getAttribute('data-src') || current.getAttribute('data-url');
    if (dataSrc) {
      const info = extractVideoInfoFromUrl(dataSrc);
      if (info.bvid) return info;
    }

    if (current.dataset?.bvid) {
      return { bvid: current.dataset.bvid, p: null };
    }

    current = current.parentElement;
  }

  return { bvid: null, p: null };
}

function findVideoInfoFromPage() {
  const fromState = extractVideoInfoFromPageState();
  if (fromState.bvid) return fromState;

  const fromLocation = extractVideoInfoFromUrl(window.location.href);
  if (fromLocation.bvid) return fromLocation;

  const meta = document.querySelector('meta[property="og:url"], meta[itemprop="url"]');
  if (meta?.content) {
    const info = extractVideoInfoFromUrl(meta.content);
    if (info.bvid) return info;
  }

  const firstLink = document.querySelector('a[href*="/video/BV"], a[href*="video/BV"], a[data-bvid]');
  if (firstLink?.href) {
    return extractVideoInfoFromUrl(firstLink.href);
  }
  if (firstLink?.getAttribute('data-bvid')) {
    return { bvid: firstLink.getAttribute('data-bvid'), p: null };
  }

  const searchCards = Array.from(document.querySelectorAll('a[href*="/video/"]'));
  for (const card of searchCards) {
    const info = extractVideoInfoFromUrl(card.href || card.getAttribute('href'));
    if (info.bvid) return info;
  }

  return { bvid: null, p: null };
}

function storeVideoInfo(info) {
  const normalized = info && info.bvid ? info : { bvid: null, p: null };
  window.__biliVideoInfo = normalized;
  window.__biliBvid = normalized.bvid;
  window.__biliP = normalized.p;
}

// -------- 监听右键点击 --------
document.addEventListener('contextmenu', (event) => {
  const clickedInfo = extractVideoInfoFromElement(event.target);
  const resolvedInfo = clickedInfo.bvid ? clickedInfo : findVideoInfoFromPage();
  storeVideoInfo(resolvedInfo);

  if (resolvedInfo.bvid) {
    console.log("📋 检测到视频BV:", resolvedInfo.bvid, "分P:", resolvedInfo.p ?? 1);
  } else {
    console.log("🔍 未检测到视频元素");
  }
}, true);

// -------- 页面加载时主动检测一次 --------
window.addEventListener('load', () => {
  setTimeout(() => {
    const info = findVideoInfoFromPage();
    storeVideoInfo(info);
    if (info.bvid) {
      console.log("📋 页面加载检测到BV:", info.bvid, "分P:", info.p ?? 1);
    }
  }, 500);
});

// -------- 监听URL变化（SPA页面） --------
let lastUrl = window.location.href;
new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    setTimeout(() => {
      const info = findVideoInfoFromPage();
      storeVideoInfo(info);
      if (info.bvid) {
        console.log("📋 URL变化检测到BV:", info.bvid, "分P:", info.p ?? 1);
      }
    }, 300);
  }
}).observe(document, { subtree: true, childList: true });
