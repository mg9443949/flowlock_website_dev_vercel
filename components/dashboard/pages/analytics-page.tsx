"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Clock, Target, Flame, TrendingUp, Loader2 } from "lucide-react"
import { supabase } from "@/utils/supabase/client"
import { useAuth } from "@/components/providers/auth-provider"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts"

type Period = "Daily" | "Weekly" | "Monthly" | "Yearly"

/* ── stat card ─────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

/* ── custom tooltip ────────────────────────────────────────── */

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-popover-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">
          {typeof payload[0].value === "number" ? Math.round(payload[0].value) : payload[0].value}m
        </p>
      </div>
    )
  }
  return null
}

/* ── empty state ─────────────────────────────────────────── */

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
      {message}
    </div>
  )
}

/* ── daily view ────────────────────────────────────────────── */

function DailyView({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<any[]>([])

  useEffect(() => {
    async function fetchDaily() {
      setLoading(true)
      try {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const { data } = await supabase
          .from("study_sessions")
          .select("started_at, duration_ms, focus_score")
          .eq("user_id", userId)
          .gte("started_at", todayStart.toISOString())
          .order("started_at", { ascending: true })

        setSessions(data || [])
      } catch (e) {
        console.error("Failed to fetch daily data:", e)
        setSessions([])
      } finally {
        setLoading(false)
      }
    }
    fetchDaily()
  }, [userId])

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  // Group sessions into 3-hour time blocks
  const timeBlocks = [
    { label: "12 – 3 AM", start: 0, end: 3 },
    { label: "3 – 6 AM", start: 3, end: 6 },
    { label: "6 – 9 AM", start: 6, end: 9 },
    { label: "9 AM – 12 PM", start: 9, end: 12 },
    { label: "12 – 3 PM", start: 12, end: 15 },
    { label: "3 – 6 PM", start: 15, end: 18 },
    { label: "6 – 9 PM", start: 18, end: 21 },
    { label: "9 PM – 12 AM", start: 21, end: 24 },
  ]

  const chartData = timeBlocks.map(block => {
    const blockSessions = sessions.filter(s => {
      const hour = new Date(s.started_at).getHours()
      return hour >= block.start && hour < block.end
    })
    const focusMin = Math.round(blockSessions.reduce((sum: number, s: any) => sum + (s.duration_ms / 60000), 0))
    return { time: block.label, focusMin }
  })

  const totalMin = chartData.reduce((s, d) => s + d.focusMin, 0)
  const sessionCount = sessions.length
  const avgMin = sessionCount > 0 ? Math.round(totalMin / sessionCount) : 0
  const peakBlock = chartData.reduce((a, b) => b.focusMin > a.focusMin ? b : a)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Total Focus" value={`${Math.floor(totalMin / 60)}h ${totalMin % 60}m`} color="bg-primary/20 text-primary" />
        <StatCard icon={Target} label="Sessions" value={`${sessionCount}`} color="bg-emerald-500/20 text-emerald-500" />
        <StatCard icon={TrendingUp} label="Avg / Session" value={`${avgMin}m`} color="bg-blue-500/20 text-blue-500" />
        <StatCard icon={Flame} label="Peak Block" value={peakBlock.focusMin > 0 ? peakBlock.time.split(" ")[0] : "—"} sub={peakBlock.focusMin > 0 ? peakBlock.time : "No sessions yet"} color="bg-orange-500/20 text-orange-500" />
      </div>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-lg">Today&apos;s Focus Timeline</CardTitle></CardHeader>
        <CardContent className="h-[300px]">
          {totalMin > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="time" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v.split(" ")[0]} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}m`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.2 }} />
                <Bar dataKey="focusMin" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Complete a focus session today to see your timeline" />
          )}
        </CardContent>
      </Card>

      {sessions.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-lg">Session Quality</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {chartData.filter(d => d.focusMin > 0).map(item => {
                const quality = item.focusMin >= 100 ? "Deep Focus" : item.focusMin >= 40 ? "Moderate" : "Light"
                const qColor = item.focusMin >= 100 ? "text-emerald-500" : item.focusMin >= 40 ? "text-amber-500" : "text-muted-foreground"
                return (
                  <div key={item.time} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.time}</span>
                    <div className="flex items-center gap-4">
                      <span className="font-medium">{item.focusMin}m</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-opacity-10 ${qColor.replace("text-", "bg-")} ${qColor}`}>{quality}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ── weekly view ────────────────────────────────────────────── */

function WeeklyView({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true)
  const [weekData, setWeekData] = useState<any[]>([])

  useEffect(() => {
    async function fetchWeekly() {
      setLoading(true)
      try {
        // Get start of current week (Monday)
        const now = new Date()
        const dayOfWeek = now.getDay()
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() + mondayOffset)
        weekStart.setHours(0, 0, 0, 0)

        const { data } = await supabase
          .from("study_sessions")
          .select("started_at, duration_ms, focus_score")
          .eq("user_id", userId)
          .gte("started_at", weekStart.toISOString())
          .order("started_at", { ascending: true })

        // Group by day of week
        const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        const grouped = dayNames.map(day => ({ day, focusMin: 0, sessions: 0, score: 0 }))

        if (data) {
          for (const s of data) {
            const d = new Date(s.started_at)
            const idx = (d.getDay() + 6) % 7 // Mon=0 .. Sun=6
            grouped[idx].focusMin += Math.round(s.duration_ms / 60000)
            grouped[idx].sessions += 1
            grouped[idx].score += s.focus_score
          }
          for (const g of grouped) {
            if (g.sessions > 0) g.score = Math.round(g.score / g.sessions)
          }
        }

        setWeekData(grouped)
      } catch (e) {
        console.error("Failed to fetch weekly data:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchWeekly()
  }, [userId])

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  const totalMin = weekData.reduce((s, d) => s + d.focusMin, 0)
  const totalSessions = weekData.reduce((s, d) => s + d.sessions, 0)
  const daysWithData = weekData.filter(d => d.sessions > 0)
  const avgScore = daysWithData.length > 0 ? Math.round(daysWithData.reduce((s, d) => s + d.score, 0) / daysWithData.length) : 0
  const bestDay = weekData.reduce((a, b) => b.focusMin > a.focusMin ? b : a)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Weekly Focus" value={`${Math.floor(totalMin / 60)}h ${totalMin % 60}m`} color="bg-primary/20 text-primary" />
        <StatCard icon={Target} label="Total Sessions" value={`${totalSessions}`} color="bg-emerald-500/20 text-emerald-500" />
        <StatCard icon={TrendingUp} label="Avg Focus Score" value={avgScore > 0 ? `${avgScore}%` : "—"} color="bg-blue-500/20 text-blue-500" />
        <StatCard icon={Flame} label="Best Day" value={bestDay.focusMin > 0 ? bestDay.day : "—"} color="bg-orange-500/20 text-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-lg">Weekly Focus Breakdown</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            {totalMin > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}m`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.2 }} />
                  <Bar dataKey="focusMin" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="Complete sessions this week to see your breakdown" />
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-lg">Daily Focus Scores</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            {totalSessions > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weekData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                          <p className="text-sm font-medium text-popover-foreground">{label}</p>
                          <p className="text-sm text-emerald-500 font-bold">{payload[0].value}% Score</p>
                        </div>
                      )
                    }
                    return null
                  }} />
                  <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} dot={{ fill: "var(--background)", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="Complete sessions to see your focus score trend" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ── monthly view ───────────────────────────────────────────── */

function MonthlyView({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true)
  const [monthData, setMonthData] = useState<any[]>([])

  useEffect(() => {
    async function fetchMonthly() {
      setLoading(true)
      try {
        // Get start of current month
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

        const { data } = await supabase
          .from("study_sessions")
          .select("started_at, duration_ms, focus_score")
          .eq("user_id", userId)
          .gte("started_at", monthStart.toISOString())
          .order("started_at", { ascending: true })

        // Group into 4-week segments
        const weeks = [
          { week: "Week 1", focusMin: 0, sessions: 0, avgScore: 0, totalScore: 0 },
          { week: "Week 2", focusMin: 0, sessions: 0, avgScore: 0, totalScore: 0 },
          { week: "Week 3", focusMin: 0, sessions: 0, avgScore: 0, totalScore: 0 },
          { week: "Week 4", focusMin: 0, sessions: 0, avgScore: 0, totalScore: 0 },
        ]

        if (data) {
          for (const s of data) {
            const dayOfMonth = new Date(s.started_at).getDate()
            // Week 1: days 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22+
            const weekIdx = Math.min(Math.floor((dayOfMonth - 1) / 7), 3)
            weeks[weekIdx].focusMin += Math.round(s.duration_ms / 60000)
            weeks[weekIdx].sessions += 1
            weeks[weekIdx].totalScore += s.focus_score
          }
          for (const w of weeks) {
            if (w.sessions > 0) w.avgScore = Math.round(w.totalScore / w.sessions)
          }
        }

        setMonthData(weeks)
      } catch (e) {
        console.error("Failed to fetch monthly data:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchMonthly()
  }, [userId])

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  const totalMin = monthData.reduce((s, d) => s + d.focusMin, 0)
  const totalSessions = monthData.reduce((s, d) => s + d.sessions, 0)
  const weeksWithData = monthData.filter(d => d.sessions > 0)
  const avgScore = weeksWithData.length > 0 ? Math.round(weeksWithData.reduce((s, d) => s + d.avgScore, 0) / weeksWithData.length) : 0
  const bestWeek = monthData.reduce((a, b) => b.focusMin > a.focusMin ? b : a)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Monthly Focus" value={`${Math.floor(totalMin / 60)}h`} color="bg-primary/20 text-primary" />
        <StatCard icon={Target} label="Total Sessions" value={`${totalSessions}`} color="bg-emerald-500/20 text-emerald-500" />
        <StatCard icon={TrendingUp} label="Avg Score" value={avgScore > 0 ? `${avgScore}%` : "—"} color="bg-blue-500/20 text-blue-500" />
        <StatCard icon={Flame} label="Best Week" value={bestWeek.focusMin > 0 ? bestWeek.week : "—"} color="bg-orange-500/20 text-orange-500" />
      </div>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-lg">Weekly Focus Comparison</CardTitle></CardHeader>
        <CardContent className="h-[300px]">
          {totalMin > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="week" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 60)}h`} />
                <Tooltip content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload
                    return (
                      <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                        <p className="text-sm font-medium text-popover-foreground">{label}</p>
                        <p className="text-sm text-foreground">{Math.floor(d.focusMin / 60)}h {d.focusMin % 60}m</p>
                        <p className="text-xs text-muted-foreground">{d.sessions} sessions</p>
                      </div>
                    )
                  }
                  return null
                }} cursor={{ fill: "var(--muted)", opacity: 0.2 }} />
                <Bar dataKey="focusMin" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Complete sessions this month to see your weekly comparison" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ── yearly heatmap (LeetCode-style) ──────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DAYS = ["", "Mon", "", "Wed", "", "Fri", ""]

function getHeatColor(minutes: number): string {
  if (minutes === 0) return "rgb(30, 30, 36)"
  if (minutes < 20) return "rgb(14, 68, 41)"
  if (minutes < 50) return "rgb(0, 109, 50)"
  if (minutes < 90) return "rgb(38, 166, 65)"
  return "rgb(57, 211, 83)"
}

function YearlyView({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true)
  const [yearData, setYearData] = useState<{ date: Date; focusMin: number }[]>([])

  useEffect(() => {
    async function fetchYearly() {
      setLoading(true)
      try {
        const { data, error } = await supabase.rpc("get_yearly_heatmap", { p_user_id: userId })

        if (data && !error) {
          setYearData(data.map((d: any) => ({
            date: new Date(d.day + "T12:00:00"),
            focusMin: d.focus_minutes || 0,
          })))
        } else {
          // Fallback: generate 365 empty days
          const days: { date: Date; focusMin: number }[] = []
          const today = new Date()
          for (let i = 364; i >= 0; i--) {
            const d = new Date(today)
            d.setDate(d.getDate() - i)
            days.push({ date: d, focusMin: 0 })
          }
          setYearData(days)
        }
      } catch (e) {
        console.error("Failed to fetch yearly data:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchYearly()
  }, [userId])

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  const totalMin = yearData.reduce((s, d) => s + d.focusMin, 0)
  const activeDays = yearData.filter(d => d.focusMin > 0).length

  // Calculate max streak
  let maxStreak = 0, currentStreak = 0
  for (const d of yearData) {
    if (d.focusMin > 0) { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak) }
    else currentStreak = 0
  }

  // Build weeks grid (53 columns × 7 rows)
  const weeks: { date: Date; focusMin: number }[][] = []
  let currentWeek: { date: Date; focusMin: number }[] = []

  const firstDay = yearData.length > 0 ? yearData[0].date.getDay() : 0
  for (let i = 0; i < firstDay; i++) {
    currentWeek.push({ date: new Date(0), focusMin: -1 })
  }

  for (const d of yearData) {
    currentWeek.push(d)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push({ date: new Date(0), focusMin: -1 })
    weeks.push(currentWeek)
  }

  // Month label positions
  const monthLabels: { month: string; col: number }[] = []
  let lastMonth = -1
  weeks.forEach((week, colIdx) => {
    for (const cell of week) {
      if (cell.focusMin >= 0) {
        const m = cell.date.getMonth()
        if (m !== lastMonth) {
          monthLabels.push({ month: MONTHS[m], col: colIdx })
          lastMonth = m
        }
        break
      }
    }
  })

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Clock} label="Total Focus" value={totalMin > 0 ? `${Math.floor(totalMin / 60)}h` : "0h"} color="bg-primary/20 text-primary" />
        <StatCard icon={Target} label="Active Days" value={`${activeDays}`} sub="out of 365" color="bg-green-500/20 text-green-400" />
        <StatCard icon={Flame} label="Max Streak" value={maxStreak > 0 ? `${maxStreak} days` : "—"} color="bg-orange-500/20 text-orange-400" />
        <StatCard icon={TrendingUp} label="Avg / Day" value={`${Math.round(totalMin / 365)}m`} color="bg-blue-500/20 text-blue-400" />
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg">{activeDays} active day{activeDays !== 1 ? "s" : ""} in the past year</CardTitle>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Total active days: <strong className="text-foreground">{activeDays}</strong></span>
              <span>Max streak: <strong className="text-foreground">{maxStreak}</strong></span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="inline-flex flex-col gap-0" style={{ minWidth: "max-content" }}>
              {/* Month labels */}
              <div className="flex ml-8 mb-1">
                {monthLabels.map((ml, i) => (
                  <span
                    key={i}
                    className="text-[10px] text-muted-foreground"
                    style={{
                      position: "relative",
                      left: `${ml.col * 14}px`,
                      width: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ml.month}
                  </span>
                ))}
              </div>

              {/* Grid rows */}
              <div className="flex gap-0">
                <div className="flex flex-col gap-[2px] mr-1 justify-start">
                  {DAYS.map((d, i) => (
                    <div key={i} className="h-[10px] w-6 text-[9px] text-muted-foreground flex items-center justify-end pr-1">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="flex gap-[2px]">
                  {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-[2px]">
                      {week.map((cell, dIdx) => (
                        <div
                          key={dIdx}
                          className="rounded-[2px] transition-colors"
                          title={cell.focusMin >= 0
                            ? `${cell.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}: ${cell.focusMin}m focus`
                            : ""}
                          style={{
                            width: 10,
                            height: 10,
                            backgroundColor: cell.focusMin < 0 ? "transparent" : getHeatColor(cell.focusMin),
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-1 mt-3 ml-8">
                <span className="text-[10px] text-muted-foreground mr-1">Less</span>
                {[0, 15, 40, 70, 120].map((v, i) => (
                  <div
                    key={i}
                    className="rounded-[2px]"
                    style={{ width: 10, height: 10, backgroundColor: getHeatColor(v) }}
                  />
                ))}
                <span className="text-[10px] text-muted-foreground ml-1">More</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

/* ── main component ────────────────────────────────────────── */

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("Daily")
  const { user } = useAuth()

  if (!user) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Analytics &amp; Reports</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Detailed insights into study behavior and performance
          </p>
        </div>
        <Button className="gap-2 bg-primary hover:bg-primary/90 w-full md:w-auto">
          <Download size={18} /> Download Report
        </Button>
      </div>

      {/* Period Filters */}
      <div className="flex gap-2 flex-wrap">
        {(["Daily", "Weekly", "Monthly", "Yearly"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${period === p
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border hover:bg-muted"
              }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Period Content */}
      {period === "Daily" && <DailyView userId={user.id} />}
      {period === "Weekly" && <WeeklyView userId={user.id} />}
      {period === "Monthly" && <MonthlyView userId={user.id} />}
      {period === "Yearly" && <YearlyView userId={user.id} />}

      {/* Export Options */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Export Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="justify-start bg-transparent gap-2">
              <Download size={18} /> Export as PDF
            </Button>
            <Button variant="outline" className="justify-start bg-transparent gap-2">
              <Download size={18} /> Export as Excel
            </Button>
            <Button variant="outline" className="justify-start bg-transparent gap-2">
              <Download size={18} /> Export as CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
