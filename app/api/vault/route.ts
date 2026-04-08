import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getAuthenticatedClient(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return { supabase: null, error: "Missing or invalid authorization header", status: 401 }
  }

  const token = authHeader.replace("Bearer ", "")
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  return { supabase, error: null, status: 200 }
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, error, status } = getAuthenticatedClient(request)
    if (error || !supabase) {
      return NextResponse.json({ error }, { status })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
    const { supabase, error, status } = getAuthenticatedClient(request)
    if (error || !supabase) {
      return NextResponse.json({ error }, { status })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
