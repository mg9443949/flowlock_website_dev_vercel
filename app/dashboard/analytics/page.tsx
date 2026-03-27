"use client"

import dynamic from "next/dynamic"
import { useAuth } from "@/components/providers/auth-provider"

const AnalyticsPage = dynamic(
  () => import("@/components/dashboard/pages/analytics-page").then(mod => mod.AnalyticsPage),
  { ssr: false }
)

export default function AnalyticsRoute() {
    const { user } = useAuth()
    if (!user) return null
    return <AnalyticsPage />
}
