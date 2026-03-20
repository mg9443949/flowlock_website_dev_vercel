"use client"

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react"
import type { FocusSessionResult } from "@/components/dashboard/pages/focus-tracker"

// ─── Sonar mini-player data ──────────────────────────────────────────────────
export const SONAR_TRACKS = [
    { text: "Ambient study lofi — low energy focus", videoId: "Q89Dzox4jAE" },
    { text: "Deep focus binaural beats", videoId: "n4YghVcjbpw" },
    { text: "Classical piano — deep work", videoId: "sAcj8me7wGI" },
    { text: "Cinematic textures — ambient minimal", videoId: "nPRrp-3sFgQ" },
    { text: "Brown noise — long session focus", videoId: "RqzGzwTY-6w" },
]

export const SPOTIFY_PLAYLISTS = [
    { text: "Lofi Girl - beats to relax/study to", uri: "spotify:playlist:0vvXsWCC9xrXsKd4ZsnwW5" },
    { text: "Deep Focus", uri: "spotify:playlist:37i9dQZF1DWZeKCadgRdKQ" },
    { text: "Intense Studying", uri: "spotify:playlist:37i9dQZF1DX8NTLI2TtZa6" },
    { text: "Instrumental Study", uri: "spotify:playlist:37i9dQZF1DX9sIqqvKsjG8" },
]

interface YTPlayer {
    loadVideoById: (id: string) => void
    loadPlaylist: (args: { list: string }) => void
    playVideo: () => void
    pauseVideo: () => void
    getPlayerState: () => number
    setVolume: (volume: number) => void
    unMute: () => void
    destroy: () => void
}

interface SpotifyPlayer {
    loadUri: (uri: string) => void
    play: () => void
    pause: () => void
    togglePlay: () => void
    destroy: () => void
    addListener: (event: string, callback: (state: any) => void) => void
}

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        YT: any
        onYouTubeIframeAPIReady?: () => void
        onSpotifyIframeApiReady?: (IFrameAPI: any) => void
    }
}

interface FocusContextType {
    // Session results
    lastFocusSession: FocusSessionResult | null
    setLastFocusSession: (session: FocusSessionResult | null) => void

    // Active session tracking
    isFocusActive: boolean
    focusElapsed: number
    targetDuration: number | null
    setFocusElapsed: (seconds: number) => void
    startFocusSession: (targetDuration?: number) => void
    stopFocusSession: () => void

    // Global Player Timer
    sonarDuration: number
    setSonarDuration: (mins: number) => void

    // YouTube Sonar Player
    sonarActiveId: string | null
    isSonarPlaying: boolean
    playSonarTrack: (id: string, type?: "track" | "playlist") => void
    playNextSonarTrack: () => void

    // Spotify Player (hidden SDK)
    spotifyActiveUri: string | null
    isSpotifyPlaying: boolean
    playSpotifyTrack: (uri: string) => void
    toggleSpotify: () => void

    // Spotify Embed (visible iframe — persists across navigation)
    spotifyEmbedId: string | null
    spotifyEmbedType: "playlist" | "track"
    setSpotifyEmbed: (id: string | null, type?: "playlist" | "track") => void

    // Universal Controls
    stopAllMusic: () => void
    toggleAllMusic: () => void
}

const FocusContext = createContext<FocusContextType | undefined>(undefined)

export function FocusProvider({ children }: { children: ReactNode }) {
    const [lastFocusSession, setLastFocusSession] = useState<FocusSessionResult | null>(null)
    const [isFocusActive, setIsFocusActive] = useState(false)
    const [focusElapsed, setFocusElapsed] = useState(0)
    const [targetDuration, setTargetDuration] = useState<number | null>(null)

    const startFocusSession = useCallback((duration?: number) => {
        setIsFocusActive(true)
        setFocusElapsed(0)
        setTargetDuration(duration || null)
    }, [])

    const stopFocusSession = useCallback(() => {
        setIsFocusActive(false)
        setFocusElapsed(0)
        setTargetDuration(null)
    }, [])

    // ─── Global Sonar Player State ─────────────────────────────────────────────
    const [sonarDuration, setSonarDuration] = useState(50)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // YouTube State
    const ytPlayerRef = useRef<YTPlayer | null>(null)
    const [ytPlayerReady, setYtPlayerReady] = useState(false)
    const [sonarActiveId, setSonarActiveId] = useState<string | null>(null)
    const [isSonarPlaying, setIsSonarPlaying] = useState(false)

    // Spotify State
    const spotifyPlayerRef = useRef<SpotifyPlayer | null>(null)
    const [spotifyPlayerReady, setSpotifyPlayerReady] = useState(false)
    const [spotifyActiveUri, setSpotifyActiveUri] = useState<string | null>(null)
    const [isSpotifyPlaying, setIsSpotifyPlaying] = useState(false)

    // Persistent visible Spotify embed (survives navigation)
    const [spotifyEmbedId, setSpotifyEmbedId] = useState<string | null>(null)
    const [spotifyEmbedType, setSpotifyEmbedType] = useState<"playlist" | "track">("playlist")

    const setSpotifyEmbed = useCallback((id: string | null, type: "playlist" | "track" = "playlist") => {
        setSpotifyEmbedId(id)
        setSpotifyEmbedType(type)
    }, [])

    // Sleep Timer (Works for whichever platform is playing)
    useEffect(() => {
        const isAnyPlaying = isSonarPlaying || isSpotifyPlaying
        if (isAnyPlaying && sonarDuration > 0) {
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => {
                stopAllMusic()
            }, sonarDuration * 60 * 1000)
        } else {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [isSonarPlaying, isSpotifyPlaying, sonarDuration])

    // Initialize YouTube API
    useEffect(() => {
        const mountId = "sonar-global-player"
        const initYt = () => {
            ytPlayerRef.current = new window.YT.Player(mountId, {
                height: "0", width: "0", videoId: "",
                playerVars: { autoplay: 0, controls: 0, modestbranding: 1 },
                events: {
                    onReady: () => setYtPlayerReady(true),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onStateChange: (e: any) => {
                        if (e.data === 0) { setSonarActiveId(null); setIsSonarPlaying(false) }
                    },
                },
            })
        }
        if (window.YT?.Player) {
            initYt()
        } else {
            window.onYouTubeIframeAPIReady = initYt
            if (!document.getElementById("yt-api-script")) {
                const s = document.createElement("script")
                s.id = "yt-api-script"
                s.src = "https://www.youtube.com/iframe_api"
                document.body.appendChild(s)
            }
        }
        return () => {
            try { ytPlayerRef.current?.destroy() } catch (_) {}
            ytPlayerRef.current = null
        }
    }, [])

    // Initialize Spotify API (Hidden Wrapper)
    useEffect(() => {
        const mountId = "spotify-global-player"
        window.onSpotifyIframeApiReady = (IFrameAPI: any) => {
            const element = document.getElementById(mountId)
            if (!element) return
            const options = { width: '0', height: '0', uri: '' }
            
            IFrameAPI.createController(element, options, (EmbedController: any) => {
                spotifyPlayerRef.current = EmbedController
                setSpotifyPlayerReady(true)

                EmbedController.addListener('playback_update', (e: any) => {
                    if (e.data.isPaused) {
                        setIsSpotifyPlaying(false)
                    } else if (e.data.isPaused === false) {
                        setIsSpotifyPlaying(true)
                    }
                })
            })
        }

        if (!document.getElementById("spotify-api-script")) {
            const s = document.createElement("script")
            s.id = "spotify-api-script"
            s.src = "https://open.spotify.com/embed/iframe-api/v1"
            document.body.appendChild(s)
        }
        
        return () => {
             // EmbedController doesn't have an explicit destroy, but we release the ref
             try { spotifyPlayerRef.current?.destroy() } catch(_) {}
             spotifyPlayerRef.current = null
        }
    }, [])

    const stopAllMusic = useCallback(() => {
        // Stop YT
        if (ytPlayerRef.current) ytPlayerRef.current.pauseVideo()
        setIsSonarPlaying(false)
        setSonarActiveId(null)

        // Stop Spotify
        if (spotifyPlayerRef.current) spotifyPlayerRef.current.pause()
        setIsSpotifyPlaying(false)
        setSpotifyActiveUri(null)
    }, [])

    const playSonarTrack = useCallback((id: string, type: "track" | "playlist" = "track") => {
        if (!ytPlayerReady || !ytPlayerRef.current) return
        
        // Pause Spotify if playing
        if (isSpotifyPlaying && spotifyPlayerRef.current) {
            spotifyPlayerRef.current.pause()
            setIsSpotifyPlaying(false)
        }

        if (sonarActiveId === id) {
            const state = ytPlayerRef.current.getPlayerState()
            if (state === 1) { ytPlayerRef.current.pauseVideo(); setIsSonarPlaying(false) }
            else { ytPlayerRef.current.playVideo(); setIsSonarPlaying(true) }
            return
        }
        setSonarActiveId(id)
        setIsSonarPlaying(true)
        if (type === "playlist") {
            ytPlayerRef.current.loadPlaylist({ list: id })
        } else {
            ytPlayerRef.current.loadVideoById(id)
        }
        // Ensure playback starts and audio is audible
        ytPlayerRef.current.playVideo()
        ytPlayerRef.current.unMute()
        ytPlayerRef.current.setVolume(100)
    }, [ytPlayerReady, sonarActiveId, isSpotifyPlaying])

    const playNextSonarTrack = useCallback(() => {
        if (!sonarActiveId) {
            playSonarTrack(SONAR_TRACKS[0].videoId)
            return
        }
        const currentIndex = SONAR_TRACKS.findIndex(t => t.videoId === sonarActiveId)
        const nextIndex = (currentIndex + 1) % SONAR_TRACKS.length
        playSonarTrack(SONAR_TRACKS[nextIndex].videoId)
    }, [playSonarTrack, sonarActiveId])

    const playSpotifyTrack = useCallback((uri: string) => {
        if (!spotifyPlayerReady || !spotifyPlayerRef.current) return
        
        // Pause YouTube if playing
        if (isSonarPlaying && ytPlayerRef.current) {
            ytPlayerRef.current.pauseVideo()
            setIsSonarPlaying(false)
        }

        if (spotifyActiveUri === uri) {
            spotifyPlayerRef.current.togglePlay()
            return
        }
        
        setSpotifyActiveUri(uri)
        setIsSpotifyPlaying(true)
        spotifyPlayerRef.current.loadUri(uri)
        spotifyPlayerRef.current.play()
    }, [spotifyPlayerReady, spotifyActiveUri, isSonarPlaying])

    const toggleSpotify = useCallback(() => {
       if (!spotifyPlayerRef.current || !spotifyActiveUri) return
       spotifyPlayerRef.current.togglePlay()
    }, [spotifyActiveUri])

    const toggleAllMusic = useCallback(() => {
        if (sonarActiveId && ytPlayerRef.current) {
            const state = ytPlayerRef.current.getPlayerState()
            if (state === 1) {
                ytPlayerRef.current.pauseVideo()
                setIsSonarPlaying(false)
            } else {
                ytPlayerRef.current.playVideo()
                ytPlayerRef.current.unMute()
                ytPlayerRef.current.setVolume(100)
                setIsSonarPlaying(true)
            }
        } else if (spotifyActiveUri && spotifyPlayerRef.current) {
            spotifyPlayerRef.current.togglePlay()
        }
    }, [sonarActiveId, spotifyActiveUri])

    return (
        <FocusContext.Provider value={{
            lastFocusSession,
            setLastFocusSession,
            isFocusActive,
            focusElapsed,
            targetDuration,
            setFocusElapsed,
            startFocusSession,
            stopFocusSession,
            
            // Sonar universal timer
            sonarDuration,
            setSonarDuration,
            stopAllMusic,
            toggleAllMusic,

            // YouTube
            sonarActiveId,
            isSonarPlaying,
            playSonarTrack,
            playNextSonarTrack,

            // Spotify SDK (hidden)
            spotifyActiveUri,
            isSpotifyPlaying,
            playSpotifyTrack,
            toggleSpotify,

            // Spotify Embed (persistent visible iframe)
            spotifyEmbedId,
            spotifyEmbedType,
            setSpotifyEmbed,
        }}>
            {/* Hidden audio players */}
            <div id="sonar-global-player" style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none', overflow: 'hidden' }} />
            <div id="spotify-global-player" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', top: '-1000px' }} />

            {children}

            {/* ── Persistent Spotify Embed ── renders on top of page content, survives navigation */}
            {spotifyEmbedId && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: '1.25rem',
                        right: '1.25rem',
                        width: '340px',
                        zIndex: 9000,
                        borderRadius: '1rem',
                        overflow: 'hidden',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(29,185,84,0.3)',
                        animation: 'spotifyEmbedSlideIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275)',
                    }}
                >
                    {/* Close button */}
                    <button
                        onClick={() => setSpotifyEmbed(null)}
                        style={{
                            position: 'absolute', top: '0.5rem', right: '0.5rem',
                            background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%',
                            width: 28, height: 28, cursor: 'pointer', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 1, fontSize: '1rem', lineHeight: 1,
                        }}
                        title="Close player"
                    >
                        ×
                    </button>
                    <iframe
                        key={spotifyEmbedId + spotifyEmbedType}
                        src={`https://open.spotify.com/embed/${spotifyEmbedType}/${spotifyEmbedId}?utm_source=generator&theme=0`}
                        width="340"
                        height={spotifyEmbedType === 'track' ? '152' : '352'}
                        frameBorder="0"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        style={{ display: 'block' }}
                    />
                    <style>{`
                        @keyframes spotifyEmbedSlideIn {
                            from { opacity: 0; transform: translateY(20px) scale(0.95); }
                            to   { opacity: 1; transform: translateY(0) scale(1); }
                        }
                    `}</style>
                </div>
            )}
        </FocusContext.Provider>
    )
}

export function useFocus() {
    const context = useContext(FocusContext)
    if (context === undefined) {
        throw new Error("useFocus must be used within a FocusProvider")
    }
    return context
}
