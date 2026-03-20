import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  // Determine the base URL — keep 127.0.0.1 for local dev (Spotify requires it)
  let host = request.headers.get("host") || "127.0.0.1:3000"
  if (host.includes("localhost")) {
    host = host.replace("localhost", "127.0.0.1")
  }
  const protocol = host.includes("127.") || host.startsWith("[::1]")
    ? "http"
    : "https"
  const baseUrl = `${protocol}://${host}`

  if (error) {
    return NextResponse.redirect(`${baseUrl}/dashboard/playlist?spotify_error=${error}`)
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/dashboard/playlist?spotify_error=no_code`)
  }

  // Pass the authorization code to the client for PKCE token exchange.
  // The client holds the code_verifier in localStorage (cookies were unreliable
  // across localhost ↔ 127.0.0.1 domain switches).
  const params = new URLSearchParams({ spotify_code: code })
  return NextResponse.redirect(`${baseUrl}/dashboard/playlist?${params.toString()}`)
}
