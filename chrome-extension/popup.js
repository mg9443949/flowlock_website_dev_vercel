document.addEventListener("DOMContentLoaded", async () => {
  const statusContainer = document.getElementById("statusContainer");
  const blockedStatusContainer = document.getElementById("blockedStatusContainer");
  const loginForm = document.getElementById("loginForm");
  const connectedView = document.getElementById("connectedView");
  const connectBtn = document.getElementById("connectBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const FLOWLOCK_URL = "https://flowlock-website-dev-vercel.vercel.app";

  async function updateUI() {
    const data = await chrome.storage.local.get([
      'sb-access-token', 'sb-user-id', 'sessionActive',
      'blockedCount', 'extensionConnected'
    ]);

    const connected = data['extensionConnected'];
    const token = data['sb-access-token'];
    const userId = data['sb-user-id'];

    if (connected && token && userId) {
      statusContainer.textContent = "Connected to FlowLock";
      statusContainer.style.color = "#22c55e";
      loginForm.classList.add("hidden");
      connectedView.classList.remove("hidden");
      blockedStatusContainer.classList.remove("hidden");

      if (data.sessionActive) {
        const count = data.blockedCount || 0;
        blockedStatusContainer.textContent = `🔒 ${count} site${count !== 1 ? 's' : ''} currently blocked.`;
        blockedStatusContainer.style.color = "#ef4444";
      } else {
        blockedStatusContainer.textContent = "No active session — sites unblocked.";
        blockedStatusContainer.style.color = "#a1a1aa";
      }
    } else {
      statusContainer.textContent = "Not connected";
      statusContainer.style.color = "#ef4444";
      loginForm.classList.remove("hidden");
      connectedView.classList.add("hidden");
      blockedStatusContainer.classList.add("hidden");
    }
  }

  await updateUI();

  // Live update when storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (
      changes['sb-access-token'] || changes['sb-user-id'] ||
      changes['sessionActive'] || changes['blockedCount'] ||
      changes['extensionConnected']
    )) {
      updateUI();
    }
  });

  // ── Connect button ─────────────────────────────────────────────────────────
  connectBtn.addEventListener("click", async () => {
    connectBtn.textContent = "Connecting...";
    connectBtn.disabled = true;

    const existingTabs = await chrome.tabs.query({ url: FLOWLOCK_URL + "/*" });
    let tab;

    if (existingTabs.length > 0) {
      tab = existingTabs[0];
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    } else {
      tab = await chrome.tabs.create({ url: FLOWLOCK_URL + "/dashboard" });
    }

    const dispatchConnect = (tabId) => {
      chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.dispatchEvent(new Event('flowlock:connect_extension'))
      }).catch(err => console.error('[FlowLock Popup] Dispatch failed:', err));
    };

    if (existingTabs.length > 0) {
      dispatchConnect(tab.id);
    } else {
      const onTabUpdated = (tabId, changeInfo) => {
        if (tabId !== tab.id || changeInfo.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
        dispatchConnect(tabId);
      };
      chrome.tabs.onUpdated.addListener(onTabUpdated);
    }

    setTimeout(() => {
      connectBtn.textContent = "Connect with FlowLock";
      connectBtn.disabled = false;
    }, 3000);
  });

  // ── Disconnect button ──────────────────────────────────────────────────────
  logoutBtn.addEventListener("click", async () => {
    logoutBtn.textContent = "Disconnecting...";
    logoutBtn.disabled = true;

    try {
      await chrome.runtime.sendMessage({ type: 'DISCONNECT' });
    } catch (e) {
      await chrome.storage.local.remove([
        'sb-access-token', 'sb-refresh-token', 'sb-user-id',
        'sessionActive', 'blockedCount', 'extensionConnected'
      ]);
    }

    await updateUI();
    logoutBtn.textContent = "Disconnect";
    logoutBtn.disabled = false;
  });
});