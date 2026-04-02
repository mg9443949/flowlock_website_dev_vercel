"use client"

import { useAuth } from "@/components/providers/auth-provider"
import { FocusProvider, useFocus } from "@/components/providers/focus-provider"
import { PomodoroProvider } from "@/components/providers/pomodoro-provider"
import { BreakOverlay } from "@/components/dashboard/break-overlay"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, Settings, User, Eye, Square, AlertCircle, Loader2 } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"

const FocusTracker = dynamic(
    () => import("@/components/dashboard/pages/focus-tracker").then(mod => mod.FocusTracker),
    { ssr: false }
)

function DashboardInner({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, isLoading, logout } = useAuth()
    const { isFocusActive, focusElapsed, targetDuration, stopFocusSession, setLastFocusSession } = useFocus()
    const router = useRouter()
    const pathname = usePathname()

    const isOnFocusPage = pathname === "/dashboard/focus"
    const isStudent = user?.role === "student"

    const [hasMountedTracker, setHasMountedTracker] = useState(false)

    useEffect(() => {
        if (isStudent && (isOnFocusPage || isFocusActive)) {
            setHasMountedTracker(true)
        }
    }, [isStudent, isOnFocusPage, isFocusActive])

    // Show the FocusTracker when: on the focus page OR a session is active.
    // Once mounted, it NEVER unmounts, to prevent destroying background database saves.
    const shouldMountTracker = hasMountedTracker

    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/")
        }
    }, [isAuthenticated, router])

    if (isLoading) {
        return (
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
                background: "#09090b",
            }}>
                <div style={{
                    width: 40,
                    height: 40,
                    border: "3px solid #27272a",
                    borderTop: "3px solid #a855f7",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    if (!user) return null

    const formatElapsed = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, "0")
        const s = (seconds % 60).toString().padStart(2, "0")
        return `${m}:${s}`
    }

    const displayTime = targetDuration
        ? formatElapsed(Math.max(0, targetDuration - focusElapsed))
        : formatElapsed(focusElapsed)

    return (
        <div className="flex h-screen bg-background">
            <AppSidebar userRole={user.role} onLogout={logout} />
            <main className="flex-1 overflow-auto flex flex-col">
                <header className="border-b border-border bg-card sticky top-0 z-10">
                    <div className="flex justify-between items-center px-6 py-4">
                        <div className="flex items-center gap-4 w-full">
                            <h1 className="text-2xl font-bold text-primary">FlowLock</h1>
                            <div className="ml-auto flex items-center gap-4">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                                            <Avatar className="h-10 w-10 border border-border">
                                                <AvatarImage src="/placeholder-user.jpg" alt={user.name} />
                                                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                                    {user.name
                                                        .split(" ")
                                                        .map((n) => n[0])
                                                        .join("")}
                                                </AvatarFallback>
                                            </Avatar>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-56" align="end" forceMount>
                                        <DropdownMenuLabel className="font-normal">
                                            <div className="flex flex-col space-y-1">
                                                <p className="text-sm font-medium leading-none">{user.name}</p>
                                                <p className="text-xs leading-none text-muted-foreground capitalize">{user.role}</p>
                                            </div>
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem asChild>
                                            <Link href="/dashboard/settings" className="cursor-pointer">
                                                <User className="mr-2 h-4 w-4" />
                                                <span>Profile</span>
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href="/dashboard/settings" className="cursor-pointer">
                                                <Settings className="mr-2 h-4 w-4" />
                                                <span>Settings</span>
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer" onClick={logout}>
                                            <LogOut className="mr-2 h-4 w-4" />
                                            <span>Log out</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Mini floating bar — visible when focus session is active and NOT on the focus page */}
                {isFocusActive && !isOnFocusPage && (
                    <div className="sticky top-[73px] z-20 mx-4 mt-2">
                        <div className="flex items-center justify-between gap-4 px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Eye size={18} className="text-emerald-500" />
                                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                </div>
                                <span className="text-sm font-semibold text-emerald-400">Focus Session Active</span>
                                <span className="text-sm font-mono text-emerald-300 tabular-nums">{displayTime}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => router.push("/dashboard/focus")}
                                    className="gap-1.5 h-8 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                >
                                    <Eye size={14} />
                                    Go to Focus
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={stopFocusSession}
                                    className="gap-1.5 h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                >
                                    <Square size={14} />
                                    Stop
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/*
                  FocusTracker lives here — the ONLY mount point.
                  Mounted when on the focus page OR when a session is active.
                  Hidden via CSS when navigated away, so camera/models persist.
                */}
                {shouldMountTracker && (
                    <div className="p-6" style={{ display: isOnFocusPage ? undefined : 'none' }}>
                        <FocusTracker
                            visible={isOnFocusPage}
                            onSessionComplete={setLastFocusSession}
                        />
                    </div>
                )}

                {/* Regular page children — hidden only when the focus tracker is visible on the focus page */}
                <div className="p-6" style={{ display: isOnFocusPage ? 'none' : undefined }}>
                    {children}
                </div>
            </main>
        </div>
    )
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <PomodoroProvider>
            <FocusProvider>
                <BreakOverlay />
                <DashboardInner>{children}</DashboardInner>
            </FocusProvider>
        </PomodoroProvider>
    )
}
