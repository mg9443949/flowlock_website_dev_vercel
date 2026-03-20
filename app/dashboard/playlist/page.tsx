"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useSpotify, type SpotifyPlaylist, type SpotifyTrack } from "@/hooks/use-spotify"
import { useGoogle, type YouTubePlaylist, type YouTubeTrack } from "@/hooks/use-google"
import { useFocus } from "@/components/providers/focus-provider"

// ─── Curated YouTube tracks ────────────────────────────────────────────────────
const SONAR_TRACKS = [
  { text: "Ambient study lofi low energy focus", videoId: "Q89Dzox4jAE" },
  { text: "Deep focus binaural beats for concentration", videoId: "n4YghVcjbpw" },
  { text: "Classical piano for deep work low intensity", videoId: "sAcj8me7wGI" },
  { text: "Cinematic textures focus ambient minimal", videoId: "nPRrp-3sFgQ" },
  { text: "Brown noise for long study session focus", videoId: "RqzGzwTY-6w" },
]

// ─── Curated Spotify playlists (shown when NOT logged in to Spotify) ──────────
const CURATED_PLAYLISTS = [
  { text: "Deep Focus", id: "37i9dQZF1DWZeKCadgRdKQ" },
  { text: "lofi beats", id: "37i9dQZF1DWWQRwui0ExPn" },
  { text: "Binaural Beats", id: "37i9dQZF1DZ06evO48r1i2" },
  { text: "Instrumental Study", id: "37i9dQZF1DX9sIqqvKsjG8" },
  { text: "White Noise", id: "37i9dQZF1DWWjGdmeTyeJ6" },
]

function msToMin(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

// ─── Search bar ────────────────────────────────────────────────────────────────
function SearchBar({ onSearch }: { onSearch: (q: string) => void }) {
  const [val, setVal] = useState("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVal(e.target.value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onSearch(e.target.value), 400)
  }
  return (
    <div style={{ position: "relative", marginBottom: "1.5rem" }}>
      <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", opacity: 0.5, pointerEvents: "none" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      </span>
      <input
        type="text"
        placeholder="Search songs, artists, playlists…"
        value={val}
        onChange={handleChange}
        style={{
          width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "0.75rem", padding: "0.85rem 1rem 0.85rem 2.75rem", color: "white",
          fontSize: "0.95rem", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
        }}
        onFocus={e => e.target.style.borderColor = "#1DB954"}
        onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
      />
    </div>
  )
}

// ─── Track row ─────────────────────────────────────────────────────────────────
function TrackRow({ track, onPlay, isActive }: { track: SpotifyTrack; onPlay: (id: string) => void; isActive: boolean }) {
  const img = track.album?.images?.[2]?.url || track.album?.images?.[0]?.url
  return (
    <div
      onClick={() => onPlay(track.id)}
      style={{
        display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.75rem 1rem",
        borderRadius: "0.75rem", cursor: "pointer",
        background: isActive ? "rgba(29,185,84,0.12)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${isActive ? "rgba(29,185,84,0.4)" : "rgba(255,255,255,0.07)"}`,
        transition: "all 0.2s", marginBottom: "0.5rem",
      }}
    >
      {img && <img src={img} alt={track.name} style={{ width: 44, height: 44, borderRadius: "0.4rem", objectFit: "cover", flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 500, color: isActive ? "#1DB954" : "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</div>
        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {track.artists.map(a => a.name).join(", ")} · {track.album.name}
        </div>
      </div>
      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>{msToMin(track.duration_ms)}</div>
      <span style={{ color: isActive ? "#1DB954" : "rgba(255,255,255,0.3)", flexShrink: 0 }}>
        {isActive
          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
      </span>
    </div>
  )
}

// ─── Playlist card ─────────────────────────────────────────────────────────────
function PlaylistCard({ playlist, isActive, onClick, img }: { playlist: SpotifyPlaylist | YouTubePlaylist; isActive: boolean; onClick: () => void; img?: string }) {
  const imageUrl = img || (// @ts-ignore
    playlist.thumbnails?.medium?.url ||
    // @ts-ignore
    playlist.snippet?.thumbnails?.medium?.url ||
    // @ts-ignore
    playlist.images?.[0]?.url)
    
  // @ts-ignore
  const name = playlist.name || playlist.snippet?.title || "Unknown Playlist"
  const tracksText = "tracks" in playlist ? `${playlist.tracks.total} tracks` : "YouTube Playlist"

  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: "1rem", overflow: "hidden", cursor: "pointer",
        background: isActive ? "rgba(29,185,84,0.12)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${isActive ? "rgba(29,185,84,0.5)" : "rgba(255,255,255,0.08)"}`,
        transition: "all 0.25s", animation: "sonarFadeUp 0.4s ease both",
      }}
    >
      {imageUrl
        ? <img src={imageUrl} alt={name} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover" }} />
        : <div style={{ width: "100%", aspectRatio: "1/1", background: "rgba(29,185,84,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3rem" }}>🎵</div>}
      <div style={{ padding: "0.75rem" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: isActive ? "#1DB954" : "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: "0.2rem" }}>{tracksText}</div>
      </div>
    </div>
  )
}

// ─── YouTube Track row ──────────────────────────────────────────────────────────
function YTTrackRow({ track, onPlay, isActive }: { track: YouTubeTrack; onPlay: (id: string) => void; isActive: boolean }) {
  const img = track.snippet?.thumbnails?.medium?.url
  // Search returns id.videoId, PlaylistItems returns snippet.resourceId.videoId
  const videoId = typeof track.id === "object" ? track.id.videoId : (track.snippet.resourceId?.videoId || track.id)
  if (!videoId) return null

  return (
    <div
      onClick={() => onPlay(videoId)}
      style={{
        display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.75rem 1rem",
        borderRadius: "0.75rem", cursor: "pointer",
        background: isActive ? "rgba(255,0,0,0.12)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${isActive ? "rgba(255,0,0,0.4)" : "rgba(255,255,255,0.07)"}`,
        transition: "all 0.2s", marginBottom: "0.5rem",
      }}
    >
      {img && <img src={img} alt={track.snippet.title} style={{ width: 44, height: 44, borderRadius: "0.4rem", objectFit: "cover", flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 500, color: isActive ? "#ff4d4d" : "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.snippet.title}</div>
        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {track.snippet.channelTitle}
        </div>
      </div>
      <span style={{ color: isActive ? "#ff4d4d" : "rgba(255,255,255,0.3)", flexShrink: 0 }}>
        {isActive
          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
      </span>
    </div>
  )
}


// ─── Main component ────────────────────────────────────────────────────────────
export default function SonarPlaylist() {
  const spotify = useSpotify()
  const google = useGoogle()
  const {
    sonarDuration: customDuration,
    setSonarDuration: setCustomDuration,
    sonarActiveId: activeVideoId,
    isSonarPlaying,
    playSonarTrack,
    stopAllMusic,
    // Global persistent embed — survives navigation
    spotifyEmbedId,
    spotifyEmbedType,
    setSpotifyEmbed,
  } = useFocus()

  const [notification, setNotification] = useState<{ text: string; show: boolean }>({ text: "", show: false })
  const [editingDuration, setEditingDuration] = useState(false)
  const notifTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  const [spotifyTab, setSpotifyTab] = useState<"my-playlists" | "search">("my-playlists")
  const [ytTab, setYtTab] = useState<"my-playlists" | "search">("my-playlists")

  // Search state (local — fine to lose on navigation)
  const [searchResults, setSearchResults] = useState<{ tracks: SpotifyTrack[]; playlists: SpotifyPlaylist[] }>({ tracks: [], playlists: [] })
  const [searchLoading, setSearchLoading] = useState(false)
  
  const [ytSearchResults, setYtSearchResults] = useState<YouTubeTrack[]>([])
  const [ytSearchLoading, setYtSearchLoading] = useState(false)

  const showNotification = (text: string) => {
    if (notifTimeout.current) clearTimeout(notifTimeout.current)
    setNotification({ text, show: true })
    notifTimeout.current = setTimeout(() => setNotification(n => ({ ...n, show: false })), 2500)
  }

  const openEmbed = (id: string, type: "playlist" | "track") => {
    if (isSonarPlaying) stopAllMusic()
    // Toggle off if same id clicked again
    if (spotifyEmbedId === id) { setSpotifyEmbed(null); return }
    setSpotifyEmbed(id, type)
  }

  const handleSonarClick = (videoId: string) => {
    // Close spotify embed when sonar track is selected
    setSpotifyEmbed(null)
    playSonarTrack(videoId)
    showNotification("Tuning in…")
  }

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults({ tracks: [], playlists: [] }); return }
    setSearchLoading(true)
    const results = await spotify.searchSpotify(query)
    setSearchResults(results)
    setSearchLoading(false)
  }, [spotify])

  const handleYtSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setYtSearchResults([]); return }
    setYtSearchLoading(true)
    const results = await google.searchYouTube(query)
    setYtSearchResults(results)
    setYtSearchLoading(false)
  }, [google])

  return (
    <div className="sonar-wrapper">
      <div className="sonar-header">
        <div className="sonar-logo">SONAR</div>
        <div className="sonar-version">v2.0.0</div>
      </div>

      <div className="sonar-hero">
        <h1 className="sonar-title">Sync Your State</h1>
        <p className="sonar-subtitle">Curated frequencies and your own Spotify library — all in one place.</p>

        <div style={{ display: "flex", justifyContent: "center", marginTop: "2.5rem", gap: "1.5rem", flexWrap: "wrap" }}>
          {/* Duration card */}
          <div className="sonar-status-card" style={{ minWidth: "160px", cursor: "pointer" }} onClick={() => setEditingDuration(true)}>
            <div className="sonar-status-label">Duration</div>
            {editingDuration ? (
              <input
                autoFocus type="number" min={1} max={480} value={customDuration}
                onClick={e => e.stopPropagation()}
                onChange={e => setCustomDuration(Number(e.target.value))}
                onBlur={() => setEditingDuration(false)}
                onKeyDown={e => { if (e.key === "Enter") setEditingDuration(false) }}
                style={{ background: "transparent", border: "none", borderBottom: "2px solid #00e5ff", color: "#00e5ff", fontFamily: "'Orbitron', monospace", fontSize: "1.2rem", fontWeight: 700, textAlign: "center", width: "80px", outline: "none" }}
              />
            ) : (
              <div className="sonar-status-value">{customDuration} <span style={{ fontSize: "0.8rem", color: "#1DB954" }}>MIN</span></div>
            )}
          </div>

          {/* Spotify connect card */}
          <div
            className="sonar-status-card"
            style={{ minWidth: "190px", cursor: "pointer", borderColor: spotify.isLoggedIn ? "#1DB954" : undefined }}
            onClick={() => {
              if (spotify.isLoggedIn) { spotify.logout(); setSpotifyEmbed(null); showNotification("Spotify disconnected") }
              else spotify.login()
            }}
          >
            <div className="sonar-status-label" style={{ color: spotify.isLoggedIn ? "#1DB954" : undefined }}>
              {spotify.isLoggedIn ? "Connected as" : "Platform"}
            </div>
            {spotify.isLoading ? (
              <div className="sonar-status-value" style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>Loading…</div>
            ) : spotify.isLoggedIn ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center" }}>
                {spotify.user?.images?.[0]?.url && (
                  <img src={spotify.user.images[0].url} alt="avatar" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                )}
                <div className="sonar-status-value" style={{ fontSize: "0.85rem", color: "#1DB954", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {spotify.user?.display_name || "Spotify"}
                </div>
              </div>
            ) : (
              <div className="sonar-status-value" style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.62 14.44c-.18.3-.57.39-.87.21-2.4-1.46-5.4-1.8-8.94-.99-.34.08-.68-.13-.76-.46-.08-.34.13-.68.46-.76 3.9-.88 7.2-.5 9.9 1.13.29.18.39.56.21.87zm1.19-2.67c-.23.36-.71.48-1.07.25-2.73-1.68-6.9-2.18-10.33-1.19-.4.12-.83-.11-.95-.51-.12-.4.11-.83.51-.95 3.91-1.12 8.5-.56 11.6 1.34.36.23.47.7.24 1.06zm.11-2.82C14.7 9.13 8.5 8.9 4.96 9.97c-.48.15-.99-.13-1.14-.61-.15-.48.13-.99.61-1.14 4.12-1.24 11-.98 14.62 1.16.43.26.57.82.31 1.25-.26.43-.82.57-1.25.31z"/></svg>
                Connect Spotify
              </div>
            )}
          </div>
          
          {/* YouTube/Google connect card */}
          <div
            className="sonar-status-card"
            style={{ minWidth: "190px", cursor: "pointer", borderColor: google.isLoggedIn ? "#ff4d4d" : undefined }}
            onClick={() => {
              if (google.isLoggedIn) { google.logout(); showNotification("Google disconnected") }
              else google.login()
            }}
          >
            <div className="sonar-status-label" style={{ color: google.isLoggedIn ? "#ff4d4d" : undefined }}>
              {google.isLoggedIn ? "Connected as" : "Platform"}
            </div>
            {google.isLoading ? (
              <div className="sonar-status-value" style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>Loading…</div>
            ) : google.isLoggedIn ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center" }}>
                {google.user?.picture && (
                  <img src={google.user.picture} alt="avatar" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                )}
                <div className="sonar-status-value" style={{ fontSize: "0.85rem", color: "#ff4d4d", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {google.user?.name || "YouTube"}
                </div>
              </div>
            ) : (
              <div className="sonar-status-value" style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff4d4d"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                Connect YouTube
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── YouTube Section ── */}
      <section className="sonar-query-section" style={{ marginTop: "3rem" }}>
        {google.isLoggedIn ? (
          /* ── YouTube LOGGED IN ── */
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
              <h2 className="sonar-section-title" style={{ color: "#ff4d4d", margin: 0, flex: 1 }}>YOUTUBE LIBRARY</h2>
            </div>
            
            {/* Tab bar */}
            <div style={{ display: "flex", gap: "0", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: "1.5rem" }}>
              {(["my-playlists", "search"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setYtTab(tab)}
                  style={{
                    background: "none", border: "none", cursor: "pointer", padding: "0.65rem 1.5rem",
                    fontSize: "0.82rem", fontWeight: 700, letterSpacing: "1px",
                    color: ytTab === tab ? "#ff4d4d" : "rgba(255,255,255,0.45)",
                    borderBottom: ytTab === tab ? "2px solid #ff4d4d" : "2px solid transparent",
                    transition: "color 0.2s", textTransform: "uppercase",
                  }}
                >
                  {tab === "my-playlists" ? "My Playlists" : "Search"}
                </button>
              ))}
            </div>

            {/* ── YouTube My Playlists tab ── */}
            {ytTab === "my-playlists" && (
              <>
                {google.ytPlaylistsLoading && google.ytPlaylists.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: "rgba(255,255,255,0.4)" }}>
                    <div style={{ width: 32, height: 32, border: "3px solid rgba(255,77,77,0.2)", borderTop: "3px solid #ff4d4d", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 1rem" }} />
                    Loading your YouTube playlists…
                  </div>
                ) : google.ytPlaylists.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem 0" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📺</div>
                    <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: "1.25rem" }}>No valid YouTube playlists found.</p>
                    <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={() => google.fetchYtPlaylists()}
                        style={{ background: "#ff4d4d", color: "#000", border: "none", borderRadius: "2rem", padding: "0.6rem 1.5rem", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
                      >
                        ↻ Retry
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "1rem" }}>
                    {google.ytPlaylists.map(pl => (
                      <PlaylistCard
                        key={pl.id}
                        playlist={pl}
                        isActive={activeVideoId === pl.id}
                        onClick={() => { playSonarTrack(pl.id, "playlist"); showNotification(pl.snippet.title) }}
                      />
                    ))}
                  </div>
                )}
                {google.ytPlaylistsLoading && google.ytPlaylists.length > 0 && (
                  <p style={{ textAlign: "center", fontSize: "0.75rem", color: "rgba(255,255,255,0.3)", marginTop: "1rem" }}>Refreshing…</p>
                )}
              </>
            )}

            {/* ── YouTube Search tab ── */}
            {ytTab === "search" && (
              <>
                <SearchBar onSearch={handleYtSearch} />
                {ytSearchLoading && (
                  <div style={{ textAlign: "center", padding: "2rem" }}>
                    <div style={{ width: 28, height: 28, border: "3px solid rgba(255,77,77,0.2)", borderTop: "3px solid #ff4d4d", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
                  </div>
                )}
                {!ytSearchLoading && ytSearchResults.length > 0 && (
                  <>
                    <h3 style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "0.75rem" }}>Videos</h3>
                    {ytSearchResults.map(track => {
                      const videoId = typeof track.id === "object" ? track.id.videoId : track.id
                      return (
                        <YTTrackRow key={videoId} track={track} isActive={activeVideoId === videoId} onPlay={id => { playSonarTrack(id, "track"); showNotification(track.snippet.title) }} />
                      )
                    })}
                  </>
                )}
                {!ytSearchLoading && ytSearchResults.length === 0 && (
                  <div style={{ textAlign: "center", padding: "3rem 0", color: "rgba(255,255,255,0.3)", fontSize: "0.9rem" }}>Start typing to search YouTube</div>
                )}
              </>
            )}
          </>
        ) : (
          /* ── YouTube NOT LOGGED IN ── */
          <>
            <h2 className="sonar-section-title">BUILT-IN SONAR FREQUENCIES</h2>
            <div className="sonar-query-grid">
              {SONAR_TRACKS.map((item, i) => {
                const isActive = activeVideoId === item.videoId
                const isPlaying = isActive && isSonarPlaying
                return (
                  <div
                    key={item.videoId}
                    className={`sonar-query-card${isActive ? " sonar-playing" : ""}`}
                    style={{ animationDelay: `${0.3 + i * 0.08}s` }}
                    onClick={() => handleSonarClick(item.videoId)}
                  >
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span className="sonar-query-text">{item.text}</span>
                      <div className="sonar-visualizer">
                        {[0.3, 0.6, 1, 0.4].map((h, j) => (
                          <div key={j} className="sonar-bar" style={{ height: `${h * 100}%`, animationDelay: `${j * 0.1}s` }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <span className="sonar-play-status" style={{ opacity: isActive ? 1 : 0 }}>
                        {isActive && !isSonarPlaying ? "PAUSED" : "PLAYING"}
                      </span>
                      <span className="sonar-copy-icon">
                        {isPlaying
                          ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                          : isActive
                            ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* ── Spotify Section ── */}
      <section className="sonar-query-section" style={{ marginTop: "3rem" }}>
        {!spotify.isLoggedIn ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
              <h2 className="sonar-section-title" style={{ color: "#1DB954", margin: 0, flex: 1 }}>SPOTIFY FOCUS PLAYLISTS</h2>
              <button
                onClick={() => spotify.login()}
                style={{ background: "#1DB954", color: "#000", border: "none", borderRadius: "2rem", padding: "0.55rem 1.25rem", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", letterSpacing: "0.5px" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.62 14.44c-.18.3-.57.39-.87.21-2.4-1.46-5.4-1.8-8.94-.99-.34.08-.68-.13-.76-.46-.08-.34.13-.68.46-.76 3.9-.88 7.2-.5 9.9 1.13.29.18.39.56.21.87zm1.19-2.67c-.23.36-.71.48-1.07.25-2.73-1.68-6.9-2.18-10.33-1.19-.4.12-.83-.11-.95-.51-.12-.4.11-.83.51-.95 3.91-1.12 8.5-.56 11.6 1.34.36.23.47.7.24 1.06zm.11-2.82C14.7 9.13 8.5 8.9 4.96 9.97c-.48.15-.99-.13-1.14-.61-.15-.48.13-.99.61-1.14 4.12-1.24 11-.98 14.62 1.16.43.26.57.82.31 1.25-.26.43-.82.57-1.25.31z"/></svg>
                Connect Spotify
              </button>
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", marginBottom: "1.2rem", marginTop: "-0.5rem" }}>
              Log in to see your own playlists and search your Spotify library.
            </p>
            {/* Curated playlists */}
            <div className="sonar-query-grid">
              {CURATED_PLAYLISTS.map((item, i) => {
                const isActive = spotifyEmbedId === item.id && spotifyEmbedType === "playlist"
                return (
                  <div
                    key={item.id}
                    className={`sonar-query-card${isActive ? " sonar-playing" : ""}`}
                    style={{ animationDelay: `${0.3 + i * 0.08}s`, borderColor: isActive ? "#1DB954" : "" }}
                    onClick={() => { openEmbed(item.id, "playlist"); showNotification(`Opening ${item.text}…`) }}
                  >
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span className="sonar-query-text">{item.text}</span>
                      <div className="sonar-visualizer">
                        {[0.3, 0.6, 1, 0.4].map((h, j) => (
                          <div key={j} className="sonar-bar" style={{ height: `${h * 100}%`, animationDelay: `${j * 0.1}s`, backgroundColor: isActive ? "#1DB954" : undefined }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <span className="sonar-play-status" style={{ opacity: isActive ? 1 : 0, color: "#1DB954" }}>OPEN ↘</span>
                      <span className="sonar-copy-icon" style={{ color: isActive ? "#1DB954" : undefined }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.62 14.44c-.18.3-.57.39-.87.21-2.4-1.46-5.4-1.8-8.94-.99-.34.08-.68-.13-.76-.46-.08-.34.13-.68.46-.76 3.9-.88 7.2-.5 9.9 1.13.29.18.39.56.21.87zm1.19-2.67c-.23.36-.71.48-1.07.25-2.73-1.68-6.9-2.18-10.33-1.19-.4.12-.83-.11-.95-.51-.12-.4.11-.83.51-.95 3.91-1.12 8.5-.56 11.6 1.34.36.23.47.7.24 1.06zm.11-2.82C14.7 9.13 8.5 8.9 4.96 9.97c-.48.15-.99-.13-1.14-.61-.15-.48.13-.99.61-1.14 4.12-1.24 11-.98 14.62 1.16.43.26.57.82.31 1.25-.26.43-.82.57-1.25.31z"/>
                        </svg>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          /* ── LOGGED IN ── */
          <>
            {/* Tab bar */}
            <div style={{ display: "flex", gap: "0", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: "1.5rem" }}>
              {(["my-playlists", "search"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSpotifyTab(tab)}
                  style={{
                    background: "none", border: "none", cursor: "pointer", padding: "0.65rem 1.5rem",
                    fontSize: "0.82rem", fontWeight: 700, letterSpacing: "1px",
                    color: spotifyTab === tab ? "#1DB954" : "rgba(255,255,255,0.45)",
                    borderBottom: spotifyTab === tab ? "2px solid #1DB954" : "2px solid transparent",
                    transition: "color 0.2s", textTransform: "uppercase",
                  }}
                >
                  {tab === "my-playlists" ? "My Playlists" : "Search"}
                </button>
              ))}
            </div>

            {/* ── My Playlists tab ── */}
            {spotifyTab === "my-playlists" && (
              <>
                {spotify.playlistsLoading && spotify.myPlaylists.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: "rgba(255,255,255,0.4)" }}>
                    <div style={{ width: 32, height: 32, border: "3px solid rgba(29,185,84,0.2)", borderTop: "3px solid #1DB954", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 1rem" }} />
                    Loading your playlists…
                  </div>
                ) : spotify.myPlaylists.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem 0" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🎵</div>
                    <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: "1.25rem" }}>No playlists loaded yet.</p>
                    <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={() => spotify.fetchMyPlaylists()}
                        style={{ background: "#1DB954", color: "#000", border: "none", borderRadius: "2rem", padding: "0.6rem 1.5rem", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
                      >
                        ↻ Retry
                      </button>
                      <button
                        onClick={() => { spotify.logout(); spotify.login() }}
                        style={{ background: "transparent", color: "#1DB954", border: "1px solid #1DB954", borderRadius: "2rem", padding: "0.6rem 1.5rem", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
                      >
                        Re-authenticate Spotify
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "1rem" }}>
                    {spotify.myPlaylists.map(pl => (
                      <PlaylistCard
                        key={pl.id}
                        playlist={pl}
                        isActive={spotifyEmbedId === pl.id}
                        onClick={() => { openEmbed(pl.id, "playlist"); showNotification(pl.name) }}
                      />
                    ))}
                  </div>
                )}
                {spotify.playlistsLoading && spotify.myPlaylists.length > 0 && (
                  <p style={{ textAlign: "center", fontSize: "0.75rem", color: "rgba(255,255,255,0.3)", marginTop: "1rem" }}>Refreshing…</p>
                )}
              </>
            )}

            {/* ── Search tab ── */}
            {spotifyTab === "search" && (
              <>
                <SearchBar onSearch={handleSearch} />
                {searchLoading && (
                  <div style={{ textAlign: "center", padding: "2rem" }}>
                    <div style={{ width: 28, height: 28, border: "3px solid rgba(29,185,84,0.2)", borderTop: "3px solid #1DB954", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
                  </div>
                )}
                {!searchLoading && searchResults.tracks.length > 0 && (
                  <>
                    <h3 style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "0.75rem" }}>Songs</h3>
                    {searchResults.tracks.map(track => (
                      <TrackRow key={track.id} track={track} isActive={spotifyEmbedId === track.id && spotifyEmbedType === "track"} onPlay={id => { openEmbed(id, "track"); showNotification(track.name) }} />
                    ))}
                  </>
                )}
                {!searchLoading && searchResults.playlists.length > 0 && (
                  <>
                    <h3 style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "0.75rem", marginTop: "1.5rem" }}>Playlists</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "1rem" }}>
                      {searchResults.playlists.map(pl => (
                        <PlaylistCard key={pl.id} playlist={pl} isActive={spotifyEmbedId === pl.id} onClick={() => { openEmbed(pl.id, "playlist"); showNotification(pl.name) }} />
                      ))}
                    </div>
                  </>
                )}
                {!searchLoading && searchResults.tracks.length === 0 && searchResults.playlists.length === 0 && (
                  <div style={{ textAlign: "center", padding: "3rem 0", color: "rgba(255,255,255,0.3)", fontSize: "0.9rem" }}>Start typing to search your Spotify library</div>
                )}
              </>
            )}
          </>
        )}
      </section>

      {/* Note about the floating player */}
      {spotifyEmbedId && (
        <div style={{ textAlign: "center", marginTop: "2rem", color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}>
          ↘ Spotify player is open in the bottom-right corner — it stays while you browse
        </div>
      )}

      <div className={`sonar-notification${notification.show ? " sonar-notif-show" : ""}`}>{notification.text}</div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap');
        .sonar-wrapper { min-height: 100%; background: radial-gradient(circle at 20% 20%, rgba(124,77,255,0.18) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(0,229,255,0.12) 0%, transparent 40%); border-radius: 1.5rem; padding: 2.5rem 2rem; position: relative; overflow: hidden; }
        .sonar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem; }
        .sonar-logo { font-family: 'Orbitron', monospace; font-weight: 700; font-size: 1.5rem; background: linear-gradient(90deg, #7c4dff, #00e5ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: 3px; }
        .sonar-version { font-size: 0.75rem; color: rgba(255,255,255,0.4); font-family: monospace; letter-spacing: 1px; }
        .sonar-hero { text-align: center; margin-bottom: 4rem; animation: sonarFadeUp 0.7s ease both; }
        .sonar-title { font-family: 'Orbitron', monospace; font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 700; margin-bottom: 0.75rem; background: linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .sonar-subtitle { font-size: 1.1rem; color: rgba(255,255,255,0.55); max-width: 520px; margin: 0 auto; line-height: 1.6; }
        .sonar-status-card { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); padding: 1.25rem; border-radius: 1.25rem; text-align: center; transition: transform 0.3s ease, border-color 0.3s ease; }
        .sonar-status-card:hover { transform: translateY(-4px); border-color: #1DB954; }
        .sonar-status-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.5); margin-bottom: 0.4rem; }
        .sonar-status-value { font-family: 'Orbitron', monospace; font-size: 1.2rem; font-weight: 700; color: #00e5ff; }
        .sonar-query-section { margin-top: 2rem; }
        .sonar-section-title { font-family: 'Orbitron', monospace; font-size: 1rem; letter-spacing: 2px; margin-bottom: 1.5rem; color: rgba(255,255,255,0.7); display: flex; align-items: center; gap: 1rem; }
        .sonar-section-title::after { content: ''; flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08); }
        .sonar-query-grid { display: grid; gap: 0.85rem; }
        .sonar-query-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 1.1rem 1.75rem; border-radius: 1rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.3s cubic-bezier(0.4,0,0.2,1); position: relative; overflow: hidden; animation: sonarFadeUp 0.5s ease both; }
        .sonar-query-card::before { content: ''; position: absolute; left: 0; top: 0; height: 100%; width: 4px; background: linear-gradient(180deg, #7c4dff, #00e5ff); opacity: 0; transition: opacity 0.3s ease; }
        .sonar-query-card:hover { background: rgba(255,255,255,0.055); border-color: rgba(255,255,255,0.18); transform: scale(1.005); }
        .sonar-query-card:hover::before { opacity: 1; }
        .sonar-query-card.sonar-playing { background: rgba(29,185,84,0.08); border-color: #1DB954; box-shadow: 0 0 24px rgba(29,185,84,0.2); }
        .sonar-query-card.sonar-playing::before { opacity: 1; animation: sonarPulse 2s infinite ease-in-out; }
        .sonar-query-text { font-size: 1rem; color: rgba(255,255,255,0.9); font-weight: 300; }
        .sonar-copy-icon { color: rgba(255,255,255,0.4); transition: color 0.25s ease; }
        .sonar-query-card:hover .sonar-copy-icon { color: #1DB954; }
        .sonar-play-status { font-size: 0.65rem; color: #1DB954; font-weight: 700; letter-spacing: 1px; transition: opacity 0.3s; }
        .sonar-visualizer { display: flex; align-items: flex-end; gap: 2px; height: 16px; margin-left: 1rem; }
        .sonar-bar { width: 3px; background: #1DB954; border-radius: 1px; transition: height 0.3s; }
        .sonar-playing .sonar-bar { animation: sonarBarGrow 0.8s infinite ease-in-out; }
        .sonar-notification { position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%) translateY(120px); background: linear-gradient(135deg, #1DB954, #158a3e); color: white; padding: 0.85rem 2rem; border-radius: 2rem; font-weight: 600; font-size: 0.9rem; box-shadow: 0 10px 30px rgba(29,185,84,0.35); transition: transform 0.45s cubic-bezier(0.175,0.885,0.32,1.275); z-index: 9999; white-space: nowrap; }
        .sonar-notification.sonar-notif-show { transform: translateX(-50%) translateY(0); }
        @keyframes sonarFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes sonarBarGrow { 0%, 100% { height: 30%; } 50% { height: 100%; } }
        @keyframes sonarPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 600px) { .sonar-query-card { padding: 1rem; } .sonar-query-text { font-size: 0.9rem; } }
      `}</style>
    </div>
  )
}
