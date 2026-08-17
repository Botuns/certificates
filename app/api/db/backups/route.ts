import { NextResponse } from "next/server"

import {
  listBackups,
  readBackup,
  readDatabase,
  snapshot,
  writeDatabase,
} from "@/lib/db/blob"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    return NextResponse.json(
      { backups: await listBackups() },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list backups" },
      { status: 500 }
    )
  }
}

/** Restore a snapshot, first snapshotting the current state so this is undoable too. */
export async function POST(request: Request) {
  try {
    const { pathname } = (await request.json()) as { pathname?: string }
    if (!pathname) {
      return NextResponse.json(
        { error: "pathname is required" },
        { status: 400 }
      )
    }

    const restored = await readBackup(pathname)
    const { db: current, etag } = await readDatabase()
    await snapshot(current)

    const saved = await writeDatabase({ ...restored, rev: current.rev }, etag)
    return NextResponse.json(saved, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to restore backup",
      },
      { status: 500 }
    )
  }
}
