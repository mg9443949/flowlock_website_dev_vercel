"use client"

import { useState, useEffect, useCallback, useRef } from "react"

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!
const SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
  "user-read-private",
  "user-read-email",
].join(" ")

const SK = {
  accessToken: "sp_access_token",
  refreshToken: "sp_refresh_token",
  expiresAt: "sp_expires_at",
  codeVerifier: "sp_code_verifier",
  redirectUri: "sp_redirect_uri",
  cachedUser: "sp_cached_user",
  cachedPlaylists: "sp_cached_playlists",
}

// ─── PKCE helpers ─────────────────────────────────────────────────────────────
function generateRandomString(length: number): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values).map((x) => possible[x % possible.length]).join("")
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface SpotifyPlaylist {
  id: string
  name: string
  description: string | null
  images: { url: string }[]
  tracks: { total: number }
  owner: { display_name: string }
  uri: string
}

export interface SpotifyTrack {
  id: string
  name: string
  artists: { name: string }[]
  album: { name: string; images: { url: string }[] }
  duration_ms: number
  uri: string
  preview_url: string | null
  external_urls: { spotify: string }
}

export interface SpotifyUser {
  id: string
  display_name: string
  email: string
  images: { url: string }[]
}

// ─── Low-level: get a fresh token (refresh if expired) ───────────────────────
async function getToken(): Promise<string | null> {
  const stored = localStorage.getItem(SK.accessToken)
  const expiresAt = Number(localStorage.getItem(SK.expiresAt) || 0)

  if (stored && Date.now() < expiresAt) return stored

  // Try refresh
  const refreshToken = localStorage.getItem(SK.refreshToken)
  if (!refreshToken) return null

  try {
    const res = await fetch("/api/spotify/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const newExpiresAt = Date.now() + (data.expires_in - 60) * 1000
    localStorage.setItem(SK.accessToken, data.access_token)
    localStorage.setItem(SK.expiresAt, String(newExpiresAt))
    if (data.refresh_token) localStorage.setItem(SK.refreshToken, data.refresh_token)
    return data.access_token
  } catch {
    return null
  }
}

// ─── Low-level: call Spotify API ──────────────────────────────────────────────
async function callSpotify(endpoint: string): Promise<any | null> {
  const token = await getToken()
  if (!token) {
    console.warn("[Spotify] No valid token for", endpoint)
    return null
  }
  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const errText = await res.text()
    console.error("[Spotify] API error", res.status, endpoint, errText)
    return null
  }
  return res.json()
}

// ─── Main hook ─────────────────────────────────────────────────────────────────
export function useSpotify() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Pre-load from cache immediately — avoids blank screen on return
  const [user, setUser] = useState<SpotifyUser | null>(() => {
    if (typeof window === "undefined") return null
    try { return JSON.parse(localStorage.getItem(SK.cachedUser) || "null") } catch { return null }
  })
  const [myPlaylists, setMyPlaylists] = useState<SpotifyPlaylist[]>(() => {
    if (typeof window === "undefined") return []
    try { return JSON.parse(localStorage.getItem(SK.cachedPlaylists) || "[]") } catch { return [] }
  })
  const [playlistsLoading, setPlaylistsLoading] = useState(false)
  const fetchedRef = useRef(false) // prevent double-fetch on StrictMode

  // ─── Initialise session ───────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)

      const params = new URLSearchParams(window.location.search)

      // 1. Check for OAuth callback code — do PKCE token exchange client-side
      //    (We exchange client-side because the code_verifier is in localStorage,
      //     not in a cookie, avoiding the localhost ↔ 127.0.0.1 cookie issue.)
      const codeParam = params.get("spotify_code")
      if (codeParam) {
        // Clean URL immediately
        const url = new URL(window.location.href)
        url.searchParams.delete("spotify_code")
        window.history.replaceState({}, "", url.toString())

        const codeVerifier = localStorage.getItem(SK.codeVerifier)
        const redirectUri = localStorage.getItem(SK.redirectUri)

        if (!codeVerifier || !redirectUri) {
          console.error("[Spotify] Missing code_verifier or redirect_uri for token exchange")
          setIsLoading(false)
          return
        }

        try {
          const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: CLIENT_ID,
              grant_type: "authorization_code",
              code: codeParam,
              redirect_uri: redirectUri,
              code_verifier: codeVerifier,
            }),
          })

          const tokenData = await tokenRes.json()

          if (!tokenRes.ok || tokenData.error) {
            console.error("[Spotify] Token exchange failed:", tokenData)
            setIsLoading(false)
            return
          }

          const expiresAt = Date.now() + (tokenData.expires_in - 60) * 1000
          localStorage.setItem(SK.accessToken, tokenData.access_token)
          localStorage.setItem(SK.refreshToken, tokenData.refresh_token)
          localStorage.setItem(SK.expiresAt, String(expiresAt))
          // Clean up PKCE artifacts
          localStorage.removeItem(SK.codeVerifier)
          localStorage.removeItem(SK.redirectUri)

          setIsLoggedIn(true)
          setIsLoading(false)
          return
        } catch (err) {
          console.error("[Spotify] Token exchange error:", err)
          setIsLoading(false)
          return
        }
      }

      // 2. Check for legacy token params (from old callback flow)
      const atParam = params.get("access_token")
      const rtParam = params.get("refresh_token")
      const exParam = params.get("expires_in")

      if (atParam && rtParam && exParam) {
        const expiresAt = Date.now() + (Number(exParam) - 60) * 1000
        localStorage.setItem(SK.accessToken, atParam)
        localStorage.setItem(SK.refreshToken, rtParam)
        localStorage.setItem(SK.expiresAt, String(expiresAt))
        const url = new URL(window.location.href)
        url.searchParams.delete("access_token")
        url.searchParams.delete("refresh_token")
        url.searchParams.delete("expires_in")
        window.history.replaceState({}, "", url.toString())
        setIsLoggedIn(true)
        setIsLoading(false)
        return
      }

      // 3. Check for error
      const errParam = params.get("spotify_error")
      if (errParam) {
        console.error("[Spotify] OAuth error:", errParam)
        const url = new URL(window.location.href)
        url.searchParams.delete("spotify_error")
        window.history.replaceState({}, "", url.toString())
        setIsLoading(false)
        return
      }

      // 4. Try to restore from localStorage (existing session)
      const token = await getToken()
      if (token) {
        setIsLoggedIn(true)
      }
      setIsLoading(false)
    }
    init()
  }, []) // runs once on mount

  // ─── Fetch user + playlists once logged in ────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return
    if (fetchedRef.current) return
    fetchedRef.current = true

    // Fetch user profile (use cache if available)
    if (!user) {
      callSpotify("/me").then((data) => {
        if (data) {
          setUser(data)
          localStorage.setItem(SK.cachedUser, JSON.stringify(data))
        }
      })
    }

    // Fetch playlists — show spinner only if no cache
    const hasCached = myPlaylists.length > 0
    if (!hasCached) setPlaylistsLoading(true)

    callSpotify("/me/playlists?limit=50").then((data) => {
      if (data?.items) {
        setMyPlaylists(data.items)
        localStorage.setItem(SK.cachedPlaylists, JSON.stringify(data.items))
      } else if (!hasCached) {
        // API returned null — token might truly be invalid, clear auth
        console.warn("[Spotify] Failed to fetch playlists, clearing session")
        clearAll()
      }
      setPlaylistsLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  // ─── Clear all Spotify data ───────────────────────────────────────────────
  const clearAll = useCallback(() => {
    Object.values(SK).forEach((k) => localStorage.removeItem(k))
    setIsLoggedIn(false)
    setUser(null)
    setMyPlaylists([])
    fetchedRef.current = false
  }, [])

  // ─── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async () => {
    const verifier = generateRandomString(128)
    const challenge = await generateCodeChallenge(verifier)
    localStorage.setItem(SK.codeVerifier, verifier)

    // Use 127.0.0.1 for the redirect URI (Spotify only allows http://127.0.0.1, not http://localhost)
    const host = window.location.host.replace("localhost", "127.0.0.1")
    const redirectUri = `${window.location.protocol}//${host}/api/spotify/callback`
    localStorage.setItem(SK.redirectUri, redirectUri)

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: redirectUri,
      code_challenge_method: "S256",
      code_challenge: challenge,
      scope: SCOPES,
    })
    window.location.href = `https://accounts.spotify.com/authorize?${params}`
  }, [])

  const logout = useCallback(() => clearAll(), [clearAll])

  // ─── Manual refresh playlists ─────────────────────────────────────────────
  const fetchMyPlaylists = useCallback(async (): Promise<SpotifyPlaylist[]> => {
    setPlaylistsLoading(true)
    const data = await callSpotify("/me/playlists?limit=50")
    const items: SpotifyPlaylist[] = data?.items ?? []
    if (items.length > 0) {
      setMyPlaylists(items)
      localStorage.setItem(SK.cachedPlaylists, JSON.stringify(items))
    }
    setPlaylistsLoading(false)
    return items
  }, [])

  // ─── Search ───────────────────────────────────────────────────────────────
  const searchSpotify = useCallback(async (query: string): Promise<{
    tracks: SpotifyTrack[]
    playlists: SpotifyPlaylist[]
  }> => {
    if (!query.trim()) return { tracks: [], playlists: [] }
    const data = await callSpotify(`/search?q=${encodeURIComponent(query)}&type=track,playlist&limit=10`)
    return {
      tracks: data?.tracks?.items ?? [],
      playlists: data?.playlists?.items?.filter(Boolean) ?? [],
    }
  }, [])

  return {
    isLoggedIn,
    isLoading,
    user,
    myPlaylists,
    playlistsLoading,
    login,
    logout,
    fetchMyPlaylists,
    searchSpotify,
  }
}
