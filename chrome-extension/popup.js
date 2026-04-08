document.addEventListener("DOMContentLoaded", async () => {
  const statusContainer = document.getElementById("statusContainer");
  const blockedStatusContainer = document.getElementById("blockedStatusContainer");
  const loginForm = document.getElementById("loginForm");
  const connectedView = document.getElementById("connectedView");
  
  const connectBtn = document.getElementById("connectBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  async function updateUI() {
    const data = await chrome.storage.local.get(["token", "userId", "sessionActive", "blockedCount"]);
    
    if (data.token && data.userId) {
      statusContainer.textContent = "Connected to FlowLock";
      statusContainer.style.color = "#22c55e"; // emerald-500
      
      loginForm.classList.add("hidden");
      connectedView.classList.remove("hidden");
      blockedStatusContainer.classList.remove("hidden");

      if (data.sessionActive) {
        const count = data.blockedCount || 0;
        blockedStatusContainer.textContent = `${count} site${count !== 1 ? 's' : ''} currently blocked.`;
        blockedStatusContainer.style.color = "#ef4444"; // red-500
      } else {
        blockedStatusContainer.textContent = "No active session.";
        blockedStatusContainer.style.color = "#a1a1aa"; // zinc-400
      }
    } else {
      statusContainer.textContent = "Not connected";
      statusContainer.style.color = "#ef4444"; // red-500
      
      loginForm.classList.remove("hidden");
      connectedView.classList.add("hidden");
      blockedStatusContainer.classList.add("hidden");
    }
  }

  // Initial render
  await updateUI();

  // Listen for storage changes to seamlessly update UI when auth completes in another tab
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.token) {
      updateUI();
    }
  });

  // Connect button opens the callback handler on the web app
  connectBtn.addEventListener("click", () => {
    window.open("http://localhost:3000/auth/extension-callback", "_blank");
  });

  // Logout wipes storage and clears rules
  logoutBtn.addEventListener("click", async () => {
    await chrome.storage.local.remove([
      "supabaseUrl", 
      "anonKey", 
      "userId", 
      "token", 
      "refreshToken", 
      "sessionActive", 
      "blockedCount"
    ]);
    
    // Explicit sync trigger to drop declarative rules right away
    chrome.runtime.sendMessage({ action: "sync_now" }).catch(() => {});
    await updateUI();
  });
});
