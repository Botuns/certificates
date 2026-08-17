"use client"

import { useEffect, useRef, useState } from "react"
import {
  Alert02Icon,
  Download01Icon,
  Refresh01Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import { ClearAllDialog } from "@/components/roster/clear-all-dialog"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { downloadBlob } from "@/lib/certificate/exporter"
import { actions, useStore } from "@/lib/db/store"
import { EVENT } from "@/lib/nav"
import type { BackupEntry, Database } from "@/lib/types"

export function SettingsView() {
  const { db, configured, status, error } = useStore()
  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Bumping this re-runs the fetch below; the Refresh button is the only caller.
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!configured) return
    let cancelled = false

    void (async () => {
      try {
        const res = await fetch("/api/db/backups", { cache: "no-store" })
        const body = (await res.json()) as { backups?: BackupEntry[] }
        if (!cancelled) setBackups(body.backups ?? [])
      } catch {
        /* listing is best-effort */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [configured, refreshKey])

  function refresh() {
    setLoading(true)
    setRefreshKey((n) => n + 1)
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(db, null, 2)], {
      type: "application/json",
    })
    const stamp = new Date().toISOString().slice(0, 10)
    downloadBlob(blob, `ijtema-roster-${stamp}.json`)
    toast.success("Backup downloaded")
  }

  async function importJson(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Database
      if (!Array.isArray(parsed?.atfal)) throw new Error("Not a roster backup")
      actions.replaceAll(parsed)
      toast.success(`Restored ${parsed.atfal.length} Atfal from file`)
    } catch (err) {
      toast.error("Could not read that backup", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  async function restore(pathname: string) {
    setRestoring(pathname)
    try {
      const res = await fetch("/api/db/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathname }),
      })
      if (!res.ok)
        throw new Error((await res.json())?.error ?? "Restore failed")
      toast.success("Backup restored", { description: "Reloading…" })
      setTimeout(() => window.location.reload(), 700)
    } catch (err) {
      toast.error("Could not restore", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setRestoring(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description={`${EVENT.org} · ${EVENT.dates}`}
      />

      <div className="grid max-w-4xl gap-4">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-heading text-sm font-bold">Storage</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {configured
              ? "The roster is saved to a db.json file in Vercel Blob, shared by everyone who opens this link."
              : "No Vercel Blob store is linked, so the roster is only saved in this browser. Set BLOB_READ_WRITE_TOKEN to share it."}
          </p>
          {status === "error" && error && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <HugeiconsIcon
                icon={Alert02Icon}
                className="mt-0.5 size-4 shrink-0"
              />
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportJson}>
              <HugeiconsIcon icon={Download01Icon} className="size-4" />
              Download backup (.json)
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <HugeiconsIcon icon={Upload01Icon} className="size-4" />
              Restore from file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importJson(f)
                e.target.value = ""
              }}
            />
          </div>
        </section>

        {configured && (
          <section className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-heading text-sm font-bold">
                  Automatic backups
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Saved before every import, bulk delete or clear. The last 20
                  are kept.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={refresh}>
                <HugeiconsIcon
                  icon={Refresh01Icon}
                  className={loading ? "size-4 animate-spin" : "size-4"}
                />
                Refresh
              </Button>
            </div>

            <div className="mt-4 space-y-1.5">
              {backups.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {loading ? "Loading…" : "No backups yet"}
                </p>
              )}
              {backups.map((b) => (
                <div
                  key={b.pathname}
                  className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {new Date(b.uploadedAt).toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {(b.size / 1024).toFixed(1)} KB
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={restoring !== null}
                    onClick={() => void restore(b.pathname)}
                  >
                    {restoring === b.pathname ? "Restoring…" : "Restore"}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-destructive/30 bg-card p-5">
          <h2 className="font-heading text-sm font-bold text-destructive">
            Danger zone
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Removes every Atfal for everyone. A backup is saved first.
          </p>
          <div className="mt-4">
            <ClearAllDialog
              trigger={
                <Button variant="outline" className="text-destructive">
                  Clear the roster ({db.atfal.length})
                </Button>
              }
            />
          </div>
        </section>
      </div>
    </>
  )
}
