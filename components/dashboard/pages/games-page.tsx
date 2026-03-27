"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TicTacToe } from "@/components/games/tic-tac-toe"
import { Sudoku } from "@/components/games/sudoku"
import { MemoryFlip } from "@/components/games/memory-flip"
import { ChessGame } from "@/components/games/chess-game"
import { Hand, Wifi, Loader2 } from "lucide-react"
import { useHandGesture } from "@/hooks/use-hand-gesture"

const GESTURE_GUIDE = [
  { gesture: "✋ All fingers up", action: "Move mouse cursor" },
  { gesture: "☝️ Index finger only", action: "Left click" },
  { gesture: "🤙 Pinky only", action: "Right click" },
  { gesture: "👍 Thumb only", action: "Scroll up" },
  { gesture: "✊ Fist", action: "Scroll down" },
]

export default function GamesPage() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  
  // Custom Web-Native Hook
  const [gestureEnabled, setGestureEnabled] = useState(false)
  const { videoRef, x, y, gesture, isActive } = useHandGesture(gestureEnabled)

  const toggleGesture = () => {
    setGestureEnabled(!gestureEnabled)
  }

  const games = [
    { id: "tic-tac-toe", name: "Tic Tac Toe", icon: "⭕", desc: "Classic strategy game" },
    { id: "sudoku", name: "Sudoku", icon: "🔢", desc: "Logic puzzle game" },
    { id: "memory", name: "Memory Flip", icon: "🧠", desc: "Test your memory" },
    { id: "chess", name: "Chess", icon: "♞", desc: "Classic strategy with AI" },
  ]

  const renderGame = () => {
    switch (selectedGame) {
      case "tic-tac-toe": return <TicTacToe onClose={() => setSelectedGame(null)} />
      case "sudoku":      return <Sudoku onClose={() => setSelectedGame(null)} />
      case "memory":      return <MemoryFlip onClose={() => setSelectedGame(null)} />
      case "chess":       return <ChessGame onClose={() => setSelectedGame(null)} />
      default:            return null
    }
  }

  return (
    <div className="relative min-h-screen">
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Break-Time Games</h1>
          <p className="text-muted-foreground">Relax and have fun during your breaks</p>
        </div>

        {/* ── Web-Native Hand Gesture Control Panel ── */}
        <Card className={`border-2 transition-colors ${gestureEnabled ? "border-emerald-500/50 bg-emerald-500/5" : "border-border"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 relative overflow-hidden rounded-full flex items-center justify-center ${gestureEnabled ? "bg-black" : "bg-muted"}`}>
                  {/* Video moved to root to prevent offscreen throttling when scrolling down */}
                  <Hand size={20} className={`relative z-10 ${gestureEnabled ? "text-emerald-400" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Web-Native Hand Control
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                      gestureEnabled ? (isActive ? "bg-emerald-500/15 text-emerald-500" : "bg-yellow-500/15 text-yellow-500") 
                                    : "bg-muted text-muted-foreground"
                    }`}>
                      {gestureEnabled 
                        ? (isActive ? <><Wifi size={10} /> Tracking Hand</> : <><Loader2 size={10} className="animate-spin" /> Looking for hand...</>)
                        : "Inactive"}
                    </span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {gestureEnabled
                      ? "Control your mouse with hand gestures directly in your browser!"
                      : "No Python backend required! Runs fully in-browser."}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={toggleGesture}
                className={gestureEnabled
                  ? "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"}
                variant="ghost"
              >
                {gestureEnabled ? "Disable Camera" : "Enable Web Tracking"}
              </Button>
            </div>
          </CardHeader>

          {/* Gesture guide — shown when active */}
          {gestureEnabled && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {GESTURE_GUIDE.map((g) => (
                  <div key={g.action} className="flex flex-col gap-1 bg-background/60 rounded-lg px-3 py-2 text-xs border border-border">
                    <span className="text-base">{g.gesture.split(" ")[0]}</span>
                    <span className="text-muted-foreground font-medium leading-tight">{g.action}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-2">
                💡 Using Web-Native MediaPipe `@mediapipe/tasks-vision`. Works securely in the browser without installing Python.
              </p>
            </CardContent>
          )}
        </Card>

        {/* ── Game Area ── */}
        {selectedGame ? (
          <div>
            <Button onClick={() => setSelectedGame(null)} variant="outline" className="mb-4">
              ← Back to Games
            </Button>
            {renderGame()}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {games.map((game) => (
              <Card
                key={game.id}
                className="bg-card border-border hover:border-primary transition-colors cursor-pointer"
                onClick={() => setSelectedGame(game.id)}
              >
                <CardHeader>
                  <div className="text-5xl mb-3">{game.icon}</div>
                  <CardTitle>{game.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{game.desc}</p>
                  <Button className="w-full bg-primary hover:bg-primary/90">Play Now</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </div>

      {gestureEnabled && (
        <>
          {/* PiP Camera view so Chrome never throttles the video stream */}
          <div className="fixed bottom-6 right-6 w-40 rounded-xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.4)] z-[9998] border-2 border-emerald-500/40 bg-black animate-in slide-in-from-bottom-5">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-auto opacity-70"
              style={{ transform: "scaleX(-1)" }} 
            />
            <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full">
              <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500 animate-pulse'}`} />
              <span className="text-[10px] font-medium text-white shadow-sm">
                {isActive ? 'Tracking' : 'Searching'}
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-center pointer-events-none">
              <span className="text-[10px] text-emerald-400 font-semibold tracking-widest uppercase">Web-Native</span>
            </div>
          </div>
          <div
            id="virtual-gesture-cursor"
            style={{
              position: "fixed",
              left: x,
              top: y,
              width: "24px",
              height: "24px",
              marginLeft: "-12px",
              marginTop: "-12px",
              background: gesture === "LEFT_CLICK" ? "rgba(239, 68, 68, 0.8)" : "rgba(16, 185, 129, 0.8)",
              border: "2px solid white",
              borderRadius: "50%",
              pointerEvents: "none",
              zIndex: 9999,
              transition: "transform 0.1s, background 0.15s",
              boxShadow: "0 0 15px rgba(16, 185, 129, 0.5)",
              display: isActive ? "block" : "none"
            }}
          ></div>
        </>
      )}
    </div>
  )
}
