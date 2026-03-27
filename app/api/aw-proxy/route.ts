import { NextRequest, NextResponse } from "next/server"

const AW_LOCAL = "http://localhost:5600/api/0"

export async function GET(req: NextRequest) {
    const endpoint = req.nextUrl.searchParams.get("endpoint") || "buckets"

    // When client=true, return the AW URL so the browser can call AW directly.
    // This is the correct approach when the app is deployed (Vercel), because
    // server-side fetches to localhost:5600 would reach the *cloud server*, not
    // the user's machine. ActivityWatch enables CORS so direct browser calls work.
    const clientMode = req.nextUrl.searchParams.get("client") === "true"
    if (clientMode) {
        return NextResponse.json({ url: `${AW_LOCAL}/${endpoint}` })
    }

    // Server-side proxy mode — works only in LOCAL development where the
    // Next.js server and ActivityWatch both run on the user's machine.
    try {
        const resp = await fetch(`${AW_LOCAL}/${endpoint}`, {
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(4000),
        })

        if (!resp.ok) {
            return NextResponse.json({ error: "AW returned error" }, { status: resp.status })
        }

        const data = await resp.json()
        return NextResponse.json(data)
    } catch {
        return NextResponse.json({ error: "ActivityWatch not reachable" }, { status: 503 })
    }
}

