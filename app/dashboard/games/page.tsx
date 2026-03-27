"use client"

import dynamic from "next/dynamic"
import { useAuth } from "@/components/providers/auth-provider"

const GamesPage = dynamic(
  () => import("@/components/dashboard/pages/games-page").then(mod => mod.GamesPage),
  { ssr: false }
)

export default function GamesRoute() {
    const { user } = useAuth()
    if (!user) return null
    return <GamesPage />
}
