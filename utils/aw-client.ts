/**
 * ActivityWatch browser client utility
 *
 * Strategy (most-reliable-first):
 *  1. Call AW directly from the browser at http://localhost:5600
 *     → Works when app is deployed (Vercel) because it's a browser→user's machine fetch.
 *     → ActivityWatch enables CORS by default, so this usually succeeds.
 *  2. Fall back to the Next.js server-side proxy (/api/aw-proxy)
 *     → Works in local development (npm run dev) where the server IS the user's machine.
 *
 * Both paths are tried so the feature works in all environments.
 */

const AW_DIRECT = "http://localhost:5600/api/0"

/** Fetch an ActivityWatch API endpoint. Returns parsed JSON or throws. */
export async function awFetch(endpoint: string): Promise<any> {
    // 1️⃣ Try direct browser fetch first
    try {
        const resp = await fetch(`${AW_DIRECT}/${endpoint}`, {
            signal: AbortSignal.timeout(4000),
        })
        if (resp.ok) return resp.json()
    } catch {
        // CORS block or AW not running — fall through to proxy
    }

    // 2️⃣ Fall back to server-side proxy (only works locally)
    const resp = await fetch(`/api/aw-proxy?endpoint=${encodeURIComponent(endpoint)}`, {
        signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) throw new Error(`AW not reachable (${resp.status})`)
    return resp.json()
}

/** Check whether ActivityWatch is reachable. Returns true/false. */
export async function isAWOnline(): Promise<boolean> {
    // 1️⃣ Direct browser fetch
    try {
        const resp = await fetch(`${AW_DIRECT}/buckets`, {
            signal: AbortSignal.timeout(3000),
        })
        if (resp.ok) return true
    } catch { /* fall through */ }

    // 2️⃣ Server-side proxy
    try {
        const resp = await fetch(`/api/aw-proxy?endpoint=buckets`, {
            signal: AbortSignal.timeout(3000),
        })
        return resp.ok
    } catch {
        return false
    }
}
