import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  let host = request.headers.get("host") || "127.0.0.1:3000"
  if (host.includes("localhost")) {
    host = host.replace("localhost", "127.0.0.1")
  }
  const protocol = host.includes("127.") || host.startsWith("[::1]")
    ? "http"
    : "https"
  const baseUrl = `${protocol}://${host}`

  // Read the origin page from the OAuth "state" param (we set it during login)
  const originPage = searchParams.get("state") || "/dashboard/calendar"

  if (error) {
    return NextResponse.redirect(`${baseUrl}/dashboard?google_error=${error}`)
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/dashboard?google_error=no_code`)
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const redirectUri = `${baseUrl}/api/google/callback`

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok || tokenData.error) {
      console.error("Google token error:", tokenData)
      return NextResponse.redirect(`${baseUrl}/dashboard?google_error=token_exchange_failed`)
    }

    // Use g_ prefix to avoid collision with Spotify's identical param names!
    const params = new URLSearchParams({
      g_access_token: tokenData.access_token,
      g_expires_in: String(tokenData.expires_in || 3599),
      g_auth: "1",
    })
    
    // Only set refresh token if it was provided (Google sometimes only sends it on first login)
    if (tokenData.refresh_token) {
      params.set("g_refresh_token", tokenData.refresh_token)
    }

    // Redirect back to the page the user was on (calendar or playlist)
    return NextResponse.redirect(`${baseUrl}${originPage}?${params.toString()}`)
  } catch (err) {
    console.error("Google callback error:", err)
    return NextResponse.redirect(`${baseUrl}/dashboard?google_error=server_error`)
  }
}
