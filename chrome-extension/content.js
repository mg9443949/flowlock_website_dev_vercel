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

  // ── Auto-recover: if context is invalidated, reload the page once ─────────
  // This handles the case where the extension is reloaded while the tab is open.
  // We only auto-reload once (tracked via sessionStorage) to avoid reload loops.
  function handleContextInvalidated() {
    const key = 'flowlock_context_reload_attempted';
    if (sessionStorage.getItem(key)) {
      console.warn('[FlowLock] Extension context invalidated — already attempted reload, giving up');
      return;
    }
    console.warn('[FlowLock] Extension context invalidated — reloading page to recover...');
    sessionStorage.setItem(key, '1');
    window.location.reload();
  }

  // Clear the reload-attempt flag on successful init so future reloads work
  function clearRecoveryFlag() {
    sessionStorage.removeItem('flowlock_context_reload_attempted');
  }

  // ── Periodically check if context is still valid ──────────────────────────
  // If extension is reloaded while this tab is open, detect it and auto-recover
  const contextWatchInterval = setInterval(() => {
    if (!isExtensionValid()) {
      clearInterval(contextWatchInterval);
      handleContextInvalidated();
    }
  }, 3000);

  function safeStorageSet(data) {
    if (!isExtensionValid()) { handleContextInvalidated(); return; }
    chrome.storage.local.set(data);
  }

  function safeSendMessage(msg) {
    if (!isExtensionValid()) { handleContextInvalidated(); return; }
    chrome.runtime.sendMessage(msg).catch(() => { });
  }

  function safeStorageGet(keys, callback) {
    if (!isExtensionValid()) { handleContextInvalidated(); callback({}); return; }
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

  // ── Explicit connect ───────────────────────────────────────────────────────
  window.addEventListener('flowlock:connect_extension', () => {
    if (!isExtensionValid()) {
      handleContextInvalidated();
      return;
    }

    console.log('[FlowLock] Connecting...');
    const session = getSession();
    if (session?.access_token) {
      writeTokenForBackground(session);
      safeStorageSet({ extensionConnected: true });
      forceSync();
      clearRecoveryFlag();
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

  // ── Session ended ──────────────────────────────────────────────────────────
  window.addEventListener('flowlock:session_ended', () => {
    console.log('[FlowLock] Session ended — forcing sync');
    forceSync();
  });

  // ── Vault changed ──────────────────────────────────────────────────────────
  window.addEventListener('flowlock:vault_changed', () => {
    console.log('[FlowLock] Vault changed — forcing sync');
    forceSync();
  });

  // ── On page load: sync token if already connected ─────────────────────────
  safeStorageGet('extensionConnected', (data) => {
    if (!data.extensionConnected) {
      console.log('[FlowLock] Not connected — skipping auto sync');
      return;
    }
    clearRecoveryFlag();
    if (!trySync()) {
      let attempts = 0;
      const interval = setInterval(() => {
        if (!isExtensionValid()) { clearInterval(interval); return; }
        attempts++;
        if (trySync() || attempts >= 20) clearInterval(interval);
      }, 500);
    }
  });

  // ── Re-sync on auth token change ───────────────────────────────────────────
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('sb-') && e.key?.endsWith('-auth-token')) {
      safeStorageGet('extensionConnected', (data) => {
        if (data.extensionConnected) trySync();
      });
    }
  });

})();