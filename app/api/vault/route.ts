import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Extracts the Supabase session from cookies (set by the browser session).
 * Falls back to the Authorization header for API clients.
 */
async function getAuthenticatedUser(request: NextRequest) {
  const cookieStore = await cookies()

  // Try to extract the access token from Supabase session cookies.
  // Supabase stores the session as sb-<project-ref>-auth-token or sb-access-token
  let accessToken: string | undefined

  // Check all cookies for the Supabase auth token (chunked or unchunked)
  const allCookies = cookieStore.getAll()
  
  // Supabase SSR stores the session JSON in sb-<ref>-auth-token cookie
  const sessionCookie = allCookies.find(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  )

  if (sessionCookie) {
    try {
      const parsed = JSON.parse(sessionCookie.value)
      accessToken = parsed.access_token ?? parsed[0]?.access_token
    } catch {
      // Might be chunked — try concatenating chunks
      const chunks = allCookies
        .filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token."))
        .sort((a, b) => a.name.localeCompare(b.name))

      if (chunks.length > 0) {
        try {
          const joined = chunks.map((c) => c.value).join("")
          const parsed = JSON.parse(joined)
          accessToken = parsed.access_token ?? parsed[0]?.access_token
        } catch {}
      }
    }
  }

  // Fallback: Authorization header (for API clients like the Chrome extension)
  if (!accessToken) {
    const authHeader = request.headers.get("Authorization") ?? request.headers.get("authorization")
    if (authHeader?.startsWith("Bearer ")) {
      accessToken = authHeader.replace("Bearer ", "")
    }
  }

  if (!accessToken) {
    return { user: null, supabase: null, error: "Not authenticated", status: 401 }
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return { user: null, supabase: null, error: "Unauthorized", status: 401 }
  }

  return { user, supabase, error: null, status: 200 }
}

export async function GET(request: NextRequest) {
  try {
    const { user, supabase, error, status } = await getAuthenticatedUser(request)
    if (error || !user || !supabase) {
      return NextResponse.json({ error }, { status })
    }

    const { data: vaultItems, error: dbError } = await supabase
      .from("distraction_vault")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })

    if (dbError) {
      return NextResponse.json({ error: "Failed to fetch vault items" }, { status: 500 })
    }

    return NextResponse.json(vaultItems)
  } catch (err) {
    console.error("Vault GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase, error, status } = await getAuthenticatedUser(request)
    if (error || !user || !supabase) {
      return NextResponse.json({ error }, { status })
    }

    const body = await request.json()
    const { name, type, identifier, icon_url } = body

    if (!name || !type || !identifier) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (type !== "website" && type !== "desktop_app") {
      return NextResponse.json({ error: "Invalid type. Must be 'website' or 'desktop_app'" }, { status: 400 })
    }

    const { data: newItem, error: dbError } = await supabase
      .from("distraction_vault")
      .insert({
        user_id: user.id,
        name,
        type,
        identifier,
        icon_url: icon_url || null
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: "Failed to create vault item" }, { status: 500 })
    }

    return NextResponse.json(newItem, { status: 201 })
  } catch (err) {
    console.error("Vault POST error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
