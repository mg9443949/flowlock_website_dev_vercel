"use client";

import { useEffect } from "react";

export default function FlowLockProvider() {
    useEffect(() => {
        function connect() {
            console.log("[FlowLock] Trying to connect...");
            window.dispatchEvent(new Event("flowlock:connect_extension"));
        }

        function handleFailure(e: any) {
            const reason = e.detail?.reason;

            console.log("[FlowLock] Connection failed:", reason);

            if (reason === "context_invalidated") {
                if (!sessionStorage.getItem("flowlock-reloaded")) {
                    console.log("[FlowLock] Reloading page to recover...");
                    sessionStorage.setItem("flowlock-reloaded", "1");
                    window.location.reload();
                }
            }
        }

        // 🔥 Try connecting immediately
        connect();

        // 🔥 Listen for extension failure
        window.addEventListener("flowlock:connect_failed", handleFailure);

        // 🔥 Reconnect after reload
        if (sessionStorage.getItem("flowlock-reloaded")) {
            console.log("[FlowLock] Reconnecting after reload...");
            sessionStorage.removeItem("flowlock-reloaded");

            setTimeout(connect, 1000);
        }

        return () => {
            window.removeEventListener("flowlock:connect_failed", handleFailure);
        };
    }, []);

    return null;
}