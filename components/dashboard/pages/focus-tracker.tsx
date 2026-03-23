"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye, Play, Square, RotateCcw, AlertTriangle, CheckCircle2, Download, Mic, Volume2, ChevronDown, ChevronUp, Gamepad2 } from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Script from "next/script"
import type { FaceLandmarker as FaceLandmarkerType } from "@mediapipe/tasks-vision"
import { useNoiseDetector } from "@/hooks/use-noise-detector"
import { useAuth } from "@/components/providers/auth-provider"
import { usePomodoro } from "@/components/providers/pomodoro-provider"
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
    })
    const [result, setResult] = useState<FocusSessionResult | null>(null)

    const [noiseExpanded, setNoiseExpanded] = useState(true)

    // Noise detection hook
    const { noiseState, startNoise, stopNoise, setAlertCallback } = useNoiseDetector()
    const { user } = useAuth()
    const { startFocusSession, stopFocusSession, setFocusElapsed, isFocusActive, targetDuration, focusElapsed } = useFocus()
    const { completeSession } = usePomodoro()
    const router = useRouter()
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

    // Fix: Keep a live ref to the targetDuration so the internal setInterval never reads stale closure data
    const targetDurationRef = useRef<number | null>(targetDuration)
    useEffect(() => { targetDurationRef.current = targetDuration }, [targetDuration])

    // Smart Break History
    const lastDistractionCountRef = useRef(0)

    // Register noise alert callback
    useEffect(() => {
        setAlertCallback((label, conf) => {
            toast.warning(`🚨 High Noise Detected (${label})!`, {
                duration: 4000,
                position: "top-right",
            })
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("🚨 High Noise Alert", {
                    body: `Distracting noise detected: ${label}`,
                    icon: "/favicon.ico" // Assuming favicon exists, fallback is default
                })
            }
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
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("Focus Alert", { body: "You appear drowsy. Stay alert!" })
                }
            } else if (newStatus === "HEAD_TURNED") {
                updateStatusUI("⚠ Distraction: Head Turned Away", "warning")
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("Focus Alert", { body: "Please keep your head facing the screen." })
                }
            } else if (newStatus === "FACE_MISSING") {
                updateStatusUI("⚠ Distraction: Face Not Detected", "warning")
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("Focus Alert", { body: "Face not detected. Are you at your screen?" })
                }
            } else if (newStatus === "UNAUTHORIZED") {
                updateStatusUI("⚠ Distraction: Unauthorized Face", "warning")
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("Focus Alert", { body: "Unauthorized person detected!" })
                }
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
            // Guard to ensure video is fully ready before passing it to TensorFlow
            if (videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
                const results = modelRef.current.detectForVideo(videoRef.current, performance.now())

                if (!canvasRef.current) return
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
                ctx.save()
                ctx.scale(-1, 1)
                ctx.translate(-canvasRef.current.width, 0)

                processDetectionRef.current(results.faceLandmarks, ctx)

                ctx.restore()
            }
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
            // Request Notification Permissions if needed
            if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
                await Notification.requestPermission()
            }

            setPhase("active")

            // Reset state
            timersRef.current = { drowsy: 0, faceMissing: 0, headTurned: 0, unauthorized: 0 }
            statsRef.current = { drowsyCount: 0, faceMissingCount: 0, headTurnedCount: 0, unauthorizedCount: 0 }
            historyRef.current = []
            currentStatusRef.current = "FOCUSED"
            isUnauthorizedRef.current = false
            hasDownloadedRef.current = false
            lastFrameTimeRef.current = Date.now()

            // ---- INITIALIZATION SEQUENCE UPDATE ----
            // 1. Load Audio Model FIRST
            updateStatusUI("Loading Audio Distraction Model...", "neutral")
            await startNoise()

            if (videoRef.current) {
                videoRef.current.width = 640
                videoRef.current.height = 480
            }
            if (canvasRef.current) {
                canvasRef.current.width = 640
                canvasRef.current.height = 480
            }

            // 2. Request Camera AFTER Audio Model is ready
            updateStatusUI("Requesting Camera...", "neutral")
            await setupCamera()

            // 3. Load Vision Models
            if (!modelRef.current) {
                updateStatusUI("Loading Vision AI Models...", "neutral")
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

            // Duration ticker
            durationIntervalRef.current = setInterval(() => {
                const elapsed = Date.now() - startTimeRef.current
                const elapsedSec = Math.floor(elapsed / 1000)
                setFocusElapsed(elapsedSec)

                let displaySec = elapsedSec
                // Fix: Evaluate using the dynamically updated ref
                if (targetDurationRef.current) {
                    const remaining = Math.max(0, targetDurationRef.current - elapsedSec)
                    displaySec = remaining
                    if (remaining <= 0) {
                        // Auto-stop when target is reached
                        handleStop()
                        return
                    }
                }

                // ── Smart Break Suggester (Evaluates every 5 minutes) ──
                if (elapsedSec > 0 && elapsedSec % 300 === 0) {
                    const now = Date.now()
                    const twentyMinsAgo = now - 20 * 60 * 1000
                    
                    // Count unique distracting events in the last 20 mins
                    const recentEvents = historyRef.current.filter(
                        (e) => e.start && e.type !== "FOCUSED" && e.time > twentyMinsAgo
                    )
                    const count = recentEvents.length
                    const accel = count - lastDistractionCountRef.current
                    lastDistractionCountRef.current = count

                    const firstName = user?.name?.split(" ")[0] || "there"

                    // If user focused for 90+ mins continuously
                    if (elapsedSec >= 90 * 60) {
                        toast.message(`Hey ${firstName}, you've been working deeply for over 90 minutes!`, {
                            description: "Your brain needs a reset. I strongly suggest a 15-minute break now.",
                            duration: 10000,
                            icon: "🧠",
                        })
                    } else if (count >= 4) {
                        const breakTime = count >= 6 ? "15min" : "10min"
                        toast.warning(`Hey ${firstName}, you've had ${count} distractions recently.`, {
                            description: `You're showing signs of fatigue. A ${breakTime} break will massively boost your focus!`,
                            duration: 8000,
                            icon: "☕",
                        })
                    } else if (accel >= 2) {
                        toast.warning(`Focus is slipping, ${firstName}.`, {
                            description: "Your distraction rate is accelerating. Try to recenter or take a quick 5min breather.",
                            duration: 6000,
                            icon: "⚠️",
                        })
                    } else {
                        // Going well
                        const compliments = [
                            `You are entirely locked in, ${firstName}. Beautiful focus!`,
                            `No breaks needed. You're in a total flow state!`,
                            `Immaculate concentration over the last 5 minutes. Keep it up!`,
                        ]
                        toast.success(compliments[Math.floor(Math.random() * compliments.length)], {
                            duration: 4000,
                            icon: "✨",
                        })
                    }
                }

            }, 1000) as unknown as NodeJS.Timeout

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
            }, 5000) as unknown as NodeJS.Timeout

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

        // Call Pomodoro completion logic
        // If there was a target duration, use it (converted to mins). Else use actual duration.
        const intendedDurationMins = targetDuration ? targetDuration / 60 : totalDuration / 60000
        completeSession(intendedDurationMins)

        // Signal to provider that session ended
        stopFocusSession()

        // Show motivational message if user opted in
        if (typeof localStorage !== "undefined" && localStorage.getItem("pref_motivational_messages") === "true") {
            const highScoreMessages = [
                "🌟 Phenomenal focus! You're unstoppable — keep up the great work!",
                "🔥 Outstanding session! Your dedication is truly inspiring.",
                "💪 You crushed it! That level of focus is what champions are made of.",
                "🚀 Incredible work! Every session like this brings you closer to your goals.",
                "🏆 Top-tier performance! You should be proud of your concentration.",
                "✨ Brilliant focus! You make hard things look easy. Keep it up!",
            ]
            const midScoreMessages = [
                "👍 Solid session! You're building great habits — consistency is key.",
                "📈 Good effort! Every session is a step forward. Keep going!",
                "💡 Nice work! A little more focus each day and you'll be unstoppable.",
                "🌱 Growing stronger! Each session plants the seeds of success.",
                "⚡ Good session! Stay consistent and watch yourself improve every day.",
                "🎯 You're on track! Progress, not perfection — you're doing great.",
            ]
            const lowScoreMessages = [
                "🌤️ Every expert was once a beginner. Tomorrow is a fresh start!",
                "💪 Don't be discouraged — every session teaches you something new.",
                "🔄 Tough session? That's okay! What matters is that you showed up.",
                "🌱 Growth takes time. Keep going — you're building something great.",
                "🧠 Distracted days happen. Rest up and come back stronger tomorrow!",
                "🎯 The comeback is always stronger than the setback. Keep pushing!",
            ]

            let pool: string[]
            if (score >= 80) pool = highScoreMessages
            else if (score >= 50) pool = midScoreMessages
            else pool = lowScoreMessages

            const msg = pool[Math.floor(Math.random() * pool.length)]

            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Great session, champ! 🎉", { body: msg })
            }
            toast.success(msg, { duration: 6000, position: "top-center" })
        }

        if (onSessionComplete) {
            onSessionComplete(sessionResult)
        }

        // Extremely important: Forcefully route back to this tracker so they don't miss the PDF and graphs
        router.push("/dashboard/focus")
    }, [onSessionComplete, router])

    const handleDownloadReport = useCallback(async () => {
        if (!result) return

        try {
            const { default: jsPDF } = await import("jspdf")
            const { default: autoTable } = await import("jspdf-autotable")
            const doc = new jsPDF()

            // Header
            doc.setFontSize(22)
            doc.setTextColor(0, 0, 0)
            doc.text("Focus Session Report", 14, 20)

            // Essential Metrics
            doc.setFontSize(12)
            doc.text(`Focus Score: ${result.score}%`, 14, 30)
            doc.text(`Total Duration: ${formatTime(result.duration)}`, 14, 38)
            doc.text(`Focused Time: ${formatTime(result.focusedTime)}`, 14, 46)

            // Detailed Metrics Table
            autoTable(doc, {
                startY: 55,
                head: [["Metric", "Count", "Time"]],
                body: [
                    ["Drowsy Events", result.drowsyCount.toString(), formatTime(result.drowsyTime)],
                    ["Head Turned Events", result.headTurnedCount.toString(), formatTime(result.headTurnedTime)],
                    ["Face Missing Events", result.faceMissingCount.toString(), formatTime(result.faceMissingTime)],
                    ["Unauthorized User Events", result.unauthorizedCount.toString(), formatTime(result.unauthorizedTime)],
                    ["High Noise Events", result.highNoiseCount.toString(), "-"],
                ],
                theme: "grid",
                headStyles: { fillColor: [88, 28, 135] }, // primary purple-ish
            })

            doc.save("focus_report.pdf")
        } catch (error) {
            console.error("Failed to generate PDF:", error)
        }
    }, [result, formatTime])

    // Render chart when results phase is entered
    useEffect(() => {
        if (phase === "results" && result && chartCanvasRef.current) {
            const Chart = (window as any).Chart
            if (!Chart) return

            if (chartInstanceRef.current) chartInstanceRef.current.destroy()

            const ctx = chartCanvasRef.current.getContext("2d")
            chartInstanceRef.current = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: ["Drowsy", "Head Turned", "Missing", "Unauthorized", "High Noise"],
                    datasets: [
                        {
                            label: "Number of Distractions",
                            data: [result.drowsyCount, result.headTurnedCount, result.faceMissingCount, result.unauthorizedCount, result.highNoiseCount],
                            backgroundColor: ["#f59e0b", "#ef4444", "#6b7280", "#a855f7", "#f97316"],
                            borderRadius: 4,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context: any) => `${context.raw} events`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0, stepSize: 1 }
                        }
                    }
                },
            })

            // Auto-generate PDF report once per session
            if (!hasDownloadedRef.current) {
                hasDownloadedRef.current = true;
                setTimeout(() => {
                    handleDownloadReport();
                }, 500); // Small delay to let UI render completely first
            }
        }
    }, [phase, result, handleDownloadReport])

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

    // External start detection — when StudySession sets it active
    const handleStartRef = useRef(handleStart)
    useEffect(() => { handleStartRef.current = handleStart }, [handleStart])
    useEffect(() => {
        if (isFocusActive && phase === "ready" && isEnrolled === true) {
            handleStartRef.current()
        }
    }, [isFocusActive, phase, isEnrolled])

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
                                                onClick={() => router.push("/dashboard/study")}
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
                        {/* Giant Timer Display */}
                        <div className="flex justify-center py-4">
                            <div className="text-7xl md:text-[120px] font-mono font-bold text-primary tracking-tighter tabular-nums drop-shadow-sm">
                                {targetDuration
                                    ? `${Math.floor(Math.max(0, targetDuration - focusElapsed) / 60).toString().padStart(2, "0")}:${Math.floor(Math.max(0, targetDuration - focusElapsed) % 60).toString().padStart(2, "0")}`
                                    : `${Math.floor(focusElapsed / 60).toString().padStart(2, "0")}:${Math.floor(focusElapsed % 60).toString().padStart(2, "0")}`
                                }
                            </div>
                        </div>

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
                                <div className="max-w-md mx-auto mb-6">
                                    <h3 className="text-center font-medium text-sm text-muted-foreground mb-3">Distractions Count</h3>
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

                                {/* Divider & Actions */}
                                <div className="pt-4 border-t border-border space-y-4">
                                    <div className="flex flex-col items-center justify-center gap-1">
                                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest text-center">
                                            Session Complete!
                                        </p>
                                        <p className="text-xs text-muted-foreground text-center">
                                            Would you like to play some games to unwind and relax your brain?
                                        </p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                        <Button onClick={() => router.push("/dashboard/games")} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                                            <Gamepad2 size={18} />
                                            Yes, take me to Games!
                                        </Button>
                                        <Button variant="outline" onClick={() => setPhase("ready")} className="gap-2 bg-transparent">
                                            <RotateCcw size={18} />
                                            No, Start New Session
                                        </Button>
                                        <Button variant="default" onClick={handleDownloadReport} className="gap-2">
                                            <Download size={18} />
                                            Download Report
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    )
}
