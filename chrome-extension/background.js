let currentSession = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AUTH_UPDATE") {
    currentSession = message.payload;

    console.log("[FlowLock BG] Auth updated:", currentSession);

    sendResponse({ ok: true });
  }

  if (message.type === "DISCONNECT") {
    currentSession = null;
    console.log("[FlowLock BG] Disconnected");

    sendResponse({ ok: true });
  }

  return true;
});

// OPTIONAL: Debug helper
chrome.runtime.onInstalled.addListener(() => {
  console.log("[FlowLock BG] Extension installed/reloaded");
});