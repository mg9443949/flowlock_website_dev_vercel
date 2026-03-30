"use client"

import { useEffect, useState } from "react"
import { ArrowUp } from "lucide-react"

export function BackToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" })

  return (
    <button
      className="back-to-top-btn"
      onClick={scrollToTop}
      aria-label="Back to top"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <ArrowUp size={18} className="text-white" />
    </button>
  )
}
