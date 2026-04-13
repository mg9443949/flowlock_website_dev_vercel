console.log("[FlowLock] Background service worker running");

const SUPABASE_URL = "https://cutgjwfkgkoynmxpsntr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1dGdqd2ZrZ2tveW5teHBzbnRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMjI1MDksImV4cCI6MjA4ODY5ODUwOX0.y0eHIyS-tZUH4_q3zqGPuDO8oiRlyBsFdN1_dNbvNrE";
const BLOCKED_URL = "https://flowlock-website-dev-vercel.vercel.app/blocked";
const FLOWLOCK_URL = "https://flowlock-website-dev-vercel.vercel.app";
const MAX_SESSION_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

// ── Keep service worker alive during fetch operations ─────────────────────
// MV3 service workers can be killed mid-fetch; this prevents that.
let keepAliveInterval = null;

function startKeepAlive() {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(() => {
    chrome.storage.local.get('extensionConnected', () => { });
  }, 20000);
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// ── Fetch with retry and longer delays ────────────────────────────────────
async function fetchWithRetry(url, options, retries = 3, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      console.warn(`[FlowLock] Fetch attempt ${i + 1} failed:`, err.message);
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
      } else {
        throw err;
      }
    }
  }
}

// ── Guard: only act if user explicitly connected ───────────────────────────
async function isUserConnected() {
  const data = await chrome.storage.local.get('extensionConnected');
  return !!data.extensionConnected;
}

// ── On install ────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.clear("syncVault", () => {
    chrome.alarms.create("syncVault", { periodInMinutes: 1 });
  });
  console.log("[FlowLock] Installed. Waiting for user to connect.");
});

// ── On startup ────────────────────────────────────────────────────────────
chrome.runtime.onStartup.addListener(async () => {
  if (await isUserConnected()) {
    grabTokenAndSync();
  } else {
    console.log("[FlowLock] Not connected on startup — skipping");
  }
});

// ── Alarm ─────────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "syncVault") {
    if (await isUserConnected()) {
      grabTokenAndSync();
    } else {
      console.log("[FlowLock] Alarm fired but not connected — skipping");
    }
  }
});

// ── Grab token from FlowLock tab ──────────────────────────────────────────
async function grabTokenAndSync() {
  console.log("[FlowLock] grabTokenAndSync started");
  startKeepAlive();

  try {
    const tabs = await chrome.tabs.query({ url: FLOWLOCK_URL + "/*" });

    if (tabs.length === 0) {
      console.log("[FlowLock] No FlowLock tab open — using stored token");
      await syncVaultAndBlock();
      return;
    }

    const tab = tabs[0];
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const authKey = Object.keys(localStorage).find(
            k => k.startsWith('sb-') && k.endsWith('-auth-token')
          );
          if (!authKey) return null;
          try {
            const parsed = JSON.parse(localStorage.getItem(authKey));
            const session = parsed?.access_token ? parsed : parsed?.currentSession ?? null;
            if (!session?.access_token) return null;
            return {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              user_id: session.user?.id
            };
          } catch (e) { return null; }
        }
      });

      const result = results?.[0]?.result;
      if (result?.access_token) {
        await chrome.storage.local.set({
          'sb-access-token': result.access_token,
          'sb-refresh-token': result.refresh_token,
          'sb-user-id': result.user_id
        });
        console.log("[FlowLock] Token refreshed from tab");
        await syncVaultAndBlock();
      } else {
        console.log("[FlowLock] No token found in tab — disconnecting");
        await disconnectAndClear();
      }
    } catch (err) {
      console.error("[FlowLock] Tab script injection failed:", err);
      await syncVaultAndBlock();
    }
  } finally {
    stopKeepAlive();
  }
}

// ── Message listener ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'SET_AUTH') {
    chrome.storage.local.set({
      'sb-access-token': message.access_token,
      'sb-refresh-token': message.refresh_token,
      'sb-user-id': message.user_id,
      'extensionConnected': true
    }, () => syncVaultAndBlock());
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'DISCONNECT') {
    disconnectAndClear().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'FORCE_SYNC') {
    isUserConnected().then(connected => {
      if (connected) {
        syncVaultAndBlock().then(() => sendResponse({ ok: true }));
      } else {
        console.log("[FlowLock] FORCE_SYNC ignored — not connected");
        sendResponse({ ok: false, reason: 'not_connected' });
      }
    });
    return true;
  }

  if (message.action === 'sync_now') {
    isUserConnected().then(connected => {
      if (connected) {
        grabTokenAndSync().then(() => sendResponse({ status: 'done' }));
      } else {
        sendResponse({ status: 'not_connected' });
      }
    });
    return true;
  }
});

// ── Watch for FlowLock tab loads ───────────────────────────────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith(FLOWLOCK_URL)) {
    if (await isUserConnected()) {
      console.log("[FlowLock] FlowLock tab loaded — refreshing token");
      setTimeout(() => grabTokenAndSync(), 2000);
    }
  }
});

// ── Blocking rules ─────────────────────────────────────────────────────────
async function clearBlockingRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const ids = existing.map(r => r.id);
  if (ids.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids });
    console.log("[FlowLock] Blocking rules cleared");
  }
}

async function applyBlockingRules(domains) {
  await clearBlockingRules();
  if (!domains || domains.length === 0) return;

  const addRules = domains.map((domain, index) => {
    const clean = domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
    return {
      id: index + 1,
      priority: 1,
      action: { type: "redirect", redirect: { url: BLOCKED_URL } },
      condition: { urlFilter: `||${clean}/`, resourceTypes: ["main_frame"] }
    };
  });

  await chrome.declarativeNetRequest.updateDynamicRules({ addRules });
  console.log("[FlowLock] Rules applied:", addRules.map(r => r.condition.urlFilter));
}

async function disconnectAndClear() {
  await chrome.storage.local.remove([
    'sb-access-token', 'sb-refresh-token', 'sb-user-id',
    'sessionActive', 'blockedCount', 'extensionConnected'
  ]);
  await clearBlockingRules();
  console.log("[FlowLock] Disconnected — all rules cleared");
}

// ── Close ghost rows directly from extension ──────────────────────────────
async function closeGhostSessions(token, ghostIds) {
  if (!ghostIds || ghostIds.length === 0) return;
  try {
    const ids = ghostIds.join(',');
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/study_sessions?id=in.(${ids})`,
      {
        method: 'PATCH',
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({ ended_at: new Date().toISOString() })
      }
    );
    if (res.ok) {
      console.log("[FlowLock] Ghost sessions closed:", ghostIds);
    } else {
      console.warn("[FlowLock] Failed to close ghost sessions:", res.status);
    }
  } catch (err) {
    console.warn("[FlowLock] closeGhostSessions error:", err.message);
  }
}

// ── Core sync ─────────────────────────────────────────────────────────────
async function syncVaultAndBlock() {
  console.log("[FlowLock] Syncing...");
  startKeepAlive();

  try {
    if (!(await isUserConnected())) {
      console.log("[FlowLock] Not connected — aborting sync");
      await clearBlockingRules();
      return;
    }

    const data = await chrome.storage.local.get(['sb-access-token', 'sb-user-id']);
    const token = data['sb-access-token'];

    if (!token) {
      console.log("[FlowLock] No token — clearing rules");
      await clearBlockingRules();
      return;
    }

    // ── Step 1: Check for active sessions ───────────────────────────────
    let sessionRes;
    try {
      sessionRes = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/study_sessions?ended_at=is.null&select=id,started_at`,
        {
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );
    } catch (fetchErr) {
      console.error("[FlowLock] Network error fetching sessions — clearing rules:", fetchErr.message);
      await clearBlockingRules();
      return;
    }

    if (!sessionRes.ok) {
      console.warn("[FlowLock] Session fetch failed:", sessionRes.status);
      if (sessionRes.status === 401) await disconnectAndClear();
      else await clearBlockingRules();
      return;
    }

    const sessions = await sessionRes.json();
    console.log("[FlowLock] Null ended_at rows found:", sessions.length);

    if (!sessions || sessions.length === 0) {
      await clearBlockingRules();
      await chrome.storage.local.set({ sessionActive: false, blockedCount: 0 });
      console.log("[FlowLock] No active session — blocking disabled");
      return;
    }

    const now = Date.now();
    const realSessions = sessions.filter(s => (now - new Date(s.started_at).getTime()) < MAX_SESSION_AGE_MS);
    const ghostSessions = sessions.filter(s => (now - new Date(s.started_at).getTime()) >= MAX_SESSION_AGE_MS);

    if (ghostSessions.length > 0) {
      console.warn("[FlowLock] Closing ghost sessions:", ghostSessions.map(s => s.id));
      closeGhostSessions(token, ghostSessions.map(s => s.id));
    }

    if (realSessions.length === 0) {
      await clearBlockingRules();
      await chrome.storage.local.set({ sessionActive: false, blockedCount: 0 });
      console.log("[FlowLock] No real active session — blocking disabled");
      return;
    }

    console.log("[FlowLock] Active session confirmed:", realSessions.length);
    await chrome.storage.local.set({ sessionActive: true });

    // ── Step 2: Fetch distraction vault ─────────────────────────────────
    let vaultRes;
    try {
      vaultRes = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/distraction_vault?type=eq.website&select=identifier`,
        {
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );
    } catch (fetchErr) {
      console.error("[FlowLock] Network error fetching vault — clearing rules:", fetchErr.message);
      await clearBlockingRules();
      return;
    }

    if (!vaultRes.ok) {
      console.warn("[FlowLock] Vault fetch failed:", vaultRes.status);
      await clearBlockingRules();
      return;
    }

    const vaultItems = await vaultRes.json();
    const domains = vaultItems.map(i => i.identifier);
    console.log("[FlowLock] Domains to block:", domains);

    await applyBlockingRules(domains);
    await chrome.storage.local.set({ blockedCount: domains.length });

  } catch (err) {
    console.error("[FlowLock] Sync error:", err.message);
    await clearBlockingRules();
  } finally {
    stopKeepAlive();
  }
}