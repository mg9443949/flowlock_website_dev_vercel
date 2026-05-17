// "use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/providers/auth-provider"
import { useFocus } from "@/components/providers/focus-provider"
import { supabase } from "@/utils/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Lock, Trash2, Globe, Monitor, Plus, Shield } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface VaultItem {
  id: string
  name: string
  type: "website" | "desktop_app"
  identifier: string
  icon_url: string | null
  created_at: string
}

export function VaultManager() {
  const { user } = useAuth()
  const { isFocusActive } = useFocus()
  const [items, setItems] = useState<VaultItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Form states
  const [webDomain, setWebDomain] = useState("")
  const [webName, setWebName] = useState("")
  const [desktopName, setDesktopName] = useState("")
  const [desktopProcess, setDesktopProcess] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Installed apps detection states
  const [installedApps, setInstalledApps] = useState<{ name: string; identifier: string }[]>([])
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [isDetecting, setIsDetecting] = useState(false)

  const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session?.access_token || ""}`
    }
  }

  const loadItems = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch("/api/vault", { headers })
      if (res.ok) {
        const data = await res.json()
        setItems(data)
      } else {
        toast.error("Failed to load vault items")
      }
    } catch (error) {
      console.error(error)
      toast.error("Network error while loading vault")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handleDelete = async (id: string) => {
    if (isFocusActive) return

    try {
      const headers = await getHeaders()
      const res = await fetch(`/api/vault/${id}`, {
        method: "DELETE",
        headers
      })
      if (res.ok) {
        setItems(items.filter(item => item.id !== id))
        toast.success("Item removed from vault")
      } else {
        toast.error("Failed to remove item")
      }
    } catch (error) {
      console.error(error)
      toast.error("Network error")
    }
  }

  const handleAdd = async (
    type: "website" | "desktop_app",
    custom?: { name: string; identifier: string }
  ) => {
    if (isFocusActive) return

    const name = custom?.name ?? (type === "website" ? webName : desktopName)
    const identifier = custom?.identifier ?? (type === "website" ? webDomain : desktopProcess)

    if (!name || !identifier) {
      toast.error("Please fill in all fields")
      return
    }

    setIsSubmitting(true)
    try {
      const headers = await getHeaders()
      const res = await fetch("/api/vault", {
        method: "POST",
        headers,
        body: JSON.stringify({ name, type, identifier })
      })

      if (res.ok) {
        const newItem = await res.json()
        setItems([...items, newItem])
        toast.success("Added to Distraction Vault")
        if (type === "website") {
          setWebName("")
          setWebDomain("")
        } else {
          // desktop_app
          if (!custom) {
            setDesktopName("")
            setDesktopProcess("")
          }
        }
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to add item")
      }
    } catch (error) {
      console.error(error)
      toast.error("Network error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const detectInstalledApps = async () => {
    setIsDetecting(true)
    try {
      const res = await fetch("/api/installed-apps")
      if (res.ok) {
        const data = await res.json()
        setInstalledApps(data.apps ?? [])
        setSearchTerm("")
        setSelectedAppIds(new Set())
      } else {
        toast.error("Failed to fetch installed apps")
      }
    } catch (e) {
      console.error(e)
      toast.error("Error detecting apps")
    } finally {
      setIsDetecting(false)
    }
  }

  const websites = items.filter(i => i.type === "website")
  const apps = items.filter(i => i.type === "desktop_app")

  const renderItem = (item: VaultItem) => (
    <div
      key={item.id}
      className="group flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50 hover:bg-card/80 transition-colors shadow-sm"
    >
      <div className="flex flex-col overflow-hidden">
        <p className="font-semibold text-sm truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground truncate">{item.identifier}</p>
      </div>
      <div className="ml-4 shrink-0">
        {isFocusActive ? (
          <div className="p-2 bg-primary/10 text-primary rounded-full transition-all" title="Locked during focus session">
            <Lock size={16} />
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors opacity-80 group-hover:opacity-100"
            onClick={() => handleDelete(item.id)}
          >
            <Trash2 size={16} />
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {isFocusActive && (
        <div className="relative overflow-hidden bg-primary/10 border border-primary/20 text-primary p-4 rounded-xl flex items-center justify-center gap-3 backdrop-blur-sm shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="absolute inset-0 bg-primary/5 translate-x-[-100%] animate-[shimmer_3s_infinite]" />
          <Shield size={24} className="animate-pulse" />
          <p className="font-semibold tracking-wide">Vault is locked during an active session</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Websites Section */}
        <Card className="bg-card border-border shadow-lg overflow-hidden flex flex-col h-full ring-1 ring-border/50">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-500">
                <Globe size={20} />
              </div>
              <CardTitle className="text-xl font-bold tracking-tight">Websites</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1 ml-12">
              Block distracting sites across your browsers.
            </p>
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col gap-4">
            <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-[250px] max-h-[400px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : websites.length > 0 ? (
                <div className="grid gap-2 animate-in fade-in duration-300">
                  {websites.map(renderItem)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border/60 rounded-xl bg-muted/20 text-muted-foreground p-4 text-center">
                  <Globe size={32} className="mb-2 opacity-50" />
                  <p className="text-sm font-medium">No websites added</p>
                  <p className="text-xs mt-1">Add sites like youtube.com to block them during sessions</p>
                </div>
              )}
            </div>

            {!isFocusActive && (
              <div className="flex items-center gap-2 pt-4 border-t border-border mt-auto">
                <div className="grid grid-cols-2 gap-2 flex-1">
                  <Input
                    placeholder="Domain (e.g. reddit.com)"
                    value={webDomain}
                    onChange={e => setWebDomain(e.target.value)}
                    disabled={isSubmitting}
                    className="bg-background/50 border-border/50 focus-visible:ring-primary/40 focus-visible:border-primary/50 transition-all font-medium"
                  />
                  <Input
                    placeholder="App Name (e.g. Reddit)"
                    value={webName}
                    onChange={e => setWebName(e.target.value)}
                    disabled={isSubmitting}
                    onKeyDown={e => e.key === 'Enter' && handleAdd("website")}
                    className="bg-background/50 border-border/50 focus-visible:ring-primary/40 focus-visible:border-primary/50 transition-all font-medium"
                  />
                </div>
                <Button
                  onClick={() => handleAdd("website")}
                  disabled={isSubmitting || !webDomain || !webName}
                  size="icon"
                  className="shrink-0 rounded-lg shadow-md hover:scale-105 active:scale-95 transition-all bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus size={20} />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Desktop Apps Section */}
        <Card className="bg-card border-border shadow-lg overflow-hidden flex flex-col h-full ring-1 ring-border/50">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-500/10 rounded-xl text-violet-500">
                <Monitor size={20} />
              </div>
              <CardTitle className="text-xl font-bold tracking-tight">Desktop Apps</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1 ml-12">
              Block specific applications on your PC.
            </p>
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col gap-4">
            <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-[250px] max-h-[400px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : apps.length > 0 ? (
                <div className="grid gap-2 animate-in fade-in duration-300">
                  {apps.map(renderItem)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border/60 rounded-xl bg-muted/20 text-muted-foreground p-4 text-center">
                  <Monitor size={32} className="mb-2 opacity-50" />
                  <p className="text-sm font-medium">No desktop apps added</p>
                  <p className="text-xs mt-1">Add processes like Spotify.exe to prevent them from opening</p>
                </div>
              )}
            </div>

            {!isFocusActive && (
              <div className="flex flex-col gap-2 pt-4 border-t border-border mt-auto">
                <Button onClick={detectInstalledApps} disabled={isDetecting} className="self-start max-w-max">
                  {isDetecting ? "Detecting..." : "Detect Installed Apps"}
                </Button>
                {installedApps.length > 0 && (
                  <>
                    <Input
                      placeholder="Search apps..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="bg-background/50 border-border/50 focus-visible:ring-primary/40 focus-visible:border-primary/50 transition-all font-medium"
                    />
                    <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                      {installedApps
                        .filter(app => app.name.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map(app => (
                          <div key={app.identifier} className="flex items-center">
                            <Checkbox
                              checked={selectedAppIds.has(app.identifier)}
                              onCheckedChange={checked => {
                                setSelectedAppIds(prev => {
                                  const newSet = new Set(prev)
                                  if (checked) newSet.add(app.identifier)
                                  else newSet.delete(app.identifier)
                                  return newSet
                                })
                              }}
                            />
                            <Label className="ml-2">{app.name}</Label>
                          </div>
                        ))}
                    </div>
                    <Button
                      onClick={async () => {
                        const ids = Array.from(selectedAppIds)
                        for (const identifier of ids) {
                          const app = installedApps.find(a => a.identifier === identifier)
                          if (app) {
                            await handleAdd("desktop_app", { name: app.name, identifier: app.identifier })
                          }
                        }
                        setSelectedAppIds(new Set())
                      }}
                      disabled={selectedAppIds.size === 0 || isSubmitting}
                      className="self-start mt-2"
                    >
                      Add Selected
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Required for the shimmer animation on the locked banner */}
      <style>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  )
}
