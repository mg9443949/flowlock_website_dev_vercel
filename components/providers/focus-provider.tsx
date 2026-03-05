"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type { FocusSessionResult } from "@/components/dashboard/pages/focus-tracker"

interface FocusContextType {
    // Session results (existing)
    lastFocusSession: FocusSessionResult | null
    setLastFocusSession: (session: FocusSessionResult | null) => void

    // Active session tracking (new)
    isFocusActive: boolean
    focusElapsed: number
    setFocusElapsed: (seconds: number) => void
    startFocusSession: () => void
    stopFocusSession: () => void
}

const FocusContext = createContext<FocusContextType | undefined>(undefined)

export function FocusProvider({ children }: { children: ReactNode }) {
    const [lastFocusSession, setLastFocusSession] = useState<FocusSessionResult | null>(null)
    const [isFocusActive, setIsFocusActive] = useState(false)
    const [focusElapsed, setFocusElapsed] = useState(0)

    const startFocusSession = useCallback(() => {
        setIsFocusActive(true)
        setFocusElapsed(0)
    }, [])

    const stopFocusSession = useCallback(() => {
        setIsFocusActive(false)
        setFocusElapsed(0)
    }, [])

    return (
        <FocusContext.Provider value={{
            lastFocusSession,
            setLastFocusSession,
            isFocusActive,
            focusElapsed,
            setFocusElapsed,
            startFocusSession,
            stopFocusSession,
        }}>
            {children}
        </FocusContext.Provider>
    )
}

export function useFocus() {
    const context = useContext(FocusContext)
    if (context === undefined) {
        throw new Error("useFocus must be used within a FocusProvider")
    }
    return context
}
