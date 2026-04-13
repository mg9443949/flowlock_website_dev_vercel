"use client"

import React from "react"
import Link from "next/link"
import { ExternalLink, Copy, Check, Download, MousePointer, ShieldAlert, MonitorPlay, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SetupExtensionPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="space-y-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Manual Extension Install</h1>
        <p className="text-muted-foreground text-lg">
          FlowLock is currently in beta and not yet published to the Chrome Web Store.
          Please follow these simple steps to load the extension as an unpacked developer extension.
        </p>
      </div>

      <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:to-border/5">

        {/* Step 1 */}
        <div className="relative flex items-center justify-center md:justify-start">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-primary text-primary-foreground font-bold shadow-sm z-10">
            1
          </div>
          <div className="hidden md:block w-[calc(50%-2.5rem)]" />
          <div className="ml-6 md:ml-0 md:w-1/2 md:pl-10 pb-8 flex-1">
            <h3 className="text-xl font-bold mb-2">Download Extension Files</h3>
            <p className="text-muted-foreground mb-4">
              Download the zip file containing the extension source code and extract it to a folder on your computer.
            </p>
            <Button asChild className="gap-2w-full sm:w-auto">
              <Link href="/api/extension/download" prefetch={false} download>
                <Download size={16} />
                Download Extension Files
              </Link>
            </Button>
          </div>
        </div>

        {/* Step 2 */}
        <div className="relative flex items-center justify-center md:justify-end">
          <div className="md:w-1/2 md:pr-10 pb-8 flex-1 text-left md:text-right">
            <h3 className="text-xl font-bold mb-2">Open Chrome Extensions</h3>
            <p className="text-muted-foreground mb-4">
              Open a new tab and navigate to the Chrome Extensions management page.
            </p>
            <div className="flex items-center gap-2 bg-muted p-2 rounded-lg border ml-6 md:ml-auto w-fit">
              <code className="text-sm px-2 text-foreground font-mono bg-transparent">chrome://extensions</code>
              <CopyButton text="chrome://extensions" />
            </div>
          </div>
          <div className="absolute left-0 md:static flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-muted text-foreground font-bold shadow-sm z-10">
            2
          </div>
          <div className="hidden md:block w-[calc(50%-2.5rem)]" />
        </div>

        {/* Step 3 */}
        <div className="relative flex items-center justify-center md:justify-start">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-muted text-foreground font-bold shadow-sm z-10">
            3
          </div>
          <div className="hidden md:block w-[calc(50%-2.5rem)]" />
          <div className="ml-6 md:ml-0 md:w-1/2 md:pl-10 pb-8 flex-1">
            <h3 className="text-xl font-bold mb-2">Enable Developer Mode</h3>
            <p className="text-muted-foreground mb-4">
              Turn on the <strong>Developer mode</strong> toggle located in the top right corner of the extensions page.
            </p>
            <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
              <div className="w-full aspect-[3/1] bg-muted/50 rounded-lg flex items-center justify-between px-6 border border-border">
                <div className="h-4 w-32 bg-border/40 rounded-full"></div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground">Developer mode</span>
                  <div className="w-10 h-5 bg-blue-500 rounded-full relative shadow-inner">
                    <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="relative flex items-center justify-center md:justify-end">
          <div className="md:w-1/2 md:pr-10 pb-8 flex-1 text-left md:text-right">
            <h3 className="text-xl font-bold mb-2">Load Unpacked</h3>
            <p className="text-muted-foreground mb-4">
              Click the <strong>Load unpacked</strong> button that appears in the top left, and select the folder you extracted in Step 1.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 border rounded-md shadow-sm bg-card font-medium text-sm text-foreground ml-6 md:ml-auto">
              <MousePointer size={16} className="text-muted-foreground" />
              Load unpacked
            </div>
          </div>
          <div className="absolute left-0 md:static flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-muted text-foreground font-bold shadow-sm z-10">
            4
          </div>
          <div className="hidden md:block w-[calc(50%-2.5rem)]" />
        </div>

        {/* Step 5 */}
        <div className="relative flex items-center justify-center md:justify-start">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-amber-500 text-white font-bold shadow-sm z-10">
            5
          </div>
          <div className="hidden md:block w-[calc(50%-2.5rem)]" />
          <div className="ml-6 md:ml-0 md:w-1/2 md:pl-10 mb-8 flex-1">
            <h3 className="text-xl font-bold mb-2">Connect to FlowLock</h3>
            <p className="text-muted-foreground mb-4">
              Pin the extension to your menubar, click it, and finally click below to securely bridge your session.
            </p>
            <ConnectButton />
          </div>
        </div>
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="p-1.5 hover:bg-muted-foreground/20 rounded-md transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-muted-foreground" />}
    </button>
  )
}

function ConnectButton() {
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle")

  const handleConnect = async () => {
    setStatus("loading")

    try {
      // ✅ Fire the custom event that content.js is listening for.
      // This tells the extension the user explicitly wants to connect.
      window.dispatchEvent(new Event('flowlock:connect_extension'))

      // Give the extension a moment to receive the event and store the token
      await new Promise(r => setTimeout(r, 1500))

      setStatus("success")
      setTimeout(() => {
        window.location.href = "/dashboard"
      }, 1000)

    } catch (err) {
      console.error('[FlowLock] Connection failed:', err)
      setStatus("error")
      // Reset back to idle after 3 seconds so the user can retry
      setTimeout(() => setStatus("idle"), 3000)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleConnect}
        size="lg"
        disabled={status === "loading" || status === "success"}
        className="w-full sm:w-auto font-semibold gap-2 bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20"
      >
        {status === "idle" && <ShieldAlert size={18} />}
        {status === "loading" && <MonitorPlay size={18} className="animate-pulse" />}
        {status === "success" && <Check size={18} />}
        {status === "error" && <AlertCircle size={18} />}

        {status === "idle" && "Connect to FlowLock"}
        {status === "loading" && "Connecting..."}
        {status === "success" && "Connected! Redirecting..."}
        {status === "error" && "Connection failed — Retry"}
      </Button>

      {/* Hint: shown only if extension might not be installed yet */}
      {status === "error" && (
        <p className="text-sm text-muted-foreground">
          Make sure the extension is installed and pinned before connecting.
        </p>
      )}
    </div>
  )
}