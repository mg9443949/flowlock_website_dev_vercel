"use client"

import { AdminPanel } from "@/components/dashboard/pages/admin-panel"
import { useAuth } from "@/components/providers/auth-provider"

export default function UsersRoute() {
    const { user } = useAuth()

    if (!user) return null

    if (user.role !== "admin") {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">You don't have access to this page.</p>
            </div>
        )
    }

    return <AdminPanel />
}
