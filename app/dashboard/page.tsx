"use client"

import dynamic from "next/dynamic"
import { useAuth } from "@/components/providers/auth-provider"
import { useFocus } from "@/components/providers/focus-provider"

const DashboardHome = dynamic(
  () => import("@/components/dashboard/pages/dashboard-home").then(mod => mod.DashboardHome),
  { ssr: false }
)

export default function DashboardPage() {
    const { user } = useAuth()
    const { lastFocusSession } = useFocus()

    if (!user) return null

    return <DashboardHome user={user} lastFocusSession={lastFocusSession} />
}
