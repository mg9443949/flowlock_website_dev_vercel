(function () {
  let port = null;

  function connectPort() {
    try {
      port = chrome.runtime.connect({ name: "flowlock-connection" });

      console.log("[FlowLock] Port connected");

      port.onDisconnect.addListener(() => {
        console.warn("[FlowLock] Port disconnected → retrying...");
        port = null;
        setTimeout(connectPort, 1000);
      });

    } catch {
      setTimeout(connectPort, 1000);
    }
  }

  function getSession() {
    const authKey = Object.keys(localStorage).find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
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

  function sendAuth() {
    if (!port) return;

    const session = getSession();
    if (!session?.access_token) return;

    port.postMessage({
      type: "AUTH_UPDATE",
      payload: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user_id: session.user?.id,
      },
    });
  }

  window.addEventListener("flowlock:connect_extension", () => {
    if (!port) connectPort();
    setTimeout(sendAuth, 500);
  });

})();