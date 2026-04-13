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
    const profilePromise = supabase
      .from('profiles')
      .select('full_name, email, role')
      .eq('id', supaUser.id)
      .single()

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 3000)
    )

    const result = await Promise.race([profilePromise, timeoutPromise])

    if (!result || !('data' in result)) {
      console.warn('[Auth] fetchProfile timed out, using fallback')
      return {
        id: supaUser.id,
        name: supaUser.user_metadata?.full_name ||
          supaUser.email?.split('@')[0] || 'User',
        email: supaUser.email || '',
        role: 'student',
        isSpotifyLinked: getSpotifyEnabled()
      }
    }

    const { data, error } = result
    if (!error && data) {
      return {
        id: supaUser.id,
        name: data.full_name || supaUser.user_metadata?.full_name || '',
        email: data.email,
        role: data.role as 'student' | 'admin',
        isSpotifyLinked: getSpotifyEnabled()
      }
    }

    return {
      id: supaUser.id,
      name: supaUser.user_metadata?.full_name ||
        supaUser.email?.split('@')[0] || 'User',
      email: supaUser.email || '',
      role: 'student',
      isSpotifyLinked: getSpotifyEnabled()
    }

  } catch (err) {
    console.error('[Auth] fetchProfile crashed:', err)
    return {
      id: supaUser.id,
      name: supaUser.email?.split('@')[0] || 'User',
      email: supaUser.email || '',
      role: 'student',
      isSpotifyLinked: getSpotifyEnabled()
    }
  }
}

// ── Close any orphaned sessions left open by crashes/refreshes ─────────────
// Runs once on app load after the user is confirmed authenticated.
// Prevents the extension from seeing ended_at=null rows and blocking
// sites permanently even when no session is actually running.
async function closeOrphanedSessions(userId: string) {
  try {
    const { error } = await supabase
      .from('study_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('ended_at', null)

    if (error) {
      console.warn('[Auth] Failed to close orphaned sessions:', error.message)
    } else {
      console.log('[Auth] Orphaned sessions closed')
    }
  } catch (err) {
    console.warn('[Auth] closeOrphanedSessions error:', err)
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
    const timeout = setTimeout(() => {
      if (mounted) setIsLoading(false)
    }, 8000)

    if (!supabase) {
      console.error("[Auth] Supabase client is null — check your .env.local file.")
      clearTimeout(timeout)
      if (mounted) setIsLoading(false)
      return
    }

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user && mounted) {
          resolvingProfile.current = true
          const profile = await fetchProfile(session.user)
          resolvingProfile.current = false

          if (mounted) {
            if (profile) {
              setUser(profile)
              setIsAuthenticated(true)
            } else {
              setUser({
                id: session.user.id,
                name: session.user.email?.split('@')[0] || 'User',
                email: session.user.email || '',
                role: 'student',
                isSpotifyLinked: false
              })
              setIsAuthenticated(true)
            }

            // ✅ Close any orphaned study sessions from previous crashes/refreshes.
            // Runs silently in background — does not block rendering.
            closeOrphanedSessions(session.user.id)
          }
        }
      } catch (error) {
        console.error('Failed to initialize session:', error)
      } finally {
        clearTimeout(timeout)
        if (mounted) setIsLoading(false)
      }
    }

    initSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user && mounted) {
          if (resolvingProfile.current) return

          const profile = await fetchProfile(session.user)
          if (profile && mounted) {
            setUser(profile)
            setIsAuthenticated(true)
            setIsLoading(false)

            // ✅ Also clean up on re-login (e.g. tab was closed mid-session)
            closeOrphanedSessions(session.user.id)
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
    if (!supabase) {
      return { error: 'Missing Supabase configuration.' }
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) return { error: error.message }
      if (!data.session) return { error: 'No session returned.' }

      const profile = await fetchProfile(data.session.user)
      if (profile) {
        setUser(profile)
        setIsAuthenticated(true)
      }

      sessionStorage.setItem('flowlock_just_logged_in', 'true')
      window.location.replace('/dashboard')
      return {}

    } catch (err: any) {
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
        return { error: "Please check your email to verify your account before logging in." }
      }
    } catch (err: any) {
      return { error: err.message || "Network connection failed. Please disable your adblocker or firewall." }
    }
  }

  const logout = () => {
    setUser(null)
    setIsAuthenticated(false)
    router.push("/")

    if (supabase) {
      supabase.auth.signOut().catch(error => {
        console.error("Logout network error:", error)
      })
    }
  }

  const updateProfile = async (userData: Partial<AuthUser>) => {
    if (!user) return
    const updatedUser = { ...user, ...userData }
    setUser(updatedUser)

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