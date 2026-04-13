let ports = [];

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "flowlock-connection") return;

  console.log("[FlowLock BG] Port connected");

  ports.push(port);

  port.onMessage.addListener((msg) => {
    if (msg.type === "AUTH_UPDATE") {
      console.log("[FlowLock BG] Auth received:", msg.payload);

      // 🔥 store globally
      globalThis.flowlockSession = msg.payload;
    }
  });

  port.onDisconnect.addListener(() => {
    console.log("[FlowLock BG] Port disconnected");
    ports = ports.filter((p) => p !== port);
  });
});