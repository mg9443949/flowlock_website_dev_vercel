"use client";

import { useEffect } from "react";

export default function FlowLockProvider() {
    useEffect(() => {
        function connect() {
            console.log("[FlowLock] Connecting (persistent)...");
            window.dispatchEvent(new Event("flowlock:connect_extension"));
        }

        connect();

        // Optional retry (safety)
        const interval = setInterval(connect, 5000);

        return () => clearInterval(interval);
    }, []);

    return null;
}