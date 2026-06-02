"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, Lock, User, Palette, Shield, Mail } from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { supabase } from "@/utils/supabase/client"

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { user, updateProfile } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [fullName, setFullName] = useState(user?.name || "")
  const [email, setEmail] = useState(user?.email || "")
  const [role, setRole] = useState("Student")
  const [isSaving, setIsSaving] = useState(false)
  const [emailReports, setEmailReports] = useState(true)
  const [savingPref, setSavingPref] = useState(false)

  useEffect(() => {
    const fetchPrefs = async () => {
      if (!user?.id) return
      const { data } = await supabase
        .from('user_preferences')
        .select('email_reports_enabled')
        .eq('user_id', user.id)
        .single()
      if (data) setEmailReports(data.email_reports_enabled)
    }
    fetchPrefs()
  }, [user?.id])

  const toggleEmailReports = async (enabled: boolean) => {
    if (!user?.id) return
    setSavingPref(true)
    setEmailReports(enabled)
    
    await supabase
      .from('user_preferences')
      .upsert({ 
        user_id: user.id, 
        email_reports_enabled: enabled,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
    
    setSavingPref(false)
    toast.success(enabled 
      ? 'Daily reports enabled!' 
      : 'Daily reports disabled'
    )
  }

  const [notifications, setNotifications] = useState({
    sessionReminder: true,
    breakAlert: true,
    motivational: false,
  })

  useEffect(() => {
    setMounted(true)
    if (user) {
      setFullName(user.name)
      setEmail(user.email)
    }

    // Load actual notification prefs
    setNotifications({
      sessionReminder: localStorage.getItem("pref_session_reminders") !== "false",
      breakAlert: localStorage.getItem("pref_break_alerts") !== "false",
      motivational: localStorage.getItem("pref_motivational_messages") === "true",
    })

  }, [user])

  const handleSaveProfile = () => {
    setIsSaving(true)
    updateProfile({ name: fullName, email })
    setTimeout(() => setIsSaving(false), 500) // visual feedback
  }

  const handleNotificationChange = (id: string, checked: boolean) => {
    const newNotifs = { ...notifications, [id]: checked }
    setNotifications(newNotifs)

    if (id === "sessionReminder") {
      localStorage.setItem("pref_session_reminders", String(checked))
    } else if (id === "breakAlert") {
      localStorage.setItem("pref_break_alerts", String(checked))
    } else if (id === "motivational") {
      localStorage.setItem("pref_motivational_messages", String(checked))
    }
  }

  const isDark = mounted ? theme === "dark" : true

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings & Preferences</h1>
        <p className="text-muted-foreground">Customize your FlowLock experience</p>
      </div>

      {/* Profile Settings */}
      <Card className="bg-card border-border">
        <CardHeader className="flex items-center gap-2">
          <User size={20} className="text-primary" />
          <CardTitle>Profile Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Full Name</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                type="email"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground mt-1"
              >
                <option>Student</option>
                <option>Teacher</option>
                <option>Admin</option>
              </select>
            </div>
          </div>
          <Button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="bg-primary hover:bg-primary/90"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card className="bg-card border-border">
        <CardHeader className="flex items-center gap-2">
          <Lock size={20} className="text-primary" />
          <CardTitle>Security Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Current Password</label>
            <Input placeholder="••••••••" type="password" className="mt-1" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">New Password</label>
              <Input placeholder="••••••••" type="password" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Confirm Password</label>
              <Input placeholder="••••••••" type="password" className="mt-1" />
            </div>
          </div>
          <Button className="bg-primary hover:bg-primary/90">Change Password</Button>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card className="bg-card border-border">
        <CardHeader className="flex items-center gap-2">
          <Shield size={20} className="text-primary" />
          <CardTitle>Two-Factor Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add an extra layer of security to your account by enabling two-factor authentication.
          </p>
          <Button className="bg-primary hover:bg-primary/90">Enable 2FA</Button>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="bg-card border-border">
        <CardHeader className="flex items-center gap-2">
          <Bell size={20} className="text-primary" />
          <CardTitle>Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              id: "sessionReminder",
              label: "Session Start Reminders",
              desc: "Get notified when your study session starts",
            },
            { id: "breakAlert", label: "Break Time Alerts", desc: "Receive alerts when it's time for a break" },
            {
              id: "motivational",
              label: "Motivational Messages",
              desc: "Receive encouraging messages throughout the day",
            },
          ].map((item) => (
            <label key={item.id} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifications[item.id as keyof typeof notifications]}
                onChange={(e) => handleNotificationChange(item.id, e.target.checked)}
                className="w-4 h-4"
              />
              <div>
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Email Preferences */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Mail size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">
            Email Preferences
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Manage your daily productivity report emails
        </p>
        
        <div className="flex items-center justify-between py-4 border-b border-border">
          <div>
            <p className="font-medium">Daily Productivity Report</p>
            <p className="text-sm text-muted-foreground mt-1">
              Receive a summary of your focus sessions every evening at 11:30 PM
            </p>
          </div>
          <Switch
            checked={emailReports}
            onCheckedChange={toggleEmailReports}
            disabled={savingPref}
          />
        </div>

        <div className="pt-4">
          <p className="text-xs text-muted-foreground">
            Reports include: total focus time, average score, distraction count, and a full session breakdown. Sent to: {user?.email}
          </p>
          
          <button
            onClick={async () => {
              const { data: { session } } = await supabase.auth.getSession()
              const res = await fetch(
                `/api/send-daily-report?test_user_id=${user?.id}`,
                {
                  headers: {
                    Authorization: `Bearer ${session?.access_token || ''}`
                  }
                }
              )
              const data = await res.json()
              if (data.success && data.processed > 0) {
                toast.success('Test report sent! Check your email.')
              } else {
                toast.error(data.error || 'No sessions today to report.')
              }
            }}
            className="text-xs text-muted-foreground underline mt-2 block"
          >
            Send test report to {user?.email}
          </button>
        </div>
      </div>

      {/* Theme Settings */}
      <Card className="bg-card border-border">
        <CardHeader className="flex items-center gap-2">
          <Palette size={20} className="text-primary" />
          <CardTitle>Theme Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark Mode</p>
              <p className="text-sm text-muted-foreground">Reduce eye strain with dark theme</p>
            </div>
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className={`relative w-12 h-6 rounded-full transition-colors ${isDark ? "bg-primary" : "bg-muted"}`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isDark ? "translate-x-6" : ""
                  }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>
    </div >
  )
}
