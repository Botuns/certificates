import "server-only"

import {
  type BlobAccessType,
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

/**
 * Access mode of the Blob store.
 *
 * "private" is the right default here: db.json holds the full names of
 * children, and a public blob is readable by anyone who learns its URL. Only
 * this server ever reads it — the browser always goes through /api/db.
 *
 * A store is created as either public or private and the SDK rejects the wrong
 * mode outright ("Cannot use public access on a private store"), which is a
 * 500 that is very hard to diagnose from the browser. So the mode is detected
 * once from the store's own error and reused.
 */
let accessMode: BlobAccessType = "private"

function isAccessMismatch(err: unknown): boolean {
  return (
    err instanceof Error &&
    /cannot use (public|private) access on a (private|public) store/i.test(
      err.message
    )
  )
}

/** Run a Blob call, flipping the access mode once if the store disagrees. */
async function withAccess<T>(
  fn: (access: BlobAccessType) => Promise<T>
): Promise<T> {
  try {
    return await fn(accessMode)
  } catch (err) {
    if (!isAccessMismatch(err)) throw err
    accessMode = accessMode === "private" ? "public" : "private"
    return fn(accessMode)
  }
}

/**
 * Normalise an ETag to its strong form.
 *
 * `get()` returns a *weak* validator (`W/"abc…"`) once the payload is large
 * enough for the response to be compressed, but `put({ ifMatch })` only ever
 * matches the *strong* form (`"abc…"`) that `put()` itself returns. Handing the
 * weak tag straight back makes every conditional write fail its precondition,
 * so the roster silently stops saving once it grows past a few hundred bytes —
 * tiny test payloads pass, real ones don't.
 */
function strongEtag(etag: string | null | undefined): string | null {
  if (!etag) return null
  return etag.replace(/^W\//, "")
}

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
    const res = await withAccess((access) =>
      get(DB_PATH, { access, useCache: false })
    )
    if (!res || res.statusCode !== 200)
      return { db: emptyDatabase(), etag: null }

    const text = await new Response(res.stream).text()
    return { db: coerce(JSON.parse(text)), etag: strongEtag(res.blob.etag) }
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

  const ifMatch = strongEtag(expectedEtag)

  try {
    const res = await withAccess((access) =>
      put(DB_PATH, JSON.stringify(payload), {
        access,
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: CACHE_MAX_AGE,
        // Omitted on first write, when there is no blob to match against.
        ...(ifMatch ? { ifMatch } : {}),
      })
    )
    return { db: payload, etag: strongEtag(res.etag) }
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
  await withAccess((access) =>
    put(`${BACKUP_PREFIX}db-${stamp}.json`, JSON.stringify(db), {
      access,
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: CACHE_MAX_AGE,
    })
  )
  await pruneBackups()
}

async function pruneBackups() {
  const { blobs } = await list({ prefix: BACKUP_PREFIX, limit: 1000 })
  if (blobs.length <= MAX_BACKUPS) return

  const stale = blobs
    .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
    .slice(MAX_BACKUPS)
  // Delete by pathname: a private store's blob URLs are not directly usable.
  if (stale.length) await del(stale.map((b) => b.pathname))
}

export async function listBackups(): Promise<BackupEntry[]> {
  if (!isBlobConfigured()) return []
  const { blobs } = await list({ prefix: BACKUP_PREFIX, limit: 1000 })
  return blobs
    .map((b) => ({
      pathname: b.pathname,
      size: b.size,
      uploadedAt: new Date(b.uploadedAt).toISOString(),
    }))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
}

export async function readBackup(pathname: string): Promise<Database> {
  if (!pathname.startsWith(BACKUP_PREFIX))
    throw new Error("Invalid backup path")
  const res = await withAccess((access) =>
    get(pathname, { access, useCache: false })
  )
  if (!res || res.statusCode !== 200) throw new Error("Backup not found")
  return coerce(JSON.parse(await new Response(res.stream).text()))
}
