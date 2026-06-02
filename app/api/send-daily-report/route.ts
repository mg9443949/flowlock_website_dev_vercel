import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey

// Helper to calculate start/end of day in user's timezone converted to UTC
function getUtcRangeForLocalDate(dateStr: string, timezone: string) {
  // dateStr is "YYYY-MM-DD"
  const getOffsetMs = (tz: string, baseDate: Date) => {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
      });
      const parts = formatter.formatToParts(baseDate);
      const map = new Map(parts.map(p => [p.type, p.value]));
      
      const year = parseInt(map.get('year')!);
      const month = parseInt(map.get('month')!) - 1;
      const day = parseInt(map.get('day')!);
      let hour = parseInt(map.get('hour')!);
      if (hour === 24) hour = 0; // Handle hour format variation
      const minute = parseInt(map.get('minute')!);
      const second = parseInt(map.get('second')!);
      
      const tzLocalAsUtc = Date.UTC(year, month, day, hour, minute, second);
      return tzLocalAsUtc - baseDate.getTime();
    } catch (e) {
      console.warn(`Timezone formatting fallback for ${tz}:`, e);
      return 0; // Fallback to UTC
    }
  };

  const localStart = Date.UTC(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(5, 7)) - 1,
    parseInt(dateStr.slice(8, 10)),
    0, 0, 0, 0
  );
  
  const localEnd = Date.UTC(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(5, 7)) - 1,
    parseInt(dateStr.slice(8, 10)),
    23, 59, 59, 999
  );
  
  const offsetStart = getOffsetMs(timezone, new Date(localStart));
  const offsetEnd = getOffsetMs(timezone, new Date(localEnd));
  
  return {
    start: new Date(localStart - offsetStart),
    end: new Date(localEnd - offsetEnd)
  };
}

// Generate the beautiful HTML productivity report email
function generateEmailHTML({ 
  userName, 
  totalSessions, 
  totalTimeStr, 
  avgFocusScore, 
  totalDistractions, 
  bestScore, 
  sessions,
  topApps,
  topWebsites,
  summary,
  dateStr
}: any) {
  const scoreColor = avgFocusScore >= 75 ? '#10b981' : 
                    avgFocusScore >= 50 ? '#f59e0b' : '#ef4444'

  // Format date nicely
  const displayDate = new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', 
    day: 'numeric', 
    month: 'long',
    year: 'numeric'
  })
  
  const sessionRows = (sessions || []).map((s: any) => {
    const duration = Math.round((s.duration_ms || 0) / 60000)
    const time = new Date(s.started_at).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    })
    return `
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
        <td style="padding: 12px 8px; color: #a1a1aa; font-size: 14px;">${time}</td>
        <td style="padding: 12px 8px; color: #f4f4f5; font-size: 14px;">${duration} min</td>
        <td style="padding: 12px 8px; color: ${
          s.focus_score >= 75 ? '#10b981' : 
          s.focus_score >= 50 ? '#f59e0b' : '#ef4444'
        }; font-weight: 600; font-size: 14px; text-align: right;">${s.focus_score}%</td>
      </tr>
    `
  }).join('')

  // Calculate percentages for activity bar chart
  let studySec = summary?.study_seconds || 0
  let distSec = summary?.distraction_seconds || 0
  let idleSec = summary?.idle_seconds || 0
  let neutralSec = summary?.neutral_seconds || 0
  let totalSec = studySec + distSec + idleSec + neutralSec

  if (totalSec === 0 && sessions?.length > 0) {
    // Fallback to study session durations if active tracking is empty
    studySec = sessions.reduce((sum: number, s: any) => sum + (s.focused_time_ms || 0) / 1000, 0)
    distSec = sessions.reduce((sum: number, s: any) => sum + (s.drowsy_time_ms || 0) / 1000 + (s.unauthorized_time_ms || 0) / 1000, 0)
    totalSec = studySec + distSec
  }

  const studyPct = totalSec > 0 ? Math.round((studySec / totalSec) * 100) : 0
  const distPct = totalSec > 0 ? Math.round((distSec / totalSec) * 100) : 0
  const idlePct = totalSec > 0 ? Math.round((idleSec / totalSec) * 100) : 0
  const neutralPct = totalSec > 0 ? Math.round(100 - studyPct - distPct - idlePct) : 0

  const showBreakdown = totalSec > 0

  // Render top Apps & Websites HTML
  const appRows = (topApps || []).slice(0, 3).map((app: any) => {
    const maxMins = topApps[0]?.duration_minutes || 1
    const pct = Math.max(5, Math.round((app.duration_minutes / maxMins) * 100))
    return `
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
          <span style="color: #e4e4e7; font-weight: 500; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 170px;">${app.app_name}</span>
          <span style="color: #a1a1aa;">${app.duration_minutes}m</span>
        </div>
        <div style="height: 6px; background: #27272a; border-radius: 3px; overflow: hidden;">
          <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #8b5cf6, #6366f1); border-radius: 3px;"></div>
        </div>
      </div>
    `
  }).join('')

  const webRows = (topWebsites || []).slice(0, 3).map((web: any) => {
    const maxMins = topWebsites[0]?.duration_minutes || 1
    const pct = Math.max(5, Math.round((web.duration_minutes / maxMins) * 100))
    return `
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
          <span style="color: #e4e4e7; font-weight: 500; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 170px;">${web.domain}</span>
          <span style="color: #a1a1aa;">${web.duration_minutes}m</span>
        </div>
        <div style="height: 6px; background: #27272a; border-radius: 3px; overflow: hidden;">
          <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #ec4899, #8b5cf6); border-radius: 3px;"></div>
        </div>
      </div>
    `
  }).join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>FlowLock Productivity Report</title>
    </head>
    <body style="background-color: #0b0c10; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0c10; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #12131a; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.4);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">
                  <table width="100%">
                    <tr>
                      <td align="center">
                        <span style="background: linear-gradient(90deg, #c084fc, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: #a855f7; font-size: 26px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">FlowLock</span>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding-top: 6px;">
                        <span style="color: #94a3b8; font-size: 14px; font-weight: 500; letter-spacing: 0.5px;">DAILY PRODUCTIVITY REPORT</span>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding-top: 12px;">
                        <span style="background-color: rgba(255,255,255,0.06); color: #e2e8f0; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.05);">${displayDate}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Content Body -->
              <tr>
                <td style="padding: 32px;">
                  
                  <!-- Greeting -->
                  <table width="100%" style="margin-bottom: 24px;">
                    <tr>
                      <td>
                        <h2 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 0 0 8px 0;">Great work today, ${userName}! 🎯</h2>
                        <p style="color: #9ca3af; font-size: 15px; line-height: 1.5; margin: 0;">Here is a comprehensive summary of your productivity, focus sessions, and tracked activity details.</p>
                      </td>
                    </tr>
                  </table>

                  <!-- Stats Grid (using table for email client compatibility) -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                    <tr>
                      <td width="48%" style="background-color: #1a1b26; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 16px; text-align: center;">
                        <span style="color: #9ca3af; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; display: block; margin-bottom: 6px;">Total Focus Time</span>
                        <span style="color: #10b981; font-size: 26px; font-weight: 800; display: block;">${totalTimeStr}</span>
                        <span style="color: #6b7280; font-size: 12px; display: block; margin-top: 4px;">${totalSessions} focus session${totalSessions === 1 ? '' : 's'}</span>
                      </td>
                      <td width="4%"></td>
                      <td width="48%" style="background-color: #1a1b26; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 16px; text-align: center;">
                        <span style="color: #9ca3af; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; display: block; margin-bottom: 6px;">Avg Focus Score</span>
                        <span style="color: ${scoreColor}; font-size: 26px; font-weight: 800; display: block;">${avgFocusScore}%</span>
                        <span style="color: #6b7280; font-size: 12px; display: block; margin-top: 4px;">Best Session: ${bestScore}%</span>
                      </td>
                    </tr>
                    <tr style="height: 16px;"><td></td><td></td><td></td></tr>
                    <tr>
                      <td width="48%" style="background-color: #1a1b26; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 16px; text-align: center;">
                        <span style="color: #9ca3af; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; display: block; margin-bottom: 6px;">Distraction Alerts</span>
                        <span style="color: ${totalDistractions === 0 ? '#10b981' : '#f59e0b'}; font-size: 26px; font-weight: 800; display: block;">${totalDistractions}</span>
                        <span style="color: #6b7280; font-size: 12px; display: block; margin-top: 4px;">
                          ${totalDistractions === 0 ? 'Perfect concentration! 🔥' : 'alerts triggered'}
                        </span>
                      </td>
                      <td width="4%"></td>
                      <td width="48%" style="background-color: #1a1b26; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 16px; text-align: center;">
                        <span style="color: #9ca3af; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; display: block; margin-bottom: 6px;">Tracked State</span>
                        <span style="color: #a855f7; font-size: 26px; font-weight: 800; display: block;">Active</span>
                        <span style="color: #6b7280; font-size: 12px; display: block; margin-top: 4px;">System running</span>
                      </td>
                    </tr>
                  </table>

                  <!-- Stacked Activity Bar -->
                  ${showBreakdown ? `
                  <div style="background-color: #1a1b26; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <h3 style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Activity Allocation</h3>
                    
                    <div style="height: 12px; display: table; width: 100%; border-radius: 6px; overflow: hidden; margin-bottom: 12px; border-collapse: collapse;">
                      ${studyPct > 0 ? `<div style="display: table-cell; width: ${studyPct}%; background-color: #10b981;" title="Study"></div>` : ''}
                      ${neutralPct > 0 ? `<div style="display: table-cell; width: ${neutralPct}%; background-color: #3b82f6;" title="Neutral"></div>` : ''}
                      ${distPct > 0 ? `<div style="display: table-cell; width: ${distPct}%; background-color: #ef4444;" title="Distracted"></div>` : ''}
                      ${idlePct > 0 ? `<div style="display: table-cell; width: ${idlePct}%; background-color: #4b5563;" title="Idle"></div>` : ''}
                    </div>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 12px; color: #a1a1aa;">
                          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #10b981; margin-right: 4px;"></span>
                          Study: ${studyPct}%
                        </td>
                        <td style="font-size: 12px; color: #a1a1aa;">
                          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #3b82f6; margin-right: 4px;"></span>
                          Neutral: ${neutralPct}%
                        </td>
                        <td style="font-size: 12px; color: #a1a1aa;">
                          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #ef4444; margin-right: 4px;"></span>
                          Distraction: ${distPct}%
                        </td>
                        <td style="font-size: 12px; color: #a1a1aa;">
                          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #4b5563; margin-right: 4px;"></span>
                          Idle: ${idlePct}%
                        </td>
                      </tr>
                    </table>
                  </div>
                  ` : ''}

                  <!-- Side-by-side Top Apps and Websites -->
                  ${(topApps?.length > 0 || topWebsites?.length > 0) ? `
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                    <tr>
                      <td width="48%" valign="top" style="background-color: #1a1b26; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 16px;">
                        <h3 style="color: #ffffff; font-size: 13px; font-weight: 700; margin: 0 0 14px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">Top Apps</h3>
                        ${topApps?.length > 0 ? appRows : '<span style="color: #6b7280; font-size: 13px;">No app activity tracked</span>'}
                      </td>
                      <td width="4%"></td>
                      <td width="48%" valign="top" style="background-color: #1a1b26; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 16px;">
                        <h3 style="color: #ffffff; font-size: 13px; font-weight: 700; margin: 0 0 14px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">Top Websites</h3>
                        ${topWebsites?.length > 0 ? webRows : '<span style="color: #6b7280; font-size: 13px;">No web activity tracked</span>'}
                      </td>
                    </tr>
                  </table>
                  ` : ''}

                  <!-- Session Breakdown -->
                  ${sessions?.length > 0 ? `
                  <div style="background-color: #1a1b26; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <h3 style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Session Breakdown</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                      <thead>
                        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.12);">
                          <th align="left" style="color: #8b5cf6; font-size: 12px; font-weight: 700; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">TIME</th>
                          <th align="left" style="color: #8b5cf6; font-size: 12px; font-weight: 700; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">DURATION</th>
                          <th align="right" style="color: #8b5cf6; font-size: 12px; font-weight: 700; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">FOCUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${sessionRows}
                      </tbody>
                    </table>
                  </div>
                  ` : ''}

                  <!-- Motivational Banner -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 12px; text-align: center; margin-bottom: 8px;">
                    <tr>
                      <td style="padding: 20px 24px;">
                        <p style="margin: 0; font-size: 15px; font-weight: 500; color: #e4e4e7; line-height: 1.5;">
                          ${avgFocusScore >= 80 
                            ? "🏆 Outstanding performance! You're in the zone. Keep it up tomorrow!" 
                            : avgFocusScore >= 60 
                            ? "💪 Solid effort today! A little more focus tomorrow and you'll crush it!"
                            : "🚀 Every session counts. Tomorrow is a fresh start — you've got this!"}
                        </p>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #0f1016; padding: 24px 32px; border-top: 1px solid rgba(255,255,255,0.04); text-align: center;">
                  <p style="color: #4b5563; font-size: 12px; margin: 0 0 6px 0; line-height: 1.4;">
                    You are receiving this daily productivity report because you enabled it in your FlowLock Settings.
                  </p>
                  <p style="color: #4b5563; font-size: 12px; margin: 0; line-height: 1.4;">
                    To opt-out, open <a href="#" style="color: #8b5cf6; text-decoration: underline;">FlowLock Settings</a> and toggle off "Daily Productivity Report".
                  </p>
                  <p style="color: #374151; font-size: 11px; margin-top: 16px; letter-spacing: 0.5px;">
                    © ${new Date().getFullYear()} FlowLock. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

export async function GET(req: NextRequest) {
  return handleRequest(req)
}

export async function POST(req: NextRequest) {
  return handleRequest(req)
}

async function handleRequest(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const testUserId = searchParams.get('test_user_id')
    const querySecret = searchParams.get('secret')

    // 1. Authorization checks
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization")
    let isAuthorized = false
    let clientSupabase = null

    // Check CRON_SECRET authorization
    if (process.env.CRON_SECRET) {
      if (querySecret === process.env.CRON_SECRET) {
        isAuthorized = true
      } else if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7)
        if (token === process.env.CRON_SECRET) {
          isAuthorized = true
        }
      }
    }

    // Verify User Session Token (for test reports from the dashboard settings page)
    if (!isAuthorized && authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7)
      // Create user-scoped supabase client
      const userSupabase = createClient(supabaseUrl, supabaseAnonKey)
      
      const { data: { user }, error: authError } = await userSupabase.auth.getUser(token)
      if (!authError && user) {
        // If they ask for a test report for themselves, authorize them
        if (testUserId && user.id === testUserId) {
          isAuthorized = true
        }
      }
    }

    // Bypass in development mode if CRON_SECRET is not configured
    if (!isAuthorized && process.env.NODE_ENV === 'development') {
      console.warn("Authorization bypassed in development mode.")
      isAuthorized = true
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Always initialize data querying Supabase client with Service Key to bypass RLS constraints
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if Resend is configured (support both standard RESEND_API_KEY and direct Resend env var)
    const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND
    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY/Resend environment variable.")
      return NextResponse.json({ error: "Resend API key is not configured" }, { status: 500 })
    }

    const resend = new Resend(resendApiKey)
    const results: any[] = []

    // 2. Fetch target user list
    let targetPreferences = []

    if (testUserId) {
      // Manual test for a single user
      const { data: pref, error: prefError } = await supabase
        .from('user_preferences')
        .select('user_id, timezone')
        .eq('user_id', testUserId)
        .single()

      if (prefError) {
        // Fallback if no pref record exists yet
        targetPreferences = [{ user_id: testUserId, timezone: 'Asia/Kolkata' }]
      } else {
        targetPreferences = [pref]
      }
    } else {
      // Cron mode: Fetch all users who enabled reports
      const { data: preferences, error: prefError } = await supabase
        .from('user_preferences')
        .select('user_id, timezone, last_email_report_sent_date')
        .eq('email_reports_enabled', true)

      if (prefError) throw prefError
      targetPreferences = preferences || []
    }

    // 3. Process reports for each target user
    for (const pref of targetPreferences) {
      try {
        const timezone = pref.timezone || 'Asia/Kolkata'

        // Determine target date in user's timezone
        const userDateStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date())

        // If not test mode, skip if already sent today
        if (!testUserId && pref.last_email_report_sent_date === userDateStr) {
          continue
        }

        // If not test mode, check if user's local hour is 23 (11 PM)
        if (!testUserId) {
          const localHourStr = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: 'numeric', hour12: false
          }).format(new Date())
          const localHour = parseInt(localHourStr)
          
          if (localHour !== 15) {
            continue // Skip, only send during 3:00 PM - 3:59 PM local time (Temporary test override)
          }
        }

        // Get user details (email and name)
        let userEmail = ""
        let userName = ""
        let userData = null
        let userError = null

        try {
          const res = await (supabase as any).auth.admin.getUserById(pref.user_id)
          userData = res.data
          userError = res.error
        } catch (e) {
          userError = e
        }

        if (userError || !userData?.user) {
          // Fallback to query profiles table if admin access fails or is restricted
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', pref.user_id)
            .single()

          if (profile?.email) {
            userEmail = profile.email
            userName = profile.full_name || profile.email.split('@')[0]
          } else {
            console.error(`Could not fetch details for user ${pref.user_id}:`, userError)
            continue
          }
        } else {
          userEmail = userData.user.email || ""
          userName = userData.user.user_metadata?.full_name || userData.user.email?.split('@')[0] || "there"
        }

        if (!userEmail) continue

        // Fetch stats for the user's local date
        const { start: dayStart, end: dayEnd } = getUtcRangeForLocalDate(userDateStr, timezone)

        // 1. Fetch daily summary
        const { data: summary } = await supabase
          .from("daily_summaries")
          .select("*")
          .eq("user_id", pref.user_id)
          .eq("date", userDateStr)
          .single()

        // 2. Fetch study sessions
        const { data: studySessions } = await supabase
          .from("study_sessions")
          .select("*")
          .eq("user_id", pref.user_id)
          .gte("started_at", dayStart.toISOString())
          .lte("started_at", dayEnd.toISOString())
          .order("started_at", { ascending: true })

        // 3. Fetch activity logs (top apps & websites)
        const { data: activities } = await supabase
          .from("activity_logs")
          .select("activity_type, app_name, domain, duration_seconds")
          .eq("user_id", pref.user_id)
          .gte("start_time", dayStart.toISOString())
          .lte("start_time", dayEnd.toISOString())

        const hasSessions = studySessions && studySessions.length > 0
        const hasActivities = activities && activities.length > 0

        // Skip sending empty emails if the user had absolutely no activity today (unless in test mode)
        if (!testUserId && !hasSessions && !hasActivities && !summary) {
          continue
        }

        // Calculate focus metrics from sessions
        const totalSessions = studySessions?.length || 0
        let totalFocusedMs = 0
        let avgFocusScore = 0
        let totalDistractions = 0
        let bestScore = 0

        if (hasSessions) {
          totalFocusedMs = studySessions.reduce((s: number, r: any) => s + (r.focused_time_ms ?? 0), 0)
          
          const sumFocusScore = studySessions.reduce((s: number, r: any) => s + (r.focus_score ?? 0), 0)
          avgFocusScore = Math.round(sumFocusScore / totalSessions)

          totalDistractions = studySessions.reduce(
            (s: number, r: any) => s + (r.drowsy_count ?? 0) + 
            (r.head_turned_count ?? 0) + (r.face_missing_count ?? 0) + 
            (r.unauthorized_count ?? 0) + (r.high_noise_count ?? 0), 0
          )
          
          bestScore = studySessions.reduce(
            (best: number, s: any) => s.focus_score > best ? s.focus_score : best, 0
          )
        }

        // If daily summary exists, it has overall focus score which overrides session average
        if (summary && summary.overall_focus_score !== null) {
          avgFocusScore = summary.overall_focus_score
        }

        const totalHours = Math.floor(totalFocusedMs / 3600000)
        const totalMins = Math.round((totalFocusedMs % 3600000) / 60000)
        let totalTimeStr = totalHours > 0 
          ? `${totalHours}h ${totalMins}m` 
          : `${totalMins}m`

        if (totalFocusedMs === 0 && summary) {
          // If study sessions didn't track focus time, check daily summary study seconds
          const sumStudyMin = Math.round((summary.study_seconds || 0) / 60)
          if (sumStudyMin > 0) {
            const h = Math.floor(sumStudyMin / 60)
            const m = sumStudyMin % 60
            totalTimeStr = h > 0 ? `${h}h ${m}m` : `${m}m`
          }
        }

        // Process Top Apps & Websites
        let topApps: { app_name: string; duration_minutes: number }[] = []
        let topWebsites: { domain: string; duration_minutes: number }[] = []

        if (hasActivities) {
          const appMap: Record<string, number> = {}
          const webMap: Record<string, number> = {}

          for (const act of activities) {
            if (act.activity_type === "app" && act.app_name) {
              appMap[act.app_name] = (appMap[act.app_name] || 0) + act.duration_seconds
            } else if (act.activity_type === "browser" && act.domain) {
              webMap[act.domain] = (webMap[act.domain] || 0) + act.duration_seconds
            }
          }

          topApps = Object.entries(appMap)
            .map(([app_name, dur_sec]) => ({ app_name, duration_minutes: Math.round(dur_sec / 60) }))
            .filter(a => a.duration_minutes > 0)
            .sort((a, b) => b.duration_minutes - a.duration_minutes)

          topWebsites = Object.entries(webMap)
            .map(([domain, dur_sec]) => ({ domain, duration_minutes: Math.round(dur_sec / 60) }))
            .filter(w => w.duration_minutes > 0)
            .sort((a, b) => b.duration_minutes - a.duration_minutes)
        }

        // Send the email via Resend
        const emailResult = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'FlowLock <onboarding@resend.dev>',
          to: userEmail,
          subject: `Your FlowLock Daily Report — ${userDateStr}`,
          html: generateEmailHTML({
            userName,
            totalSessions,
            totalTimeStr,
            avgFocusScore,
            totalDistractions,
            bestScore,
            sessions: studySessions || [],
            topApps,
            topWebsites,
            summary,
            dateStr: userDateStr
          })
        })

        if (emailResult.error) {
          console.error(`Email send failed for ${userEmail}:`, emailResult.error)
          results.push({ email: userEmail, status: 'error', details: emailResult.error })
        } else {
          // Update last_email_report_sent_date to prevent duplicate sends (only in auto-cron mode)
          if (!testUserId) {
            await supabase
              .from('user_preferences')
              .update({ last_email_report_sent_date: userDateStr })
              .eq('user_id', pref.user_id)
          }

          results.push({ email: userEmail, status: 'sent', date: userDateStr })
        }

      } catch (userErr: any) {
        console.error(`Error compiling daily report for user ${pref.user_id}:`, userErr)
        results.push({ user_id: pref.user_id, status: 'error', error: userErr.message })
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results })

  } catch (err: any) {
    console.error("General daily-report endpoint error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
