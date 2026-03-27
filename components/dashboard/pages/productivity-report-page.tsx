"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Download, Clock, Target, Flame, TrendingUp, Loader2,
    Monitor, Globe, Moon, Zap, RefreshCw, Calendar, FileText, FileSpreadsheet, AlertCircle
} from "lucide-react"
import { supabase } from "@/utils/supabase/client"
import { useAuth } from "@/components/providers/auth-provider"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts"
import AIInsightsPanel from "./ai-insights-panel"
import { awFetch, isAWOnline } from "@/utils/aw-client"

/* ── types ─────────────────────────────────────────────────── */

interface AppUsage {
    app_name: string
    duration_minutes: number
}

interface WebsiteUsage {
    domain: string
    duration_minutes: number
}

interface ExistingMetrics {
    study_sessions_count: number
    total_study_minutes: number
    total_focused_minutes: number
    total_drowsy_minutes: number
    total_distracted_minutes: number
    avg_focus_score: number
}

interface ReportData {
    date: string
    focus_time: number
    distraction_time: number
    total_active_minutes: number
    idle_minutes: number
    productivity_score: number
    top_apps: AppUsage[]
    top_websites: WebsiteUsage[]
    all_apps: AppUsage[]
    all_websites: WebsiteUsage[]
    existing_metrics: ExistingMetrics
}

/* ── colors ────────────────────────────────────────────────── */

const APP_COLORS = [
    "#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4",
    "#14b8a6", "#10b981", "#22c55e", "#84cc16", "#eab308",
]
const PIE_COLORS = ["#8b5cf6", "#3b82f6", "#f59e0b", "#ef4444"]

/* ── stat card ─────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, sub, color }: {
    icon: React.ElementType; label: string; value: string; sub?: string; color: string
}) {
    return (
        <Card className="bg-card border-border overflow-hidden relative group">
            <div className={`absolute inset-0 opacity-[0.03] ${color.split(" ")[0]}`} />
            <CardContent className="p-5 flex items-center gap-4 relative">
                <div className={`p-3 rounded-xl ${color} transition-transform group-hover:scale-110`}>
                    <Icon size={22} />
                </div>
                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                    <p className="text-2xl font-bold mt-0.5">{value}</p>
                    {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
                </div>
            </CardContent>
        </Card>
    )
}

/* ── custom tooltip ────────────────────────────────────────── */

function ChartTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border p-3 rounded-xl shadow-xl">
                <p className="text-sm font-medium text-popover-foreground">{label}</p>
                <p className="text-sm text-primary font-bold">{Math.round(payload[0].value)}m</p>
            </div>
        )
    }
    return null
}

/* ── productivity score ring ───────────────────────────────── */

function ScoreRing({ score }: { score: number }) {
    const circumference = 2 * Math.PI * 54
    const offset = circumference - (score / 100) * circumference
    const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444"

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width="140" height="140" className="-rotate-90">
                <circle cx="70" cy="70" r="54" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                <circle
                    cx="70" cy="70" r="54" fill="none" stroke={color} strokeWidth="8"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round" className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-bold" style={{ color }}>{score}</span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Score</span>
            </div>
        </div>
    )
}

/* ── empty state ───────────────────────────────────────────── */

function EmptyState({ title, message }: { title: string; message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-2xl bg-muted/50 mb-4">
                <AlertCircle size={32} className="text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground max-w-md">{message}</p>
        </div>
    )
}

async function fetchAWDataForDate(dateStr: string): Promise<{
    applications: AppUsage[]
    websites: WebsiteUsage[]
    idle_minutes: number
    total_active_minutes: number
} | null> {
    try {
        const buckets = await awFetch("buckets")
        const windowBucket = Object.keys(buckets).find((k: string) => k.includes("aw-watcher-window"))
        const webBucket = Object.keys(buckets).find((k: string) => k.includes("aw-watcher-web"))
        const afkBucket = Object.keys(buckets).find((k: string) => k.includes("aw-watcher-afk"))

        const dayStart = new Date(dateStr + "T00:00:00").toISOString()
        const dayEnd = new Date(dateStr + "T23:59:59").toISOString()

        const fetchEvents = async (bucketId: string | undefined) => {
            if (!bucketId) return []
            try {
                return await awFetch(
                    `buckets/${bucketId}/events?start=${dayStart}&end=${dayEnd}&limit=-1`
                )
            } catch { return [] }
        }

        const [windowEvents, webEvents, afkEvents] = await Promise.all([
            fetchEvents(windowBucket),
            fetchEvents(webBucket),
            fetchEvents(afkBucket),
        ])

        const appMap: Record<string, number> = {}
        const webMap: Record<string, number> = {}
        let idleMin = 0
        let activeMin = 0

        for (const e of windowEvents) {
            const name = e.data?.app || "Unknown"
            const dur = (e.duration || 0) / 60
            if (name !== "Unknown") {
                appMap[name] = (appMap[name] || 0) + dur
                activeMin += dur
            }
        }

        for (const e of webEvents) {
            const url = e.data?.url || ""
            if (url) {
                try {
                    let domain = new URL(url).hostname
                    if (domain.startsWith("www.")) domain = domain.slice(4)
                    if (domain) webMap[domain] = (webMap[domain] || 0) + (e.duration || 0) / 60
                } catch { /* skip */ }
            }
        }

        for (const e of afkEvents) {
            if (e.data?.status !== "not-afk") {
                idleMin += (e.duration || 0) / 60
            }
        }

        return {
            applications: Object.entries(appMap)
                .map(([app_name, duration_minutes]) => ({ app_name, duration_minutes: Math.round(duration_minutes) }))
                .filter(a => a.duration_minutes > 0)
                .sort((a, b) => b.duration_minutes - a.duration_minutes),
            websites: Object.entries(webMap)
                .map(([domain, duration_minutes]) => ({ domain, duration_minutes: Math.round(duration_minutes) }))
                .filter(w => w.duration_minutes > 0)
                .sort((a, b) => b.duration_minutes - a.duration_minutes),
            idle_minutes: Math.round(idleMin),
            total_active_minutes: Math.round(activeMin),
        }
    } catch {
        return null
    }
}

/* ── main component ────────────────────────────────────────── */

export default function ProductivityReportPage() {
    const { user } = useAuth()
    const searchParams = useSearchParams()
    const autoSync = searchParams.get("autoSync")
    const autoDownload = searchParams.get("autoDownload")
    const hasAutoSynced = useRef(false)
    const hasAutoDownloaded = useRef(false)
    const [syncComplete, setSyncComplete] = useState(false)
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0])
    const [report, setReport] = useState<ReportData | null>(null)
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null)
    const [awStatus, setAwStatus] = useState<"checking" | "online" | "offline">("checking")

    const fetchReport = useCallback(async () => {
        if (!user) return
        setLoading(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

            if (!token) {
                setLoading(false)
                return
            }

            const resp = await fetch(`/api/productivity/report?date=${selectedDate}`, {
                headers: { Authorization: `Bearer ${token}` },
            })

            if (resp.ok) {
                const data = await resp.json()
                setReport(data)
            }
        } catch (e) {
            console.error("Failed to fetch report:", e)
        } finally {
            setLoading(false)
        }
    }, [user, selectedDate])

    // Check AW status using shared client (direct browser fetch → localhost:5600 first)
    useEffect(() => {
        setAwStatus("checking")
        isAWOnline()
            .then(online => setAwStatus(online ? "online" : "offline"))
            .catch(() => setAwStatus("offline"))
    }, [])

    useEffect(() => {
        fetchReport()
    }, [fetchReport])

    useEffect(() => {
        if (autoSync === "true") {
            if (awStatus === "online" && !hasAutoSynced.current) {
                hasAutoSynced.current = true
                handleFetchFromAW()
            } else if (awStatus === "offline") {
                setSyncComplete(true)
            }
        }
    }, [autoSync, awStatus])

    useEffect(() => {
        const isSyncReady = autoSync === "true" ? syncComplete : true;
        if (autoDownload === "true" && report && !hasAutoDownloaded.current && !loading && isSyncReady) {
            hasAutoDownloaded.current = true
            // eslint-disable-next-line react-hooks/exhaustive-deps
            handleDownloadPDF()
        }
    }, [autoDownload, autoSync, syncComplete, report, loading])

    /* ── on-demand fetch from AW ─────────────────────────────── */

    const handleFetchFromAW = async () => {
        if (!user || awStatus !== "online") return
        setLoading(true)

        try {
            const awData = await fetchAWDataForDate(selectedDate)
            if (!awData) {
                setLoading(false)
                setSyncComplete(true)
                return
            }

            // Upload to backend
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token
            if (!token) {
                setSyncComplete(true)
                return
            }

            await fetch("/api/productivity/upload", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    date: selectedDate,
                    ...awData,
                }),
            })

            // Re-fetch report
            await fetchReport()
            setSyncComplete(true)
        } catch (e) {
            console.error("Failed to fetch from AW:", e)
            setLoading(false)
            setSyncComplete(true)
        }
    }

    /* ── PDF download ────────────────────────────────────────── */

    const handleDownloadPDF = async () => {
        if (!report || !user) return
        setExporting("pdf")

        try {
            const { default: jsPDF } = await import("jspdf")
            const { default: autoTable } = await import("jspdf-autotable")
            const doc = new jsPDF()

            doc.setProperties({
                title: "FlowLock Productivity Report",
                subject: `Productivity Report - ${report.date}`,
                author: user.name,
                creator: "FlowLock",
            })

            // Header
            doc.setFontSize(24)
            doc.setTextColor(139, 92, 246) // violet
            doc.text("FlowLock Productivity Report", 14, 22)

            doc.setFontSize(11)
            doc.setTextColor(80, 80, 80)
            doc.text(`Date: ${report.date}`, 14, 32)
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 38)
            doc.text(`User: ${user.name} (${user.email})`, 14, 44)

            // Summary
            doc.setFontSize(14)
            doc.setTextColor(0, 0, 0)
            doc.text("Productivity Summary", 14, 58)

            autoTable(doc, {
                startY: 63,
                head: [["Metric", "Value"]],
                body: [
                    ["Productivity Score", `${report.productivity_score}%`],
                    ["Total Active Time", `${Math.floor(report.total_active_minutes / 60)}h ${report.total_active_minutes % 60}m`],
                    ["Focus Time", `${Math.floor(report.focus_time / 60)}h ${report.focus_time % 60}m`],
                    ["Idle Time", `${report.idle_minutes}m`],
                ],
                theme: "grid",
                headStyles: { fillColor: [139, 92, 246] },
            })

            // Top Applications
            if (report.top_apps.length > 0) {
                const y = (doc as any).lastAutoTable.finalY + 12
                doc.setFontSize(14)
                doc.text("Top Applications", 14, y)

                autoTable(doc, {
                    startY: y + 5,
                    head: [["Application", "Duration (minutes)"]],
                    body: report.top_apps.map(a => [a.app_name, `${a.duration_minutes}m`]),
                    theme: "striped",
                    headStyles: { fillColor: [139, 92, 246] },
                })
            }

            // Top Websites
            if (report.top_websites.length > 0) {
                const y = (doc as any).lastAutoTable.finalY + 12
                doc.setFontSize(14)
                doc.text("Top Websites", 14, y)

                autoTable(doc, {
                    startY: y + 5,
                    head: [["Website", "Duration (minutes)"]],
                    body: report.top_websites.map(w => [w.domain, `${w.duration_minutes}m`]),
                    theme: "striped",
                    headStyles: { fillColor: [139, 92, 246] },
                })
            }

            // Existing Study Metrics
            const em = report.existing_metrics
            if (em.study_sessions_count > 0) {
                const y = (doc as any).lastAutoTable.finalY + 12
                doc.setFontSize(14)
                doc.text("Study Session Metrics", 14, y)

                autoTable(doc, {
                    startY: y + 5,
                    head: [["Metric", "Value"]],
                    body: [
                        ["Study Sessions", `${em.study_sessions_count}`],
                        ["Total Study Time", `${Math.floor(em.total_study_minutes / 60)}h ${em.total_study_minutes % 60}m`],
                        ["Focused Time", `${Math.floor(em.total_focused_minutes / 60)}h ${em.total_focused_minutes % 60}m`],
                        ["Drowsy Time", `${em.total_drowsy_minutes}m`],
                        ["Distracted Time", `${em.total_distracted_minutes}m`],
                        ["Avg Focus Score", `${em.avg_focus_score}%`],
                    ],
                    theme: "grid",
                    headStyles: { fillColor: [99, 102, 241] },
                })
            }

            doc.save(`flowlock_productivity_${report.date}.pdf`)
        } catch (e) {
            console.error("PDF generation failed:", e)
        } finally {
            setExporting(null)
        }
    }

    /* ── CSV download ────────────────────────────────────────── */

    const handleDownloadCSV = () => {
        if (!report) return
        setExporting("csv")

        try {
            const lines: string[] = []

            // Summary
            lines.push("FlowLock Productivity Report")
            lines.push(`Date,${report.date}`)
            lines.push(`Productivity Score,${report.productivity_score}%`)
            lines.push(`Total Active Minutes,${report.total_active_minutes}`)
            lines.push(`Focus Time Minutes,${report.focus_time}`)
            lines.push(`Idle Minutes,${report.idle_minutes}`)
            lines.push("")

            // Apps
            lines.push("Application Usage")
            lines.push("App Name,Duration (minutes)")
            for (const app of report.all_apps) {
                lines.push(`"${app.app_name}",${app.duration_minutes}`)
            }
            lines.push("")

            // Websites
            lines.push("Website Usage")
            lines.push("Domain,Duration (minutes)")
            for (const site of report.all_websites) {
                lines.push(`"${site.domain}",${site.duration_minutes}`)
            }
            lines.push("")

            // Existing metrics
            const em = report.existing_metrics
            lines.push("Study Session Metrics")
            lines.push(`Study Sessions,${em.study_sessions_count}`)
            lines.push(`Total Study Minutes,${em.total_study_minutes}`)
            lines.push(`Total Focused Minutes,${em.total_focused_minutes}`)
            lines.push(`Total Drowsy Minutes,${em.total_drowsy_minutes}`)
            lines.push(`Total Distracted Minutes,${em.total_distracted_minutes}`)
            lines.push(`Avg Focus Score,${em.avg_focus_score}%`)

            const blob = new Blob([lines.join("\n")], { type: "text/csv" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `flowlock_productivity_${report.date}.csv`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch (e) {
            console.error("CSV generation failed:", e)
        } finally {
            setExporting(null)
        }
    }

    /* ── render ───────────────────────────────────────────────── */

    if (!user) return null

    const hasAWData = report && report.total_active_minutes > 0
    const hasStudyData = report && report.existing_metrics.study_sessions_count > 0

    // Chart data
    const appChartData = report?.top_apps.slice(0, 10).map(a => ({
        name: a.app_name.length > 20 ? a.app_name.slice(0, 18) + "…" : a.app_name,
        minutes: a.duration_minutes,
    })) || []

    const webChartData = report?.top_websites.slice(0, 10).map(w => ({
        name: w.domain.length > 25 ? w.domain.slice(0, 23) + "…" : w.domain,
        minutes: w.duration_minutes,
    })) || []

    const pieData = report ? [
        { name: "Active", value: Math.max(0, report.focus_time) },
        { name: "Idle", value: report.idle_minutes },
    ].filter(d => d.value > 0) : []

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold mb-1">Productivity Report</h1>
                    <p className="text-muted-foreground text-sm md:text-base">
                        Daily insights from ActivityWatch and study sessions
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* AW Status */}
                    <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${awStatus === "online"
                        ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
                        : awStatus === "offline"
                            ? "text-red-400 bg-red-500/10 border-red-500/30"
                            : "text-muted-foreground bg-muted border-border"
                        }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${awStatus === "online" ? "bg-emerald-500" : awStatus === "offline" ? "bg-red-400" : "bg-muted-foreground"
                            }`} />
                        AW {awStatus === "checking" ? "…" : awStatus}
                    </div>

                    {/* Date picker */}
                    <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            max={new Date().toISOString().split("T")[0]}
                            className="pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 flex-wrap">
                <Button
                    onClick={handleFetchFromAW}
                    disabled={loading || awStatus !== "online"}
                    variant="outline"
                    className="gap-2"
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    Sync from ActivityWatch
                </Button>

                <Button
                    onClick={handleDownloadPDF}
                    disabled={!hasAWData && !hasStudyData || exporting === "pdf"}
                    className="gap-2 bg-primary hover:bg-primary/90"
                >
                    {exporting === "pdf" ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                    Download PDF
                </Button>

                <Button
                    onClick={handleDownloadCSV}
                    disabled={!hasAWData && !hasStudyData || exporting === "csv"}
                    variant="outline"
                    className="gap-2"
                >
                    {exporting === "csv" ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                    Download CSV
                </Button>
            </div>

            {/* Loading state */}
            {loading && (
                <div className="flex justify-center p-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}

            {/* Content */}
            {!loading && report && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            icon={Zap}
                            label="Productivity Score"
                            value={`${report.productivity_score}%`}
                            sub={report.productivity_score >= 75 ? "Great!" : report.productivity_score >= 50 ? "Average" : "Needs improvement"}
                            color="bg-violet-500/20 text-violet-500"
                        />
                        <StatCard
                            icon={Clock}
                            label="Active Time"
                            value={`${Math.floor(report.total_active_minutes / 60)}h ${report.total_active_minutes % 60}m`}
                            color="bg-blue-500/20 text-blue-500"
                        />
                        <StatCard
                            icon={Moon}
                            label="Idle Time"
                            value={`${report.idle_minutes}m`}
                            color="bg-amber-500/20 text-amber-500"
                        />
                        <StatCard
                            icon={Target}
                            label="Study Sessions"
                            value={`${report.existing_metrics.study_sessions_count}`}
                            sub={report.existing_metrics.avg_focus_score > 0 ? `Avg score: ${report.existing_metrics.avg_focus_score}%` : undefined}
                            color="bg-emerald-500/20 text-emerald-500"
                        />
                    </div>

                    {/* Score & Idle/Active Pie */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="bg-card border-border">
                            <CardHeader>
                                <CardTitle className="text-lg">Productivity Score</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center justify-center py-6">
                                <ScoreRing score={report.productivity_score} />
                                <p className="text-sm text-muted-foreground mt-4">
                                    {report.productivity_score >= 75
                                        ? "Excellent focus today!"
                                        : report.productivity_score >= 50
                                            ? "Decent productivity. Keep going!"
                                            : "Try reducing idle time."}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-border lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Moon size={18} className="text-amber-500" />
                                    Active vs Idle Time
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[280px]">
                                {pieData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%" cy="50%"
                                                innerRadius={60} outerRadius={100}
                                                paddingAngle={3}
                                                dataKey="value"
                                            >
                                                {pieData.map((_, i) => (
                                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                content={({ active, payload }) => {
                                                    if (active && payload?.length) {
                                                        return (
                                                            <div className="bg-popover border border-border p-3 rounded-xl shadow-xl">
                                                                <p className="text-sm font-medium">{payload[0].name}</p>
                                                                <p className="text-sm text-primary font-bold">{payload[0].value}m</p>
                                                            </div>
                                                        )
                                                    }
                                                    return null
                                                }}
                                            />
                                            <Legend
                                                formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <EmptyState title="No time data" message="Sync from ActivityWatch to see your active vs idle breakdown" />
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* App Usage Chart */}
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Monitor size={18} className="text-blue-500" />
                                Application Usage
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[400px]">
                            {appChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={appChartData}
                                        layout="vertical"
                                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.4} />
                                        <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `${v}m`} />
                                        <YAxis type="category" dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={150} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.2 }} />
                                        <Bar dataKey="minutes" radius={[0, 6, 6, 0]}>
                                            {appChartData.map((_, i) => (
                                                <Cell key={i} fill={APP_COLORS[i % APP_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyState title="No app data" message="Sync from ActivityWatch to see your application usage" />
                            )}
                        </CardContent>
                    </Card>

                    {/* Website Usage Chart */}
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Globe size={18} className="text-cyan-500" />
                                Website Usage
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[400px]">
                            {webChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={webChartData}
                                        layout="vertical"
                                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.4} />
                                        <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `${v}m`} />
                                        <YAxis type="category" dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={180} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.2 }} />
                                        <Bar dataKey="minutes" radius={[0, 6, 6, 0]}>
                                            {webChartData.map((_, i) => (
                                                <Cell key={i} fill={APP_COLORS[(i + 3) % APP_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyState title="No website data" message="Sync from ActivityWatch to see your browsing activity" />
                            )}
                        </CardContent>
                    </Card>

                    {/* Existing Study Metrics */}
                    {hasStudyData && (
                        <Card className="bg-card border-border">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <TrendingUp size={18} className="text-emerald-500" />
                                    Study Session Metrics
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                    {[
                                        { label: "Sessions", value: `${report.existing_metrics.study_sessions_count}`, color: "text-primary" },
                                        { label: "Study Time", value: `${Math.floor(report.existing_metrics.total_study_minutes / 60)}h ${report.existing_metrics.total_study_minutes % 60}m`, color: "text-blue-500" },
                                        { label: "Focused", value: `${Math.floor(report.existing_metrics.total_focused_minutes / 60)}h ${report.existing_metrics.total_focused_minutes % 60}m`, color: "text-emerald-500" },
                                        { label: "Drowsy", value: `${report.existing_metrics.total_drowsy_minutes}m`, color: "text-amber-500" },
                                        { label: "Distracted", value: `${report.existing_metrics.total_distracted_minutes}m`, color: "text-red-500" },
                                        { label: "Focus Score", value: `${report.existing_metrics.avg_focus_score}%`, color: "text-violet-500" },
                                    ].map(item => (
                                        <div key={item.label} className="text-center p-4 rounded-xl bg-muted/30 border border-border/50">
                                            <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                                            <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            {/* No data empty state */}
            {!loading && report && !hasAWData && !hasStudyData && (
                <Card className="bg-card border-border">
                    <CardContent className="py-8">
                        <EmptyState
                            title="No data for this date"
                            message={awStatus === "online"
                                ? "Click 'Sync from ActivityWatch' to fetch your data, or run the agent script."
                                : "Start ActivityWatch on your machine and run the agent script, or use the Sync button."}
                        />
                    </CardContent>
                </Card>
            )}

            {/* AI Productivity Analysis */}
            <AIInsightsPanel
                reportData={report ? {
                    top_apps: report.top_apps,
                    top_websites: report.top_websites,
                } : null}
            />
        </div>
    )
}
