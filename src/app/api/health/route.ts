/**
 * NEST — GET /api/health
 * Liveness probe. No auth, no DB touch — the preview panel and the QA matrix
 * use it to confirm the API tree is mounted.
 */

import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ ok: true })
}
