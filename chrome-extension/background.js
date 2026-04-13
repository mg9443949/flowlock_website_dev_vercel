let blockedSites = [
  "youtube.com",
  "instagram.com",
  "facebook.com"
];

// 🔥 Check every tab update
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.url) return;

  checkAndBlock(tabId, tab.url);
});

// 🔥 More reliable navigation detection
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return;

  chrome.tabs.get(details.tabId, (tab) => {
    if (tab?.url) {
      checkAndBlock(details.tabId, tab.url);
    }
  });
});

// 🔥 Core blocking logic
function checkAndBlock(tabId, url) {
  const isBlocked = blockedSites.some(site => url.includes(site));

  if (isBlocked) {
    console.log("[FlowLock] Blocking:", url);

    chrome.tabs.update(tabId, {
      url: "https://flowlock-website-dev-vercel.vercel.app/blocked"
    });
  }
}