"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Timer, Eye, CheckCircle2, TrendingUp, Loader2, Clock } from "lucide-react"
import type { AuthUser } from "@/components/providers/auth-provider"
import type { FocusSessionResult } from "./focus-tracker"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  Pie,
  PieChart,
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
} from "recharts"
import { Sparkles, Brain, Flame } from "lucide-react"
import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/utils/supabase/client"

const MOTIVATIONAL_QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { text: "Small progress is still progress. Keep going.", author: "Unknown" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "A little progress each day adds up to big results.", author: "Satya Nani" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "You are capable of more than you know.", author: "E.O. Wilson" },
]

interface DashboardHomeProps {
  user: AuthUser
  lastFocusSession?: FocusSessionResult | null
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-popover-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">
          {typeof payload[0].value === "number" ? payload[0].value.toFixed(1) : payload[0].value}
          {payload[0].name === "focus" || payload[0].payload?.focus ? "m" : ""}
          {payload[0].name === "hours" ? "h" : ""}
          {payload[0].name === "value" ? "%" : ""}
        </p>
      </div>
    )
  }
  return null
}

import { useAuth } from "@/components/providers/auth-provider"
import { useFocus } from "@/components/providers/focus-provider"
import { useStudySessions } from "@/hooks/use-study-sessions"
import { VaultManager } from "@/components/vault/VaultManager"

// Helper: ms to hours
function msToHours(ms: number) {
  return +(ms / (1000 * 60 * 60)).toFixed(1)
}

// Helper: ms to minutes
function msToMinutes(ms: number) {
  return Math.round(ms / (1000 * 60))
}

export default function DashboardHome() {
  const { user } = useAuth()
  const { lastFocusSession } = useFocus()
  const { sessions, loading: isLoading } = useStudySessions()

  const [motivationalQuote, setMotivationalQuote] = useState<{ text: string; author: string } | null>(null)
  const [aiQuickTip, setAiQuickTip] = useState<string | null>(null)
  const [aiTipLoading, setAiTipLoading] = useState(false)
  const [todayInsight, setTodayInsight] = useState<string | null>(null)
  const [todayInsightLoading, setTodayInsightLoading] = useState(false)

  // Pick a daily-rotating quote if the pref is enabled
  useEffect(() => {
    if (typeof localStorage !== "undefined" && localStorage.getItem("pref_motivational_messages") === "true") {
      const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
      setMotivationalQuote(MOTIVATIONAL_QUOTES[dayIndex % MOTIVATIONAL_QUOTES.length])
    }
  }, [])

  // Fetch AI quick tip when a focus session just ended
  useEffect(() => {
    if (!lastFocusSession || !user) return
    setAiTipLoading(true)
    setAiQuickTip(null)
    fetch("/api/ai-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "quick_tip",
        userName: user.name,
        session: lastFocusSession,
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.tip) setAiQuickTip(data.tip) })
      .catch(() => null)
      .finally(() => setAiTipLoading(false))
  }, [lastFocusSession, user])

  const stats = useMemo(() => {
    const allSessions = sessions || []
    
    // Base stats requested by user
    const totalSessions = allSessions.length
    const totalFocusedMs = allSessions.reduce((s, r) => s + (r.focused_time_ms ?? 0), 0)
    const avgFocusScore = allSessions.length ? Math.round(allSessions.reduce((s, r) => s + r.focus_score, 0) / allSessions.length) : 0
    const avgDurationMs = allSessions.length ? allSessions.reduce((s, r) => s + r.duration_ms, 0) / allSessions.length : 0
    const bestFocusScore = allSessions.length ? Math.max(...allSessions.map(r => r.focus_score)) : 0
    const totalDistractions = allSessions.reduce((s, r) =>
      s + (r.drowsy_count ?? 0) + (r.head_turned_count ?? 0) +
      (r.face_missing_count ?? 0) + (r.unauthorized_count ?? 0) +
      (r.high_noise_count ?? 0), 0)

    // Current Streak computation
    let currentStreak = 0
    const dailySessionsObj: Record<string, boolean> = {}
    for (const s of allSessions) {
       if (s.started_at) {
         const dt = new Date(s.started_at)
         const dStr = dt.getFullYear() + "-" + (dt.getMonth()+1) + "-" + dt.getDate()
         dailySessionsObj[dStr] = true
       }
    }
    const checkDate = new Date()
    while (true) {
      const dStr = checkDate.getFullYear() + "-" + (checkDate.getMonth()+1) + "-" + checkDate.getDate()
      if (dailySessionsObj[dStr]) {
         currentStreak++
         checkDate.setDate(checkDate.getDate() - 1)
      } else {
         if (currentStreak === 0) { 
            checkDate.setDate(checkDate.getDate() - 1)
            const yStr = checkDate.getFullYear() + "-" + (checkDate.getMonth()+1) + "-" + checkDate.getDate()
            if (dailySessionsObj[yStr]) {
               currentStreak = 1
               checkDate.setDate(checkDate.getDate() - 1)
               continue
            }
         }
         break
      }
    }
    const streakDots = Array.from({length: 7}, (_, i) => i < Math.min(currentStreak, 7)).reverse()

    // Peak Zone computation
    let peakZone = null
    if (allSessions.length >= 3) {
      const hourBuckets: Record<number, {total: number, count: number}> = {}
      for (const s of allSessions) {
        if (!s.started_at || typeof s.focus_score !== 'number') continue
        const h = new Date(s.started_at).getHours()
        const bucket = Math.floor(h / 2) * 2
        if (!hourBuckets[bucket]) hourBuckets[bucket] = {total: 0, count: 0}
        hourBuckets[bucket].total += s.focus_score
        hourBuckets[bucket].count++
      }
      let bestBucket = -1
      let bestBucketAvg = -1
      for (const bStr in hourBuckets) {
         const b = parseInt(bStr)
         const avg = hourBuckets[b].total / hourBuckets[b].count
         if (avg > bestBucketAvg && hourBuckets[b].count > 0) {
           bestBucketAvg = avg
           bestBucket = b
         }
      }
      if (bestBucket !== -1) {
         const formatHour = (hour: number) => {
             const ampm = hour >= 12 ? 'pm' : 'am'
             const h12 = hour % 12 || 12
             return `${h12}${ampm}`
         }
         peakZone = `${formatHour(bestBucket)}–${formatHour((bestBucket + 2) % 24)}`
      }
    }

    // Chart Data computations (Retrofitting old UI state into useMemo)
    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const now = new Date()
    const days: any[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      days.push({
        day: DAY_LABELS[d.getDay()],
        date: d.toDateString(),
        focusMin: 0,
        sessions: 0,
        totalScore: 0,
        avgScore: 0,
      })
    }
    for (const s of allSessions) {
       if (!s.started_at) continue
       const sessionDateStr = new Date(s.started_at).toDateString()
       const dayEntry = days.find(d => d.date === sessionDateStr)
       if (dayEntry) {
          const dMs = typeof s.duration_ms === 'number' ? s.duration_ms : 0
          dayEntry.focusMin += Math.round(dMs / 60000)
          dayEntry.sessions += 1
          dayEntry.totalScore += (s.focus_score || 0)
       }
    }
    for (const d of days) {
       if (d.sessions > 0) d.avgScore = Math.round(d.totalScore / d.sessions)
    }

    const todayStr = new Date().toDateString()
    const todaySessions = allSessions.filter((s: any) => s.started_at && new Date(s.started_at).toDateString() === todayStr)
    let todayFocusMs = 0
    let todayDurMs = 0
    let todayScoreSum = 0
    for (const s of todaySessions) {
      todayFocusMs += (s.focused_time_ms || 0)
      todayDurMs += (s.duration_ms || 0)
      todayScoreSum += (s.focus_score || 0)
    }

    let insightMsg = "Keep building your focus habits! 🚀"
    if (todaySessions.length >= 10) insightMsg = "You're a focus machine! 🏆"
    else if (todaySessions.length >= 5) insightMsg = "You're building momentum! ⚡"
    else if (todaySessions.length >= 1) insightMsg = "Great start — keep it up! 🔥"

    let distMs = 0
    let allTimeDurMs = 0
    for (const s of allSessions) {
       allTimeDurMs += (s.duration_ms || 0)
       distMs += ((s.drowsy_time_ms || 0) + (s.head_turned_time_ms || 0) + (s.face_missing_time_ms || 0) + (s.unauthorized_time_ms || 0))
    }

    const sessionDurations = allSessions.map((s: any) => typeof s.duration_ms === 'number' ? Math.round(s.duration_ms / 60000) : 0).reverse()
    let trendUp = false
    if (sessionDurations.length >= 2) {
        const fh = sessionDurations.slice(0, Math.max(1, Math.floor(sessionDurations.length / 2)))
        const sh = sessionDurations.slice(Math.max(1, Math.floor(sessionDurations.length / 2)))
        const fAvg = fh.reduce((a: number, b: number) => a + b, 0) / fh.length
        const sAvg = sh.reduce((a: number, b: number) => a + b, 0) / sh.length
        trendUp = sAvg >= fAvg && sAvg > 0
    }

    const hourDistractions = Array(24).fill(0)
    for (const s of todaySessions) {
      const distAmount = (s.drowsy_count || 0) + (s.head_turned_count || 0) + (s.face_missing_count || 0)
      if (distAmount > 0 && s.started_at) {
         hourDistractions[new Date(s.started_at).getHours()] += distAmount
      }
    }

    return {
      totalStudyMs: todayFocusMs,
      totalSessions: todaySessions.length,
      insightMessage: insightMsg,
      avgSessionMs: todaySessions.length > 0 ? Math.round(todayDurMs / todaySessions.length) : 0,
      avgFocusScore: todaySessions.length > 0 ? Math.round(todayScoreSum / todaySessions.length) : 0,
      bestFocusTimeWindow: todaySessions.length > 0 ? `${Math.max(...todaySessions.map(x => x.focus_score || 0))}pts` : "Not enough data",
      totalDistractions: todaySessions.reduce((acc, s) => acc + (s.drowsy_count || 0) + (s.head_turned_count || 0) + (s.face_missing_count || 0) + (s.unauthorized_count || 0) + (s.high_noise_count || 0), 0),
      streakDays: currentStreak,
      longestStreak: currentStreak, // Keeping simple for now
      streakDots,
      peakZoneDisplay: peakZone || "—",
      dailyData: days,
      totalFocusedMs: totalFocusedMs,
      totalDistractedMs: distMs,
      allTimeDurationMs: allTimeDurMs,
      recentSessionDurations: sessionDurations.slice(-7),
      isSessionTrendUp: trendUp,
      distractionHourData: hourDistractions.map((val, idx) => ({ name: idx.toString(), value: val }))
    }
  }, [sessions])

  const {
    totalStudyMs,
    totalSessions,
    insightMessage,
    avgSessionMs,
    avgFocusScore,
    bestFocusTimeWindow,
    totalDistractions,
    streakDays,
    longestStreak,
    streakDots,
    peakZoneDisplay,
    dailyData,
    totalFocusedMs,
    totalDistractedMs,
    allTimeDurationMs,
    recentSessionDurations,
    isSessionTrendUp,
    distractionHourData
  } = stats

  // Fetch Today's Insight (once per day, cached in localStorage)
  useEffect(() => {
    if (!user?.id) return
    const cacheKey = `flowlock_daily_insight_${user.id}_${new Date().toDateString()}`
    const cached = typeof localStorage !== "undefined" ? localStorage.getItem(cacheKey) : null
    if (cached) {
      setTodayInsight(cached)
      return
    }
    const fetchInsight = async () => {
      setTodayInsightLoading(true)
      try {
        const { data: recentSessions } = await supabase
          .from("study_sessions")
          .select("started_at, duration_ms, focus_score, drowsy_count, head_turned_count, face_missing_count")
          .eq("user_id", user.id)
          .order("started_at", { ascending: false })
          .limit(7)
        if (!recentSessions || recentSessions.length === 0) return
        const res = await fetch("/api/ai-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "daily_insight",
            userName: user.name,
            sessions: recentSessions,
          }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (data?.insight) {
          setTodayInsight(data.insight)
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(cacheKey, data.insight)
          }
        }
      } catch {
        // silently fail
      } finally {
        setTodayInsightLoading(false)
      }
    }
    fetchInsight()
  }, [user?.id])

  if (!user) return null


  // Compute productivity distribution from real data using exact formula ensuring exactly 100%
  const totalDuration = allTimeDurationMs
  const distractedMs = totalDistractedMs
  const productiveMs = totalFocusedMs

  const neutralMs = Math.max(0, totalDuration - productiveMs - distractedMs)

  const divisor = totalDuration > 0 ? totalDuration : 1
  const productivePct = Math.round((productiveMs / divisor) * 100)
  const distractedPct = Math.round((distractedMs / divisor) * 100)
  const neutralPct = 100 - productivePct - distractedPct

  const clamp = (n: number) => Math.min(100, Math.max(0, n))
  const finalProductive = totalDuration === 0 ? 0 : clamp(productivePct)
  const finalDistracted = totalDuration === 0 ? 0 : clamp(distractedPct)
  const finalNeutral = totalDuration === 0 ? 0 : clamp(100 - finalProductive - finalDistracted)

  const productivityData = [
    { name: "Productive", value: finalProductive, color: "#a855f7" },
    { name: "Neutral", value: finalNeutral, color: "#60a5fa" },
    { name: "Distracted", value: finalDistracted, color: "#f87171" },
  ]

  // Format avg session time
  const avgSessionMinutes = Math.floor(avgSessionMs / (1000 * 60))
  const avgSessionDisplay = avgSessionMinutes >= 60
    ? `${Math.floor(avgSessionMinutes / 60)}h ${avgSessionMinutes % 60}m`
    : `${avgSessionMinutes}m`

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Daily Motivational Quote */}
      {motivationalQuote && (
        <Card className="bg-gradient-to-r from-primary/10 via-violet-500/10 to-primary/5 border-primary/20 overflow-hidden">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Sparkles size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary mb-1 uppercase tracking-wider">Daily Motivation</p>
              <p className="text-foreground font-medium leading-snug">"{motivationalQuote.text}"</p>
              <p className="text-xs text-muted-foreground mt-1">— {motivationalQuote.author}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Focus Session Banner */}
      {lastFocusSession && (
        <Card className="bg-gradient-to-r from-emerald-500/10 to-primary/10 border-emerald-500/20">
          <CardContent className="p-6 flex items-center gap-6">
            <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Eye size={24} className="text-emerald-500" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium text-foreground">Latest Focus Session</p>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  Score: <span className={`font-bold ${lastFocusSession.score >= 80 ? 'text-emerald-500' : lastFocusSession.score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{lastFocusSession.score}%</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 ${
                    lastFocusSession.score >= 85 ? 'bg-emerald-500/20 text-emerald-500' :
                    lastFocusSession.score >= 70 ? 'bg-blue-500/20 text-blue-500' :
                    lastFocusSession.score >= 50 ? 'bg-amber-500/20 text-amber-500' :
                    'bg-red-500/20 text-red-500'
                  }`}>{lastFocusSession.score >= 85 ? 'A' : lastFocusSession.score >= 70 ? 'B' : lastFocusSession.score >= 50 ? 'C' : 'D'}</span>
                </span>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span>
                  {Math.floor(lastFocusSession.duration / 60000)}m {Math.floor((lastFocusSession.duration / 1000) % 60)}s
                </span>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span title={`Drowsy: ${lastFocusSession.drowsyCount} · Head turned: ${lastFocusSession.headTurnedCount} · Face missing: ${lastFocusSession.faceMissingCount}`}>
                  {lastFocusSession.drowsyCount + lastFocusSession.headTurnedCount + lastFocusSession.faceMissingCount} distractions
                  {lastFocusSession.drowsyCount + lastFocusSession.headTurnedCount + lastFocusSession.faceMissingCount > 0 && (
                    <span className="text-xs text-muted-foreground/70 ml-1">
                      ({lastFocusSession.drowsyCount > 0 ? `${lastFocusSession.drowsyCount} drowsy` : ''}{lastFocusSession.headTurnedCount > 0 ? `${lastFocusSession.drowsyCount > 0 ? ', ' : ''}${lastFocusSession.headTurnedCount} turned` : ''}{lastFocusSession.faceMissingCount > 0 ? `${(lastFocusSession.drowsyCount > 0 || lastFocusSession.headTurnedCount > 0) ? ', ' : ''}${lastFocusSession.faceMissingCount} missing` : ''})
                    </span>
                  )}
                </span>
              </div>
            </div>
            <CheckCircle2 size={24} className="text-emerald-500 flex-shrink-0 opacity-50" />
          </CardContent>
        </Card>
      )}

      {/* AI Quick Tip (after session) */}
      {lastFocusSession && (
        <Card className="border-violet-500/20 bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-transparent overflow-hidden">
          <div className="h-0.5 w-full bg-gradient-to-r from-violet-500 to-indigo-500" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/15 flex-shrink-0">
              {aiTipLoading
                ? <Loader2 size={16} className="text-violet-400 animate-spin" />
                : <Brain size={16} className="text-violet-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider mb-0.5">AI Quick Tip</p>
              {aiTipLoading
                ? <div className="h-3.5 w-56 rounded bg-muted/40 animate-pulse" />
                : aiQuickTip
                  ? <p className="text-sm text-foreground leading-snug">{aiQuickTip}</p>
                  : <p className="text-sm text-muted-foreground">Available after your next session.</p>}
            </div>
            <Sparkles size={14} className="text-violet-400/50 flex-shrink-0" />
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 lg:grid-cols-6 gap-6">
        {/* Personalized Insight Card (Replaces Total Study Time) */}
        <Card className="md:col-span-2 lg:col-span-2 xl:col-span-2 bg-gradient-to-br from-zinc-900 to-zinc-950 border-emerald-500/20 shadow-md flex flex-col justify-center">
          <CardContent className="p-6 space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-emerald-50 mb-1">
                {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}, {user.name.split(" ")[0]}!
              </h2>
              <p className="text-sm text-zinc-400">Here's your productivity overview.</p>
            </div>
            
            <div className="flex items-baseline gap-3">
              <p className="text-5xl font-black tracking-tight text-emerald-500 max-w-[200px] truncate">
                {totalStudyMs > 0
                  ? (() => {
                      const totalMin = Math.round(totalStudyMs / 60000)
                      return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`
                    })()
                  : "0h 0m"}
              </p>
              <p className="text-sm font-medium text-emerald-500/60">
                total across {totalSessions} session{totalSessions !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
              <TrendingUp size={16} />
              {insightMessage}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col p-6 bg-card border-border">
          <p className="text-sm font-medium text-muted-foreground w-full text-left mb-6">Average Focus</p>
          {(() => {
            const score = lastFocusSession ? lastFocusSession.score : (avgFocusScore > 0 ? avgFocusScore : 0)
            const colorClass = score >= 70 ? "text-emerald-500" : score >= 40 ? "text-amber-500" : "text-red-500"
            const strokeColor = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444"
            const radius = 38
            const circumference = 2 * Math.PI * radius
            const offset = score > 0 ? circumference - (score / 100) * circumference : circumference

            return (
              <div className="flex flex-col items-center w-full flex-1 justify-between">
                <div className="relative flex items-center justify-center w-32 h-32 mb-4">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="38" className="stroke-muted/30" strokeWidth="8" fill="none" />
                    <circle 
                      cx="50" cy="50" r="38" 
                      stroke={strokeColor} 
                      strokeWidth="8" 
                      fill="none" 
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      className="transition-all duration-1000 ease-in-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-black tracking-tight ${colorClass}`}>{score > 0 ? `${score}%` : "—"}</span>
                    <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mt-0.5">Focus Score</span>
                  </div>
                </div>
                <div className="w-full bg-muted/30 rounded-lg p-3 text-center border border-border/50">
                  <p className="text-xs font-medium text-muted-foreground">
                    Best focus: <span className="text-foreground font-semibold">{bestFocusTimeWindow}</span>
                  </p>
                </div>
              </div>
            )
          })()}
        </Card>

        <Card className="flex flex-col">
          <CardContent className="p-6 flex-1 flex flex-col justify-between">
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Avg. Session</p>
                <Timer size={16} className="text-muted-foreground/50" />
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-3xl font-bold tracking-tight text-foreground">{totalSessions > 0 ? avgSessionDisplay : "—"}</p>
                {isSessionTrendUp && recentSessionDurations.length >= 2 && (
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 uppercase tracking-wider">
                    <TrendingUp size={12} />
                    Up
                  </span>
                )}
              </div>
            </div>
            
            <div className="h-10 mt-auto w-full -ml-2">
            {recentSessionDurations.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={recentSessionDurations.map((val: number, i: number) => ({ i, val }))}>
                    <defs>
                      <linearGradient id="colorTeal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="val" stroke="#14b8a6" strokeWidth={2} fillOpacity={1} fill="url(#colorTeal)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-end ml-2">
                  <p className="text-xs font-medium text-muted-foreground">Per session</p>
                </div>
            )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardContent className="p-6 flex-1 flex flex-col justify-between">
            <div className="space-y-2 mb-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Distractions</p>
              </div>
              
              <div className="flex flex-wrap items-baseline gap-2">
                {totalDistractions === 0 ? (
                  <p className="text-sm font-medium text-emerald-500 mt-2">
                    No distractions logged yet — great focus!
                  </p>
                ) : (
                  <>
                    <p className="text-3xl font-bold tracking-tight text-white">{totalDistractions}</p>
                    <span className="text-xs text-muted-foreground">total distractions</span>
                  </>
                )}
              </div>
            </div>

            <div className="h-12 mt-auto w-full -ml-1">
              {totalDistractions > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distractionHourData}>
                    <Bar dataKey="value" fill="#f59e0b" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardContent className="p-6 flex-1 flex flex-col justify-between">
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Current Streak</p>
                <Flame size={16} className={streakDays > 0 ? "text-emerald-500" : "text-muted-foreground/50"} />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold tracking-tight text-foreground">
                  {streakDays > 0 ? `${streakDays} day streak` : "—"}
                </p>
                {streakDays >= 7 && (
                  <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 uppercase tracking-wider">
                    🔥 Week streak!
                  </span>
                )}
              </div>
            </div>

            <div className="mt-auto pt-2 space-y-3 border-t border-border/50">
              <div className="flex items-center justify-between w-full pt-1">
                {streakDots.length > 0 ? (
                  streakDots.map((isActive: boolean, i: number) => (
                    <div 
                      key={i} 
                      className={`w-3.5 h-3.5 rounded-full ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-muted border border-muted-foreground/20'}`}
                      title={isActive ? "Focused" : "Missed"}
                    />
                  ))
                ) : (
                  Array.from({length: 7}).map((_, i) => (
                    <div key={i} className="w-3.5 h-3.5 rounded-full bg-muted border border-muted-foreground/20" />
                  ))
                )}
              </div>
              
              <div className="text-xs font-medium">
                {streakDays === 0 ? (
                  <span className="text-amber-500">
                    Start today to build your streak 🚀
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Longest streak: <span className="text-foreground">{longestStreak} day{longestStreak !== 1 ? "s" : ""}</span>
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Best Study Window */}
        <Card className="flex flex-col">
          <CardContent className="p-6 flex-1 flex flex-col justify-between">
            <div className="space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">Peak Zone</p>
                <Clock size={16} className="text-violet-500" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[1.35rem] font-bold tracking-tight text-foreground leading-none">
                  {peakZoneDisplay}
                </p>
              </div>
            </div>

            <div className="mt-auto pt-2 border-t border-border/50">
              <p className="text-xs font-medium">
                {totalSessions < 3 ? (
                  <span className="text-muted-foreground">
                    Log 3+ sessions to unlock
                  </span>
                ) : (
                  <span className="text-violet-500 text-[11px] uppercase tracking-wide font-bold">
                    Peak performance zone
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Insight */}
      {(todayInsight || todayInsightLoading) && (
        <div className="flex">
          <div className="flex-1 bg-gradient-to-r from-violet-500/8 via-purple-500/5 to-transparent border border-violet-500/15 rounded-xl px-5 py-4 flex items-start gap-3.5">
            <div className="mt-0.5 p-2 rounded-lg bg-violet-500/15 flex-shrink-0">
              {todayInsightLoading
                ? <Loader2 size={15} className="text-violet-400 animate-spin" />
                : <Sparkles size={15} className="text-violet-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1">Today's Insight</p>
              {todayInsightLoading
                ? <div className="space-y-1.5">
                    <div className="h-3.5 w-3/4 rounded bg-muted/50 animate-pulse" />
                    <div className="h-3.5 w-1/2 rounded bg-muted/40 animate-pulse" />
                  </div>
                : <p className="text-sm text-foreground leading-relaxed">{todayInsight}</p>}
            </div>
          </div>
        </div>
      )}

      {/* This Week / Daily Report */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-lg font-bold">This Week</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Study minutes per day</p>
        </CardHeader>
        <CardContent className="p-6 min-h-[300px]">
          {dailyData.some((d: any) => d.focusMin > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) =>
                  v >= 60 ? `${Math.floor(v / 60)}h` : `${v}m`
                } />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload
                      const dur = typeof d.focusMin === 'number' && !isNaN(d.focusMin) ? d.focusMin : 0
                      const sesh = typeof d.sessions === 'number' && !isNaN(d.sessions) ? d.sessions : 0
                      const avg = typeof d.avgScore === 'number' && !isNaN(d.avgScore) ? d.avgScore : 0
                      const hh = Math.floor(dur / 60)
                      const mm = dur % 60
                      return (
                        <div className="bg-zinc-900 border border-border p-3 rounded-lg shadow-lg space-y-1">
                          <p className="text-sm font-medium text-zinc-100">{d.date}</p>
                          <p className="text-sm text-emerald-400 font-medium">{hh > 0 ? `${hh}h ` : ''}{mm}m studied</p>
                          <p className="text-xs text-zinc-400">{sesh} session{sesh !== 1 ? 's' : ''}</p>
                          {avg > 0 && <p className="text-xs font-medium text-emerald-500">Avg focus: {avg}%</p>}
                        </div>
                      )
                    }
                    return null
                  }}
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                />
                <ReferenceLine y={120} stroke="#8b5cf6" strokeDasharray="5 5" strokeWidth={1} />
                <Bar dataKey="focusMin" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {dailyData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={index === 6 ? '#10b981' : 'var(--primary)'} fillOpacity={index === 6 ? 1 : 0.6} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground text-sm gap-3">
              <span className="text-4xl opacity-30">📅</span>
              Complete sessions this week to see your daily breakdown
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distraction Vault */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-bold tracking-tight">Distraction Vault</h2>
          <span className="text-xs text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-muted border border-border/50">
            Blocked during sessions
          </span>
        </div>
        <VaultManager />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">


        {/* Productivity Distribution */}
        <Card>
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-base font-semibold">Productivity Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-6 min-h-[300px] flex gap-4 items-center justify-center">
            {totalSessions > 0 ? (
              <>
                <div className="h-[300px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={productivityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {productivityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-foreground">{finalProductive}%</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">FOCUSED</span>
                  </div>
                </div>
                {/* Legend with % values */}
                <div className="space-y-3 min-w-[140px]">
                  {productivityData.map((item) => (
                    <div key={item.name} className="space-y-0.5">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 flex-shrink-0" />
                        <span className="text-sm font-bold" style={{ color: item.color }}>{item.value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground text-sm gap-3">
                <span className="text-4xl opacity-30">📊</span>
                Complete a focus session to see your productivity breakdown
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
