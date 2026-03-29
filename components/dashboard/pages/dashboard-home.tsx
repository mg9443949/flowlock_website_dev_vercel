"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Timer, Eye, CheckCircle2, TrendingUp, Loader2 } from "lucide-react"
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
} from "recharts"
import { Sparkles, Brain } from "lucide-react"
import { useEffect, useState } from "react"
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
  const [isLoading, setIsLoading] = useState(true)
  const [dailyData, setDailyData] = useState<any[]>([])
  const [totalStudyMs, setTotalStudyMs] = useState(0)
  const [avgFocusScore, setAvgFocusScore] = useState(0)
  const [totalSessions, setTotalSessions] = useState(0)
  const [avgSessionMs, setAvgSessionMs] = useState(0)
  const [totalDistractions, setTotalDistractions] = useState(0)
  const [totalFocusedMs, setTotalFocusedMs] = useState(0)
  const [totalDistractedMs, setTotalDistractedMs] = useState(0)
  const [streakDays, setStreakDays] = useState(0)
  const [insightMessage, setInsightMessage] = useState("Keep building your focus habits! 🚀")
  const [motivationalQuote, setMotivationalQuote] = useState<{ text: string; author: string } | null>(null)
  const [aiQuickTip, setAiQuickTip] = useState<string | null>(null)
  const [aiTipLoading, setAiTipLoading] = useState(false)

  if (!user) return null

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

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const timeoutPromise = new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error("Supabase query timed out")), 10000)
        )

        // Fetch ALL sessions to compute global metrics & insights
        const { data: allSessions } = await Promise.race([
          supabase
            .from("study_sessions")
            .select("*")
            .eq("user_id", user?.id)
            .order("started_at", { ascending: true }),
          timeoutPromise
        ])

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

        if (!allSessions || allSessions.length === 0) {
          setDailyData(days)
          setIsLoading(false)
          return
        }

        let totalMs = 0
        let totalSes = allSessions.length
        let totalScore = 0
        let totalDist = 0
        let totalFoc = 0
        let totalDistTime = 0

        const nowMs = now.getTime()
        const sevenDaysAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000
        const fourteenDaysAgoMs = nowMs - 14 * 24 * 60 * 60 * 1000

        let thisWeekMs = 0
        let lastWeekMs = 0

        for (const s of allSessions) {
          if (!s.started_at) continue
          const dMs = (typeof s.duration_ms === 'number' ? s.duration_ms : 0)
          totalMs += dMs
          totalScore += (s.focus_score || 0)
          totalDist += (s.drowsy_count || 0) + (s.head_turned_count || 0) + (s.face_missing_count || 0)
          totalFoc += (s.focused_time_ms || 0)
          
          const dt = (s.drowsy_time_ms || 0) + (s.head_turned_time_ms || 0) + (s.face_missing_time_ms || 0) + (s.unauthorized_time_ms || 0)
          totalDistTime += dt

          const sessionDateObj = new Date(s.started_at)
          const sessionMs = sessionDateObj.getTime()

          if (sessionMs >= sevenDaysAgoMs) {
            thisWeekMs += dMs
            const sessionDateStr = sessionDateObj.toDateString()
            const dayEntry = days.find(d => d.date === sessionDateStr)
            if (dayEntry) {
              dayEntry.focusMin += Math.round(dMs / 60000)
              dayEntry.sessions += 1
              dayEntry.totalScore += (s.focus_score || 0)
            }
          } else if (sessionMs >= fourteenDaysAgoMs) {
            lastWeekMs += dMs
          }
        }

        for (const d of days) {
          if (d.sessions > 0) d.avgScore = Math.round(d.totalScore / d.sessions)
        }

        const bestDay = days.reduce((prev, current) => (prev.focusMin > current.focusMin) ? prev : current, days[0])

        setTotalStudyMs(totalMs)
        setTotalSessions(totalSes)
        setAvgFocusScore(Math.round(totalScore / totalSes))
        setAvgSessionMs(Math.round(totalMs / totalSes))
        setTotalDistractions(totalDist)
        setTotalFocusedMs(totalFoc)
        setTotalDistractedMs(totalDistTime)
        setDailyData(days)

        // Simple Streak
        let streak = 0
        for (let i = 6; i >= 0; i--) {
          if (days[i].sessions > 0) streak++
          else if (i !== 6) break 
        }
        setStreakDays(streak)

        if (thisWeekMs > lastWeekMs && lastWeekMs > 0) {
          const pct = Math.round(((thisWeekMs - lastWeekMs) / lastWeekMs) * 100)
          setInsightMessage(`You've studied ${pct}% more than last week 🔥`)
        } else if (bestDay && bestDay.focusMin > 0) {
          setInsightMessage(`Your best day this week was ${bestDay.day} with ${bestDay.focusMin}m focused 🎯`)
        } else {
          setInsightMessage("Keep building your focus habits! 🚀")
        }

      } catch (e) {
        console.error("Failed to fetch dashboard data:", e)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user?.id, lastFocusSession])

  // Compute productivity distribution from real data
  const productivePercent = totalStudyMs > 0 ? Math.round((totalFocusedMs / totalStudyMs) * 100) : 0
  const distractedPercent = totalStudyMs > 0 ? Math.round((totalDistractedMs / totalStudyMs) * 100) : 0
  const neutralPercent = Math.max(0, 100 - productivePercent - distractedPercent)

  const productivityData = [
    { name: "Productive", value: productivePercent, color: "#a78bfa" },
    { name: "Neutral", value: neutralPercent, color: "#60a5fa" },
    { name: "Distracted", value: distractedPercent, color: "#f87171" },
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
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
        {/* Personalized Insight Card (Replaces Total Study Time) */}
        <Card className="md:col-span-2 lg:col-span-2 bg-gradient-to-br from-zinc-900 to-zinc-950 border-emerald-500/20 shadow-md flex flex-col justify-center">
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
                      return totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : `${totalMin}m`
                    })()
                  : "0m"}
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

        <Card>
          <CardContent className="p-6 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Average Focus</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold tracking-tight text-foreground">
                  {lastFocusSession ? `${lastFocusSession.score}%` : avgFocusScore > 0 ? `${avgFocusScore}%` : "—"}
                </p>
                {(lastFocusSession?.score ?? avgFocusScore) > 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    (lastFocusSession?.score ?? avgFocusScore) >= 85 ? 'bg-emerald-500/20 text-emerald-500' :
                    (lastFocusSession?.score ?? avgFocusScore) >= 70 ? 'bg-blue-500/20 text-blue-500' :
                    (lastFocusSession?.score ?? avgFocusScore) >= 50 ? 'bg-amber-500/20 text-amber-500' :
                    'bg-red-500/20 text-red-500'
                  }`}>
                    {(lastFocusSession?.score ?? avgFocusScore) >= 85 ? 'Excellent' :
                     (lastFocusSession?.score ?? avgFocusScore) >= 70 ? 'Good' :
                     (lastFocusSession?.score ?? avgFocusScore) >= 50 ? 'Average' : 'Needs Work'}
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-emerald-500">
                {lastFocusSession ? "From last session" : avgFocusScore > 0 ? "Lifetime average" : "No data yet"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Avg. Session</p>
              <Timer size={16} className="text-muted-foreground/50" />
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold tracking-tight text-foreground">{totalSessions > 0 ? avgSessionDisplay : "—"}</p>
              <p className="text-xs font-medium text-muted-foreground">Per session</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Distractions</p>
            <div className="space-y-1">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {lastFocusSession
                  ? lastFocusSession.drowsyCount + lastFocusSession.headTurnedCount + lastFocusSession.faceMissingCount
                  : totalDistractions > 0 ? totalDistractions : "—"}
              </p>
              {lastFocusSession && (lastFocusSession.drowsyCount + lastFocusSession.headTurnedCount + lastFocusSession.faceMissingCount > 0) ? (
                <p className="text-xs font-medium text-muted-foreground">
                  {[lastFocusSession.drowsyCount > 0 ? `${lastFocusSession.drowsyCount} drowsy` : null,
                    lastFocusSession.headTurnedCount > 0 ? `${lastFocusSession.headTurnedCount} head-turn` : null,
                    lastFocusSession.faceMissingCount > 0 ? `${lastFocusSession.faceMissingCount} face-miss` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              ) : (
                <p className="text-xs font-medium text-muted-foreground">
                  {lastFocusSession ? "Last session" : "All time"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Current Streak</p>
            <div className="space-y-1">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {streakDays > 0 ? `${streakDays} day${streakDays !== 1 ? "s" : ""}` : "—"}
              </p>
              <p className="text-xs font-medium text-amber-500">
                {streakDays > 0 ? "Keep it up!" : "Start a session!"}
              </p>
            </div>
          </CardContent>
        </Card>
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
                    <span className="text-3xl font-bold text-foreground">{productivePercent}%</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Focused</span>
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

        {/* Daily Report */}
        <Card>
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-base font-semibold">Daily Study Report</CardTitle>
          </CardHeader>
          <CardContent className="p-6 min-h-[300px]">
            {dailyData.some(d => d.focusMin > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
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
                          <div className="bg-popover border border-border p-3 rounded-lg shadow-lg space-y-1">
                            <p className="text-sm font-medium text-popover-foreground">{d.date}</p>
                            <p className="text-sm text-foreground">{hh > 0 ? `${hh}h ` : ''}{mm}m studied</p>
                            <p className="text-xs text-muted-foreground">{sesh} session{sesh !== 1 ? 's' : ''}</p>
                            {avg > 0 && <p className="text-xs font-medium text-primary">Avg focus: {avg}%</p>}
                          </div>
                        )
                      }
                      return null
                    }}
                    cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                  />
                  <Bar dataKey="focusMin" fill="var(--primary)" radius={[4, 4, 0, 0]} />
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
      </div>
    </div>
  )
}
