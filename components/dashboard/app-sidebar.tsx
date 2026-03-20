"use client"

import { BarChart3, Users, TrendingUp, Settings, Gamepad2, Menu, X, Clock, LogOut, Eye, Zap, Monitor, FileBarChart, Music2, Play, Pause, Calendar } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { UserRole } from "@/components/providers/auth-provider"

interface AppSidebarProps {
    userRole: UserRole
    onLogout: () => void
}

import { useFocus } from "@/components/providers/focus-provider"

export function AppSidebar({ userRole, onLogout }: AppSidebarProps) {
    const [isOpen, setIsOpen] = useState(false)
    const pathname = usePathname()
    
    const { isSonarPlaying, isSpotifyPlaying, stopAllMusic, toggleAllMusic } = useFocus()
    const isPlayingAny = isSonarPlaying || isSpotifyPlaying

    const menuItems = [
        { id: "dashboard", label: "Dashboard", icon: BarChart3, href: "/dashboard", roles: ["student", "admin"] as const },
        { id: "focus", label: "Focus Tracker", icon: Eye, href: "/dashboard/focus", roles: ["student"] as const },
        { id: "study", label: "Study Session", icon: Clock, href: "/dashboard/study", roles: ["student"] as const },
        { id: "users", label: "User Management", icon: Users, href: "/dashboard/users", roles: ["admin"] as const },
        { id: "analytics", label: "Analytics", icon: TrendingUp, href: "/dashboard/analytics", roles: ["student", "admin"] as const },
        { id: "productivity", label: "Productivity Report", icon: FileBarChart, href: "/dashboard/productivity", roles: ["student", "admin"] as const },
        { id: "games", label: "Games", icon: Gamepad2, href: "/dashboard/games", roles: ["student", "admin"] as const },
        { id: "playlist", label: "Sonar Playlist", icon: Music2, href: "/dashboard/playlist", roles: ["student", "admin"] as const },
        { id: "calendar", label: "Calendar", icon: Calendar, href: "/dashboard/calendar", roles: ["student", "admin"] as const },
        { id: "settings", label: "Settings", icon: Settings, href: "/dashboard/settings", roles: ["student", "admin"] as const },
    ]

    const visibleMenuItems = menuItems.filter((item) => (item.roles as readonly string[]).includes(userRole))

    return (
        <>
            <Button
                variant="outline"
                size="icon"
                onClick={() => setIsOpen(!isOpen)}
                className="fixed top-4 left-4 z-50 lg:hidden"
            >
                {isOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>

            <div
                className={cn(
                    "fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden transition-all duration-200",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={() => setIsOpen(false)}
            />

            <div
                className={cn(
                    "fixed left-0 top-0 h-screen w-72 bg-card border-r border-border flex flex-col z-40 lg:relative lg:z-auto transition-transform duration-300 ease-in-out lg:translate-x-0 pb-4",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {/* Header */}
                <div className="p-6 border-b border-border">
                    <Link href="/dashboard" className="flex items-center gap-2 text-primary mb-1">
                        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                            <Zap size={20} fill="currentColor" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">FlowLock</h1>
                    </Link>
                    <p className="text-xs font-medium text-muted-foreground ml-1">Focus & Study Dashboard</p>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
                    {visibleMenuItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.id}
                                href={item.href}
                                onClick={() => setIsOpen(false)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group text-sm font-medium",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon size={20} className={cn("transition-transform group-hover:scale-110", isActive && "animate-pulse-subtle")} />
                                <span>{item.label}</span>
                                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-foreground/50" />}
                            </Link>
                        )
                    })}
                </nav>

                {/* Footer Actions */}
                <div className="p-4 border-t border-border space-y-2">
                    {isPlayingAny && (
                        <div className="bg-primary/10 rounded-lg p-3 mb-2 flex items-center justify-between border border-primary/20">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                                    <Music2 size={12} className={isSpotifyPlaying ? "text-[#1DB954]" : "text-primary"} />
                                </div>
                                <div className="flex flex-col truncate">
                                    <p className="text-xs font-semibold text-foreground truncate">
                                        {isSpotifyPlaying ? "Spotify Focus" : "Sonar Tracks"}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">Playing in background</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={toggleAllMusic}
                                    className="p-1.5 hover:bg-primary/20 text-muted-foreground hover:text-primary rounded-md transition-colors"
                                    title="Play/Pause"
                                >
                                     {isPlayingAny ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current" />}
                                </button>
                                <button
                                    onClick={stopAllMusic}
                                    className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                                    title="Stop Music"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors text-sm font-medium"
                    >
                        <LogOut size={20} />
                        <span>Logout</span>
                    </button>
                </div>
            </div>
        </>
    )
}
