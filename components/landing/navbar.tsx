"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Menu, X, Zap } from "lucide-react"

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Blog", href: "#blog" },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Show navbar after 100px scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Close drawer on outside click
  useEffect(() => {
    if (!mobileOpen) return
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setMobileOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [mobileOpen])

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [mobileOpen])

  return (
    <>
      {/* ── Main Navbar ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          opacity: scrolled ? 1 : 0,
          transform: scrolled ? "translateY(0)" : "translateY(-12px)",
          pointerEvents: scrolled ? "auto" : "none",
        }}
      >
        {/* Glass panel */}
        <div
          style={{
            backgroundColor: "rgba(10,10,10,0.75)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">

              {/* Logo */}
              <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{
                    background: "linear-gradient(135deg, #3B82F6 0%, #818cf8 100%)",
                    boxShadow: "0 0 10px rgba(59,130,246,0.4)",
                  }}
                >
                  <Zap size={16} className="text-white" fill="white" />
                </div>
                <span className="text-base font-extrabold tracking-tight text-white group-hover:text-blue-300 transition-colors duration-200">
                  FlowLock
                </span>
              </Link>

              {/* Desktop nav links */}
              <div className="hidden md:flex items-center gap-8">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200 relative group"
                  >
                    {link.label}
                    {/* Underline on hover */}
                    <span
                      className="absolute -bottom-0.5 left-0 h-px w-0 group-hover:w-full transition-all duration-300"
                      style={{ background: "linear-gradient(90deg, #4f7cff, #818cf8)" }}
                    />
                  </a>
                ))}
              </div>

              {/* Desktop CTA */}
              <div className="hidden md:flex items-center">
                <Link href="/login">
                  <button
                    className="text-sm font-semibold text-white px-5 py-2 rounded-full cursor-pointer transition-all duration-200 ease-in-out"
                    style={{
                      background: "linear-gradient(135deg, #3B82F6 0%, #4f46e5 100%)",
                      border: "1px solid rgba(59,130,246,0.5)",
                      boxShadow: "0 0 12px rgba(59,130,246,0.25)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow =
                        "0 0 24px 4px rgba(59,130,246,0.5)"
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow =
                        "0 0 12px rgba(59,130,246,0.25)"
                    }}
                  >
                    Get Started
                  </button>
                </Link>
              </div>

              {/* Mobile hamburger */}
              <button
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-zinc-400 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.05)" }}
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          {/* Blue gradient bottom line */}
          <div
            className="h-px w-full"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, #3B82F6 30%, #818cf8 60%, transparent 100%)",
              opacity: 0.6,
            }}
          />
        </div>

        {/* ── Mobile slide-down drawer ── */}
        <div
          ref={drawerRef}
          className="md:hidden overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: mobileOpen ? "320px" : "0px",
            backgroundColor: "rgba(10,10,10,0.95)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: mobileOpen ? "1px solid rgba(255,255,255,0.06)" : "none",
          }}
        >
          <div className="px-6 py-5 flex flex-col gap-5">
            {NAV_LINKS.map((link, i) => (
              <a
                key={link.label}
                href={link.href}
                className="text-base font-medium text-zinc-300 hover:text-white transition-colors duration-200"
                style={{
                  opacity: mobileOpen ? 1 : 0,
                  transform: mobileOpen ? "translateX(0)" : "translateX(-12px)",
                  transition: `opacity 0.3s ease ${i * 50}ms, transform 0.3s ease ${i * 50}ms, color 0.2s`,
                }}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}

            <Link href="/login" onClick={() => setMobileOpen(false)}>
              <button
                className="w-full text-sm font-semibold text-white px-5 py-3 rounded-full mt-1 cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #3B82F6 0%, #4f46e5 100%)",
                  border: "1px solid rgba(59,130,246,0.4)",
                  opacity: mobileOpen ? 1 : 0,
                  transform: mobileOpen ? "translateY(0)" : "translateY(8px)",
                  transition: "opacity 0.35s ease 200ms, transform 0.35s ease 200ms",
                }}
              >
                Get Started →
              </button>
            </Link>
          </div>
        </div>
      </nav>
    </>
  )
}
