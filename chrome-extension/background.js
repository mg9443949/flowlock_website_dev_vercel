const SUPABASE_URL = "https://cutgjwfkgkoynmxpsntr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1dGdqd2ZrZ2tveW5teHBzbnRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMjI1MDksImV4cCI6MjA4ODY5ODUwOX0.y0eHIyS-tZUH4_q3zqGPuDO8oiRlyBsFdN1_dNbvNrE";
const BLOCKED_URL = "https://flowlock-website-dev-vercel.vercel.app/blocked";
const FLOWLOCK_URL = "https://flowlock-website-dev-vercel.vercel.app";

// ── On install, set alarm ──────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("syncVault", { periodInMinutes: 1 });
  grabTokenAndSync(); // sync immediately on install
});

// ── On browser startup, sync immediately ──────────────────────────────────
chrome.runtime.onStartup.addListener(() => {
  grabTokenAndSync();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "syncVault") grabTokenAndSync();
});

// ── Main: inject script into FlowLock tab to grab token ───────────────────
async function grabTokenAndSync() {
  console.log('[FlowLock] grabTokenAndSync started');

  const tabs = await chrome.tabs.query({ url: FLOWLOCK_URL + "/*" });

  if (tabs.length === 0) {
    console.log('[FlowLock] No FlowLock tab open, trying stored token');
    await syncVaultAndBlock();
    return;
  }

  const tab = tabs[0];
  console.log('[FlowLock] Found FlowLock tab:', tab.id);

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
    console.log('[FlowLock] Injected script result:', result ? 'got token' : 'no token');

    if (result?.access_token) {
      await chrome.storage.local.set({
        'sb-access-token': result.access_token,
        'sb-refresh-token': result.refresh_token,
        'sb-user-id': result.user_id
      });
      console.log('[FlowLock] Token stored from tab injection');
      await syncVaultAndBlock();
    }
  } catch (err) {
    console.error('[FlowLock] Script injection failed:', err);
    await syncVaultAndBlock();
  }
}

// ── On popup connect button (manual trigger) ───────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_AUTH') {
    chrome.storage.local.set({
      'sb-access-token': message.access_token,
      'sb-refresh-token': message.refresh_token,
      'sb-user-id': message.user_id
    }, () => {
      syncVaultAndBlock();
    });
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'sync_now') {
    grabTokenAndSync().then(() => sendResponse({ status: 'done' }));
    return true;
  }
});

// ── Watch for tab updates on FlowLock domain ──────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith(FLOWLOCK_URL)) {
    console.log('[FlowLock] FlowLock tab loaded, grabbing token');
    setTimeout(() => grabTokenAndSync(), 2000);
  }
});

// ── Blocking rules ─────────────────────────────────────────────────────────
async function clearBlockingRules() {
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules.map(r => r.id);
  if (oldRuleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldRuleIds });
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
      condition: {
        urlFilter: `||${clean}/`,  // ✅ correct declarativeNetRequest syntax
        resourceTypes: ["main_frame"]
      }
    };
  });

  await chrome.declarativeNetRequest.updateDynamicRules({ addRules });
  console.log('[FlowLock] Rules applied:', addRules.map(r => r.condition.urlFilter));
}

// ── Core sync ──────────────────────────────────────────────────────────────
async function syncVaultAndBlock() {
  console.log('[FlowLock] Starting sync...');
  const data = await chrome.storage.local.get(['sb-access-token', 'sb-user-id']);
  const token = data['sb-access-token'];

  console.log('[FlowLock] Token present:', !!token);
  if (!token) {
    await clearBlockingRules();
    return;
  }

  try {
    const sessionRes = await fetch(
      `${SUPABASE_URL}/rest/v1/study_sessions?ended_at=is.null&select=id`,
      { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` } }
    );

    if (!sessionRes.ok) {
      console.warn('[FlowLock] Session fetch failed:', sessionRes.status);
      await clearBlockingRules();
      return;
    }

    const sessions = await sessionRes.json();
    console.log('[FlowLock] Active sessions:', sessions.length);

    if (!sessions.length) {
      await clearBlockingRules();
      await chrome.storage.local.set({ sessionActive: false, blockedCount: 0 });
      return;
    }

    await chrome.storage.local.set({ sessionActive: true });

    const vaultRes = await fetch(
      `${SUPABASE_URL}/rest/v1/distraction_vault?type=eq.website&select=identifier`,
      { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` } }
    );

    const vaultItems = await vaultRes.json();
    const domains = vaultItems.map(i => i.identifier);
    console.log('[FlowLock] Blocking domains:', domains);

    await applyBlockingRules(domains);
    await chrome.storage.local.set({ blockedCount: domains.length });

  } catch (err) {
    console.error('[FlowLock] Sync error:', err);
    await clearBlockingRules();
  }
}