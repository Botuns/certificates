"use client"

import { useSyncExternalStore } from "react"

import { defaultFields } from "@/lib/certificate/geometry"
import { mergeDatabases, unionDatabases } from "@/lib/db/merge"
import type { Atfal, Database, Field } from "@/lib/types"

const CACHE_KEY = "ijtema-certs:v1"
const SYNC_DEBOUNCE_MS = 800

export type SyncStatus = "idle" | "loading" | "saving" | "error" | "offline"

export type StoreState = {
  db: Database
  etag: string | null
  status: SyncStatus
  ready: boolean
  error: string | null
  /** False when BLOB_READ_WRITE_TOKEN is missing — the app runs local-only. */
  configured: boolean
}

const emptyDb = (): Database => ({
  rev: 0,
  atfal: [],
  fields: defaultFields(),
  updatedAt: Date.now(),
})

let state: StoreState = {
  db: emptyDb(),
  etag: null,
  status: "loading",
  ready: false,
  error: null,
  configured: true,
}

/** Last state confirmed by the server — the merge base. */
let base: Database = emptyDb()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null
let inFlight: Promise<void> | null = null
let pending = false
let booted = false

function emit() {
  for (const l of listeners) l()
}

function set(patch: Partial<StoreState>) {
  state = { ...state, ...patch }
  emit()
}

type CacheShape = {
  db: Database
  /** Last state the server confirmed, or null if we have never synced. */
  base: Database | null
}

/**
 * Persist the working copy *and* the last synced state. Keeping the ancestor
 * across reloads is what lets the next boot tell a genuine remote deletion
 * apart from a record that simply never reached the server.
 */
function cache(db: Database, syncedBase: Database | null = base) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ db, base: syncedBase } satisfies CacheShape)
    )
  } catch {
    /* quota or private mode — the server copy is still authoritative */
  }
}

function normalise(db: Database): Database {
  if (!Array.isArray(db.fields) || db.fields.length === 0) {
    db.fields = defaultFields()
  }
  return db
}

function readCache(): CacheShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheShape
    if (!parsed || typeof parsed !== "object") return null
    if (!Array.isArray(parsed.db?.atfal)) return null
    return {
      db: normalise(parsed.db),
      base:
        parsed.base && Array.isArray(parsed.base.atfal) ? parsed.base : null,
    }
  } catch {
    return null
  }
}

/** Apply a change locally right away, then sync in the background. */
function mutate(
  fn: (db: Database) => Database,
  opts: { snapshot?: boolean } = {}
) {
  const next = fn(state.db)
  set({ db: next })
  cache(next)
  scheduleSync(opts.snapshot ?? false)
}

let wantsSnapshot = false

function scheduleSync(snapshot: boolean) {
  wantsSnapshot ||= snapshot
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void flush(), SYNC_DEBOUNCE_MS)
}

/** Push local state to the server, merging if someone else got there first. */
export async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (inFlight) {
    pending = true
    return inFlight
  }

  // Boot hasn't answered yet, so we don't know the etag or whether a Blob
  // store even exists. Editing the moment the page loads used to fire a PUT
  // into that gap. The change is already in localStorage; try again shortly.
  if (!state.ready) {
    scheduleSync(wantsSnapshot)
    return
  }

  // No Blob store linked: the localStorage copy written by mutate() is the
  // only store there is. Posting would just 500 and surface a scary error for
  // what is a supported local-only mode.
  if (!state.configured) {
    set({ status: "offline" })
    return
  }

  const snapshot = wantsSnapshot
  wantsSnapshot = false
  set({ status: "saving", error: null })

  inFlight = (async () => {
    try {
      const res = await fetch("/api/db", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ db: state.db, etag: state.etag, snapshot }),
      })

      if (res.status === 409) {
        const remote = (await res.json()) as {
          db: Database
          etag: string | null
        }
        const merged = mergeDatabases(base, state.db, remote.db)
        set({ db: merged, etag: remote.etag })
        cache(merged)
        // Retry once against the version we just merged onto.
        const retry = await fetch("/api/db", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ db: merged, etag: remote.etag }),
        })
        if (!retry.ok)
          throw new Error((await retry.json())?.error ?? "Save failed")
        const saved = (await retry.json()) as {
          db: Database
          etag: string | null
        }
        base = saved.db
        set({ db: saved.db, etag: saved.etag, status: "idle" })
        cache(saved.db)
        return
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Save failed (${res.status})`)
      }

      const saved = (await res.json()) as { db: Database; etag: string | null }
      base = saved.db
      // Keep any edits made while the request was in flight.
      const stillLocal = state.db
      const reconciled =
        stillLocal.updatedAt > saved.db.updatedAt ? stillLocal : saved.db
      set({ db: reconciled, etag: saved.etag, status: "idle" })
      cache(reconciled)
    } catch (err) {
      set({
        status: "error",
        error: err instanceof Error ? err.message : "Could not save",
      })
    } finally {
      inFlight = null
      if (pending) {
        pending = false
        scheduleSync(false)
      }
    }
  })()

  return inFlight
}

/** Boot: paint from cache instantly, then reconcile with the server. */
export function initStore() {
  if (booted || typeof window === "undefined") return
  booted = true

  const cached = readCache()
  if (cached) {
    base = cached.base ?? cached.db
    set({ db: cached.db, ready: true })
  }

  void (async () => {
    try {
      const res = await fetch("/api/db", { cache: "no-store" })
      if (!res.ok) throw new Error(`Load failed (${res.status})`)
      const body = (await res.json()) as {
        db: Database
        etag: string | null
        configured: boolean
      }

      // Reconcile the cached copy with the server.
      //
      // With a known ancestor this is a real 3-way merge, so a deletion made
      // elsewhere is honoured. Without one — first run on this device, or a
      // session that never managed to sync — we fall back to a union, because
      // "missing from the server" is then indistinguishable from "never
      // uploaded", and guessing "deleted" would wipe the roster.
      let merged: Database
      if (!cached) {
        merged = body.db
      } else if (cached.base) {
        merged = mergeDatabases(cached.base, cached.db, body.db)
      } else {
        merged = unionDatabases(cached.db, body.db)
      }

      const dirty = JSON.stringify(merged) !== JSON.stringify(body.db)

      base = body.db
      set({
        db: merged,
        etag: body.etag,
        ready: true,
        configured: body.configured,
        status: body.configured ? "idle" : "offline",
      })
      cache(merged, body.db)
      if (dirty && body.configured) scheduleSync(false)
    } catch (err) {
      set({
        ready: true,
        status: "error",
        error:
          err instanceof Error ? err.message : "Could not reach the server",
      })
    }
  })()

  // Don't lose the last keystrokes when the tab is closed or backgrounded.
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && timer) void flush()
  })
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

const getSnapshot = () => state
const serverSnapshot: StoreState = {
  db: emptyDb(),
  etag: null,
  status: "loading",
  ready: false,
  error: null,
  configured: true,
}
const getServerSnapshot = () => serverSnapshot

export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/* ---------------------------------------------------------------- actions */

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `a_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

export const actions = {
  addAtfal(name: string, dila: string) {
    const entry: Atfal = {
      id: newId(),
      name: name.trim(),
      dila: dila.trim(),
      createdAt: Date.now(),
    }
    mutate((db) => ({
      ...db,
      atfal: [entry, ...db.atfal],
      updatedAt: Date.now(),
    }))
    return entry
  },

  addMany(rows: { name: string; dila: string }[]) {
    const now = Date.now()
    const entries: Atfal[] = rows.map((r, i) => ({
      id: newId(),
      name: r.name.trim(),
      dila: r.dila.trim(),
      createdAt: now + i,
    }))
    mutate(
      (db) => ({
        ...db,
        atfal: [...entries, ...db.atfal],
        updatedAt: Date.now(),
      }),
      { snapshot: true }
    )
    return entries.length
  },

  updateAtfal(id: string, patch: Partial<Pick<Atfal, "name" | "dila">>) {
    mutate((db) => ({
      ...db,
      atfal: db.atfal.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      updatedAt: Date.now(),
    }))
  },

  removeAtfal(id: string) {
    mutate((db) => ({
      ...db,
      atfal: db.atfal.filter((a) => a.id !== id),
      updatedAt: Date.now(),
    }))
  },

  removeMany(ids: string[]) {
    const set_ = new Set(ids)
    mutate(
      (db) => ({
        ...db,
        atfal: db.atfal.filter((a) => !set_.has(a.id)),
        updatedAt: Date.now(),
      }),
      { snapshot: true }
    )
  },

  clearAll() {
    mutate((db) => ({ ...db, atfal: [], updatedAt: Date.now() }), {
      snapshot: true,
    })
  },

  /** Bulk-rename a Dila — used by the spelling-variant normaliser. */
  renameDila(from: string, to: string) {
    mutate(
      (db) => ({
        ...db,
        atfal: db.atfal.map((a) =>
          a.dila === from ? { ...a, dila: to.trim() } : a
        ),
        updatedAt: Date.now(),
      }),
      { snapshot: true }
    )
  },

  updateField(id: string, patch: Partial<Field>) {
    mutate((db) => ({
      ...db,
      fields: db.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      updatedAt: Date.now(),
    }))
  },

  resetFields() {
    mutate((db) => ({ ...db, fields: defaultFields(), updatedAt: Date.now() }))
  },

  replaceAll(db: Database) {
    mutate(() => ({ ...db, updatedAt: Date.now() }), { snapshot: true })
  },

  retry() {
    void flush()
  },
}
