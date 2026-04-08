"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/utils/supabase/client"
import { Loader2, CheckCircle2 } from "lucide-react"

// Safely ignore standard chrome browser types in the React env
declare var chrome: any;

export default function ExtensionCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState("Connecting to FlowLock Vault extension...")
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    let mounted = true
    
    const connectExtension = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error || !session) {
          if (mounted) setStatus("No active session found. Please log in first.")
          setTimeout(() => {
            if (mounted) router.push('/login?next=/auth/extension-callback')
          }, 1500)
          return
        }

        const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!extensionId) {
          if (mounted) setStatus("Error: NEXT_PUBLIC_EXTENSION_ID is missing in environment variables.")
          return
        }

        // Must run in a Chromium environment where chrome.runtime API exists
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage(
            extensionId,
            {
              action: "SUPABASE_AUTH_PAYLOAD",
              payload: {
                token: session.access_token,
                refreshToken: session.refresh_token,
                userId: session.user.id,
                supabaseUrl,
                anonKey
              }
            },
            (response: any) => {
              if (chrome.runtime.lastError) {
                  if (mounted) setStatus(`Failed to connect to extension. Make sure FlowLock Vault is installed and enabled in Chrome. (${chrome.runtime.lastError.message})`)
                  return
              }
               
              if (response && response.status === "success") {
                if (mounted) {
                  setIsSuccess(true)
                  setStatus("Connected! You can safely close this tab.")
                }
              } else {
                if (mounted) setStatus("Extension responded, but something went wrong.")
              }
            }
          )
        } else {
           if (mounted) setStatus("Please open this page inside a Chrome-based browser with the extension installed.")
        }

      } catch (err) {
        console.error(err)
        if (mounted) setStatus("An error occurred during authentication.")
      }
    }

    // Small delay to let UI mount smoothly
    setTimeout(connectExtension, 500)

    return () => {
      mounted = false
    }
  }, [router])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className={`absolute inset-0 blur-xl rounded-full transition-colors duration-1000 ${isSuccess ? 'bg-emerald-500/20' : 'bg-primary/20'}`} />
            <div className={`relative p-4 rounded-full border transition-all duration-700 ${isSuccess ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-primary/10 text-primary border-primary/20 animate-spin'}`}>
              {isSuccess ? <CheckCircle2 size={48} strokeWidth={1.5} /> : <Loader2 size={48} strokeWidth={1.5} />}
            </div>
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
          Extension Connection
        </h1>
        <p className={`font-medium transition-colors duration-500 ${isSuccess ? 'text-emerald-500' : 'text-muted-foreground'}`}>
          {status}
        </p>
      </div>
    </div>
  )
}
