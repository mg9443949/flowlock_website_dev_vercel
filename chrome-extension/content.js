console.log("[FlowLock] Content script loaded");

(function () {

  // ── Guard: extension context can be invalidated on reload ─────────────────
  function isExtensionValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function safeStorageSet(data) {
    if (!isExtensionValid()) return;
    chrome.storage.local.set(data);
  }

  function safeSendMessage(msg) {
    if (!isExtensionValid()) return;
    chrome.runtime.sendMessage(msg).catch(() => { });
  }

  function safeStorageGet(keys, callback) {
    if (!isExtensionValid()) { callback({}); return; }
    chrome.storage.local.get(keys, callback);
  }

  // ── Read Supabase session from localStorage ────────────────────────────────
  function getSession() {
    const authKey = Object.keys(localStorage).find(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    if (!authKey) return null;
    try {
      const parsed = JSON.parse(localStorage.getItem(authKey));
      return parsed?.access_token ? parsed : parsed?.currentSession ?? null;
    } catch (e) { return null; }
  }

  function writeTokenForBackground(session) {
    if (!session?.access_token) return;
    safeStorageSet({
      'sb-access-token': session.access_token,
      'sb-refresh-token': session.refresh_token,
      'sb-user-id': session.user?.id
    });
  }

  function trySync() {
    const session = getSession();
    if (session?.access_token) {
      writeTokenForBackground(session);
      return true;
    }
    return false;
  }

  function forceSync() {
    safeSendMessage({ type: 'FORCE_SYNC' });
  }

  // ── Explicit connect (triggered by popup or web app button) ───────────────
  window.addEventListener('flowlock:connect_extension', () => {
    if (!isExtensionValid()) {
      console.warn('[FlowLock] Extension context invalidated — reload the page and try again');
      window.dispatchEvent(new CustomEvent('flowlock:connect_failed', {
        detail: { reason: 'context_invalidated' }
      }));
      return;
    }

    console.log('[FlowLock] Connect requested');
    const session = getSession();
    if (session?.access_token) {
      writeTokenForBackground(session);
      safeStorageSet({ extensionConnected: true });
      forceSync();
    } else {
      console.warn('[FlowLock] No session found — user may not be logged in');
      window.dispatchEvent(new CustomEvent('flowlock:connect_failed', {
        detail: { reason: 'no_session' }
      }));
    }
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────
  window.addEventListener('flowlock:disconnect_extension', () => {
    console.log('[FlowLock] Disconnect requested');
    safeSendMessage({ type: 'DISCONNECT' });
  });

  // ── Session ended: force sync AFTER ended_at is written to Supabase ───────
  // This event must be dispatched from focus-tracker.tsx INSIDE saveSession(),
  // after the supabase.update() call resolves — not before.
  window.addEventListener('flowlock:session_ended', () => {
    console.log('[FlowLock] Session ended — forcing sync');
    forceSync();
  });

  // ── Vault changed: re-sync blocking rules ─────────────────────────────────
  window.addEventListener('flowlock:vault_changed', () => {
    console.log('[FlowLock] Vault changed — forcing sync');
    forceSync();
  });

  // ── On page load: re-sync token if already connected ──────────────────────
  safeStorageGet('extensionConnected', (data) => {
    if (!data.extensionConnected) {
      console.log('[FlowLock] Not connected — skipping auto sync');
      return;
    }
    if (!trySync()) {
      let attempts = 0;
      const interval = setInterval(() => {
        if (!isExtensionValid()) { clearInterval(interval); return; }
        attempts++;
        if (trySync() || attempts >= 20) clearInterval(interval);
      }, 500);
    }
  });

  // ── Re-sync when auth token changes (login/logout) ────────────────────────
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('sb-') && e.key?.endsWith('-auth-token')) {
      safeStorageGet('extensionConnected', (data) => {
        if (data.extensionConnected) trySync();
      });
    }
  });

})();