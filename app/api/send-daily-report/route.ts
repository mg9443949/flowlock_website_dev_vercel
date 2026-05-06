export const runtime = 'nodejs'

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  // fetch users + stats from Supabase, send emails
  // same logic as before — nothing platform-specific here
}