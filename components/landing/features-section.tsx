"use client"

import { useEffect, useRef, useState } from "react"
import { Activity, BrainCircuit, Gamepad2, LineChart, TimerReset } from "lucide-react"

const features = [
  {
    title: "Cross-Platform Tracking",
    description:
      "Install our background Windows agent and Chrome extension to capture all your workflow data across apps and websites automatically.",
    stat: "Tracks 50+ apps automatically",
    icon: Activity,
    iconAnim: "group-hover:animate-[pulse_0.8s_ease-in-out_infinite]",
    glowColor: "rgba(59,130,246,0.55)",
    delay: 0,
  },
  {
    title: "Smart Focus Timer",
    description:
      "Set your own productivity rules. FlowLock intelligently differentiates between deep-work applications and distractions in real time.",
    stat: "Detects distractions in <2 seconds",
    icon: TimerReset,
    iconAnim: "group-hover:animate-[spin_2s_linear_infinite]",
    glowColor: "rgba(99,102,241,0.55)",
    delay: 80,
  },
  {
    title: "AI Productivity Coach",
    description:
      "Get personalized, AI-driven insights summarizing what distracted you and offering actionable advice to improve your daily habits.",
    stat: "Powered by Gemini AI",
    icon: BrainCircuit,
    iconAnim: "group-hover:animate-[pulse_1s_ease-in-out_infinite]",
    glowColor: "rgba(139,92,246,0.55)",
    delay: 160,
  },
  {
    title: "Web-Native Active Breaks",
    description:
      "Take rejuvenating breaks without leaving your browser. Play fun, web-native games controlled entirely by your hand gestures via webcam.",
    stat: "5 built-in gesture games",
    icon: Gamepad2,
    iconAnim: "group-hover:animate-[bounce_0.7s_ease-in-out_infinite]",
    glowColor: "rgba(16,185,129,0.55)",
    delay: 240,
  },
  {
    title: "Performance Dashboard",
    description:
      "Visualize your entire day with beautifully crafted charts, pinpointing your exact focus trends and time wasted.",
    stat: "7+ chart types & weekly insights",
    icon: LineChart,
    iconAnim: "group-hover:animate-[pulse_1.2s_ease-in-out_infinite]",
    glowColor: "rgba(59,130,246,0.55)",
    delay: 320,
  },
]

function FeatureCard({
  feature,
  visible,
}: {
  feature: (typeof features)[0]
  visible: boolean
}) {
  const Icon = feature.icon

  return (
    <div
      className="group relative rounded-2xl p-px transition-all duration-500 cursor-default"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.6s ease ${feature.delay}ms, transform 0.6s ease ${feature.delay}ms, box-shadow 0.3s ease`,
        background: "linear-gradient(135deg, rgba(59,91,219,0.18) 0%, rgba(30,30,40,0.6) 60%, rgba(99,102,241,0.12) 100%)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 1.5px rgba(99,130,255,0.5), 0 0 24px 4px ${feature.glowColor}`
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px rgba(255,255,255,0.06)"
      }}
    >
      {/* inner card */}
      <div
        className="relative h-full rounded-[15px] p-7 flex flex-col gap-4 overflow-hidden"
        style={{ backgroundColor: "rgba(12,12,18,0.92)" }}
      >
        {/* top-right corner accent glow */}
        <div
          className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${feature.glowColor} 0%, transparent 70%)`,
            filter: "blur(16px)",
          }}
        />

        {/* Icon */}
        <div className="h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(59,91,219,0.22) 0%, rgba(99,102,241,0.10) 100%)",
            border: "1px solid rgba(99,130,255,0.18)",
          }}
        >
          <Icon className={`h-7 w-7 text-blue-400 ${feature.iconAnim} transition-colors group-hover:text-blue-300`} />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white leading-tight group-hover:text-blue-100 transition-colors duration-300">
          {feature.title}
        </h3>

        {/* Description */}
        <p className="text-zinc-400 leading-relaxed text-base flex-1">
          {feature.description}
        </p>

        {/* Stat / proof point */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
          <span
            className="text-xs font-semibold tracking-wide"
            style={{
              background: "linear-gradient(90deg, #6080ff, #818cf8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            ✦ {feature.stat}
          </span>
        </div>
      </div>
    </div>
  )
}

export function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.12 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  const topRow = features.slice(0, 3)
  const bottomRow = features.slice(3)

  return (
    <section
      id="features"
      className="py-28 relative border-t px-6 lg:px-8 overflow-hidden"
      style={{ backgroundColor: "#0a0a0a", borderColor: "rgba(255,255,255,0.07)" }}
    >
      {/* Ambient background glows */}
      <div
        className="absolute top-0 left-1/4 -z-10 w-[500px] h-[300px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse, rgba(59,91,219,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="absolute bottom-0 right-1/4 -z-10 w-[400px] h-[250px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse, rgba(99,102,241,0.10) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="mx-auto max-w-6xl" ref={sectionRef}>
        {/* Section header */}
        <div
          className="text-center mb-20"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-4">
            Everything You Need
          </p>
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-white">
            Engineered for{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #4f7cff 0%, #818cf8 60%, #60a5fa 100%)",
              }}
            >
              Deep Work
            </span>
          </h2>
          <p className="mt-5 text-lg text-zinc-500 max-w-2xl mx-auto font-light">
            An interconnected suite of tools designed exclusively to stop procrastination and increase focus.
          </p>
        </div>

        {/* Top row — 3 cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
          {topRow.map((feature, idx) => (
            <FeatureCard key={idx} feature={feature} visible={visible} />
          ))}
        </div>

        {/* Bottom row — 2 cards centered */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 lg:w-2/3 lg:mx-auto">
          {bottomRow.map((feature, idx) => (
            <FeatureCard key={idx + 3} feature={feature} visible={visible} />
          ))}
        </div>
      </div>
    </section>
  )
}
