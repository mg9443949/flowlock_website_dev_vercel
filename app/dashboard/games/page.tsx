"use client"

import dynamic from "next/dynamic"

const GamesPage = dynamic(
  () => import("@/components/dashboard/pages/games-page"),
  { ssr: false }
)

export default function GamesRoute() {
    return <GamesPage />
}
