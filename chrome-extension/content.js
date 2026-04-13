(function () {
  // ── DO NOT auto-set connected flag here ──────────────────────────────────
  // Connection should only be set when the user explicitly connects
  // via the popup or the web app's "Connect Extension" button.

  function getSession() {
    const authKey = Object.keys(localStorage).find(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    if (!authKey) return null;
    try {
      const raw = localStorage.getItem(authKey);
      const parsed = JSON.parse(raw);
      return parsed?.access_token ? parsed : parsed?.currentSession ?? null;
    } catch (e) { return null; }
  }

  function writeTokenForBackground(session) {
    if (!session?.access_token) return;
    chrome.storage.local.set({
      'sb-access-token': session.access_token,
      'sb-refresh-token': session.refresh_token,
      'sb-user-id': session.user?.id
    });
  }

  // Only sync token — does NOT mark extension as connected
  function trySync() {
    const session = getSession();
    if (session?.access_token) {
      writeTokenForBackground(session);
      return true;
    }
    return false;
  }

  function forceSync() {
    chrome.runtime.sendMessage({ type: 'FORCE_SYNC' }).catch(() => { });
  }

  // ── Listen for explicit connect request from the web app ─────────────────
  // The web app should dispatch this event when the user clicks "Connect Extension"
  window.addEventListener('flowlock:connect_extension', () => {
    console.log('[FlowLock content] Explicit connect requested');
    const session = getSession();
    if (session?.access_token) {
      writeTokenForBackground(session);
      // Mark as connected only on explicit user action
      chrome.storage.local.set({ extensionConnected: true });
      forceSync();
    }
  });

  // ── Listen for explicit disconnect ────────────────────────────────────────
  window.addEventListener('flowlock:disconnect_extension', () => {
    console.log('[FlowLock content] Explicit disconnect requested');
    chrome.runtime.sendMessage({ type: 'DISCONNECT' }).catch(() => { });
  });

  // ── Listen for session end event ──────────────────────────────────────────
  window.addEventListener('flowlock:session_ended', () => {
    console.log('[FlowLock content] Session ended — forcing sync');
    forceSync();
  });

  // ── Listen for vault change event ─────────────────────────────────────────
  window.addEventListener('flowlock:vault_changed', () => {
    console.log('[FlowLock content] Vault changed — forcing sync');
    forceSync();
  });

  // ── On page load: only sync token IF already connected ───────────────────
  // Does NOT auto-connect — just refreshes the token if the user was
  // already connected in a previous session.
  chrome.storage.local.get('extensionConnected', (data) => {
    if (!data.extensionConnected) {
      console.log('[FlowLock content] Not connected — skipping auto sync');
      return;
    }

    if (!trySync()) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (trySync() || attempts >= 20) clearInterval(interval);
      }, 500);
    }
  });

  // ── Re-sync on auth token change (login/logout) ───────────────────────────
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('sb-') && e.key?.endsWith('-auth-token')) {
      chrome.storage.local.get('extensionConnected', (data) => {
        if (data.extensionConnected) trySync();
      });
    }
  });
})();