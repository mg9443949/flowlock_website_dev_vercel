document.addEventListener("DOMContentLoaded", async () => {
  const statusContainer = document.getElementById("statusContainer");
  const blockedStatusContainer = document.getElementById("blockedStatusContainer");
  const loginForm = document.getElementById("loginForm");
  const connectedView = document.getElementById("connectedView");
  const connectBtn = document.getElementById("connectBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  async function updateUI() {
    const data = await chrome.storage.local.get([
      'sb-access-token',
      'sb-user-id',
      'sessionActive',
      'blockedCount',
      'extensionConnected'
    ]);

    const token = data['sb-access-token'];
    const userId = data['sb-user-id'];
    const connected = data['extensionConnected'];

    if (token && userId && connected) {
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

  // Initial render
  await updateUI();

  // Watch for storage changes so popup updates live
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (
      changes['sb-access-token'] ||
      changes['sb-user-id'] ||
      changes['sessionActive'] ||
      changes['blockedCount'] ||
      changes['extensionConnected']
    )) {
      updateUI();
    }
  });

  // ── Connect button ────────────────────────────────────────────────────────
  connectBtn.addEventListener("click", async () => {
    connectBtn.textContent = "Connecting...";
    connectBtn.disabled = true;

    const FLOWLOCK_URL = "https://flowlock-website-dev-vercel.vercel.app";

    // Check if a FlowLock tab is already open
    const existingTabs = await chrome.tabs.query({ url: FLOWLOCK_URL + "/*" });

    let tab;
    if (existingTabs.length > 0) {
      // Reuse existing tab and bring it to focus
      tab = existingTabs[0];
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    } else {
      // Open a new FlowLock tab (dashboard, not a non-existent callback page)
      tab = await chrome.tabs.create({ url: FLOWLOCK_URL + "/dashboard" });
    }

    // Wait for the tab to finish loading, then dispatch the connect event
    // content.js is already injected on FlowLock pages and listening for this event
    function onTabUpdated(tabId, changeInfo) {
      if (tabId !== tab.id || changeInfo.status !== 'complete') return;

      chrome.tabs.onUpdated.removeListener(onTabUpdated);

      // Dispatch the custom event into the page — content.js picks this up
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          window.dispatchEvent(new Event('flowlock:connect_extension'));
        }
      }).then(() => {
        console.log('[FlowLock Popup] flowlock:connect_extension dispatched');
      }).catch(err => {
        console.error('[FlowLock Popup] Failed to dispatch event:', err);
      });
    }

    // If the tab is already loaded (reused tab), fire immediately
    if (existingTabs.length > 0) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          window.dispatchEvent(new Event('flowlock:connect_extension'));
        }
      }).catch(err => console.error('[FlowLock Popup] Script injection failed:', err));
    } else {
      // New tab — wait for it to load first
      chrome.tabs.onUpdated.addListener(onTabUpdated);
    }

    // Reset button after 3 seconds (UI will auto-update via storage listener when connected)
    setTimeout(() => {
      connectBtn.textContent = "Connect with FlowLock";
      connectBtn.disabled = false;
    }, 3000);
  });

  // ── Disconnect button ─────────────────────────────────────────────────────
  logoutBtn.addEventListener("click", async () => {
    logoutBtn.textContent = "Disconnecting...";
    logoutBtn.disabled = true;

    try {
      await chrome.runtime.sendMessage({ type: 'DISCONNECT' });
    } catch (e) {
      // Fallback if service worker is inactive
      await chrome.storage.local.remove([
        'sb-access-token',
        'sb-refresh-token',
        'sb-user-id',
        'sessionActive',
        'blockedCount',
        'extensionConnected'
      ]);
    }

    await updateUI();
    logoutBtn.textContent = "Disconnect";
    logoutBtn.disabled = false;
  });
});