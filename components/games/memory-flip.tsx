"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { HelpCircle } from "lucide-react"

const EMOJIS = ["🎮", "🎨", "🎭", "🎪", "🎯", "🎲", "🎸", "🎺"]

const getShuffledCards = () => {
  return [...EMOJIS, ...EMOJIS]
    .sort(() => Math.random() - 0.5)
    .map((emoji) => ({ emoji, flipped: false, matched: false }))
}

export function MemoryFlip({ onClose }: { onClose: () => void }) {
  const [cards, setCards] = useState(getShuffledCards())
  const [flipped, setFlipped] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [showInstructions, setShowInstructions] = useState(true)

  const handleClick = (index: number) => {
    if (flipped.length >= 2 || flipped.includes(index) || cards[index].matched) {
      return
    }

    const newFlipped = [...flipped, index]
    setFlipped(newFlipped)

    if (newFlipped.length === 2) {
      setMoves((prev) => prev + 1)
      const firstIndex = newFlipped[0]
      const secondIndex = newFlipped[1]

      if (cards[firstIndex].emoji === cards[secondIndex].emoji) {
        // Keep them open as matched after a short delay
        setTimeout(() => {
          setCards((prev) =>
            prev.map((card, i) =>
              i === firstIndex || i === secondIndex ? { ...card, matched: true } : card
            )
          )
          setFlipped([])
        }, 300)
      } else {
        // No match: flip them back after a delay
        setTimeout(() => {
          setFlipped([])
        }, 800)
      }
    }
  }

  const resetGame = () => {
    setCards(getShuffledCards())
    setFlipped([])
    setMoves(0)
  }

  const matchedCount = cards.filter((c) => c.matched).length

  return (
    <>
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>How to Play</DialogTitle>
            <DialogDescription>
              <ul className="list-disc list-inside space-y-1">
                <li>The board contains cards placed face down.</li>
                <li>Select a card using hand tracking.</li>
                <li>Select a second card to reveal it.</li>
                <li>If both cards match, they stay open; otherwise they flip back after a short delay.</li>
                <li>Remember card positions and find all matching pairs.</li>
                <li>Complete all pairs to win the game.</li>
              </ul>
              <p className="mt-2 text-sm text-muted-foreground">
                Hand‑tracking gestures: hover hand over a card, pinch/select to flip.
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-4">
            <Button onClick={() => setShowInstructions(false)}>Start Game</Button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="relative flex flex-col items-center justify-center min-h-screen space-y-6 p-4">

      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Memory Flip</h2>
        <p className="text-lg text-muted-foreground">
          Moves: {moves} | Matched: {matchedCount / 2}/8
        </p>
      </div>

      <button
        onClick={() => setShowInstructions(true)}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted"
        aria-label="Show How to Play"
      >
        <HelpCircle size={20} className="text-muted-foreground" />
      </button>
      <div className="grid grid-cols-4 gap-3 max-w-md">
        {cards.map((card, index) => (
          <button
            key={index}
            onClick={() => handleClick(index)}
            className={`w-20 h-20 rounded-lg font-bold text-3xl transition-all ${card.matched || flipped.includes(index)
                ? "bg-accent text-accent-foreground"
                : "bg-primary text-primary-foreground hover:opacity-80"
              }`}
          >
            {card.matched || flipped.includes(index) ? card.emoji : "?"}
          </button>
        ))}
      </div>

      {matchedCount === EMOJIS.length * 2 && (
        <div className="text-center space-y-3">
          <p className="text-2xl font-bold text-primary">🎉 You won in {moves} moves!</p>
          <Button onClick={resetGame} className="bg-primary hover:bg-primary/90">
            Play Again
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        {matchedCount < EMOJIS.length * 2 && (
          <Button onClick={resetGame} className="bg-primary hover:bg-primary/90">
            Reset
          </Button>
        )}
        <Button onClick={onClose} variant="outline">
          Back to Games
        </Button>
      </div>
    </div>
  )
}
