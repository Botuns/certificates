"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  Alert02Icon,
  Download01Icon,
  FolderZipIcon,
  PrinterIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import { CertificateCanvas } from "@/components/editor/certificate-canvas"
import { PageHeader } from "@/components/shell/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import {
  downloadBlob,
  generatePdfBytes,
  generateZip,
  pdfBlob,
  printBytes,
} from "@/lib/certificate/exporter"
import { useStore } from "@/lib/db/store"
import { getPrintSelection } from "@/lib/print-selection"
import { dilaCounts, dilaOf, safeFileName, sortForPrint } from "@/lib/roster"
import { cn } from "@/lib/utils"

/** Measured: artwork + embedded fonts make every standalone PDF ~1.07 MB. */
const MB_PER_FILE = 1.07
const ZIP_WARN_FILES = 40

type Scope = "all" | "dila" | "selected"
type Job = { label: string; done: number; total: number } | null

export function PrintView() {
  const { db } = useStore()

  // Read the hand-off once, at mount. Arriving here from the roster is always
  // a client-side navigation, so there is no server render to disagree with.
  const [selectedIds] = useState<string[]>(() => getPrintSelection())
  const [scope, setScope] = useState<Scope>(() =>
    getPrintSelection().length ? "selected" : "all"
  )
  const [chosenDilas, setChosenDilas] = useState<Set<string>>(new Set())
  const [job, setJob] = useState<Job>(null)

  const counts = useMemo(() => dilaCounts(db.atfal), [db.atfal])

  const records = useMemo(() => {
    if (scope === "selected") {
      const ids = new Set(selectedIds)
      return sortForPrint(db.atfal.filter((a) => ids.has(a.id)))
    }
    if (scope === "dila") {
      return sortForPrint(db.atfal.filter((a) => chosenDilas.has(dilaOf(a))))
    }
    return sortForPrint(db.atfal)
  }, [scope, db.atfal, chosenDilas, selectedIds])

  const payload = useMemo(
    () => records.map((a) => ({ name: a.name, dila: dilaOf(a) })),
    [records]
  )

  const busy = job !== null

  function baseName() {
    if (scope === "dila" && chosenDilas.size === 1) {
      return safeFileName(`Ijtema 2026 - ${[...chosenDilas][0]}`)
    }
    if (scope === "selected" && records.length === 1) {
      return safeFileName(`Ijtema 2026 - ${records[0].name}`)
    }
    return `Ijtema 2026 Certificates (${records.length})`
  }

  async function run<T>(
    label: string,
    fn: (p: (d: number, t: number) => void) => Promise<T>
  ) {
    setJob({ label, done: 0, total: records.length })
    try {
      return await fn((done, total) => setJob({ label, done, total }))
    } finally {
      setJob(null)
    }
  }

  async function downloadMerged() {
    if (!payload.length) return
    try {
      const bytes = await run("Building your PDF", (p) =>
        generatePdfBytes(db.fields, payload, p)
      )
      downloadBlob(pdfBlob(bytes), `${baseName()}.pdf`)
      toast.success(
        `${records.length} certificate${records.length === 1 ? "" : "s"} ready`
      )
    } catch (err) {
      toast.error("Could not build the PDF", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  async function printNow() {
    if (!payload.length) return
    try {
      const bytes = await run("Preparing to print", (p) =>
        generatePdfBytes(db.fields, payload, p)
      )
      printBytes(bytes)
    } catch (err) {
      toast.error("Could not open the print view", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  async function downloadZip() {
    if (!payload.length) return
    try {
      const blob = await run("Building separate files", (p) =>
        generateZip(db.fields, payload, p)
      )
      downloadBlob(blob, `${baseName()}.zip`)
      toast.success(`${records.length} separate files ready`)
    } catch (err) {
      toast.error("Could not build the ZIP", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const zipMb = Math.round(records.length * MB_PER_FILE)

  return (
    <>
      <PageHeader
        title="Print certificates"
        description="Choose who to print for, then download a single PDF or one file each."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-4">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(
                [
                  ["all", `Everyone (${db.atfal.length})`],
                  ["dila", "By Dila"],
                  ["selected", `Selected (${selectedIds.length})`],
                ] as [Scope, string][]
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={scope === value ? "default" : "outline"}
                  onClick={() => setScope(value)}
                  disabled={value === "selected" && selectedIds.length === 0}
                >
                  {label}
                </Button>
              ))}
            </div>

            {scope === "dila" && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setChosenDilas(new Set(counts.map((c) => c.dila)))
                    }
                  >
                    Select all
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setChosenDilas(new Set())}
                  >
                    Clear
                  </Button>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {counts.map((c) => (
                    <label
                      key={c.dila}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors",
                        chosenDilas.has(c.dila) &&
                          "border-primary/40 bg-primary/5"
                      )}
                    >
                      <Checkbox
                        checked={chosenDilas.has(c.dila)}
                        onCheckedChange={(v) =>
                          setChosenDilas((prev) => {
                            const next = new Set(prev)
                            if (v) next.add(c.dila)
                            else next.delete(c.dila)
                            return next
                          })
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{c.dila}</span>
                      <Badge variant="secondary">{c.count}</Badge>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {scope === "selected" && selectedIds.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing selected yet — pick people on the{" "}
                <Link
                  href="/roster"
                  className="font-medium text-primary hover:underline"
                >
                  Roster
                </Link>{" "}
                page and choose Print.
              </p>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <p className="mb-2 text-sm font-medium">
              {records.length} certificate{records.length === 1 ? "" : "s"} will
              be printed
            </p>
            {records.length > 0 ? (
              <div className="max-h-64 overflow-y-auto rounded-xl border">
                <table className="w-full text-sm">
                  <tbody>
                    {records.slice(0, 200).map((a, i) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="w-10 p-2 text-xs text-muted-foreground tabular-nums">
                          {i + 1}
                        </td>
                        <td className="p-2 font-medium">{a.name}</td>
                        <td className="p-2 text-right text-muted-foreground">
                          {dilaOf(a)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {records.length > 200 && (
                  <p className="p-2 text-center text-xs text-muted-foreground">
                    …and {records.length - 200} more
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No one matches this selection.
              </p>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-4">
            <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Preview
            </p>
            <CertificateCanvas
              fields={db.fields}
              values={{
                name: records[0]?.name ?? "Abdul-Qahar Olajide",
                dila: records[0] ? dilaOf(records[0]) : "Ibadan",
              }}
              interactive={false}
            />
            <Link
              href="/editor"
              className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
            >
              Adjust the layout →
            </Link>
          </div>

          <div className="space-y-2 rounded-2xl border bg-card p-4">
            {job && (
              <div className="mb-3 space-y-1.5">
                <p className="text-sm font-medium">{job.label}…</p>
                <Progress
                  value={job.total ? (job.done / job.total) * 100 : 0}
                />
                <p className="text-xs text-muted-foreground tabular-nums">
                  {job.done} of {job.total}
                </p>
              </div>
            )}

            <Button
              className="w-full"
              disabled={!records.length || busy}
              onClick={downloadMerged}
            >
              <HugeiconsIcon icon={Download01Icon} className="size-4" />
              Download one PDF
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={!records.length || busy}
              onClick={printNow}
            >
              <HugeiconsIcon icon={PrinterIcon} className="size-4" />
              Print now
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={!records.length || busy}
              onClick={downloadZip}
            >
              <HugeiconsIcon icon={FolderZipIcon} className="size-4" />
              Separate files (.zip)
            </Button>

            <p className="pt-1 text-xs text-muted-foreground">
              One PDF is best for printing — {records.length || 0} page
              {records.length === 1 ? "" : "s"} in a single file of about 1 MB,
              sent to the printer as one job.
            </p>

            {records.length > ZIP_WARN_FILES && (
              <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-400">
                <HugeiconsIcon
                  icon={Alert02Icon}
                  className="mt-0.5 size-3.5 shrink-0"
                />
                <span>
                  Separate files repeat the artwork in every file — this ZIP
                  would be roughly {zipMb} MB. Use the single PDF unless you
                  need to send certificates individually.
                </span>
              </p>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
