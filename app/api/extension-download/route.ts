import { NextRequest, NextResponse } from "next/server"
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/chrome-extension.zip', request.url));
}
