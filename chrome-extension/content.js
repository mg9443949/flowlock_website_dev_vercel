(function() {
  // Set connection flag so the dashboard knows the extension is installed
  window.localStorage.setItem('flowlock_extension_connected', 'true');
  window.localStorage.setItem('flowlock_extension_version', '1.0.0');

  // Find Supabase auth token in localStorage and send to background
  const authKey = Object.keys(window.localStorage).find(
    k => k.startsWith('sb-') && k.endsWith('-auth-token')
  );
  if (authKey) {
    try {
      const session = JSON.parse(window.localStorage.getItem(authKey));
      if (session?.access_token) {
        chrome.runtime.sendMessage({
          type: 'SET_AUTH',
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          user_id: session.user?.id
        });
      }
    } catch(e) {}
  }
})();
