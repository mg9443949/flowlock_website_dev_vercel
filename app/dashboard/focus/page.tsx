"use client"

import { useAuth } from "@/components/providers/auth-provider"

export default function FocusRoute() {
    const { user } = useAuth()

    if (!user) return null

    if (user.role !== "student") {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">You don&apos;t have access to this page.</p>
            </div>
        )
    }

    // FocusTracker is rendered by the DashboardLayout (the only mount point).
    // This page returns null so the layout's tracker is the only visible content.
    return null
}
