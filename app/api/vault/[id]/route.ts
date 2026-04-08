import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function getAuthenticatedUser(request: NextRequest) {
  const cookieStore = await cookies()
  let accessToken: string | undefined

  const allCookies = cookieStore.getAll()
  const sessionCookie = allCookies.find(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  )

  if (sessionCookie) {
    try {
      const parsed = JSON.parse(sessionCookie.value)
      accessToken = parsed.access_token ?? parsed[0]?.access_token
    } catch {
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { user, supabase, error, status } = await getAuthenticatedUser(request)
    if (error || !user || !supabase) {
      return NextResponse.json({ error }, { status })
    }

    // Check ownership before deleting
    const { data: existing, error: fetchError } = await supabase
      .from("distraction_vault")
      .select("user_id")
      .eq("id", id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error: dbError } = await supabase
      .from("distraction_vault")
      .delete()
      .eq("id", id)

    if (dbError) {
      return NextResponse.json({ error: "Failed to delete vault item" }, { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error("Vault DELETE error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
