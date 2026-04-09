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
    // Write to a special key that background.js watches via storage.onChanged
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

  if (!trySync()) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (trySync() || attempts >= 20) clearInterval(interval);
    }, 500);
  }

  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('sb-') && e.key?.endsWith('-auth-token')) {
      trySync();
    }
  });
})();