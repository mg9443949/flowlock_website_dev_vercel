import { NextRequest, NextResponse } from "next/server"
export async function GET(request: NextRequest) {
  // Redirect to the static file in the public folder. This works in both dev and serverless environments.
  return NextResponse.redirect(new URL('/chrome-extension.zip', request.url));
}
