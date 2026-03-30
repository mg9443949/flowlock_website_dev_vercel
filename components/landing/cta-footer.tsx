"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

export function CtaFooter() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    if (sectionRef.current) io.observe(sectionRef.current)
    return () => io.disconnect()
  }, [])

  return (
    <>
      {/* ── CTA block ── */}
      <section
        ref={sectionRef}
        className="relative overflow-hidden border-t px-6 lg:px-8 py-12 md:py-20"
        style={{ backgroundColor: "#0a0a0a", borderColor: "rgba(255,255,255,0.07)" }}
      >
        {/* Central radial blue glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(59,130,246,0.22) 0%, rgba(59,130,246,0.08) 40%, transparent 70%)",
          }}
        />

        {/* Dot-grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div
          className="relative z-10 mx-auto max-w-3xl flex flex-col items-center text-center"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(28px)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
          }}
        >
          {/* Eyebrow */}
          <p className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-6">
            Ready to Lock In?
          </p>

          {/* Headline */}
          <h2
            className="text-[36px] md:text-[56px] font-bold tracking-tight text-white mb-5"
            style={{ lineHeight: "1.1" }}
          >
            Your Focus.{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #3B82F6 0%, #818cf8 55%, #60a5fa 100%)",
              }}
            >
              Your Data.
            </span>{" "}
            Your Edge.
          </h2>

          {/* Subtext */}
          <p className="text-lg text-zinc-500 mb-10 font-light max-w-xl">
            Join thousands building their deep work habit with FlowLock.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-10">
            {/* Primary CTA */}
            <Link href="/login">
              <button
                className="group relative w-full sm:w-auto text-base font-semibold px-8 py-3.5 rounded-full text-white cursor-pointer transition-all duration-200 ease-in-out"
                style={{
                  background: "linear-gradient(135deg, #3B82F6 0%, #4f46e5 100%)",
                  border: "1.5px solid rgba(59,130,246,0.55)",
                  boxShadow: "0 0 14px 2px rgba(59,130,246,0.28)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 0 30px 8px rgba(59,130,246,0.55), 0 0 0 2px rgba(59,130,246,0.4)"
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 0 14px 2px rgba(59,130,246,0.28)"
                }}
              >
                Start for Free →
              </button>
            </Link>

            {/* Ghost CTA */}
            <Link href="#how-it-works">
              <button
                className="w-full sm:w-auto text-base font-semibold px-8 py-3.5 rounded-full text-blue-400 cursor-pointer transition-all duration-200 ease-in-out"
                style={{
                  background: "transparent",
                  border: "1.5px solid rgba(59,130,246,0.35)",
                  boxShadow: "none",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = "rgba(59,130,246,0.10)"
                  el.style.borderColor = "rgba(59,130,246,0.65)"
                  el.style.color = "#a5b4fc"
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = "transparent"
                  el.style.borderColor = "rgba(59,130,246,0.35)"
                  el.style.color = "#60a5fa"
                }}
              >
                Watch a Demo
              </button>
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {[
              { icon: "🔒", label: "No credit card" },
              { icon: "⚡", label: "Setup in 3 min" },
              { icon: "🧠", label: "AI-powered insights" },
            ].map((badge) => (
              <span
                key={badge.label}
                className="flex items-center gap-1.5 text-xs font-medium text-zinc-500"
              >
                <span>{badge.icon}</span>
                {badge.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Copyright strip ── */}
      <footer
        className="py-6 text-center border-t text-xs text-zinc-700"
        style={{
          backgroundColor: "#0a0a0a",
          borderColor: "rgba(255,255,255,0.05)",
        }}
      >
        <p>© {new Date().getFullYear()} FlowLock. Master Your Focus.</p>
      </footer>
    </>
  )
}
