(function() {
  window.localStorage.setItem('flowlock_extension_connected', 'true');

  function getSession() {
    const authKey = Object.keys(localStorage).find(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    if (!authKey) return null;
    try {
      return JSON.parse(localStorage.getItem(authKey));
    } catch(e) { return null; }
  }

  function sendAuth(session) {
    chrome.runtime.sendMessage({
      type: 'SET_AUTH',
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      user_id: session.user?.id
    }, () => void chrome.runtime.lastError);
  }

  // Try immediately
  const session = getSession();
  if (session?.access_token) {
    sendAuth(session);
  }

  // Also try after page fully loads (catches SPAs that hydrate late)
  window.addEventListener('load', () => {
    const s = getSession();
    if (s?.access_token) sendAuth(s);
  });

  // Also watch for auth changes (e.g. user logs in on this tab)
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('sb-') && e.key?.endsWith('-auth-token')) {
      const s = getSession();
      if (s?.access_token) sendAuth(s);
    }
  });
})();
