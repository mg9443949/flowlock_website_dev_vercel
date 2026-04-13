(function () {

  // ── Guard: check if extension context is still valid ─────────────────────
  // Becomes invalid when the extension is reloaded/updated while the
  // FlowLock tab is still open. All chrome.* calls must go through this.
  function isExtensionValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function safeStorageSet(data) {
    if (!isExtensionValid()) {
      console.warn('[FlowLock content] Extension context invalidated — skipping storage.set');
      return;
    }
    chrome.storage.local.set(data);
  }

  function safeSendMessage(msg) {
    if (!isExtensionValid()) {
      console.warn('[FlowLock content] Extension context invalidated — skipping sendMessage');
      return;
    }
    chrome.runtime.sendMessage(msg).catch(() => { });
  }

  function safeStorageGet(keys, callback) {
    if (!isExtensionValid()) {
      console.warn('[FlowLock content] Extension context invalidated — skipping storage.get');
      callback({});
      return;
    }
    chrome.storage.local.get(keys, callback);
  }

  // ─────────────────────────────────────────────────────────────────────────

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

  // ── Listen for explicit connect request ───────────────────────────────────
  window.addEventListener('flowlock:connect_extension', () => {
    if (!isExtensionValid()) {
      console.warn('[FlowLock content] Extension context invalidated — reload the page and try again');
      window.dispatchEvent(new CustomEvent('flowlock:connect_failed', {
        detail: { reason: 'context_invalidated' }
      }));
      return;
    }

    console.log('[FlowLock content] Explicit connect requested');
    const session = getSession();
    if (session?.access_token) {
      writeTokenForBackground(session);
      safeStorageSet({ extensionConnected: true });
      forceSync();
    } else {
      console.warn('[FlowLock content] No session found — user may not be logged in');
      window.dispatchEvent(new CustomEvent('flowlock:connect_failed', {
        detail: { reason: 'no_session' }
      }));
    }
  });

  // ── Listen for explicit disconnect ────────────────────────────────────────
  window.addEventListener('flowlock:disconnect_extension', () => {
    console.log('[FlowLock content] Explicit disconnect requested');
    safeSendMessage({ type: 'DISCONNECT' });
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

  // ── On page load: sync token only if already connected ───────────────────
  safeStorageGet('extensionConnected', (data) => {
    if (!data.extensionConnected) {
      console.log('[FlowLock content] Not connected — skipping auto sync');
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

  // ── Re-sync on auth token change (login/logout) ───────────────────────────
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('sb-') && e.key?.endsWith('-auth-token')) {
      safeStorageGet('extensionConnected', (data) => {
        if (data.extensionConnected) trySync();
      });
    }
  });

})();