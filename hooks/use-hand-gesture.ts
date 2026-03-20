"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { HandLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision"

export type GestureType = "MOVE" | "LEFT_CLICK" | "RIGHT_CLICK" | "SCROLL_UP" | "SCROLL_DOWN" | "NONE"

export interface GestureState {
    x: number
    y: number
    gesture: GestureType
    isActive: boolean
}

export function useHandGesture(enabled: boolean) {
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const [state, setState] = useState<GestureState>({ 
        x: typeof window !== "undefined" ? window.innerWidth / 2 : 0, 
        y: typeof window !== "undefined" ? window.innerHeight / 2 : 0, 
        gesture: "NONE", 
        isActive: false 
    })
    const requestRef = useRef<number>(0)
    const landmarkerRef = useRef<HandLandmarker | null>(null)
    const lastClickTimeRef = useRef<number>(0)
    const posRef = useRef({ 
        x: typeof window !== "undefined" ? window.innerWidth / 2 : 0, 
        y: typeof window !== "undefined" ? window.innerHeight / 2 : 0 
    })

    // Helper to setup MediaPipe
    useEffect(() => {
        let isSetup = true

        async function createLandmarker() {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
                )
                if (!isSetup) return

                const landmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 1,
                    minHandDetectionConfidence: 0.65,
                    minHandPresenceConfidence: 0.65,
                    minTrackingConfidence: 0.65
                })

                if (!isSetup) {
                    landmarker.close()
                    return
                }

                landmarkerRef.current = landmarker
            } catch (err) {
                console.error("Failed to load hand landmarker:", err)
            }
        }

        if (enabled && !landmarkerRef.current) {
            createLandmarker()
        }

        return () => {
            isSetup = false
            if (landmarkerRef.current) {
                landmarkerRef.current.close()
                landmarkerRef.current = null
            }
        }
    }, [enabled])

    // Detect gestures based on landmark distances from the wrist
    const classifyGesture = (landmarks: any[]) => {
        // Simple distance function
        const getDist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2))
        
        // A finger is extended if its tip is further from the wrist (0) than its PIP joint
        const isUp = (tip: number, pip: number) => {
            return getDist(landmarks[tip], landmarks[0]) > getDist(landmarks[pip], landmarks[0])
        }

        const thumbUp = isUp(4, 3)
        const indexUp = isUp(8, 6)
        const middleUp = isUp(12, 10)
        const ringUp = isUp(16, 14)
        const pinkyUp = isUp(20, 18)
        
        const f = [thumbUp, indexUp, middleUp, ringUp, pinkyUp]

        if (f[1] && f[2] && f[3] && f[4]) return "MOVE" // all 4 fingers (with or without thumb)
        if (!f[0] && f[1] && !f[2] && !f[3] && !f[4]) return "LEFT_CLICK" // strictly index only
        if (f[0] && f[1] && !f[2] && !f[3] && !f[4]) return "LEFT_CLICK" // index + thumb (to match user habit)
        if (!f[1] && !f[2] && !f[3] && f[4]) return "RIGHT_CLICK" // pinky only (with or without thumb)
        if (f[0] && !f[1] && !f[2] && !f[3] && !f[4]) return "SCROLL_UP" // thumb only
        if (!f[0] && !f[1] && !f[2] && !f[3] && !f[4]) return "SCROLL_DOWN" // fist

        return "NONE"
    }

    // Main inference loop
    const predictWebcam = useCallback(() => {
        if (!videoRef.current || !landmarkerRef.current || !enabled) return

        let startTimeMs = performance.now()
        if (videoRef.current.currentTime > 0) {
            const results = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs)

            if (results.landmarks && results.landmarks.length > 0) {
                const hand = results.landmarks[0]
                const index = hand[8] // index fingertip

                // Mirrored X because webcam is mirrored
                const screenX = (1 - index.x) * window.innerWidth
                const screenY = index.y * window.innerHeight

                // Smooth position
                const smooth = 4
                posRef.current.x += (screenX - posRef.current.x) / smooth
                posRef.current.y += (screenY - posRef.current.y) / smooth

                const gesture = classifyGesture(hand)
                
                setState({
                    x: posRef.current.x,
                    y: posRef.current.y,
                    gesture,
                    isActive: true
                })

                // Simulate actions
                executeAction(gesture, posRef.current.x, posRef.current.y)
            } else {
                setState(prev => ({ ...prev, isActive: false, gesture: "NONE" }))
            }
        }

        requestRef.current = requestAnimationFrame(predictWebcam)
    }, [enabled])

    // Execute DOM interactions
    const executeAction = (gesture: GestureType, x: number, y: number) => {
        const now = performance.now()
        
        if (gesture === "LEFT_CLICK" && now - lastClickTimeRef.current > 400) {
            const el = document.elementFromPoint(x, y)
            if (el && el instanceof HTMLElement) {
                // Flash cursor to indicate click
                const cursor = document.getElementById('virtual-gesture-cursor')
                if (cursor) {
                    cursor.style.transform = 'scale(0.5)'
                    setTimeout(() => cursor.style.transform = 'scale(1)', 150)
                }

                el.click()
            }
            lastClickTimeRef.current = now
        } else if (gesture === "SCROLL_UP") {
            window.scrollBy({ top: -20, behavior: "instant" })
        } else if (gesture === "SCROLL_DOWN") {
            window.scrollBy({ top: 20, behavior: "instant" })
        }
    }

    // Setup webcam feed
    useEffect(() => {
        if (!enabled) {
            if (videoRef.current && videoRef.current.srcObject) {
                const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
                tracks.forEach(track => track.stop())
                videoRef.current.srcObject = null
            }
            if (requestRef.current) cancelAnimationFrame(requestRef.current)
            setState(prev => ({ ...prev, isActive: false, gesture: "NONE" }))
            return
        }

        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
            .then(stream => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                    videoRef.current.addEventListener("loadeddata", predictWebcam)
                }
            })
            .catch(err => {
                console.error("Camera error:", err)
            })

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current)
            if (videoRef.current) {
                videoRef.current.removeEventListener("loadeddata", predictWebcam)
            }
        }
    }, [enabled, predictWebcam])

    return { videoRef, ...state }
}
