"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye, Play, Square, RotateCcw, AlertTriangle, CheckCircle2, Download, Mic, Volume2, ChevronDown, ChevronUp } from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import Script from "next/script"
import type { FaceLandmarker as FaceLandmarkerType } from "@mediapipe/tasks-vision"
import { useNoiseDetector } from "@/hooks/use-noise-detector"
import { useAuth } from "@/components/providers/auth-provider"
import { useFocus } from "@/components/providers/focus-provider"
import { supabase } from "@/utils/supabase/client"
import { toast } from "sonner"
import { useFaceAuth } from "@/hooks/use-face-auth"

// Session result data passed to parent
export interface FocusSessionResult {
    score: number
    duration: number
    drowsyCount: number
    headTurnedCount: number
    faceMissingCount: number
    unauthorizedCount: number
    highNoiseCount: number
    focusedTime: number
    drowsyTime: number
    headTurnedTime: number
    faceMissingTime: number
    unauthorizedTime: number
}

interface FocusTrackerProps {
    onSessionComplete?: (result: FocusSessionResult) => void
    visible?: boolean
}

// Detection configuration
const CONFIG = {
    EAR_THRESHOLD: 0.20,
    HEAD_YAW_THRESHOLD: 25,
    BUFFER_TIME: 1000,
}

type DetectionStatus = "FOCUSED" | "DROWSY" | "HEAD_TURNED" | "FACE_MISSING" | "UNAUTHORIZED"
type Phase = "ready" | "enroll" | "active" | "results"

export function FocusTracker({ onSessionComplete, visible = true }: FocusTrackerProps) {
    const [phase, setPhase] = useState<Phase>("ready")
    const [chartLoaded, setChartLoaded] = useState(false)
    const [statusText, setStatusText] = useState("System Ready")
    const [statusType, setStatusType] = useState<"focused" | "warning" | "neutral">("neutral")
    const [metrics, setMetrics] = useState({
        status: "Focused",
        doze: "0.0s",
        face: "0.0s",
        head: "0.0s",
        unauth: "0.0s",
        ear: "0.00",
        yaw: "0°",
        duration: "00:00",
    })
    const [result, setResult] = useState<FocusSessionResult | null>(null)

    const [noiseExpanded, setNoiseExpanded] = useState(true)

    // Noise detection hook
    const { noiseState, startNoise, stopNoise, setAlertCallback } = useNoiseDetector()
    const { user } = useAuth()
    const { startFocusSession, stopFocusSession, setFocusElapsed, isFocusActive } = useFocus()
    const {
        loadModels,
        isModelsLoaded,
        isEnrolled,
        checkEnrollmentStatus,
        enrollFace,
        authenticateFace,
        resetFaceData,
    } = useFaceAuth()

    // Refs for mutable state that persists across frames
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const chartCanvasRef = useRef<HTMLCanvasElement>(null)
    const modelRef = useRef<FaceLandmarkerType | null>(null)
    const animationIdRef = useRef<number | null>(null)
    const isRunningRef = useRef(false)
    const startTimeRef = useRef(0)
    const lastFrameTimeRef = useRef(0)
    const timersRef = useRef({ drowsy: 0, faceMissing: 0, headTurned: 0, unauthorized: 0 })
    const statsRef = useRef({ drowsyCount: 0, faceMissingCount: 0, headTurnedCount: 0, unauthorizedCount: 0 })
    const historyRef = useRef<Array<{ type: string; start: boolean; time: number }>>([])
    const currentStatusRef = useRef<DetectionStatus>("FOCUSED")
    const chartInstanceRef = useRef<any>(null)
    const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const authIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const isUnauthorizedRef = useRef<boolean>(false)
    const processDetectionRef = useRef<(faceLandmarks: any[], ctx: CanvasRenderingContext2D) => void>(() => { })
    const authenticateFaceRef = useRef(authenticateFace)

    // Register noise alert callback
    useEffect(() => {
        setAlertCallback(() => {
            toast.warning("🚨 High Noise Detected!", {
                duration: 4000,
                position: "top-right",
            })
        })
    }, [setAlertCallback])

    // Detect already-loaded Chart.js script (e.g. after SPA navigation)
    useEffect(() => {
        if (typeof (window as any).Chart === "function") setChartLoaded(true)

        // Load face-api models and check enrollment status (in-browser)
        loadModels()
        checkEnrollmentStatus()
    }, [])

    // EAR calculation
    // EAR — works with normalized landmarks (ratio is scale-invariant)
    const calculateEAR = useCallback((landmarks: any[], indices: number[]) => {
        const p = indices.map(i => landmarks[i])
        const v1 = Math.hypot(p[1].x - p[5].x, p[1].y - p[5].y)
        const v2 = Math.hypot(p[2].x - p[4].x, p[2].y - p[4].y)
        const h = Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y)
        return (v1 + v2) / (2.0 * h)
    }, [])

    // Format milliseconds to mm:ss
    const formatTime = useCallback((ms: number) => {
        const seconds = Math.floor((ms / 1000) % 60)
        const minutes = Math.floor((ms / (1000 * 60)) % 60)
        return `${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
    }, [])

    // Update status banner
    const updateStatusUI = useCallback((message: string, type: "focused" | "warning" | "neutral") => {
        setStatusText(message)
        setStatusType(type)
        setMetrics((prev) => ({ ...prev, status: message }))
    }, [])

    // Update detection status with event tracking
    const updateDetectionStatus = useCallback(
        (newStatus: DetectionStatus) => {
            if (currentStatusRef.current === newStatus) return
            const now = Date.now()

            if (currentStatusRef.current !== "FOCUSED") {
                historyRef.current.push({ type: currentStatusRef.current, start: false, time: now })
            }
            if (newStatus !== "FOCUSED") {
                historyRef.current.push({ type: newStatus, start: true, time: now })
                if (newStatus === "DROWSY") statsRef.current.drowsyCount++
                if (newStatus === "HEAD_TURNED") statsRef.current.headTurnedCount++
                if (newStatus === "FACE_MISSING") statsRef.current.faceMissingCount++
                if (newStatus === "UNAUTHORIZED") statsRef.current.unauthorizedCount++
            }

            currentStatusRef.current = newStatus

            if (newStatus === "FOCUSED") {
                updateStatusUI("✓ Focused", "focused")
            } else if (newStatus === "DROWSY") {
                updateStatusUI("⚠ Distraction: Drowsiness", "warning")
            } else if (newStatus === "HEAD_TURNED") {
                updateStatusUI("⚠ Distraction: Head Turned Away", "warning")
            } else if (newStatus === "FACE_MISSING") {
                updateStatusUI("⚠ Distraction: Face Not In Frame", "warning")
            } else if (newStatus === "UNAUTHORIZED") {
                updateStatusUI("🚨 ALERT: Unauthorized User Detected", "warning")
            }
        },
        [updateStatusUI]
    )

    // Draw face mesh overlay — landmarks have normalized coords (0-1)
    const drawMesh = useCallback((landmarks: any[], ctx: CanvasRenderingContext2D) => {
        if (!landmarks || !canvasRef.current) return
        const w = canvasRef.current.width
        const h = canvasRef.current.height
        ctx.fillStyle = "#10b981"
        for (let i = 0; i < landmarks.length; i += 10) {
            ctx.fillRect(landmarks[i].x * w, landmarks[i].y * h, 2, 2)
        }
        ctx.fillStyle = "cyan"
            ;[33, 133, 362, 263].forEach((idx) => {
                ctx.fillRect(landmarks[idx].x * w, landmarks[idx].y * h, 4, 4)
            })
        ctx.fillStyle = "red"
        ctx.fillRect(landmarks[1].x * w, landmarks[1].y * h, 5, 5)
    }, [])

    // Process each detection frame — faceLandmarks from MediaPipe
    const processDetection = useCallback(
        (faceLandmarks: any[], ctx: CanvasRenderingContext2D) => {
            const now = Date.now()
            const delta = now - lastFrameTimeRef.current
            lastFrameTimeRef.current = now

            if (isUnauthorizedRef.current) {
                timersRef.current.unauthorized += delta
                updateDetectionStatus("UNAUTHORIZED")
                setMetrics((prev) => ({
                    ...prev,
                    ear: "0.00",
                    yaw: "0°",
                    unauth: (timersRef.current.unauthorized / 1000).toFixed(1) + "s",
                    doze: (timersRef.current.drowsy / 1000).toFixed(1) + "s",
                    face: (timersRef.current.faceMissing / 1000).toFixed(1) + "s",
                    head: (timersRef.current.headTurned / 1000).toFixed(1) + "s",
                }))
                return
            } else {
                timersRef.current.unauthorized = 0
            }

            // No face detected
            if (!faceLandmarks || faceLandmarks.length === 0) {
                timersRef.current.faceMissing += delta

                if (timersRef.current.faceMissing > CONFIG.BUFFER_TIME) {
                    updateDetectionStatus("FACE_MISSING")
                }

                setMetrics((prev) => ({
                    ...prev,
                    ear: "0.00",
                    yaw: "0°",
                    doze: (timersRef.current.drowsy / 1000).toFixed(1) + "s",
                    face: (timersRef.current.faceMissing / 1000).toFixed(1) + "s",
                    head: (timersRef.current.headTurned / 1000).toFixed(1) + "s",
                }))
                return
            }

            // Face detected → reset faceMissing immediately
            timersRef.current.faceMissing = 0
            const landmarks = faceLandmarks[0] // first face's landmarks array

            // EAR — normalized coords, ratio is scale-invariant
            const leftEAR = calculateEAR(landmarks, [33, 160, 158, 133, 153, 144])
            const rightEAR = calculateEAR(landmarks, [362, 385, 387, 263, 373, 380])
            const avgEAR = (leftEAR + rightEAR) / 2

            // Yaw — normalized coords (width cancels out)
            const nose = landmarks[1]
            const midX = (landmarks[33].x + landmarks[263].x) / 2
            const yaw = (nose.x - midX) * 100 * 1.5

            // Update timers — immediate reset when condition clears
            if (avgEAR < CONFIG.EAR_THRESHOLD) {
                timersRef.current.drowsy += delta
            } else {
                timersRef.current.drowsy = 0
            }

            if (Math.abs(yaw) > CONFIG.HEAD_YAW_THRESHOLD) {
                timersRef.current.headTurned += delta
            } else {
                timersRef.current.headTurned = 0
            }

            // Determine status
            if (timersRef.current.drowsy > CONFIG.BUFFER_TIME) {
                updateDetectionStatus("DROWSY")
            } else if (timersRef.current.headTurned > CONFIG.BUFFER_TIME) {
                updateDetectionStatus("HEAD_TURNED")
            } else {
                updateDetectionStatus("FOCUSED")
            }

            setMetrics((prev) => ({
                ...prev,
                ear: avgEAR.toFixed(2),
                yaw: Math.round(yaw) + "°",
                doze: (timersRef.current.drowsy / 1000).toFixed(1) + "s",
                face: (timersRef.current.faceMissing / 1000).toFixed(1) + "s",
                head: (timersRef.current.headTurned / 1000).toFixed(1) + "s",
                unauth: (timersRef.current.unauthorized / 1000).toFixed(1) + "s",
            }))
        },
        [calculateEAR, drawMesh, updateDetectionStatus]
    )

    // Keep the ref always pointing to the latest processDetection
    useEffect(() => {
        processDetectionRef.current = processDetection
    }, [processDetection])

    // Keep the ref always pointing to the latest authenticateFace
    useEffect(() => {
        authenticateFaceRef.current = authenticateFace
    }, [authenticateFace])

    // Detection loop — uses detectForVideo (synchronous) and ref for latest processDetection
    const detectLoop = useCallback(() => {
        if (!isRunningRef.current || !videoRef.current || !canvasRef.current || !modelRef.current) return

        const ctx = canvasRef.current.getContext("2d")
        if (!ctx) return

        try {
            const results = modelRef.current.detectForVideo(videoRef.current, performance.now())

            if (!canvasRef.current) return
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
            ctx.save()
            ctx.scale(-1, 1)
            ctx.translate(-canvasRef.current.width, 0)

            processDetectionRef.current(results.faceLandmarks, ctx)

            ctx.restore()
        } catch (e) {
            console.error("Detection frame error:", e)
        }

        animationIdRef.current = requestAnimationFrame(detectLoop)
    }, [])

    // Setup camera
    const setupCamera = useCallback(async () => {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: "user" },
            audio: false,
        })
        if (videoRef.current) {
            videoRef.current.srcObject = stream
            return new Promise<void>((resolve) => {
                videoRef.current!.onloadedmetadata = () => resolve()
            })
        }
    }, [])

    const handleEnroll = async () => {
        setPhase("enroll")
        updateStatusUI("Loading models & camera...", "neutral")
        await loadModels()
        await setupCamera()
        updateStatusUI("Ready — click Capture Face", "neutral")
    }

    const captureAndEnroll = async () => {
        if (!videoRef.current) return

        try {
            updateStatusUI("Enrolling face...", "neutral")
            const result = await enrollFace(videoRef.current)
            if (result.success) {
                setPhase("ready")
                updateStatusUI("System Ready", "neutral")
                toast.success("Face registered successfully!")

                if (videoRef.current?.srcObject) {
                    const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
                    tracks.forEach(track => track.stop())
                    videoRef.current.srcObject = null
                }
            } else {
                updateStatusUI("Error: " + result.message, "warning")
            }
        } catch (e: any) {
            updateStatusUI("Error: " + e.message, "warning")
        }
    }

    // Start session
    const handleStart = useCallback(async () => {
        try {
            setPhase("active")

            // Reset state
            timersRef.current = { drowsy: 0, faceMissing: 0, headTurned: 0, unauthorized: 0 }
            statsRef.current = { drowsyCount: 0, faceMissingCount: 0, headTurnedCount: 0, unauthorizedCount: 0 }
            historyRef.current = []
            currentStatusRef.current = "FOCUSED"
            isUnauthorizedRef.current = false
            lastFrameTimeRef.current = Date.now()

            if (videoRef.current) {
                videoRef.current.width = 640
                videoRef.current.height = 480
            }
            if (canvasRef.current) {
                canvasRef.current.width = 640
                canvasRef.current.height = 480
            }

            updateStatusUI("Requesting Camera...", "neutral")
            await setupCamera()

            // Load MediaPipe FaceLandmarker model with GPU delegate
            if (!modelRef.current) {
                updateStatusUI("Loading AI Model... (This may take a moment)", "neutral")
                const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision")
                const filesetResolver = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
                )
                modelRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                        delegate: "CPU"
                    },
                    runningMode: "VIDEO",
                    numFaces: 1,
                })
            }

            // Load face-api models for background authentication
            await loadModels()

            isRunningRef.current = true
            startTimeRef.current = Date.now()
            updateStatusUI("✓ Focused", "focused")

            // Signal to provider that session is active
            startFocusSession()

            // Start noise detection
            startNoise()

            // Duration ticker
            durationIntervalRef.current = setInterval(() => {
                const elapsed = Date.now() - startTimeRef.current
                const elapsedSec = Math.floor(elapsed / 1000)
                setFocusElapsed(elapsedSec)
                setMetrics((prev) => ({
                    ...prev,
                    duration: `${Math.floor(elapsed / 60000)
                        .toString()
                        .padStart(2, "0")}:${Math.floor((elapsed / 1000) % 60)
                            .toString()
                            .padStart(2, "0")}`,
                }))
            }, 1000)

            // Background auth interval (in-browser using face-api)
            authIntervalRef.current = setInterval(async () => {
                if (!videoRef.current || !isRunningRef.current) return
                try {
                    const result = await authenticateFaceRef.current(videoRef.current)
                    if (!result.authenticated && result.message !== "No face detected" && result.message !== "No enrolled face found" && result.message !== "Models not loaded") {
                        isUnauthorizedRef.current = true
                    } else if (result.authenticated) {
                        isUnauthorizedRef.current = false
                    }
                } catch (e) {
                    console.error("Auth error:", e)
                }
            }, 5000)

            detectLoop()
        } catch (error: any) {
            console.error(error)
            updateStatusUI("Error: " + error.message, "warning")
        }
    }, [setupCamera, detectLoop, updateStatusUI])

    // Stop session
    const handleStop = useCallback(async () => {
        isRunningRef.current = false
        if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current)
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
        if (authIntervalRef.current) clearInterval(authIntervalRef.current)

        // Stop noise detection
        stopNoise()

        // Stop camera
        if (videoRef.current?.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
            tracks.forEach((track) => track.stop())
            videoRef.current.srcObject = null
        }

        // Calculate results
        const now = Date.now()
        const totalDuration = now - startTimeRef.current

        let drowsyDuration = 0
        let headDuration = 0
        let faceDuration = 0
        let unauthorizedDuration = 0
        let lastEvent: any = null

        historyRef.current.forEach((e) => {
            if (e.start) {
                lastEvent = e
            } else if (lastEvent && lastEvent.type === e.type) {
                const dur = e.time - lastEvent.time
                if (e.type === "DROWSY") drowsyDuration += dur
                if (e.type === "HEAD_TURNED") headDuration += dur
                if (e.type === "FACE_MISSING") faceDuration += dur
                if (e.type === "UNAUTHORIZED") unauthorizedDuration += dur
                lastEvent = null
            }
        })

        if (lastEvent) {
            const dur = now - lastEvent.time
            if (lastEvent.type === "DROWSY") drowsyDuration += dur
            if (lastEvent.type === "HEAD_TURNED") headDuration += dur
            if (lastEvent.type === "FACE_MISSING") faceDuration += dur
            if (lastEvent.type === "UNAUTHORIZED") unauthorizedDuration += dur
        }

        const distractedTime = drowsyDuration + headDuration + faceDuration + unauthorizedDuration
        const focusedTime = Math.max(0, totalDuration - distractedTime)
        const score = Math.round((focusedTime / totalDuration) * 100) || 0

        const sessionResult: FocusSessionResult = {
            score,
            duration: totalDuration,
            drowsyCount: statsRef.current.drowsyCount,
            headTurnedCount: statsRef.current.headTurnedCount,
            faceMissingCount: statsRef.current.faceMissingCount,
            unauthorizedCount: statsRef.current.unauthorizedCount,
            highNoiseCount: noiseState.highNoiseCount,
            focusedTime,
            drowsyTime: drowsyDuration,
            headTurnedTime: headDuration,
            faceMissingTime: faceDuration,
            unauthorizedTime: unauthorizedDuration,
        }

        // Persist session to Supabase (with validation to prevent bogus data)
        const MAX_SESSION_MS = 24 * 60 * 60 * 1000 // 24 hours max
        if (user?.id && startTimeRef.current > 0 && totalDuration > 0 && totalDuration < MAX_SESSION_MS) {
            const startedAt = new Date(startTimeRef.current).toISOString()
            const endedAt = new Date(now).toISOString()
            const { error } = await supabase.from("study_sessions").insert({
                user_id: user.id,
                started_at: startedAt,
                ended_at: endedAt,
                duration_ms: totalDuration,
                focus_score: score,
                focused_time_ms: focusedTime,
                drowsy_count: statsRef.current.drowsyCount,
                drowsy_time_ms: drowsyDuration,
                head_turned_count: statsRef.current.headTurnedCount,
                head_turned_time_ms: headDuration,
                face_missing_count: statsRef.current.faceMissingCount,
                face_missing_time_ms: faceDuration,
                unauthorized_count: statsRef.current.unauthorizedCount,
                unauthorized_time_ms: unauthorizedDuration,
                high_noise_count: noiseState.highNoiseCount,
            })
            if (error) console.error("Failed to save session to Supabase:", error)
        }

        setResult(sessionResult)
        setPhase("results")

        // Signal to provider that session ended
        stopFocusSession()

        if (onSessionComplete) {
            onSessionComplete(sessionResult)
        }
    }, [onSessionComplete])

    // Render chart when results phase is entered
    useEffect(() => {
        if (phase === "results" && result && chartCanvasRef.current) {
            const Chart = (window as any).Chart
            if (!Chart) return

            if (chartInstanceRef.current) chartInstanceRef.current.destroy()

            const ctx = chartCanvasRef.current.getContext("2d")
            chartInstanceRef.current = new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: ["Focused", "Drowsy", "Head Turned", "Missing", "Unauthorized"],
                    datasets: [
                        {
                            data: [result.focusedTime, result.drowsyTime, result.headTurnedTime, result.faceMissingTime, result.unauthorizedTime],
                            backgroundColor: ["#10b981", "#f59e0b", "#ef4444", "#6b7280", "#a855f7"],
                        },
                    ],
                },
                options: {
                    responsive: true,
                    plugins: { legend: { position: "bottom" } },
                },
            })
        }
    }, [phase, result])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isRunningRef.current = false
            if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current)
            if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
            if (authIntervalRef.current) clearInterval(authIntervalRef.current)
            stopNoise()
            if (videoRef.current?.srcObject) {
                const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
                tracks.forEach((track) => track.stop())
            }
            if (chartInstanceRef.current) chartInstanceRef.current.destroy()
        }
    }, [])

    // External stop detection — when the mini bar's Stop button is pressed,
    // isFocusActive becomes false; this triggers the actual session stop.
    const handleStopRef = useRef(handleStop)
    useEffect(() => { handleStopRef.current = handleStop }, [handleStop])
    useEffect(() => {
        if (!isFocusActive && phase === "active") {
            handleStopRef.current()
        }
    }, [isFocusActive, phase])

    const handleDownloadReport = useCallback(() => {
        if (!result) return
        const data = JSON.stringify(
            {
                score: result.score,
                duration: formatTime(result.duration),
                drowsyCount: result.drowsyCount,
                headTurnedCount: result.headTurnedCount,
                faceMissingCount: result.faceMissingCount,
                unauthorizedCount: result.unauthorizedCount,
                highNoiseCount: result.highNoiseCount,
                focusedTime: formatTime(result.focusedTime),
                drowsyTime: formatTime(result.drowsyTime),
                headTurnedTime: formatTime(result.headTurnedTime),
                faceMissingTime: formatTime(result.faceMissingTime),
                unauthorizedTime: formatTime(result.unauthorizedTime),
                history: historyRef.current,
            },
            null,
            2
        )
        const blob = new Blob([data], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "focus_report.json"
        a.click()
        URL.revokeObjectURL(url)
    }, [result, formatTime])

    return (
        <div style={{ display: visible ? undefined : 'none' }}>
            {/* Chart.js CDN — only dependency still loaded via script tag */}
            <Script
                src="https://cdn.jsdelivr.net/npm/chart.js"
                strategy="afterInteractive"
                onLoad={() => setChartLoaded(true)}
            />

            <div className="space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-3">
                        <Eye className="text-primary" size={28} />
                        Focus Tracker
                    </h1>
                    <p className="text-muted-foreground text-sm md:text-base">
                        AI-powered concentration monitoring using your webcam
                    </p>
                </div>

                {/* ── READY PHASE ── */}
                {phase === "ready" && (
                    <div className="animate-in fade-in duration-300">
                        <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/30 max-w-2xl mx-auto">
                            <CardContent className="pt-8 pb-8 space-y-6">
                                <div className="text-center space-y-2">
                                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                                        <Eye size={36} className="text-primary" />
                                    </div>
                                    <h2 className="text-xl font-bold">Real-time Concentration Detection</h2>
                                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                                        Uses your webcam and AI-powered face detection to track your focus in real time. Everything runs locally in your browser.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
                                    {[
                                        { icon: "👁️", label: "Detects drowsiness & eye closure" },
                                        { icon: "🔄", label: "Monitors head orientation" },
                                        { icon: "👤", label: "Tracks face presence" },
                                        { icon: "📊", label: "Real-time status updates" },
                                    ].map((f) => (
                                        <div key={f.label} className="flex items-center gap-2 text-sm bg-background/50 rounded-lg px-3 py-2">
                                            <span>{f.icon}</span>
                                            <span>{f.label}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="text-center space-y-2">
                                    {isEnrolled === false ? (
                                        <Button
                                            size="lg"
                                            onClick={handleEnroll}
                                            className="gap-2 text-base px-8 bg-purple-600 hover:bg-purple-700 text-white"
                                        >
                                            <Eye size={20} />
                                            Enroll Your Face First
                                        </Button>
                                    ) : (
                                        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
                                            <Button
                                                size="lg"
                                                onClick={handleStart}
                                                className="gap-2 text-base px-8"
                                            >
                                                <Play size={20} />
                                                Start Focus Session
                                            </Button>
                                            <Button
                                                size="lg"
                                                variant="outline"
                                                onClick={async () => {
                                                    try {
                                                        await resetFaceData()
                                                        toast.success("Face data removed. Please enroll again.")
                                                    } catch {
                                                        toast.error("Could not reset face data.")
                                                    }
                                                }}
                                                className="gap-2 text-base px-6 bg-transparent"
                                            >
                                                <RotateCcw size={18} />
                                                Re-enroll Face
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <p className="text-xs text-muted-foreground text-center">
                                    🔒 All processing happens locally. No data is stored or transmitted.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ── ENROLL PHASE ── */}
                {phase === "enroll" && (
                    <div className="animate-in fade-in duration-300">
                        <Card className="border-border max-w-2xl mx-auto">
                            <CardHeader className="text-center">
                                <CardTitle className="text-2xl">Face Enrollment</CardTitle>
                                <p className="text-muted-foreground text-sm">Please look directly at the camera to register your face for authentication.</p>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="relative bg-black aspect-video rounded-xl overflow-hidden mx-auto max-w-sm">
                                    <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
                                    <canvas ref={canvasRef} className="hidden" />
                                </div>
                                <div className="text-center">
                                    <span className={`text-sm font-medium mb-4 block ${statusType === "warning" ? "text-red-500" : "text-amber-500"}`}>{statusText}</span>
                                    <div className="flex gap-3 justify-center">
                                        <Button onClick={captureAndEnroll} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
                                            <Eye size={18} /> Capture Face
                                        </Button>
                                        <Button variant="outline" onClick={() => {
                                            if (videoRef.current?.srcObject) {
                                                const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
                                                tracks.forEach(track => track.stop())
                                            }
                                            setPhase("ready")
                                            updateStatusUI("System Ready", "neutral")
                                        }}>Cancel</Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ── ACTIVE PHASE ── */}
                {phase === "active" && (
                    <div className="animate-in fade-in duration-300 space-y-6">
                        {/* Status banner */}
                        <div
                            className={`w-full py-4 px-6 text-center text-lg font-bold text-white rounded-xl transition-colors duration-500 ${statusType === "focused"
                                ? "bg-emerald-500"
                                : statusType === "warning"
                                    ? "bg-red-500"
                                    : "bg-gray-500"
                                }`}
                        >
                            {statusText}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Video feed */}
                            <div className="lg:col-span-2">
                                <Card className="overflow-hidden border-border">
                                    <div className="relative bg-black aspect-video">
                                        <video
                                            ref={videoRef}
                                            playsInline
                                            muted
                                            autoPlay
                                            className="w-full h-full object-cover"
                                            style={{ transform: "scaleX(-1)" }}
                                        />
                                        <canvas
                                            ref={canvasRef}
                                            className="absolute inset-0 w-full h-full"
                                            style={{ transform: "scaleX(-1)" }}
                                        />
                                    </div>
                                </Card>
                            </div>

                            {/* Live metrics panel */}
                            <div>
                                <Card className="border-border">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Eye size={18} className="text-primary" />
                                            Live Metrics
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {[
                                            { label: "Status", value: metrics.status, id: "status" },
                                            { label: "Doze Timer", value: metrics.doze, id: "doze" },
                                            { label: "Face Timer", value: metrics.face, id: "face" },
                                            { label: "Head Timer", value: metrics.head, id: "head" },
                                            { label: "Unauthorized", value: metrics.unauth, id: "unauth" },
                                            { label: "EAR", value: metrics.ear, id: "ear" },
                                            { label: "Yaw", value: metrics.yaw, id: "yaw" },
                                            { label: "Duration", value: metrics.duration, id: "duration" },
                                        ].map((m) => (
                                            <div
                                                key={m.id}
                                                className="flex justify-between items-center px-3 py-2.5 bg-muted/50 rounded-lg text-sm font-medium"
                                            >
                                                <span className="text-muted-foreground">{m.label}</span>
                                                <span
                                                    className={
                                                        m.id === "status"
                                                            ? statusType === "focused"
                                                                ? "text-emerald-500"
                                                                : statusType === "warning"
                                                                    ? "text-red-500"
                                                                    : ""
                                                            : ""
                                                    }
                                                >
                                                    {m.value}
                                                </span>
                                            </div>
                                        ))}

                                        <Button
                                            variant="destructive"
                                            onClick={handleStop}
                                            className="w-full gap-2 mt-4"
                                            size="lg"
                                        >
                                            <Square size={18} />
                                            Stop Session
                                        </Button>
                                    </CardContent>
                                </Card>

                                {/* ── Noise Monitor Panel ── */}
                                <Card className="border-border">
                                    <CardHeader
                                        className="cursor-pointer select-none pb-2"
                                        onClick={() => setNoiseExpanded(!noiseExpanded)}
                                    >
                                        <CardTitle className="text-base flex items-center justify-between">
                                            <span className="flex items-center gap-2">
                                                <Volume2 size={18} className="text-primary" />
                                                Noise Monitor
                                                {noiseState.micActive && (
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                )}
                                            </span>
                                            {noiseExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </CardTitle>
                                    </CardHeader>
                                    {noiseExpanded && (
                                        <CardContent className="space-y-3 pt-0">
                                            {noiseState.isLoading ? (
                                                <p className="text-sm text-muted-foreground animate-pulse">Loading noise detector...</p>
                                            ) : noiseState.micDenied ? (
                                                <p className="text-sm text-amber-500">🎙️ Noise monitoring unavailable — microphone access denied</p>
                                            ) : (
                                                <>
                                                    {/* dB Level Bar */}
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-xs text-muted-foreground">
                                                            <span>dB Level</span>
                                                            <span>{noiseState.dbLevel > -100 ? noiseState.dbLevel.toFixed(1) : "—"} dBFS</span>
                                                        </div>
                                                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-300 ${noiseState.noiseStatus === "high"
                                                                    ? "bg-red-500"
                                                                    : noiseState.noiseStatus === "moderate"
                                                                        ? "bg-amber-500"
                                                                        : "bg-emerald-500"
                                                                    }`}
                                                                style={{
                                                                    width: `${Math.max(0, Math.min(100, ((noiseState.dbLevel + 100) / 100) * 100))}%`,
                                                                }}
                                                            />
                                                        </div>
                                                    </div>


                                                    {/* Noise Status Badge */}
                                                    <div className="flex justify-between items-center px-3 py-2 bg-muted/50 rounded-lg text-sm">
                                                        <span className="text-muted-foreground">Status</span>
                                                        <span
                                                            className={`font-semibold ${noiseState.noiseStatus === "high"
                                                                ? "text-red-500"
                                                                : noiseState.noiseStatus === "moderate"
                                                                    ? "text-amber-500"
                                                                    : "text-emerald-500"
                                                                }`}
                                                        >
                                                            {noiseState.noiseStatus === "high"
                                                                ? "🚨 High Noise"
                                                                : noiseState.noiseStatus === "moderate"
                                                                    ? "⚠️ Moderate"
                                                                    : "✅ Quiet"}
                                                        </span>
                                                    </div>

                                                    {/* High noise counter */}
                                                    <div className="flex justify-between items-center px-3 py-2 bg-muted/50 rounded-lg text-sm">
                                                        <span className="text-muted-foreground">High Noise Events</span>
                                                        <span className="font-medium">{noiseState.highNoiseCount}</span>
                                                    </div>
                                                </>
                                            )}
                                        </CardContent>
                                    )}
                                </Card>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── RESULTS PHASE ── */}
                {phase === "results" && result && (
                    <div className="animate-in fade-in duration-300 space-y-6 max-w-2xl mx-auto">
                        <Card className="border-border">
                            <CardHeader className="text-center">
                                <div className="mx-auto mb-2">
                                    {result.score >= 70 ? (
                                        <CheckCircle2 size={48} className="text-emerald-500" />
                                    ) : (
                                        <AlertTriangle size={48} className="text-amber-500" />
                                    )}
                                </div>
                                <CardTitle className="text-3xl">
                                    Focus Score:{" "}
                                    <span className={result.score >= 70 ? "text-emerald-500" : "text-amber-500"}>
                                        {result.score}%
                                    </span>
                                </CardTitle>
                                <p className="text-muted-foreground">
                                    Session Duration: {formatTime(result.duration)}
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Chart */}
                                <div className="max-w-xs mx-auto">
                                    <canvas ref={chartCanvasRef} />
                                </div>

                                {/* Breakdown */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                                        Session Breakdown
                                    </h3>
                                    {[
                                        {
                                            label: "Focused Time",
                                            value: formatTime(result.focusedTime),
                                            pct: result.score + "%",
                                            color: "bg-emerald-500",
                                        },
                                        {
                                            label: "Drowsiness Events",
                                            value: `${result.drowsyCount} times (${formatTime(result.drowsyTime)})`,
                                            pct: "",
                                            color: "bg-amber-500",
                                        },
                                        {
                                            label: "Head Turned Events",
                                            value: `${result.headTurnedCount} times (${formatTime(result.headTurnedTime)})`,
                                            pct: "",
                                            color: "bg-red-500",
                                        },
                                        {
                                            label: "Face Not Detected",
                                            value: `${result.faceMissingCount} times (${formatTime(result.faceMissingTime)})`,
                                            pct: "",
                                            color: "bg-gray-500",
                                        },
                                        {
                                            label: "Unauthorized User",
                                            value: `${result.unauthorizedCount} times (${formatTime(result.unauthorizedTime)})`,
                                            pct: "",
                                            color: "bg-purple-500",
                                        },
                                        {
                                            label: "🔊 High Noise Events",
                                            value: `${result.highNoiseCount} interruptions`,
                                            pct: "",
                                            color: "bg-orange-500",
                                        },
                                    ].map((item) => (
                                        <div key={item.label} className="flex items-center gap-3 text-sm">
                                            <div className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`} />
                                            <span className="font-medium flex-1">{item.label}</span>
                                            <span className="text-muted-foreground">{item.value}</span>
                                            {item.pct && <span className="font-bold">{item.pct}</span>}
                                        </div>
                                    ))}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 justify-center pt-2">
                                    <Button onClick={() => setPhase("ready")} className="gap-2">
                                        <RotateCcw size={18} />
                                        New Session
                                    </Button>
                                    <Button variant="outline" onClick={handleDownloadReport} className="gap-2 bg-transparent">
                                        <Download size={18} />
                                        Download Report
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    )
}
