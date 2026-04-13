let blockedSites = [
  "youtube.com",
  "instagram.com",
  "facebook.com"
];

let isSessionActive = false;

// 🔥 HANDLE MESSAGES FROM CONTENT SCRIPT
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "flowlock-connection") return;

  console.log("[FlowLock BG] Port connected");

  port.onMessage.addListener((msg) => {

    if (msg.type === "AUTH_UPDATE") {
      console.log("[FlowLock BG] Auth received");
    }

    if (msg.type === "START_SESSION") {
      console.log("[FlowLock BG] Study session STARTED");
      isSessionActive = true;
    }

    if (msg.type === "END_SESSION") {
      console.log("[FlowLock BG] Study session ENDED");
      isSessionActive = false;
    }
  });
});

// 🔥 TAB MONITORING
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.url) return;
  checkAndBlock(tabId, tab.url);
});

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return;

  chrome.tabs.get(details.tabId, (tab) => {
    if (tab?.url) {
      checkAndBlock(details.tabId, tab.url);
    }
  });
});

// 🔥 BLOCKING LOGIC (FIXED)
function checkAndBlock(tabId, url) {

  // ✅ ONLY block if session is active
  if (!isSessionActive) return;

  const isBlocked = blockedSites.some(site => url.includes(site));

  if (isBlocked) {
    console.log("[FlowLock] Blocking:", url);

    chrome.tabs.update(tabId, {
      url: "https://flowlock-website-dev-vercel.vercel.app/blocked"
    });
  }
}