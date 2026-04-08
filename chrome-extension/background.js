const FLOWLOCK_URL = "http://localhost:3000/blocked"; // Change to production domain when ready

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("syncVault", { periodInMinutes: 1 });
  syncVaultState();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "syncVault") {
    syncVaultState();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "sync_now") {
    syncVaultState().then(() => sendResponse({ status: "done" }));
    return true; // Keep message channel open for async response
  }
});

// Listen for external messages directly from the FlowLock web domain
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  // Security guard: Ensure origin matches exactly
  if (!sender.url || !sender.url.startsWith("http://localhost:3000")) return;

  if (message.action === "SUPABASE_AUTH_PAYLOAD" && message.payload) {
    chrome.storage.local.set({
      supabaseUrl: message.payload.supabaseUrl,
      anonKey: message.payload.anonKey,
      userId: message.payload.userId,
      token: message.payload.token,
      refreshToken: message.payload.refreshToken,
      sessionActive: false,
      blockedCount: 0
    }).then(() => {
      // Manually trigger an immediate update block
      syncVaultState();
      sendResponse({ status: "success" });
    });
    return true; // Returns async
  }
});

async function clearAllRules() {
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules.map(rule => rule.id);
  if (oldRuleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldRuleIds });
  }
}

async function refreshSupabaseToken(data) {
  if (!data.refreshToken || !data.supabaseUrl || !data.anonKey) return false;

  try {
    const res = await fetch(`${data.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "apikey": data.anonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refresh_token: data.refreshToken })
    });

    if (!res.ok) return false;
    
    const refreshedData = await res.json();
    
    if (refreshedData.access_token && refreshedData.refresh_token) {
      await chrome.storage.local.set({
        token: refreshedData.access_token,
        refreshToken: refreshedData.refresh_token
      });
      return true; // Successfully refreshed
    }
  } catch (err) {
    console.error("Token refresh unexpectedly failed:", err);
  }
  return false;
}

// The core sync cycle -- takes isRetry flag to prevent infinite loops when refreshing
async function syncVaultState(isRetry = false) {
  try {
    const data = await chrome.storage.local.get(["token", "refreshToken", "userId", "supabaseUrl", "anonKey"]);
    const { token, userId, supabaseUrl, anonKey } = data;

    if (!token || !userId || !supabaseUrl || !anonKey) {
      await clearAllRules();
      await chrome.storage.local.set({ sessionActive: false, blockedCount: 0 });
      return;
    }

    // 1. Check if ANY active session exists for this user
    const sessionRes = await fetch(`${supabaseUrl}/rest/v1/study_sessions?user_id=eq.${userId}&status=eq.active&select=id`, {
      method: "GET",
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${token}`
      }
    });

    // Handle token exhaustion silently
    if (sessionRes.status === 401 && !isRetry) {
      const refreshed = await refreshSupabaseToken(data);
      if (refreshed) {
        return syncVaultState(true); // Restart the cycle perfectly using new locally stored keys
      } else {
        // Unrecoverable refresh (likely expired entirely). Clear current storage but don't drop config entirely.
        await clearAllRules();
        await chrome.storage.local.set({ sessionActive: false, blockedCount: 0, token: null });
        return;
      }
    }

    if (!sessionRes.ok) throw new Error(`Supabase Sessions Error: ${sessionRes.statusText}`);
    const sessions = await sessionRes.json();

    if (!sessions || sessions.length === 0) {
      await clearAllRules();
      await chrome.storage.local.set({ sessionActive: false, blockedCount: 0 });
      return;
    }

    // 2. We have an active session! Fetch the distraction vault
    await chrome.storage.local.set({ sessionActive: true });

    const vaultRes = await fetch(`${supabaseUrl}/rest/v1/distraction_vault?user_id=eq.${userId}&type=eq.website&select=identifier`, {
      method: "GET",
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${token}`
      }
    });

    if (vaultRes.status === 401 && !isRetry) {
      const refreshed = await refreshSupabaseToken(data);
      if (refreshed) return syncVaultState(true);
    }

    if (!vaultRes.ok) throw new Error(`Supabase Vault Error: ${vaultRes.statusText}`);
    const vaultItems = await vaultRes.json();

    // 3. Update firewall rules based on vault items
    await clearAllRules();

    if (vaultItems && vaultItems.length > 0) {
      const addRules = vaultItems.map((item, index) => {
        // Simple sanitization: remove http:// or https:// and www.
        const domain = item.identifier.replace(/^https?:\/\//, '').replace(/^www\./, '');
        return {
          id: index + 1,
          priority: 1,
          action: {
            type: "redirect",
            redirect: { url: FLOWLOCK_URL }
          },
          condition: {
            urlFilter: `*://${domain}/*`,
            resourceTypes: ["main_frame"]
          }
        };
      });

      await chrome.declarativeNetRequest.updateDynamicRules({ addRules });
      await chrome.storage.local.set({ blockedCount: vaultItems.length });
    } else {
      await chrome.storage.local.set({ blockedCount: 0 });
    }

  } catch (error) {
    console.error("syncVaultState encountered an error:", error);
    // Silent fail on error keeps existing tracking rules alive in case of a temporary connection drop
  }
}
