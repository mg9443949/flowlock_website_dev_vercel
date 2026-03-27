"use client"

import { SettingsPage } from "@/components/dashboard/pages/settings-page"
import { useAuth } from "@/components/providers/auth-provider"

export default function SettingsRoute() {
    const { user } = useAuth()
    if (!user) return null
    return <SettingsPage />
}
