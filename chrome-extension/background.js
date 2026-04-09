const SUPABASE_URL = "https://cutgjwfkgkoynmxpsntr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1dGdqd2ZrZ2tveW5teHBzbnRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMjI1MDksImV4cCI6MjA4ODY5ODUwOX0.y0eHIyS-tZUH4_q3zqGPuDO8oiRlyBsFdN1_dNbvNrE";
const BLOCKED_URL = "https://flowlock-website-dev-vercel.vercel.app/blocked";
const FLOWLOCK_APP_URL = "https://flowlock-website-dev-vercel.vercel.app";

// ─── Alarm: sync on install and every 60s ──────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("syncVault", { periodInMinutes: 1 });
  syncVaultAndBlock();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "syncVault") {
    syncVaultAndBlock();
  }
});

// ─── Message listeners ─────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Triggered by content.js on every FlowLock page load
  if (message.type === 'SET_AUTH') {
    chrome.storage.local.set({
      'sb-access-token': message.access_token,
      'sb-refresh-token': message.refresh_token,
      'sb-user-id': message.user_id
    }, () => {
      syncVaultAndBlock();
    });
  }

  // Manual sync trigger (e.g. from popup)
  if (message.action === "sync_now") {
    syncVaultAndBlock().then(() => sendResponse({ status: "done" }));
    return true;
  }
});

// Legacy external listener (kept for backward compatibility)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ status: 'connected' });
  }
});

// ─── Blocking rules ────────────────────────────────────────────────────────
async function clearBlockingRules() {
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules.map(rule => rule.id);
  if (oldRuleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldRuleIds });
  }
}

async function applyBlockingRules(domains) {
  await clearBlockingRules();

  if (!domains || domains.length === 0) return;

  const addRules = domains.map((domainStr, index) => {
    const cleanDomain = domainStr
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
    return {
      id: index + 1,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { url: BLOCKED_URL }
      },
      condition: {
        urlFilter: `*://${cleanDomain}/*`,
        resourceTypes: ["main_frame"]
      }
    };
  });

  await chrome.declarativeNetRequest.updateDynamicRules({ addRules });
}

// ─── Core sync function ────────────────────────────────────────────────────
async function syncVaultAndBlock() {
  try {
    const data = await chrome.storage.local.get(['sb-access-token', 'sb-user-id']);
    const token = data['sb-access-token'];
    const userId = data['sb-user-id'];

    if (!token || !userId) {
      await clearBlockingRules();
      return;
    }

    // 1. Check for an active session
    const sessionRes = await fetch(
      `${SUPABASE_URL}/rest/v1/study_sessions?status=eq.active&select=id`,
      {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${token}`
        }
      }
    );

    if (!sessionRes.ok) {
      await clearBlockingRules();
      return;
    }

    const sessions = await sessionRes.json();

    if (!sessions || sessions.length === 0) {
      // No active session → unblock everything
      await clearBlockingRules();
      await chrome.storage.local.set({ sessionActive: false, blockedCount: 0 });
      return;
    }

    await chrome.storage.local.set({ sessionActive: true });

    // 2. Fetch vault websites for this user
    const vaultRes = await fetch(
      `${SUPABASE_URL}/rest/v1/distraction_vault?type=eq.website&select=identifier`,
      {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${token}`
        }
      }
    );

    if (!vaultRes.ok) {
      await clearBlockingRules();
      return;
    }

    const vaultItems = await vaultRes.json();
    const domains = vaultItems.map(item => item.identifier);

    await applyBlockingRules(domains);
    await chrome.storage.local.set({ blockedCount: domains.length });

  } catch (error) {
    console.error("[FlowLock] syncVaultAndBlock error:", error);
    await clearBlockingRules();
  }
}
