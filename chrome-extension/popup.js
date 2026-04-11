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
      'blockedCount'
    ]);

    const token = data['sb-access-token'];
    const userId = data['sb-user-id'];

    if (token && userId) {
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
      changes['blockedCount']
    )) {
      updateUI();
    }
  });

  // Connect button → open FlowLock dashboard for login
  connectBtn.addEventListener("click", () => {
    chrome.tabs.create({
      url: "https://flowlock-website-dev-vercel.vercel.app/auth/extension-callback"
    });
  });

  // ✅ FIX — Disconnect: send DISCONNECT message to background
  // which calls disconnectAndClear() to wipe token + clear all blocking rules atomically
  logoutBtn.addEventListener("click", async () => {
    logoutBtn.textContent = "Disconnecting...";
    logoutBtn.disabled = true;

    try {
      await chrome.runtime.sendMessage({ type: 'DISCONNECT' });
    } catch (e) {
      // Service worker may be inactive — clear storage directly as fallback
      await chrome.storage.local.remove([
        'sb-access-token',
        'sb-refresh-token',
        'sb-user-id',
        'sessionActive',
        'blockedCount'
      ]);
    }

    await updateUI();
    logoutBtn.textContent = "Disconnect";
    logoutBtn.disabled = false;
  });
});