"use client"

import { useState, useEffect, useCallback, useRef } from "react"

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/youtube.readonly",
  "openid",
  "email",
  "profile",
].join(" ")

const GK = {
  accessToken: "go_access_token",
  refreshToken: "go_refresh_token",
  expiresAt: "go_expires_at",
  cachedUser: "go_cached_user",
  cachedYTPlaylists: "go_cached_yt_playlists",
}

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface GoogleUser {
  id: string
  name: string
  email: string
  picture: string
}

export interface YouTubePlaylist {
  id: string
  snippet: {
    title: string
    description: string
    thumbnails: { default: { url: string }, medium: { url: string }, high: { url: string } }
  }
}

export interface YouTubeTrack {
  id: { videoId: string } | string
  snippet: {
    title: string
    channelTitle: string
    thumbnails: { default: { url: string }, medium: { url: string } }
    resourceId?: { videoId: string }
  }
}

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  htmlLink: string
}

// ─── Low-level: get a fresh token (refresh if expired) ───────────────────────
async function getToken(): Promise<string | null> {
  const stored = localStorage.getItem(GK.accessToken)
  const expiresAt = Number(localStorage.getItem(GK.expiresAt) || 0)

  // Buffer of 60 seconds
  if (stored && Date.now() < expiresAt) return stored

  // Try refresh
  const refreshToken = localStorage.getItem(GK.refreshToken)
  if (!refreshToken) return null

  try {
    const res = await fetch("/api/google/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const newExpiresAt = Date.now() + (data.expires_in - 60) * 1000
    localStorage.setItem(GK.accessToken, data.access_token)
    localStorage.setItem(GK.expiresAt, String(newExpiresAt))
    if (data.refresh_token) localStorage.setItem(GK.refreshToken, data.refresh_token)
    return data.access_token
  } catch {
    return null
  }
}

// ─── Low-level: call Google API ──────────────────────────────────────────────
async function callGoogle(endpoint: string, options: RequestInit = {}): Promise<any | null> {
  const token = await getToken()
  if (!token) {
    console.warn("[Google] No valid token for", endpoint)
    return null
  }
  
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...options.headers,
  }

  const res = await fetch(endpoint, { ...options, headers })
  if (!res.ok) {
    const errText = await res.text()
    console.error("[Google] API error", res.status, endpoint, errText)
    return null
  }
  
  // Some endpoints return 204 No Content
  if (res.status === 204) return true
  
  return res.json()
}

// ─── Main hook ─────────────────────────────────────────────────────────────────
export function useGoogle() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Pre-load from cache immediately
  const [user, setUser] = useState<GoogleUser | null>(() => {
    if (typeof window === "undefined") return null
    try { return JSON.parse(localStorage.getItem(GK.cachedUser) || "null") } catch { return null }
  })
  const [ytPlaylists, setYtPlaylists] = useState<YouTubePlaylist[]>(() => {
    if (typeof window === "undefined") return []
    try { return JSON.parse(localStorage.getItem(GK.cachedYTPlaylists) || "[]") } catch { return [] }
  })
  
  const [ytPlaylistsLoading, setYtPlaylistsLoading] = useState(false)
  const fetchedRef = useRef(false) // prevent double-fetch on StrictMode

  // ─── Initialise session ───────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)

      // 1. Check for OAuth callback tokens in URL (highest priority)
      // We use g_ prefix to avoid collision with Spotify's identical param names
      const params = new URLSearchParams(window.location.search)
      const atParam = params.get("g_access_token")
      const rtParam = params.get("g_refresh_token")
      const exParam = params.get("g_expires_in")
      const gAuth = params.get("g_auth")

      if (gAuth && atParam && exParam) {
        const expiresAt = Date.now() + (Number(exParam) - 60) * 1000
        localStorage.setItem(GK.accessToken, atParam)
        localStorage.setItem(GK.expiresAt, String(expiresAt))
        // Refresh token might only be sent on first login
        if (rtParam) {
          localStorage.setItem(GK.refreshToken, rtParam)
        }
        
        // Clean URL properly without breaking navigation state
        const url = new URL(window.location.href)
        url.searchParams.delete("g_access_token")
        url.searchParams.delete("g_refresh_token")
        url.searchParams.delete("g_expires_in")
        url.searchParams.delete("g_auth")
        window.history.replaceState({}, "", url.toString())
        
        setIsLoggedIn(true)
        setIsLoading(false)
        return
      }

      const errParam = params.get("google_error")
      if (errParam) {
        console.error("[Google] OAuth error:", errParam)
        const url = new URL(window.location.href)
        url.searchParams.delete("google_error")
        window.history.replaceState({}, "", url.toString())
        setIsLoading(false)
        return
      }

      // 2. Try to restore from localStorage (existing session)
      const token = await getToken()
      if (token) {
        setIsLoggedIn(true)
      }
      setIsLoading(false)
    }
    init()
  }, []) // runs once on mount

  // ─── Fetch user + initial data once logged in ─────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return
    if (fetchedRef.current) return
    fetchedRef.current = true

    // Fetch user profile (Google UserInfo endpoint)
    if (!user) {
      callGoogle("https://www.googleapis.com/oauth2/v3/userinfo").then((data) => {
        if (data) {
          const u: GoogleUser = {
            id: data.sub,
            name: data.name,
            email: data.email,
            picture: data.picture,
          }
          setUser(u)
          localStorage.setItem(GK.cachedUser, JSON.stringify(u))
        }
      })
    }

    // Fetch YouTube playlists — show spinner only if no cache
    const hasCachedYt = ytPlaylists.length > 0
    if (!hasCachedYt) setYtPlaylistsLoading(true)

    callGoogle("https://youtube.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50").then((data) => {
      if (data?.items) {
        setYtPlaylists(data.items)
        localStorage.setItem(GK.cachedYTPlaylists, JSON.stringify(data.items))
      } else {
        // Token invalid, scopes revoked, or YouTube API not enabled
        console.warn("[Google] Failed to fetch YT playlists, ignoring instead of clearing session.")
        setYtPlaylists([])
      }
      setYtPlaylistsLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  // ─── Clear all Google data ───────────────────────────────────────────────
  const clearAll = useCallback(() => {
    Object.values(GK).forEach((k) => localStorage.removeItem(k))
    setIsLoggedIn(false)
    setUser(null)
    setYtPlaylists([])
    fetchedRef.current = false
  }, [])

  // ─── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async () => {
    let host = window.location.host
    if (host.includes("localhost")) {
      host = host.replace("localhost", "127.0.0.1")
    }
    const redirectUri = `${window.location.protocol}//${host}/api/google/callback`
    
    // Pass current page path as 'state' so callback redirects us back here
    const originPage = window.location.pathname
    
    // We MUST include access_type=offline and prompt=consent to get a refresh_token
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      state: originPage,
    })
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }, [])

  const logout = useCallback(() => clearAll(), [clearAll])

  // ─── YouTube Methods ────────────────────────────────────────────────────
  const fetchYtPlaylists = useCallback(async (): Promise<YouTubePlaylist[]> => {
    setYtPlaylistsLoading(true)
    const data = await callGoogle("https://youtube.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50")
    const items: YouTubePlaylist[] = data?.items ?? []
    if (items.length > 0) {
      setYtPlaylists(items)
      localStorage.setItem(GK.cachedYTPlaylists, JSON.stringify(items))
    }
    setYtPlaylistsLoading(false)
    return items
  }, [])
  
  const getYtPlaylistItems = useCallback(async (playlistId: string): Promise<YouTubeTrack[]> => {
    const data = await callGoogle(`https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}`)
    return data?.items ?? []
  }, [])

  const searchYouTube = useCallback(async (query: string): Promise<YouTubeTrack[]> => {
    if (!query.trim()) return []
    // Search for video type only
    const data = await callGoogle(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(query)}&type=video`)
    return data?.items ?? []
  }, [])
  
  // ─── Calendar Methods ───────────────────────────────────────────────────
  const fetchCalendarEvents = useCallback(async (timeMin: Date = new Date(), maxResults: number = 20): Promise<CalendarEvent[]> => {
    // timeMin must be RFC3339 timestamp with mandatory time zone offset
    const timeStr = timeMin.toISOString()
    const data = await callGoogle(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeStr)}&maxResults=${maxResults}&orderBy=startTime&singleEvents=true`)
    return data?.items ?? []
  }, [])
  
  const createCalendarEvent = useCallback(async (summary: string, description: string, startTime: Date, endTime: Date): Promise<CalendarEvent | null> => {
    const event = {
      summary,
      description,
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
    }
    return callGoogle("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      body: JSON.stringify(event)
    })
  }, [])

  return {
    isLoggedIn,
    isLoading,
    user,
    login,
    logout,
    
    // YouTube
    ytPlaylists,
    ytPlaylistsLoading,
    fetchYtPlaylists,
    getYtPlaylistItems,
    searchYouTube,
    
    // Calendar
    fetchCalendarEvents,
    createCalendarEvent,
  }
}
