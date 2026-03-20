import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { refresh_token } = await request.json()

    if (!refresh_token) {
      return NextResponse.json({ error: "No refresh token provided" }, { status: 400 })
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token,
        grant_type: "refresh_token",
      }),
    })

    const data = await response.json()

    if (!response.ok || data.error) {
      return NextResponse.json({ error: data.error || "Google token refresh failed" }, { status: 401 })
    }

    return NextResponse.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      // Google sometimes sends a new refresh token, otherwise keep the old one
      refresh_token: data.refresh_token || refresh_token,
    })
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
