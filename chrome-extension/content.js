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

  function sendMessage(msg) {
    if (!port) return;
    port.postMessage(msg);
  }

  // 🔥 CONNECT
  window.addEventListener("flowlock:connect_extension", () => {
    if (!port) connectPort();
  });

  // 🔥 START SESSION
  window.addEventListener("flowlock:start_session", () => {
    console.log("[FlowLock] Start session event");
    sendMessage({ type: "START_SESSION" });
  });

  // 🔥 END SESSION
  window.addEventListener("flowlock:end_session", () => {
    console.log("[FlowLock] End session event");
    sendMessage({ type: "END_SESSION" });
  });

})();