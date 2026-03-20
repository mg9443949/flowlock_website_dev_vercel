"use client"

import { useState, useEffect } from "react"
import { useGoogle, type CalendarEvent } from "@/hooks/use-google"

export default function CalendarPage() {
  const google = useGoogle()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  
  // Create Event State
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [desc, setDesc] = useState("")
  const [startDate, setStartDate] = useState("")
  const [startTime, setStartTime] = useState("09:00")
  const [endDate, setEndDate] = useState("")
  const [endTime, setEndTime] = useState("10:00")
  const [isCreating, setIsCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  
  // Format Date helpers
  const today = new Date().toISOString().split("T")[0]

  useEffect(() => {
    if (google.isLoggedIn) {
      loadEvents()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google.isLoggedIn])

  const loadEvents = async () => {
    setLoadingEvents(true)
    // Fetch from start of the current week (Sunday)
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    
    // Max 50 events is plenty for a typical week view
    const data = await google.fetchCalendarEvents(startOfWeek, 50)
    setEvents(data)
    setLoadingEvents(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")
    if (!title || !startDate || !startTime || !endDate || !endTime) {
      setErrorMsg("Please fill out all required fields.")
      return
    }

    const startDateTime = new Date(`${startDate}T${startTime}:00`)
    const endDateTime = new Date(`${endDate}T${endTime}:00`)

    if (endDateTime <= startDateTime) {
      setErrorMsg("End time must be after start time.")
      return
    }

    setIsCreating(true)
    const res = await google.createCalendarEvent(title, desc, startDateTime, endDateTime)
    if (res) {
      // success
      setShowForm(false)
      setTitle("")
      setDesc("")
      setStartDate("")
      setStartTime("09:00")
      setEndDate("")
      setEndTime("10:00")
      loadEvents()
    } else {
      setErrorMsg("Failed to create event. Make sure you granted Calendar write permissions.")
    }
    setIsCreating(false)
  }

  const formatEventTime = (event: CalendarEvent) => {
    if (event.start.date) return "All Day" // All-day event
    if (event.start.dateTime) {
      return new Date(event.start.dateTime).toLocaleString([], { 
        weekday: 'short', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit'
      })
    }
    return ""
  }

  if (google.isLoading) {
    return (
      <div style={{ padding: "3rem", display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "rgba(255,255,255,0.5)" }}>
        <div style={{ width: 32, height: 32, border: "3px solid rgba(255,77,77,0.2)", borderTop: "3px solid #ff4d4d", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    )
  }

  if (!google.isLoggedIn) {
    return (
      <div style={{ padding: "3rem 2rem", maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📅</div>
        <h1 style={{ fontFamily: "'Orbitron', monospace", fontSize: "2rem", marginBottom: "1rem" }}>Google Calendar Integration</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: "2.5rem", lineHeight: 1.6 }}>
          Sync your schedule directly within Flowlock. View your upcoming events, create new tasks, and manage your time without leaving the app.
        </p>
        <button
          onClick={() => google.login()}
          style={{ background: "#4285F4", color: "#fff", border: "none", borderRadius: "2rem", padding: "0.8rem 2rem", fontWeight: 600, fontSize: "1rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.75rem", transition: "transform 0.2s" }}
          onMouseOver={e => e.currentTarget.style.transform = "scale(1.05)"}
          onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          Connect Google Account
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontFamily: "'Orbitron', monospace", fontSize: "2rem", margin: 0 }}>Calendar</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", margin: "0.5rem 0 0 0" }}>Manage your schedule</p>
        </div>
        
        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ background: showForm ? "rgba(255,255,255,0.1)" : "#4285F4", color: "#fff", border: "none", borderRadius: "2rem", padding: "0.6rem 1.5rem", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            {showForm ? "Cancel" : "＋ New Event"}
          </button>
          <button
            onClick={() => google.logout()}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", borderRadius: "2rem", padding: "0.6rem 1.5rem", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer" }}
          >
            Disconnect
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "1rem", padding: "2rem", marginBottom: "2rem", animation: "slideDown 0.3s ease-out" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1.5rem", color: "#4285F4" }}>Create Event</h2>
          {errorMsg && <div style={{ color: "#ff4d4d", fontSize: "0.85rem", marginBottom: "1rem", background: "rgba(255,77,77,0.1)", padding: "0.75rem", borderRadius: "0.5rem" }}>{errorMsg}</div>}
          
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", marginBottom: "0.5rem" }}>Event Title *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required autoFocus placeholder="e.g. Project Meeting" style={inputStyle} />
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", marginBottom: "0.5rem" }}>Start Date & Time *</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="date" value={startDate} min={today} onChange={e => setStartDate(e.target.value)} required style={{ ...inputStyle, flex: 2 }} />
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required style={{ ...inputStyle, flex: 1 }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", marginBottom: "0.5rem" }}>End Date & Time *</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="date" value={endDate} min={startDate || today} onChange={e => setEndDate(e.target.value)} required style={{ ...inputStyle, flex: 2 }} />
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required style={{ ...inputStyle, flex: 1 }} />
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", marginBottom: "0.5rem" }}>Description (Optional)</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="Meeting links, notes..." style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button disabled={isCreating} type="submit" style={{ background: "#4285F4", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.75rem 2rem", fontWeight: 600, fontSize: "0.95rem", cursor: isCreating ? "wait" : "pointer", opacity: isCreating ? 0.7 : 1 }}>
                {isCreating ? "Creating..." : "Create Event"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "2rem", alignItems: "start" }}>
        {/* Left Column: Embed Visual View */}
        <div style={{ width: "100%", height: "600px", background: "rgba(255,255,255,0.02)", borderRadius: "1rem", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
          <WeeklyCalendar events={events} />
        </div>

        {/* Right Column: Upcoming List */}
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "1rem", border: "1px solid rgba(255,255,255,0.08)", padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Upcoming Events</h3>
            <button onClick={loadEvents} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }} title="Refresh">↻</button>
          </div>

          {loadingEvents ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "rgba(255,255,255,0.4)" }}>Loading...</div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "rgba(255,255,255,0.3)", fontSize: "0.9rem" }}>No upcoming events found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {events.map(event => (
                <a key={event.id} href={event.htmlLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "0.75rem", padding: "1rem", borderLeft: "4px solid #4285F4", transition: "background 0.2s" }}
                       onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                       onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}>
                    <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: "0.3rem" }}>{event.summary || "(No title)"}</div>
                    <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>{formatEventTime(event)}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

const inputStyle = {
  background: "rgba(255,255,255,0.05)", 
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "0.5rem", 
  padding: "0.8rem 1rem", 
  color: "white",
  fontSize: "0.9rem", 
  outline: "none", 
  width: "100%",
  boxSizing: "border-box" as const,
  transition: "border-color 0.2s"
}

// ─── Weekly Calendar Component ────────────────────────────────────────────────
function WeeklyCalendar({ events }: { events: CalendarEvent[] }) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const now = new Date()
  
  // Calculate the dates for the current week (Sunday to Saturday)
  const weekDates = days.map((_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() - now.getDay() + i)
    return d
  })

  // Group events into 7 arrays by matching date
  const grouped = weekDates.map(date => {
    return events.filter(ev => {
      const evDate = new Date(ev.start.dateTime || ev.start.date || "")
      if (isNaN(evDate.getTime())) return false
      return evDate.getDate() === date.getDate() && 
             evDate.getMonth() === date.getMonth() && 
             evDate.getFullYear() === date.getFullYear()
    }).sort((a, b) => {
      const tA = new Date(a.start.dateTime || a.start.date || "").getTime()
      const tB = new Date(b.start.dateTime || b.start.date || "").getTime()
      return tA - tB
    })
  })

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", height: "100%", background: "rgba(255,255,255,0.08)", gap: "1px" }}>
      {days.map((dayName, idx) => {
        const dateObj = weekDates[idx]
        const isToday = dateObj.getDate() === now.getDate() && dateObj.getMonth() === now.getMonth()
        return (
          <div key={dayName} style={{ background: "#121212", display: "flex", flexDirection: "column", padding: "1rem 0.6rem" }}>
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "0.3rem" }}>{dayName}</div>
              <div style={{ 
                fontSize: "1.1rem", 
                fontWeight: 600, 
                color: isToday ? "#fff" : "rgba(255,255,255,0.8)",
                background: isToday ? "#4285F4" : "transparent",
                width: "32px", height: "32px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", margin: "0 auto"
              }}>
                {dateObj.getDate()}
              </div>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", overflowY: "auto", flex: 1, paddingRight: "0.25rem" }}>
              {grouped[idx].map(ev => {
                const isAllDay = !ev.start.dateTime
                return (
                  <a key={ev.id} href={ev.htmlLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                    <div 
                      style={{ 
                        background: isAllDay ? "rgba(66, 133, 244, 0.15)" : "transparent",
                        border: isAllDay ? "none" : "1px solid rgba(255,255,255,0.1)",
                        borderLeft: isAllDay ? "3px solid #4285F4" : "2px solid #4285F4",
                        borderRadius: "0.3rem", 
                        padding: "0.5rem", 
                        fontSize: "0.75rem",
                        transition: "all 0.2s",
                      }}
                      onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(66, 133, 244, 0.15)" }}
                      onMouseOut={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none" }}
                    >
                      <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: isAllDay ? 0 : "0.25rem", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {ev.summary || "(No Title)"}
                      </div>
                      {!isAllDay && (
                        <div style={{ color: "rgba(255,255,255,0.5)", fontWeight: 500, fontSize: "0.7rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {new Date(ev.start.dateTime as string).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

