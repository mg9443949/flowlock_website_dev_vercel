"use client"

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react"
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
    const resolvingProfile = useRef(false)
    const router = useRouter()

    useEffect(() => {
        let mounted = true
        // Safety net: never stay in loading state longer than 8 seconds
        const timeout = setTimeout(() => {
            if (mounted) setIsLoading(false)
        }, 8000)

        // Guard: if env vars are missing, fail fast
        if (!supabase) {
            console.error("[Auth] Supabase client is null — NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Check your .env.local file.")
            clearTimeout(timeout)
            if (mounted) setIsLoading(false)
            return
        }

        // Check existing session on mount
        const initSession = async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user && mounted) {
              resolvingProfile.current = true
              const profile = await fetchProfile(session.user)
              if (profile && mounted) {
                setUser(profile)
                setIsAuthenticated(true)
              }
              resolvingProfile.current = false
            }
          } catch (error) {
            console.error('Failed to initialize session:', error)
          } finally {
            clearTimeout(timeout)
            if (mounted) setIsLoading(false)
          }
        }

        initSession()

        // Listen for auth state changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user && mounted) {
              // If initSession is already resolving the profile, skip —
              // avoid double fetchProfile calls racing each other
              if (resolvingProfile.current) return
              
              const profile = await fetchProfile(session.user)
              if (profile && mounted) {
                setUser(profile)
                setIsAuthenticated(true)
                // If isLoading is still true when this fires, 
                // make sure we resolve it
                setIsLoading(false)
              }
            } else if (event === 'SIGNED_OUT' && mounted) {
              setUser(null)
              setIsAuthenticated(false)
            }
          }
        )

        return () => {
            mounted = false
            clearTimeout(timeout)
            subscription.unsubscribe()
        }
    }, [])

  const login = async (
    email: string,
    password: string
  ): Promise<{ error?: string }> => {
    alert('LOGIN STEP 1: function called')
    
    try {
      alert('LOGIN STEP 2: calling signInWithPassword')
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      alert('LOGIN STEP 3: got response. error=' + 
            (error?.message ?? 'none') + 
            ' session=' + (data?.session ? 'EXISTS' : 'NULL'))

      if (error) {
        alert('LOGIN STEP 3 FAIL: ' + error.message)
        return { error: error.message }
      }

      if (!data?.session) {
        alert('LOGIN STEP 3 FAIL: session is null')
        return { error: 'No session returned.' }
      }

      alert('LOGIN STEP 4: about to fetchProfile')
      
      let profile = null
      try {
        profile = await fetchProfile(data.session.user)
        alert('LOGIN STEP 4 DONE: profile=' + 
              (profile ? profile.email : 'NULL'))
      } catch (profileErr: any) {
        alert('LOGIN STEP 4 CRASH: ' + profileErr.message)
      }

      if (profile) {
        setUser(profile)
        setIsAuthenticated(true)
      }

      alert('LOGIN STEP 5: about to navigate to /dashboard')
      window.location.replace('/dashboard')
      alert('LOGIN STEP 6: navigation called (should never see this)')
      
      return {}

    } catch (err: any) {
      alert('LOGIN CATCH: ' + err.message)
      return { error: err.message || 'Network error.' }
    }
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
        if (!supabase) {
            return { error: "Missing database configuration. Please add Supabase environment variables to Vercel and redeploy." }
        }

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: name, role: "student" },
                    emailRedirectTo: `${window.location.origin}/dashboard`,
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
        } catch (err: any) {
            return { error: err.message || "Network connection failed. Please disable your adblocker or firewall." }
        }
    }

    const logout = () => {
        // Optimistic, instant local logout guarantees the UI functions offline
        setUser(null)
        setIsAuthenticated(false)
        router.push("/")
        
        // Background network logout (fire and forget)
        if (supabase) {
            supabase.auth.signOut().catch(error => {
                console.error("Logout network error (e.g. Supabase offline or blocked):", error)
            })
        }
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

    // Don't block rendering — let public pages (like sign-in) through immediately.
    // The dashboard layout handles auth-gating with isLoading internally.
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
