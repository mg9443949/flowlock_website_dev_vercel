(function () {
  window.localStorage.setItem('flowlock_extension_connected', 'true');

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

  function trySync() {
    const session = getSession();
    if (session?.access_token) {
      writeTokenForBackground(session);
      return true;
    }
    return false;
  }

  // ✅ FIX — Force an immediate re-sync when session ends or vault changes
  // The web app dispatches these custom events at the right moments
  function forceSync() {
    chrome.runtime.sendMessage({ type: 'FORCE_SYNC' }).catch(() => { });
  }

  // Listen for session end event dispatched by focus-tracker.tsx
  window.addEventListener('flowlock:session_ended', () => {
    console.log('[FlowLock content] Session ended — forcing sync');
    forceSync();
  });

  // Listen for vault change event dispatched by distraction vault UI
  window.addEventListener('flowlock:vault_changed', () => {
    console.log('[FlowLock content] Vault changed — forcing sync');
    forceSync();
  });

  // Initial token sync on page load
  if (!trySync()) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (trySync() || attempts >= 20) clearInterval(interval);
    }, 500);
  }

  // Re-sync on auth token change (login/logout)
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('sb-') && e.key?.endsWith('-auth-token')) {
      trySync();
    }
  });
})();