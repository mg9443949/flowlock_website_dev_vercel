import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization")
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Missing authorization header" }, { status: 401 })
        }

        const token = authHeader.replace("Bearer ", "")

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        })

        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const date = req.nextUrl.searchParams.get("date")
        if (!date) {
            return NextResponse.json({ error: "Missing date parameter" }, { status: 400 })
        }

        const dayStart = new Date(date + "T00:00:00.000Z")
        const dayEnd = new Date(date + "T23:59:59.999Z")

        // 1. Fetch daily summary from native custom agent DB
        const { data: summary } = await supabase
            .from("daily_summaries")
            .select("*")
            .eq("user_id", user.id)
            .eq("date", date)
            .single()

        // 2. Fetch raw activity logs to build top apps/websites lists dynamically for the day
        const { data: activities } = await supabase
            .from("activity_logs")
            .select("activity_type, app_name, domain, duration_seconds")
            .eq("user_id", user.id)
            .gte("start_time", dayStart.toISOString())
            .lte("start_time", dayEnd.toISOString())

        let applications: { app_name: string; duration_minutes: number }[] = []
        let websites: { domain: string; duration_minutes: number }[] = []

        if (activities && activities.length > 0) {
            const appMap: Record<string, number> = {}
            const webMap: Record<string, number> = {}

            for (const act of activities) {
                if (act.activity_type === "app" && act.app_name) {
                    appMap[act.app_name] = (appMap[act.app_name] || 0) + act.duration_seconds
                } else if (act.activity_type === "browser" && act.domain) {
                    webMap[act.domain] = (webMap[act.domain] || 0) + act.duration_seconds
                }
            }

            applications = Object.entries(appMap)
                .map(([app_name, dur_sec]) => ({ app_name, duration_minutes: Math.round(dur_sec / 60) }))
                .filter(a => a.duration_minutes > 0)
                .sort((a, b) => b.duration_minutes - a.duration_minutes)

            websites = Object.entries(webMap)
                .map(([domain, dur_sec]) => ({ domain, duration_minutes: Math.round(dur_sec / 60) }))
                .filter(w => w.duration_minutes > 0)
                .sort((a, b) => b.duration_minutes - a.duration_minutes)
        }

        // 3. Fetch existing study sessions for this date
        const { data: studySessions } = await supabase
            .from("study_sessions")
            .select("*")
            .eq("user_id", user.id)
            .gte("started_at", dayStart.toISOString())
            .lte("started_at", dayEnd.toISOString())

        // Calculate existing study metrics
        let totalStudyMin = 0
        let totalFocusedMin = 0
        let totalDrowsyMin = 0
        let totalDistractedMin = 0
        let avgFocusScore = 0

        if (studySessions && studySessions.length > 0) {
            for (const s of studySessions) {
                totalStudyMin += (s.duration_ms || 0) / 60000
                totalFocusedMin += (s.focused_time_ms || 0) / 60000
                totalDrowsyMin += (s.drowsy_time_ms || 0) / 60000
                totalDistractedMin += ((s.head_turned_time_ms || 0) + (s.face_missing_time_ms || 0) + (s.unauthorized_time_ms || 0)) / 60000
            }
            avgFocusScore = Math.round(
                studySessions.reduce((sum: number, s: any) => sum + (s.focus_score || 0), 0) / studySessions.length
            )
        }

        // 4. Derive metrics from daily_summary
        const totalActiveMin = summary ? Math.round(((summary.study_seconds || 0) + (summary.distraction_seconds || 0) + (summary.neutral_seconds || 0)) / 60) : 0
        const idleMin = summary ? Math.round((summary.idle_seconds || 0) / 60) : 0
        const focusTime = summary ? Math.round((summary.study_seconds || 0) / 60) : 0
        const distractionTime = summary ? Math.round((summary.distraction_seconds || 0) / 60) : 0
        
        let productivityScore = 0
        const totalTrackedMin = totalActiveMin + idleMin
        
        // Match the original scoring structure, but with real data
        if (summary && summary.overall_focus_score !== null) {
            productivityScore = summary.overall_focus_score
        } else if (totalTrackedMin > 0) {
            productivityScore = Math.round(((focusTime + (totalActiveMin - focusTime - distractionTime)) / totalTrackedMin) * 100)
        }

        const report = {
            date,
            focus_time: focusTime,
            distraction_time: distractionTime,
            total_active_minutes: totalActiveMin,
            idle_minutes: idleMin,
            productivity_score: productivityScore,
            top_apps: applications.slice(0, 10),
            top_websites: websites.slice(0, 10),
            all_apps: applications,
            all_websites: websites,
            existing_metrics: {
                study_sessions_count: studySessions?.length || 0,
                total_study_minutes: Math.round(totalStudyMin),
                total_focused_minutes: Math.round(totalFocusedMin),
                total_drowsy_minutes: Math.round(totalDrowsyMin),
                total_distracted_minutes: Math.round(totalDistractedMin),
                avg_focus_score: avgFocusScore,
            },
        }

        return NextResponse.json(report)
    } catch (error) {
        console.error("Report error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
