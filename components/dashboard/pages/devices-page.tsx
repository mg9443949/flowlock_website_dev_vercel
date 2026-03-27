"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/providers/auth-provider"
import { supabase } from "@/utils/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Monitor, Smartphone, Globe, Plus, Trash2, Clock, Activity, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface DeviceSession {
    id: string
    device_type: string
    device_id: string
    started_at: string
    status: string
    focus_score: number | null
}

interface ActivityLog {
    id: string
    activity_type: string
    app_name: string
    window_title: string | null
    domain: string | null
    start_time: string
    duration_seconds: number
    classification: string
}

interface ProductivityRule {
    id: string
    rule_type: string
    match_string: string
    classification: string
}

export function DevicesPage() {
    const { user } = useAuth()

    const [sessions, setSessions] = useState<DeviceSession[]>([])
    const [activities, setActivities] = useState<ActivityLog[]>([])
    const [rules, setRules] = useState<ProductivityRule[]>([])

    // Rule form state
    const [newRuleType, setNewRuleType] = useState('app')
    const [newMatchString, setNewMatchString] = useState('')
    const [newClassification, setNewClassification] = useState('study')
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!user) return

        const fetchData = async () => {
            setIsLoading(true)

            // Fetch Sessions — active sessions float to top, then sorted by time
            const { data: sessionData } = await supabase
                .from('device_sessions')
                .select('*')
                .eq('user_id', user.id)
                .order('started_at', { ascending: false })
                .limit(20)

            if (sessionData) {
                // Sort: active first, then completed; within each group sort by time desc
                const sorted = [...sessionData].sort((a, b) => {
                    if (a.status === b.status) return 0
                    return a.status === 'active' ? -1 : 1
                })
                setSessions(sorted)
            }

            // Fetch Activities
            const { data: activityData } = await supabase
                .from('activity_logs')
                .select('*')
                .eq('user_id', user.id)
                .order('start_time', { ascending: false })
                .limit(50)

            if (activityData) setActivities(activityData)

            // Fetch Rules
            const { data: rulesData } = await supabase
                .from('productivity_rules')
                .select('*')
                .eq('user_id', user.id)
                .order('rule_type', { ascending: true })

            if (rulesData) setRules(rulesData)

            setIsLoading(false)
        }

        fetchData()

        // Realtime Subscriptions
        const channels = supabase.channel('custom-all-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'device_sessions', filter: `user_id=eq.${user.id}` },
                (payload) => {
                    fetchData() // Simple refresh on any session change
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `user_id=eq.${user.id}` },
                (payload) => {
                    const newLog = payload.new as ActivityLog
                    setActivities(prev => [newLog, ...prev.slice(0, 49)])
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channels)
        }
    }, [user])


    const handleAddRule = async () => {
        if (!user || !newMatchString.trim()) return

        const { error } = await supabase
            .from('productivity_rules')
            .insert({
                user_id: user.id,
                rule_type: newRuleType,
                match_string: newMatchString.trim().toLowerCase(),
                classification: newClassification
            })

        if (error) {
            toast.error("Failed to add rule.")
            console.error(error)
        } else {
            toast.success("Rule added successfully.")
            setNewMatchString('')
            // Optimistic reload
            const { data } = await supabase.from('productivity_rules').select('*').eq('user_id', user.id)
            if (data) setRules(data)
        }
    }

    const handleDeleteRule = async (id: string) => {
        const { error } = await supabase.from('productivity_rules').delete().eq('id', id)
        if (error) {
            toast.error("Failed to delete rule.")
        } else {
            setRules(rules.filter(r => r.id !== id))
            toast.success("Rule deleted.")
        }
    }

    const getDeviceIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case 'windows': return <Monitor className="h-5 w-5 text-blue-500" />
            case 'android': return <Smartphone className="h-5 w-5 text-green-500" />
            case 'chrome': return <Globe className="h-5 w-5 text-yellow-500" />
            default: return <Monitor className="h-5 w-5 text-gray-500" />
        }
    }

    const getClassificationBadge = (classification: string) => {
        switch (classification.toLowerCase()) {
            case 'study': return <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">Study</Badge>
            case 'distraction': return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20">Distraction</Badge>
            case 'idle': return <Badge className="bg-gray-500/10 text-gray-500 hover:bg-gray-500/20">Idle</Badge>
            default: return <Badge variant="outline" className="text-muted-foreground">Neutral</Badge>
        }
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold tracking-tight">Devices & Apps</h2>
                <p className="text-muted-foreground">
                    Monitor your cross-platform activity and customize website/application tracking classifications.
                </p>
            </div>

            <Tabs defaultValue="activity" className="space-y-6">
                <TabsList className="grid w-full md:w-[400px] grid-cols-2">
                    <TabsTrigger value="activity">Live Tracking</TabsTrigger>
                    <TabsTrigger value="rules">Productivity Rules</TabsTrigger>
                </TabsList>

                {/* ACTIVITY & SESSIONS TAB */}
                <TabsContent value="activity" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Device Sessions List */}
                        <Card className="md:col-span-1 shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-primary" />
                                    Active Devices
                                </CardTitle>
                                <CardDescription>Background clients tracking data globally.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <p className="text-sm text-center text-muted-foreground py-4">Loading sessions...</p>
                                ) : sessions.length === 0 ? (
                                    <p className="text-sm text-center text-muted-foreground py-4">No active connection found. Install a client extension or app.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {sessions.map((s) => (
                                            <div key={s.id} className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-card">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        {getDeviceIcon(s.device_type)}
                                                        <span className="font-semibold text-sm capitalize">{s.device_type}</span>
                                                    </div>
                                                    <Badge variant={s.status === 'active' ? "default" : "secondary"}>
                                                        {s.status}
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground flex justify-between">
                                                    <span>{s.device_id}</span>
                                                    <span>{new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Recent Activity Log */}
                        <Card className="md:col-span-2 shadow-sm border-border">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-primary" />
                                    Recent Activity Feed
                                </CardTitle>
                                <CardDescription>Real-time stream of apps and websites from your devices.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[500px] pr-4">
                                    {isLoading ? (
                                        <p className="text-sm text-center text-muted-foreground py-10">Loading activities...</p>
                                    ) : activities.length === 0 ? (
                                        <p className="text-sm text-center text-muted-foreground py-10">Waiting for tracking data...</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {activities.map((act) => (
                                                <div key={act.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="flex-shrink-0">
                                                            {act.activity_type === 'browser' ? (
                                                                <Globe className="h-8 w-8 p-1.5 rounded-md bg-yellow-500/10 text-yellow-600" />
                                                            ) : (
                                                                <Monitor className="h-8 w-8 p-1.5 rounded-md bg-blue-500/10 text-blue-600" />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col overflow-hidden text-ellipsis whitespace-nowrap min-w-0 pr-4">
                                                            <span className="font-medium text-sm truncate">
                                                                {act.activity_type === 'browser' ? act.domain || 'URL' : act.app_name || 'App'}
                                                            </span>
                                                            {act.window_title && (
                                                                <span className="text-xs text-muted-foreground truncate">{act.window_title}</span>
                                                            )}
                                                            <span className="text-[10px] text-muted-foreground mt-0.5">
                                                                {new Date(act.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                                {' • '}{act.duration_seconds}s
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex-shrink-0 ml-2">
                                                        {getClassificationBadge(act.classification)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* PRODUCTIVITY RULES TAB */}
                <TabsContent value="rules" className="space-y-6">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings2 className="h-5 w-5 text-primary" />
                                Custom Categorization
                            </CardTitle>
                            <CardDescription>
                                Tell the tracker what constitutes distraction or study for you personally. The desktop and Chrome apps sync these periodically.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            {/* Add New Rule */}
                            <div className="flex flex-col md:flex-row gap-3 items-end p-4 rounded-lg bg-muted/40 border border-border">
                                <div className="space-y-1 w-full md:w-auto flex-1">
                                    <label className="text-xs font-medium px-1">Type</label>
                                    <Select value={newRuleType} onValueChange={setNewRuleType}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="app">Desktop App</SelectItem>
                                            <SelectItem value="domain">Website Domain</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1 w-full md:w-auto flex-[2]">
                                    <label className="text-xs font-medium px-1">Keywords / Match String</label>
                                    <Input
                                        placeholder="e.g. youtube.com or spotify"
                                        value={newMatchString}
                                        onChange={(e) => setNewMatchString(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1 w-full md:w-auto flex-1">
                                    <label className="text-xs font-medium px-1">Category</label>
                                    <Select value={newClassification} onValueChange={setNewClassification}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Classification" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="study">Study</SelectItem>
                                            <SelectItem value="distraction">Distraction</SelectItem>
                                            <SelectItem value="neutral">Neutral</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button onClick={handleAddRule} className="w-full md:w-auto h-10 gap-1.5" disabled={!newMatchString}>
                                    <Plus size={16} />
                                    Save Rule
                                </Button>
                            </div>

                            {/* Existing Rules List */}
                            <div className="rounded-md border border-border overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 border-b border-border text-left">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Match String</th>
                                            <th className="px-4 py-3 font-medium">Match Type</th>
                                            <th className="px-4 py-3 font-medium">Override Category</th>
                                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border bg-card">
                                        {rules.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-sm">
                                                    No custom productivity rules defined.
                                                </td>
                                            </tr>
                                        ) : rules.map((rule) => (
                                            <tr key={rule.id} className="hover:bg-muted/20">
                                                <td className="px-4 py-3 font-medium">{rule.match_string}</td>
                                                <td className="px-4 py-3 text-muted-foreground capitalize">{rule.rule_type}</td>
                                                <td className="px-4 py-3">{getClassificationBadge(rule.classification)}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8 p-0 px-2"
                                                        onClick={() => handleDeleteRule(rule.id)}
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
