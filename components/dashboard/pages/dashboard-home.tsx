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
import { Sparkles } from "lucide-react"
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

// Helper: ms to hours
function msToHours(ms: number) {
  return +(ms / (1000 * 60 * 60)).toFixed(1)
}

// Helper: ms to minutes
function msToMinutes(ms: number) {
  return Math.round(ms / (1000 * 60))
}

export function DashboardHome({ user, lastFocusSession }: DashboardHomeProps) {
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
  const [motivationalQuote, setMotivationalQuote] = useState<{ text: string; author: string } | null>(null)

  // Pick a daily-rotating quote if the pref is enabled
  useEffect(() => {
    if (typeof localStorage !== "undefined" && localStorage.getItem("pref_motivational_messages") === "true") {
      const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
      setMotivationalQuote(MOTIVATIONAL_QUOTES[dayIndex % MOTIVATIONAL_QUOTES.length])
    }
  }, [])

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        // Fetch last 7 days of sessions
        const now = new Date()
        const sevenDaysAgo = new Date(now)
        sevenDaysAgo.setDate(now.getDate() - 6)
        sevenDaysAgo.setHours(0, 0, 0, 0)

        const timeoutPromise = new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error("Supabase query timed out")), 10000)
        )

        const { data: recentSessions } = await Promise.race([
          supabase
            .from("study_sessions")
            .select("started_at, duration_ms, focus_score")
            .eq("user_id", user.id)
            .gte("started_at", sevenDaysAgo.toISOString())
            .order("started_at", { ascending: true }),
          timeoutPromise
        ])

        // Build daily bar chart data for last 7 days
        const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
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

        if (recentSessions) {
          for (const s of recentSessions) {
            if (!s.started_at) continue
            const sessionDate = new Date(s.started_at).toDateString()
            const dayEntry = days.find(d => d.date === sessionDate)
            if (!dayEntry) continue
            const dur = typeof s.duration_ms === 'number' ? s.duration_ms : 0
            const score = typeof s.focus_score === 'number' ? s.focus_score : 0
            dayEntry.focusMin += Math.round(dur / 60000)
            dayEntry.sessions += 1
            dayEntry.totalScore += score
          }
          for (const d of days) {
            if (d.sessions > 0) d.avgScore = Math.round(d.totalScore / d.sessions)
          }
        }
        setDailyData(days)
      } catch (e) {
        console.error("Failed to fetch dashboard data:", e)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user.id, lastFocusSession])

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
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back, {user.name}</h1>
        <p className="text-muted-foreground">
          Here's your study performance overview.
        </p>
      </div>

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
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  Score: <span className="font-bold text-emerald-500">{lastFocusSession.score}%</span>
                </span>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span>
                  Duration: {Math.floor(lastFocusSession.duration / 60000)}m {Math.floor((lastFocusSession.duration / 1000) % 60)}s
                </span>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span>
                  {lastFocusSession.drowsyCount + lastFocusSession.headTurnedCount + lastFocusSession.faceMissingCount} distraction events
                </span>
              </div>
            </div>
            <CheckCircle2 size={24} className="text-emerald-500 flex-shrink-0 opacity-50" />
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardContent className="p-6 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Total Study Time</p>
            <div className="space-y-1">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {totalStudyMs > 0 ? `${msToHours(totalStudyMs)}h` : "0h"}
              </p>
              <p className="text-xs font-medium text-muted-foreground">
                {totalSessions} session{totalSessions !== 1 ? "s" : ""}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Average Focus</p>
            <div className="space-y-1">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {lastFocusSession ? `${lastFocusSession.score}%` : avgFocusScore > 0 ? `${avgFocusScore}%` : "—"}
              </p>
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
              <p className="text-xs font-medium text-muted-foreground">
                {lastFocusSession ? "Last session" : "All time"}
              </p>
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
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Productive</span>
                  </div>
                </div>
                {/* Legend */}
                <div className="space-y-2 min-w-[120px]">
                  {productivityData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
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
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 60)}h`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload
                        const dur = typeof d.focusMin === 'number' && !isNaN(d.focusMin) ? d.focusMin : 0
                        const sesh = typeof d.sessions === 'number' && !isNaN(d.sessions) ? d.sessions : 0
                        return (
                          <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                            <p className="text-sm font-medium text-popover-foreground">{d.date}</p>
                            <p className="text-sm text-foreground">{Math.floor(dur / 60)}h {dur % 60}m</p>
                            <p className="text-xs text-muted-foreground">{sesh} session{sesh !== 1 ? 's' : ''}</p>
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
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                Complete sessions this week to see your daily breakdown
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
