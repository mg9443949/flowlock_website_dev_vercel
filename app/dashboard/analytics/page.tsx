"use client"

import dynamic from "next/dynamic"

const AnalyticsPage = dynamic(
  () => import("@/components/dashboard/pages/analytics-page"),
  { ssr: false }
)

export default function AnalyticsRoute() {
    return <AnalyticsPage />
}
