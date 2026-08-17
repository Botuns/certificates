import { NextResponse } from "next/server"

import {
  ConflictError,
  isBlobConfigured,
  readDatabase,
  snapshot,
  writeDatabase,
} from "@/lib/db/blob"
import type { Database } from "@/lib/types"

/** Roster state is per-request; never prerender or cache this route. */
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const { db, etag } = await readDatabase()
    return NextResponse.json(
      { db, etag, configured: isBlobConfigured() },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read roster" },
      { status: 500 }
    )
  }
}

type PutBody = {
  db: Database
  etag: string | null
  /** Set by the client before destructive edits (clear, bulk delete, import). */
  snapshot?: boolean
}

export async function PUT(request: Request) {
  let body: PutBody
  try {
    body = (await request.json()) as PutBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (
    !body?.db ||
    !Array.isArray(body.db.atfal) ||
    !Array.isArray(body.db.fields)
  ) {
    return NextResponse.json(
      { error: "Malformed database payload" },
      { status: 400 }
    )
  }

  try {
    if (body.snapshot) {
      const { db: previous } = await readDatabase()
      await snapshot(previous)
    }

    const saved = await writeDatabase(body.db, body.etag ?? null)
    return NextResponse.json(saved, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (err) {
    // Someone else wrote first. Hand back their version so the client can merge
    // rather than blindly overwrite.
    if (err instanceof ConflictError) {
      return NextResponse.json(
        { error: err.message, conflict: true, ...err.current },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save roster" },
      { status: 500 }
    )
  }
}
