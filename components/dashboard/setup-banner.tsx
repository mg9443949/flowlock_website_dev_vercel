"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/providers/auth-provider"
import { supabase } from "@/utils/supabase/client"
import { CheckCircle2, Chrome, Monitor, Shield, ExternalLink } from "lucide-react"
import Link from "next/link"

interface ConnectionStatus {
  extensionConnected: boolean
  agentConnected: boolean
  loading: boolean
}

// Agent is considered "live" if it pinged in the last 10 minutes
const AGENT_LIVENESS_WINDOW_MS = 10 * 60 * 1000

function isAgentLive(lastPingAt: string | null): boolean {
  if (!lastPingAt) return false
  return Date.now() - new Date(lastPingAt).getTime() < AGENT_LIVENESS_WINDOW_MS
}

function useConnectionStatus(): ConnectionStatus {
  const { user } = useAuth()
  const [status, setStatus] = useState<ConnectionStatus>({
    extensionConnected: false,
    agentConnected: false,
    loading: true,
  })

  useEffect(() => {
    if (!user?.id) return

    let isMounted = true

    async function fetchStatus() {
      // 1. Check Chrome Extension via injected localStorage flag
      let liveExtensionConnected = false
      if (typeof window !== "undefined") {
        try {
          liveExtensionConnected = window.localStorage.getItem('flowlock_extension_connected') === 'true';
        } catch {}
      }

      // 2. Check Agent from DB
      const { data, error } = await supabase
        .from("user_preferences")
        .select("extension_connected, agent_connected, agent_last_ping_at")
        .eq("user_id", user!.id)
        .single()

      if (!isMounted) return

      if (error || !data) {
        setStatus({ extensionConnected: liveExtensionConnected, agentConnected: false, loading: false })
        return
      }

      setStatus({
        // Override DB with our live check
        extensionConnected: liveExtensionConnected,
        agentConnected: (data.agent_connected && isAgentLive(data.agent_last_ping_at)) ?? false,
        loading: false,
      })
    }

    fetchStatus()

    // Re-poll every 10s so it detects when installed/connected more responsively
    const interval = setInterval(fetchStatus, 10_000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [user?.id])

  return status
}

function StatusBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
      <CheckCircle2 size={13} strokeWidth={2.5} />
      Connected
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70">
      <span className="w-2 h-2 rounded-full bg-muted-foreground/30 border border-muted-foreground/40" />
      Not connected
    </span>
  )
}

function getOSLabel(): "windows" | "mac" | "other" {
  if (typeof navigator === "undefined") return "windows"
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("mac")) return "mac"
  if (ua.includes("win")) return "windows"
  return "other"
}

export function SetupBanner() {
  const { extensionConnected, agentConnected, loading } = useConnectionStatus()
  const [os, setOs] = useState<"windows" | "mac" | "other">("windows")

  useEffect(() => {
    setOs(getOSLabel())
  }, [])

  // Hide once both are connected
  if (loading || (extensionConnected && agentConnected)) return null

  const downloadLabel =
    os === "mac" ? "Download for Mac" : os === "windows" ? "Download for Windows" : "Download Agent"

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-transparent p-5 animate-in fade-in slide-in-from-top-3 duration-500 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 flex-shrink-0">
          <Shield size={18} strokeWidth={2} />
        </div>
        <div>
          <h3 className="font-bold text-foreground text-sm tracking-tight">
            Set up Vault Protection
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect both tools below to fully activate your Distraction Vault
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-full px-2.5 py-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              extensionConnected && agentConnected
                ? "bg-emerald-500"
                : extensionConnected || agentConnected
                ? "bg-amber-500"
                : "bg-muted-foreground/40"
            }`}
          />
          {extensionConnected && agentConnected
            ? "All set"
            : extensionConnected || agentConnected
            ? "1 of 2"
            : "0 of 2"}{" "}
          connected
        </div>
      </div>

      {/* Step Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Step 1 — Chrome Extension */}
        <div
          className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors ${
            extensionConnected
              ? "border-emerald-500/20 bg-emerald-500/5"
              : "border-border/60 bg-card/60"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl flex-shrink-0 ${
                extensionConnected
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "bg-blue-500/10 text-blue-400"
              }`}
            >
              <Chrome size={18} strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Step 1
                </p>
                <StatusBadge connected={extensionConnected} />
              </div>
              <p className="font-semibold text-sm text-foreground">Block Websites</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Install the FlowLock Chrome extension to block distracting sites during sessions
              </p>
            </div>
          </div>

          {!extensionConnected && (
            <Link
              href="/setup/extension"
              className="inline-flex items-center justify-center gap-1.5 w-full rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold py-2 px-3 transition-all"
            >
              <ExternalLink size={12} />
              Add to Chrome
            </Link>
          )}
        </div>

        {/* Step 2 — Desktop Agent */}
        <div
          className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors ${
            agentConnected
              ? "border-emerald-500/20 bg-emerald-500/5"
              : "border-border/60 bg-card/60"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl flex-shrink-0 ${
                agentConnected
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "bg-violet-500/10 text-violet-400"
              }`}
            >
              <Monitor size={18} strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Step 2
                </p>
                <StatusBadge connected={agentConnected} />
              </div>
              <p className="font-semibold text-sm text-foreground">Block Desktop Apps</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Download the FlowLock desktop agent to block apps like Spotify and Discord during
                sessions
              </p>
            </div>
          </div>

          {!agentConnected && (
            <a
              href="/downloads/flowlock-desktop-agent"
              className="inline-flex items-center justify-center gap-1.5 w-full rounded-lg bg-violet-600 hover:bg-violet-700 active:scale-95 text-white text-xs font-semibold py-2 px-3 transition-all"
            >
              <ExternalLink size={12} />
              {downloadLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
