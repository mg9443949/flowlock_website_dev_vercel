"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { HelpCircle } from "lucide-react"

const EMOJIS = ["🎮", "🎨", "🎭", "🎪", "🎯", "🎲", "🎸", "🎺"]

interface Card {
  emoji: string
  matched: boolean
}

const getShuffledCards = (): Card[] => {
  return [...EMOJIS, ...EMOJIS]
    .sort(() => Math.random() - 0.5)
    .map((emoji) => ({ emoji, matched: false }))
}

export function MemoryFlip({ onClose }: { onClose: () => void }) {
  const [cards, setCards] = useState<Card[]>(getShuffledCards())
  const [flipped, setFlipped] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [showInstructions, setShowInstructions] = useState(true)
  const [locked, setLocked] = useState(false)

  const handleClick = (index: number) => {
    // Ignore if: board is locked, already flipped, or already matched
    if (locked || flipped.includes(index) || cards[index].matched) return

    const newFlipped = [...flipped, index]
    setFlipped(newFlipped)

    if (newFlipped.length === 2) {
      setMoves((prev) => prev + 1)
      setLocked(true) // Lock board while evaluating

      const [firstIndex, secondIndex] = newFlipped

      if (cards[firstIndex].emoji === cards[secondIndex].emoji) {
        // Match found — mark both as matched
        setTimeout(() => {
          setCards((prev) =>
            prev.map((card, i) =>
              i === firstIndex || i === secondIndex ? { ...card, matched: true } : card
            )
          )
          setFlipped([])
          setLocked(false)
        }, 400)
      } else {
        // No match — flip both back
        setTimeout(() => {
          setFlipped([])
          setLocked(false)
        }, 900)
      }
    }
  }

  const resetGame = () => {
    setCards(getShuffledCards())
    setFlipped([])
    setMoves(0)
    setLocked(false)
  }

  const matchedPairs = cards.filter((c) => c.matched).length / 2
  const totalPairs = EMOJIS.length
  const isWon = matchedPairs === totalPairs

  return (
    <>
      {/* Instructions Dialog */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>How to Play</DialogTitle>
            <DialogDescription asChild>
              <div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>The board contains cards placed face down.</li>
                  <li>Click a card to flip it and reveal its emoji.</li>
                  <li>Click a second card to try to find the matching pair.</li>
                  <li>If both cards match, they stay open; otherwise they flip back.</li>
                  <li>Remember card positions and find all matching pairs.</li>
                  <li>Complete all {totalPairs} pairs to win the game.</li>
                </ul>
                <p className="mt-2 text-sm text-muted-foreground">
                  Hand‑tracking gestures: hover hand over a card, pinch/select to flip.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-4">
            <Button onClick={() => setShowInstructions(false)}>Start Game</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Game Board */}
      <div className="relative flex flex-col items-center justify-center min-h-screen space-y-6 p-4">

        {/* Help button */}
        <button
          onClick={() => setShowInstructions(true)}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Show How to Play"
        >
          <HelpCircle size={20} className="text-muted-foreground" />
        </button>

        {/* Stats */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold">Memory Flip</h2>
          <p className="text-lg text-muted-foreground">
            Moves: {moves} &nbsp;|&nbsp; Matched: {matchedPairs}/{totalPairs}
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-4 gap-3 max-w-md">
          {cards.map((card, index) => {
            const isVisible = card.matched || flipped.includes(index)
            return (
              <button
                key={index}
                onClick={() => handleClick(index)}
                disabled={isVisible && card.matched}
                className={`w-20 h-20 rounded-lg font-bold text-3xl transition-all duration-200 select-none
                  ${card.matched
                    ? "bg-emerald-600/80 text-white cursor-default scale-95"
                    : flipped.includes(index)
                    ? "bg-accent text-accent-foreground scale-105"
                    : "bg-primary text-primary-foreground hover:opacity-80 hover:scale-105 active:scale-95"
                  }`}
              >
                {isVisible ? card.emoji : "?"}
              </button>
            )
          })}
        </div>

        {/* Win Banner */}
        {isWon && (
          <div className="text-center space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="text-2xl font-bold text-primary">🎉 You won in {moves} moves!</p>
            <Button onClick={resetGame} className="bg-primary hover:bg-primary/90">
              Play Again
            </Button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!isWon && (
            <Button onClick={resetGame} className="bg-primary hover:bg-primary/90">
              Reset
            </Button>
          )}
          <Button onClick={onClose} variant="outline">
            Back to Games
          </Button>
        </div>

      </div>
    </>
  )
}
