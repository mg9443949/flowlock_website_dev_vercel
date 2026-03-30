import Link from "next/link"
import { Button } from "@/components/ui/button"

export function HeroSection() {
  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-[88vh] overflow-hidden px-6 lg:px-8 text-center animate-page-load"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      {/* ── Dot-grid background overlay ── */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* ── Deep blue pulsing radial glow behind headline ── */}
      <div
        className="absolute z-0 rounded-full pointer-events-none animate-hero-glow-pulse"
        style={{
          width: "700px",
          height: "480px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -52%)",
          background:
            "radial-gradient(ellipse at center, rgba(59,130,246,0.38) 0%, rgba(59,130,246,0.12) 45%, transparent 75%)",
          filter: "blur(32px)",
        }}
      />

      {/* ── Secondary ambient glow (bottom-right) ── */}
      <div
        className="absolute bottom-0 right-0 z-0 pointer-events-none"
        style={{
          width: "400px",
          height: "300px",
          background:
            "radial-gradient(ellipse at bottom right, rgba(99,102,241,0.18) 0%, transparent 65%)",
          filter: "blur(40px)",
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 mx-auto max-w-5xl">

        {/* Badge */}
        <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/8 px-3.5 py-1.5 text-sm font-medium text-emerald-400 mb-8 animate-fade-in-up">
          <span
            className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2 flex-shrink-0 animate-badge-dot-pulse"
          />
          Now available on Windows and Chrome
        </div>

        {/* Headline */}
        <h1
          className="text-5xl font-extrabold tracking-tight sm:text-7xl mb-6 animate-fade-in-up animation-delay-100"
          style={{ lineHeight: "1.08" }}
        >
          <span className="text-white">Master Your Focus.</span>
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #3B82F6 0%, #818cf8 50%, #60a5fa 100%)",
            }}
          >
            Maximize Everything.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-xl leading-8 text-zinc-400 mb-12 font-light animate-fade-in-up animation-delay-200">
          FlowLock unites AI-driven productivity analysis, cross-device tracking,
          and active gesture-controlled game breaks to help you orchestrate deep,
          uninterrupted flow.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-300">
          <Link href="/login">
            <button
              className="animate-btn-border-glow relative group w-full sm:w-auto text-lg px-8 py-4 rounded-full font-semibold text-white transition-all duration-200 ease-in-out cursor-pointer"
              style={{
                background:
                  "linear-gradient(135deg, #3B82F6 0%, #4f46e5 100%)",
                border: "1.5px solid rgba(59,130,246,0.6)",
                boxShadow:
                  "0 0 16px 2px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              {/* Hover inner glow overlay */}
              <span
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at center, rgba(59,130,246,0.25) 0%, transparent 70%)",
                }}
              />
              <span className="relative z-10">Get Started for Free</span>
            </button>
          </Link>

          <Link href="#how-it-works">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto text-lg px-8 py-6 rounded-full border-zinc-700 text-zinc-300 hover:bg-zinc-800/60 hover:border-zinc-500 hover:text-white backdrop-blur-sm transition-all duration-200 ease-in-out"
              style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
            >
              See How It Works
            </Button>
          </Link>
        </div>

        {/* Social proof strip */}
        <p className="mt-10 text-xs text-zinc-600 font-medium animate-fade-in-up animation-delay-500 tracking-wide uppercase">
          Trusted by students &amp; professionals — free forever, no card needed
        </p>
      </div>

      {/* ── Scroll indicator ── */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce flex flex-col items-center text-zinc-600">
        <span className="text-xs font-medium mb-2 tracking-widest uppercase">Scroll</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}
