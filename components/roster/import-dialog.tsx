"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import {
  Alert02Icon,
  Tick02Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { actions, useStore } from "@/lib/db/store"
import { buildRows } from "@/lib/import/clean"
import {
  detectLayout,
  ROLE_LABELS,
  type ColumnRole,
  type Detection,
} from "@/lib/import/detect"
import {
  ACCEPTED_TYPES,
  parseWorkbook,
  type SheetData,
} from "@/lib/import/parse"
import { cn } from "@/lib/utils"

const ROLES: ColumnRole[] = [
  "ignore",
  "name",
  "firstName",
  "lastName",
  "otherNames",
  "dila",
]

export function ImportDialog({ trigger }: { trigger: React.ReactElement }) {
  const { db } = useStore()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fileName, setFileName] = useState("")
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [sheetIndex, setSheetIndex] = useState(0)
  const [detection, setDetection] = useState<Detection | null>(null)
  const [headerRow, setHeaderRow] = useState<number | null>(null)
  const [mapping, setMapping] = useState<Record<number, ColumnRole>>({})
  const [titleCase, setTitleCase] = useState(true)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Memoised so the ?? [] fallback doesn't produce a new array identity on
  // every render and thrash the useMemos that depend on it.
  const grid = useMemo(
    () => sheets[sheetIndex]?.rows ?? [],
    [sheets, sheetIndex]
  )

  const applySheet = useCallback((data: SheetData[], index: number) => {
    const det = detectLayout(data[index]?.rows ?? [])
    setSheetIndex(index)
    setDetection(det)
    setHeaderRow(det.headerRow)
    setMapping(det.mapping)
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true)
      try {
        const parsed = await parseWorkbook(file)
        if (!parsed.length) {
          toast.error("That file has no readable rows")
          return
        }
        setFileName(file.name)
        setSheets(parsed)
        applySheet(parsed, 0)
      } catch (err) {
        toast.error("Could not read that file", {
          description:
            err instanceof Error ? err.message : "Unsupported format",
        })
      } finally {
        setBusy(false)
      }
    },
    [applySheet]
  )

  const result = useMemo(() => {
    if (!grid.length) return null
    return buildRows(grid, headerRow, mapping, {
      titleCase,
      skipDuplicates,
      existing: db.atfal,
    })
  }, [grid, headerRow, mapping, titleCase, skipDuplicates, db.atfal])

  const columnCount = useMemo(
    () => Math.max(...grid.slice(0, 30).map((r) => r.length), 0),
    [grid]
  )

  const headerCells = headerRow === null ? [] : (grid[headerRow] ?? [])
  const hasName = Object.values(mapping).some(
    (r) => r === "name" || r === "firstName" || r === "lastName"
  )

  function reset() {
    setFileName("")
    setSheets([])
    setDetection(null)
    setHeaderRow(null)
    setMapping({})
    setSheetIndex(0)
  }

  function commit() {
    if (!result?.rows.length) return
    const n = actions.addMany(result.rows)
    toast.success(`Imported ${n} Atfal`, {
      description: "A backup of the previous roster was saved.",
    })
    setOpen(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[92svh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Import from Excel or CSV</DialogTitle>
          <DialogDescription>
            Columns are detected automatically — check the preview and correct
            anything that looks wrong before importing.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(92svh-9.5rem)] overflow-y-auto px-5 py-4">
          {!sheets.length ? (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                const f = e.dataTransfer.files?.[0]
                if (f) void handleFile(f)
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
                <HugeiconsIcon icon={Upload01Icon} className="size-6" />
              </span>
              <div>
                <p className="font-medium">Drop your roster here</p>
                <p className="text-sm text-muted-foreground">
                  .xlsx, .xls or .csv — messy headers are fine
                </p>
              </div>
              <Button onClick={() => inputRef.current?.click()} disabled={busy}>
                {busy ? "Reading…" : "Choose a file"}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                  e.target.value = ""
                }}
              />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{fileName}</span>
                <button
                  type="button"
                  onClick={reset}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Choose another file
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {sheets.length > 1 && (
                  <div className="space-y-1.5">
                    <Label>Sheet</Label>
                    <Select
                      value={String(sheetIndex)}
                      onValueChange={(v) => applySheet(sheets, Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {(v) => {
                            const sheet = sheets[Number(v)]
                            return sheet
                              ? `${sheet.name} (${sheet.rows.length} rows)`
                              : "Sheet"
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {sheets.map((s, i) => (
                          <SelectItem key={s.name} value={String(i)}>
                            {s.name} ({s.rows.length} rows)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Header row</Label>
                  <Select
                    value={headerRow === null ? "none" : String(headerRow)}
                    onValueChange={(v) =>
                      setHeaderRow(v === "none" ? null : Number(v))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(v) =>
                          v === "none"
                            ? "No header — data starts at row 1"
                            : `Row ${Number(v) + 1}`
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        No header — data starts at row 1
                      </SelectItem>
                      {grid.slice(0, 10).map((row, i) => (
                        <SelectItem key={i} value={String(i)}>
                          Row {i + 1}:{" "}
                          {row.filter(Boolean).slice(0, 3).join(" · ") ||
                            "(blank)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {detection && !detection.confident && (
                <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                  <HugeiconsIcon
                    icon={Alert02Icon}
                    className="mt-0.5 size-4 shrink-0"
                  />
                  We had to guess some columns. Please check the mapping below.
                </p>
              )}

              <div className="space-y-2">
                <Label>What is in each column?</Label>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {Array.from({ length: columnCount }, (_, c) => (
                          <th key={c} className="p-2 text-left align-top">
                            <p className="mb-1.5 truncate text-xs font-semibold text-muted-foreground">
                              {headerCells[c]?.trim() || `Column ${c + 1}`}
                            </p>
                            <Select
                              value={mapping[c] ?? "ignore"}
                              onValueChange={(v) =>
                                setMapping((m) => ({
                                  ...m,
                                  [c]: v as ColumnRole,
                                }))
                              }
                            >
                              <SelectTrigger
                                size="sm"
                                className="w-full min-w-32"
                              >
                                <SelectValue>
                                  {(v) => ROLE_LABELS[v as ColumnRole]}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map((r) => (
                                  <SelectItem key={r} value={r}>
                                    {ROLE_LABELS[r]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {grid
                        .slice(headerRow === null ? 0 : headerRow + 1)
                        .slice(0, 5)
                        .map((row, r) => (
                          <tr key={r} className="border-b last:border-0">
                            {Array.from({ length: columnCount }, (_, c) => (
                              <td
                                key={c}
                                className={cn(
                                  "max-w-40 truncate p-2",
                                  (mapping[c] ?? "ignore") === "ignore" &&
                                    "text-muted-foreground/50"
                                )}
                              >
                                {row[c] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={titleCase}
                    onCheckedChange={(v) => setTitleCase(v === true)}
                  />
                  Fix capitalisation (ABDUL → Abdul)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={skipDuplicates}
                    onCheckedChange={(v) => setSkipDuplicates(v === true)}
                  />
                  Skip duplicates
                </label>
              </div>

              {result && (
                <div className="space-y-3 rounded-xl bg-muted/50 p-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="flex items-center gap-1.5 font-semibold text-primary">
                      <HugeiconsIcon icon={Tick02Icon} className="size-4" />
                      {result.rows.length} ready to import
                    </span>
                    {result.skipped > 0 && (
                      <span className="text-muted-foreground">
                        {result.skipped} blank row
                        {result.skipped === 1 ? "" : "s"} skipped
                      </span>
                    )}
                    {result.duplicatesInFile > 0 && (
                      <span className="text-muted-foreground">
                        {result.duplicatesInFile} duplicate
                        {result.duplicatesInFile === 1 ? "" : "s"} in file
                      </span>
                    )}
                    {result.duplicatesExisting > 0 && (
                      <span className="text-muted-foreground">
                        {result.duplicatesExisting} already in roster
                      </span>
                    )}
                  </div>

                  {result.rows.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-lg border bg-background">
                      <table className="w-full text-sm">
                        <tbody>
                          {result.rows.slice(0, 50).map((r, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="p-2 font-medium">{r.name}</td>
                              <td className="p-2 text-right text-muted-foreground">
                                {r.dila || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!hasName && (
                    <p className="text-sm text-destructive">
                      Pick which column holds the name before importing.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-5 py-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={commit} disabled={!result?.rows.length || !hasName}>
            Import {result?.rows.length ? `${result.rows.length} Atfal` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
