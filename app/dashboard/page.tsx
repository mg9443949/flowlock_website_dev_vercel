"use client"

import dynamic from "next/dynamic"

const DashboardHome = dynamic(
  () => import("@/components/dashboard/pages/dashboard-home"),
  { ssr: false }
)

export default function DashboardPage() {
    return <DashboardHome />
}
