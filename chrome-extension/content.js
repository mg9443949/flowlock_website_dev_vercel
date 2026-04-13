(function () {
  function isExtensionValid() {
    try {
      return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
    } catch {
      return false;
    }
  }

  function safeStorageSet(data) {
    if (!isExtensionValid()) {
      console.warn('[FlowLock content] Extension context invalidated — skipping storage.set');
      return false;
    }
    chrome.storage.local.set(data);
    return true;
  }

  function safeSendMessage(msg) {
    if (!isExtensionValid()) {
      console.warn('[FlowLock content] Extension context invalidated — skipping sendMessage');
      return Promise.resolve({ ok: false, reason: 'context_invalidated' });
    }

    try {
      return chrome.runtime.sendMessage(msg).catch(() => {
        return { ok: false, reason: 'send_failed' };
      });
    } catch {
      return Promise.resolve({ ok: false, reason: 'send_failed' });
    }
  }

  function safeStorageGet(keys, callback) {
    if (!isExtensionValid()) {
      console.warn('[FlowLock content] Extension context invalidated — skipping storage.get');
      callback({});
      return;
    }
    chrome.storage.local.get(keys, callback);
  }

  function getSession() {
    const authKey = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
    );

    if (!authKey) return null;

    try {
      const raw = localStorage.getItem(authKey);
      const parsed = JSON.parse(raw);
      return parsed?.access_token ? parsed : parsed?.currentSession ?? null;
    } catch {
      return null;
    }
  }

  function writeTokenForBackground(session) {
    if (!session?.access_token) return false;

    return safeStorageSet({
      'sb-access-token': session.access_token,
      'sb-refresh-token': session.refresh_token,
      'sb-user-id': session.user?.id,
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
    return safeSendMessage({ type: 'FORCE_SYNC' });
  }

  async function connectExtension() {
    const session = getSession();

    if (!session?.access_token) {
      window.dispatchEvent(
        new CustomEvent('flowlock:connect_failed', {
          detail: { reason: 'no_session' },
        })
      );
      return;
    }

    if (!isExtensionValid()) {
      window.dispatchEvent(
        new CustomEvent('flowlock:connect_failed', {
          detail: {
            reason: 'context_invalidated',
            recoverable: true,
          },
        })
      );
      return;
    }

    const stored = writeTokenForBackground(session);
    if (!stored) {
      window.dispatchEvent(
        new CustomEvent('flowlock:connect_failed', {
          detail: { reason: 'storage_failed' },
        })
      );
      return;
    }

    safeStorageSet({ extensionConnected: true });
    await forceSync();

    window.dispatchEvent(
      new CustomEvent('flowlock:connect_success', {
        detail: { ok: true },
      })
    );
  }

  window.addEventListener('flowlock:connect_extension', connectExtension);

  window.addEventListener('flowlock:disconnect_extension', () => {
    safeSendMessage({ type: 'DISCONNECT' });
  });

  window.addEventListener('flowlock:session_ended', forceSync);
  window.addEventListener('flowlock:vault_changed', forceSync);

  safeStorageGet('extensionConnected', (data) => {
    if (!data.extensionConnected) return;

    if (!trySync()) {
      let attempts = 0;
      const interval = setInterval(() => {
        if (!isExtensionValid()) {
          clearInterval(interval);
          return;
        }

        attempts++;
        if (trySync() || attempts >= 20) {
          clearInterval(interval);
        }
      }, 500);
    }
  });

  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('sb-') && e.key?.endsWith('-auth-token')) {
      safeStorageGet('extensionConnected', (data) => {
        if (data.extensionConnected) trySync();
      });
    }
  });
})();