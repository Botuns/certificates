import "server-only"

import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  del,
  get,
  list,
  put,
} from "@vercel/blob"

import { defaultFields } from "@/lib/certificate/geometry"
import type { Atfal, BackupEntry, Database, Field } from "@/lib/types"

const DB_PATH = "certificates/db.json"
const BACKUP_PREFIX = "certificates/backups/"
const MAX_BACKUPS = 20

/** Blob's minimum permitted cache TTL is 60s; reads bypass it with useCache:false. */
const CACHE_MAX_AGE = 60

export class ConflictError extends Error {
  constructor(public readonly current: LoadedDatabase) {
    super("The roster was changed by someone else")
    this.name = "ConflictError"
  }
}

export type LoadedDatabase = { db: Database; etag: string | null }

export function emptyDatabase(): Database {
  return { rev: 0, atfal: [], fields: defaultFields(), updatedAt: Date.now() }
}

export function isBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

function coerce(raw: unknown): Database {
  const base = emptyDatabase()
  if (!raw || typeof raw !== "object") return base

  const o = raw as Partial<Database>
  const atfal: Atfal[] = Array.isArray(o.atfal)
    ? o.atfal
        .filter((a): a is Atfal => Boolean(a) && typeof a === "object")
        .map((a) => ({
          id: String(a.id ?? crypto.randomUUID()),
          name: String(a.name ?? "").trim(),
          dila: String(a.dila ?? "").trim(),
          createdAt: Number(a.createdAt) || Date.now(),
        }))
        .filter((a) => a.name.length > 0)
    : []

  // Merge stored fields over the defaults so a field added in a later version
  // still gets sane values when reading an older db.json.
  const stored = Array.isArray(o.fields) ? o.fields : []
  const fields: Field[] = base.fields.map((def) => {
    const hit = stored.find((f) => f && (f as Field).id === def.id)
    return hit ? { ...def, ...(hit as Field) } : def
  })
  for (const f of stored) {
    const extra = f as Field
    if (extra?.id && !fields.some((x) => x.id === extra.id)) fields.push(extra)
  }

  return {
    rev: Number(o.rev) || 0,
    atfal,
    fields,
    updatedAt: Number(o.updatedAt) || Date.now(),
  }
}

/**
 * Read db.json straight from origin storage.
 *
 * `useCache: false` is deliberate: Vercel Blob serves through a CDN whose
 * minimum TTL is 60s, so a cached read could hand back a roster that is a
 * minute stale — and, worse, a stale ETag would then fail every conditional
 * write. Correctness beats the few ms this costs.
 */
export async function readDatabase(): Promise<LoadedDatabase> {
  if (!isBlobConfigured()) return { db: emptyDatabase(), etag: null }

  try {
    const res = await get(DB_PATH, { access: "public", useCache: false })
    if (!res || res.statusCode !== 200)
      return { db: emptyDatabase(), etag: null }

    const text = await new Response(res.stream).text()
    return { db: coerce(JSON.parse(text)), etag: res.blob.etag }
  } catch (err) {
    // First ever run: nothing has been written yet.
    if (err instanceof BlobNotFoundError)
      return { db: emptyDatabase(), etag: null }
    throw err
  }
}

/**
 * Write db.json, refusing to clobber a concurrent edit.
 *
 * `ifMatch` makes this a genuine compare-and-swap at the storage layer, so two
 * open tabs cannot silently lose each other's changes — the loser gets a
 * ConflictError carrying the current state to reconcile against.
 */
export async function writeDatabase(
  next: Database,
  expectedEtag: string | null
): Promise<LoadedDatabase> {
  if (!isBlobConfigured()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set. Link a Vercel Blob store, or add it to .env.local for local dev."
    )
  }

  const payload: Database = {
    ...next,
    rev: next.rev + 1,
    updatedAt: Date.now(),
  }

  try {
    const res = await put(DB_PATH, JSON.stringify(payload), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: CACHE_MAX_AGE,
      // Omitted on first write, when there is no blob to match against.
      ...(expectedEtag ? { ifMatch: expectedEtag } : {}),
    })
    return { db: payload, etag: res.etag ?? null }
  } catch (err) {
    if (err instanceof BlobPreconditionFailedError) {
      throw new ConflictError(await readDatabase())
    }
    throw err
  }
}

/**
 * Snapshot the *previous* state before a destructive change. The app is open
 * with no auth, so "delete all" is one click away for anyone with the link —
 * these snapshots are the undo.
 */
export async function snapshot(db: Database): Promise<void> {
  if (!isBlobConfigured() || db.atfal.length === 0) return

  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  await put(`${BACKUP_PREFIX}db-${stamp}.json`, JSON.stringify(db), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: CACHE_MAX_AGE,
  })
  await pruneBackups()
}

async function pruneBackups() {
  const { blobs } = await list({ prefix: BACKUP_PREFIX, limit: 1000 })
  if (blobs.length <= MAX_BACKUPS) return

  const stale = blobs
    .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
    .slice(MAX_BACKUPS)
  if (stale.length) await del(stale.map((b) => b.url))
}

export async function listBackups(): Promise<BackupEntry[]> {
  if (!isBlobConfigured()) return []
  const { blobs } = await list({ prefix: BACKUP_PREFIX, limit: 1000 })
  return blobs
    .map((b) => ({
      pathname: b.pathname,
      url: b.url,
      size: b.size,
      uploadedAt: new Date(b.uploadedAt).toISOString(),
    }))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
}

export async function readBackup(pathname: string): Promise<Database> {
  if (!pathname.startsWith(BACKUP_PREFIX))
    throw new Error("Invalid backup path")
  const res = await get(pathname, { access: "public", useCache: false })
  if (!res || res.statusCode !== 200) throw new Error("Backup not found")
  return coerce(JSON.parse(await new Response(res.stream).text()))
}
