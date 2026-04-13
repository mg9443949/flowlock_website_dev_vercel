"use client";

import { useEffect } from "react";

export default function FlowLockProvider() {
    useEffect(() => {
        function connect() {
            console.log("[FlowLock] Connecting...");
            window.dispatchEvent(new Event("flowlock:connect_extension"));
        }

        connect();

        const interval = setInterval(connect, 5000);

        return () => clearInterval(interval);
    }, []);

    return null;
}