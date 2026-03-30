"use client"

import { useAuth } from "@/components/providers/auth-provider"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { HeroSection } from "@/components/landing/hero-section"
import { FeaturesSection } from "@/components/landing/features-section"
import { HowItWorksSection } from "@/components/landing/how-it-works-section"
import { CtaFooter } from "@/components/landing/cta-footer"
import { Navbar } from "@/components/landing/navbar"
import { ArrowUp } from "lucide-react"

export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const [showToTop, setShowToTop] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, router])

  useEffect(() => {
    const onScroll = () => setShowToTop(window.scrollY > 400)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  if (isAuthenticated) {
    return null
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      
      <CtaFooter />

      {/* Back to top button */}
      <button
        className="back-to-top-btn"
        onClick={scrollToTop}
        style={{
          opacity: showToTop ? 1 : 0,
          transform: showToTop ? "translateY(0)" : "translateY(20px)",
          pointerEvents: showToTop ? "auto" : "none",
        }}
        aria-label="Back to top"
      >
        <ArrowUp className="text-white w-5 h-5" />
      </button>
    </div>
  )
}
