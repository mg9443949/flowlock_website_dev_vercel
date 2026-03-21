"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/utils/supabase/client"
import type { User } from "@supabase/supabase-js"

export type UserRole = "student" | "admin"

export interface AuthUser {
    id: string
    name: string
    email: string
    role: UserRole
    isSpotifyLinked: boolean
}

interface AuthContextType {
    user: AuthUser | null
    isAuthenticated: boolean
    isLoading: boolean
    login: (email: string, password: string) => Promise<{ error?: string }>
    demoLogin: () => void
    signup: (email: string, password: string, name: string) => Promise<{ error?: string }>
    logout: () => void
    updateProfile: (userData: Partial<AuthUser>) => void
    setSpotifyEnabled: (enabled: boolean) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const SPOTIFY_STORAGE_KEY = "flowlock_spotify_enabled"

function getSpotifyEnabled(): boolean {
    if (typeof window === "undefined") return false
    return localStorage.getItem(SPOTIFY_STORAGE_KEY) === "true"
}

async function fetchProfile(supaUser: User): Promise<AuthUser | null> {
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("full_name, email, role")
            .eq("id", supaUser.id)
            .single()

        if (!error && data) {
            return {
                id: supaUser.id,
                name: data.full_name || supaUser.user_metadata?.full_name || "",
                email: data.email,
                role: data.role as "student" | "admin",
                isSpotifyLinked: getSpotifyEnabled(),
            }
        }

        // Fallback: profile row doesn't exist yet (new signup) or query failed
        // Use auth metadata instead of blocking login
        console.warn("[Auth] Profile fetch failed, using auth metadata fallback:", error?.message)
        return {
            id: supaUser.id,
            name: supaUser.user_metadata?.full_name || supaUser.email?.split("@")[0] || "User",
            email: supaUser.email || "",
            role: (supaUser.user_metadata?.role as "student" | "admin") || "student",
            isSpotifyLinked: getSpotifyEnabled(),
        }
    } catch (err) {
        console.error("[Auth] fetchProfile crashed:", err)
        // Still allow login with minimal info
        return {
            id: supaUser.id,
            name: supaUser.email?.split("@")[0] || "User",
            email: supaUser.email || "",
            role: "student",
            isSpotifyLinked: getSpotifyEnabled(),
        }
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        // Safety net: never stay in loading state longer than 5 seconds
        const timeout = setTimeout(() => setIsLoading(false), 5000)

        // Check existing session on mount
        const initSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (session?.user) {
                    const profile = await fetchProfile(session.user)
                    if (profile) {
                        setUser(profile)
                        setIsAuthenticated(true)
                    }
                }
            } catch (error) {
                console.error("Failed to initialize session:", error)
            } finally {
                clearTimeout(timeout)
                setIsLoading(false)
            }
        }

        initSession()

        // Listen for auth state changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === "SIGNED_IN" && session?.user) {
                    const profile = await fetchProfile(session.user)
                    if (profile) {
                        setUser(profile)
                        setIsAuthenticated(true)
                    }
                } else if (event === "SIGNED_OUT") {
                    setUser(null)
                    setIsAuthenticated(false)
                }
            }
        )

        return () => {
            clearTimeout(timeout)
            subscription.unsubscribe()
        }
    }, [])

    const login = async (email: string, password: string): Promise<{ error?: string }> => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return { error: error.message }

        if (data.session?.user) {
            const profile = await fetchProfile(data.session.user)
            if (profile) {
                setUser(profile)
                setIsAuthenticated(true)
            }
        }
        
        router.push("/dashboard")
        return {}
    }

    const demoLogin = () => {
        const demoUser: AuthUser = {
            id: "demo-id-1234",
            name: "Demo Student",
            email: "demo@flowlock.app",
            role: "student",
            isSpotifyLinked: getSpotifyEnabled(),
        }
        setUser(demoUser)
        setIsAuthenticated(true)
        router.push("/dashboard")
    }

    const signup = async (email: string, password: string, name: string): Promise<{ error?: string }> => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: name, role: "student" },
            },
        })
        if (error) return { error: error.message }

        if (data.session?.user) {
            const profile = await fetchProfile(data.session.user)
            if (profile) {
                setUser(profile)
                setIsAuthenticated(true)
            }
            router.push("/dashboard")
            return {}
        } else {
            // If there's no session immediately, Supabase is waiting for email confirmation
            return { error: "Please check your email to verify your account before logging in." }
        }
    }

    const logout = async () => {
        const { error } = await supabase.auth.signOut()
        if (error) console.error("Error during logout:", error)

        setUser(null)
        setIsAuthenticated(false)
        router.push("/")
    }

    const updateProfile = async (userData: Partial<AuthUser>) => {
        if (!user) return
        const updatedUser = { ...user, ...userData }
        setUser(updatedUser)

        // Persist to Supabase
        await supabase.from("profiles").update({
            full_name: updatedUser.name,
            role: updatedUser.role,
        }).eq("id", user.id)
    }

    const setSpotifyEnabled = (enabled: boolean) => {
        if (typeof window !== "undefined") {
            localStorage.setItem(SPOTIFY_STORAGE_KEY, String(enabled))
        }
        setUser((prev) => prev ? { ...prev, isSpotifyLinked: enabled } : prev)
    }

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

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, demoLogin, signup, logout, updateProfile, setSpotifyEnabled }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}
