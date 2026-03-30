"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Download, LogIn, PlayCircle } from "lucide-react"

const steps = [
  {
    title: "Create Account",
    description:
      "Sign up to access your personalized focus dashboard and configure your initial productivity rules.",
    timeTag: "~30 seconds",
    icon: LogIn,
    num: "01",
  },
  {
    title: "Install Agents",
    description:
      "Download the lightweight Windows Agent and Chrome Extension to monitor apps and browsing seamlessly.",
    timeTag: "~2 minutes",
    icon: Download,
    num: "02",
  },
  {
    title: "Start Session",
    description:
      "Launch a Focus Session. FlowLock immediately begins analyzing your workflow and intelligently blocking distractions.",
    timeTag: "Instant",
    icon: PlayCircle,
    num: "03",
  },
  {
    title: "Review & Reset",
    description:
      "End your session to view real-time analytics, review AI coaching tips, and play a web-native game to reset your focus.",
    timeTag: "After each session",
    icon: CheckCircle2,
    num: "04",
  },
]

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0) // 0–100
  const [activeStep, setActiveStep] = useState(-1)
  const observerFired = useRef(false)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !observerFired.current) {
          observerFired.current = true
          io.disconnect()

          // Animate progress line 0 → 100% over 1.6 s
          const duration = 1600
          const start = performance.now()
          const tick = (now: number) => {
            const pct = Math.min(((now - start) / duration) * 100, 100)
            setProgress(pct)

            // Activate each step icon when line reaches it
            // Steps are evenly spaced at 0%, 33%, 66%, 100%
            const thresholds = [5, 36, 69, 98]
            thresholds.forEach((t, i) => {
              if (pct >= t) setActiveStep(i)
            })

            if (pct < 100) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.3 }
    )
    io.observe(section)
    return () => io.disconnect()
  }, [])

  return (
    <section
      id="how-it-works"
      className="py-28 relative border-t overflow-hidden px-6 lg:px-8"
      style={{ backgroundColor: "#0a0a0a", borderColor: "rgba(255,255,255,0.07)" }}
    >
      {/* Dot-grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] pointer-events-none -z-10"
        style={{
          background:
            "radial-gradient(ellipse, rgba(59,91,219,0.10) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />

      <div className="mx-auto max-w-6xl relative z-10" ref={sectionRef}>
        {/* Header */}
        <div className="text-center mb-20">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-4">
            Get Up And Running
          </p>
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-white">
            How to{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #4f7cff 0%, #818cf8 60%, #60a5fa 100%)",
              }}
            >
              Execute
            </span>
          </h2>
          <p className="mt-5 text-lg text-zinc-500 max-w-xl mx-auto font-light">
            Your journey to uninterrupted focus takes less than 3 minutes.
          </p>
        </div>

        {/* Timeline */}
        <div className="relative">

          {/* ── Animated progress track (desktop) ── */}
          <div className="hidden lg:block absolute left-0 right-0 top-10 h-px"
            style={{ backgroundColor: "rgba(255,255,255,0.07)" }}
          >
            {/* Filled portion */}
            <div
              ref={lineRef}
              className="absolute top-0 left-0 h-full transition-none"
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(90deg, #3B5BDB 0%, #818cf8 50%, #60a5fa 100%)",
                boxShadow: "0 0 10px 2px rgba(99,130,255,0.5)",
                transition: "none",
              }}
            />
          </div>

          {/* Steps grid */}
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-4 lg:gap-6 relative z-10">
            {steps.map((step, idx) => {
              const isActive = activeStep >= idx
              const Icon = step.icon
              return (
                <div key={idx} className="flex flex-col items-center">
                  {/* Icon circle */}
                  <div
                    className="relative flex h-20 w-20 items-center justify-center rounded-full mb-8 transition-all duration-500"
                    style={{
                      background: isActive
                        ? "linear-gradient(135deg, rgba(59,91,219,0.30) 0%, rgba(99,102,241,0.15) 100%)"
                        : "rgba(255,255,255,0.03)",
                      border: isActive
                        ? "2px solid rgba(99,130,255,0.7)"
                        : "2px solid rgba(255,255,255,0.08)",
                      boxShadow: isActive
                        ? "0 0 24px 4px rgba(59,91,219,0.35)"
                        : "none",
                      transform: isActive ? "scale(1.08)" : "scale(1)",
                    }}
                  >
                    {/* Step number badge */}
                    <span
                      className="absolute -top-2 -right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: isActive
                          ? "linear-gradient(135deg, #3B5BDB, #818cf8)"
                          : "rgba(255,255,255,0.08)",
                        color: isActive ? "#fff" : "rgba(255,255,255,0.3)",
                      }}
                    >
                      {step.num}
                    </span>
                    <Icon
                      className="h-8 w-8 transition-colors duration-500"
                      style={{
                        color: isActive ? "#818cf8" : "rgba(255,255,255,0.2)",
                      }}
                    />
                  </div>

                  {/* Text */}
                  <h3
                    className="text-xl font-bold text-center mb-1 transition-colors duration-500"
                    style={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.35)" }}
                  >
                    {step.title}
                  </h3>

                  {/* Time tag */}
                  <p
                    className="text-xs italic font-medium mb-3 transition-colors duration-500"
                    style={{
                      color: isActive ? "#6080ff" : "rgba(255,255,255,0.2)",
                    }}
                  >
                    {step.timeTag}
                  </p>

                  <p
                    className="text-center leading-relaxed text-sm max-w-[220px] transition-colors duration-500"
                    style={{ color: isActive ? "#a1a1aa" : "rgba(255,255,255,0.2)" }}
                  >
                    {step.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Reassurance line */}
        <p className="text-center text-xs text-zinc-600 mt-16 tracking-wide">
          No credit card required.&nbsp;&nbsp;Cancel anytime.
        </p>
      </div>
    </section>
  )
}
