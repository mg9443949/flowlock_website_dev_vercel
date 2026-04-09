document.addEventListener("DOMContentLoaded", async () => {
  const statusContainer = document.getElementById("statusContainer");
  const blockedStatusContainer = document.getElementById("blockedStatusContainer");
  const loginForm = document.getElementById("loginForm");
  const connectedView = document.getElementById("connectedView");
  const connectBtn = document.getElementById("connectBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  async function updateUI() {
    // Use the new storage keys set by content.js / SET_AUTH handler
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
        blockedStatusContainer.textContent = `${count} site${count !== 1 ? 's' : ''} currently blocked.`;
        blockedStatusContainer.style.color = "#ef4444";
      } else {
        blockedStatusContainer.textContent = "No active session.";
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

  // Watch for storage changes so the popup updates after content.js fires in a tab
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes['sb-access-token'] || changes.sessionActive)) {
      updateUI();
    }
  });

  // Connect button → open production FlowLock dashboard (user logs in there)
  connectBtn.addEventListener("click", () => {
    chrome.tabs.create({
      url: "https://flowlock-website-dev-vercel.vercel.app/auth/extension-callback"
    });
  });

  // Disconnect: clear auth keys and blocking rules
  logoutBtn.addEventListener("click", async () => {
    await chrome.storage.local.remove([
      'sb-access-token',
      'sb-refresh-token',
      'sb-user-id',
      'sessionActive',
      'blockedCount'
    ]);
    chrome.runtime.sendMessage({ action: "sync_now" }).catch(() => { });
    await updateUI();
  });
});
