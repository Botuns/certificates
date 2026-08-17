"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import {
  Delete02Icon,
  PlusSignIcon,
  PrinterIcon,
  Search01Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import { AddAtfalDialog } from "@/components/roster/atfal-form"
import { ClearAllDialog } from "@/components/roster/clear-all-dialog"
import { DilaNormalizer } from "@/components/roster/dila-normalizer"
import { ImportDialog } from "@/components/roster/import-dialog"
import { RosterTable } from "@/components/roster/roster-table"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { actions, useStore } from "@/lib/db/store"
import { setPrintSelection } from "@/lib/print-selection"
import { dilaCounts, filterRoster, sortForPrint } from "@/lib/roster"

const ALL = "__all__"

export function RosterView() {
  const router = useRouter()
  const params = useSearchParams()
  const { db, ready } = useStore()

  const [query, setQuery] = useState(params.get("q") ?? "")
  const [dila, setDila] = useState(params.get("dila") ?? ALL)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // The sidebar Dila links and the topbar search change the URL while this
  // component stays mounted, so the inputs have to follow. React's documented
  // way to do that is to adjust state during render, not in an effect.
  const urlKey = params.toString()
  const [lastUrlKey, setLastUrlKey] = useState(urlKey)
  if (urlKey !== lastUrlKey) {
    setLastUrlKey(urlKey)
    setQuery(params.get("q") ?? "")
    setDila(params.get("dila") ?? ALL)
  }

  const counts = useMemo(() => dilaCounts(db.atfal), [db.atfal])

  const rows = useMemo(
    () =>
      sortForPrint(
        filterRoster(db.atfal, { query, dila: dila === ALL ? null : dila })
      ),
    [db.atfal, query, dila]
  )

  // Drop selections that are no longer visible so bulk actions can't reach
  // records the user cannot see.
  const visibleSelected = useMemo(() => {
    const visible = new Set(rows.map((r) => r.id))
    return [...selected].filter((id) => visible.has(id))
  }, [rows, selected])

  function printSelection(ids: string[]) {
    if (!ids.length) return
    setPrintSelection(ids)
    router.push("/print")
  }

  function deleteSelected() {
    actions.removeMany(visibleSelected)
    toast.success(`Removed ${visibleSelected.length} Atfal`, {
      description: "A backup was saved first.",
    })
    setSelected(new Set())
  }

  return (
    <>
      <PageHeader
        title="Roster"
        description={
          ready
            ? `${db.atfal.length} Atfal across ${counts.length} Dila${counts.length === 1 ? "" : "s"}`
            : "Loading…"
        }
        actions={
          <>
            <ImportDialog
              trigger={
                <Button variant="outline">
                  <HugeiconsIcon icon={Upload01Icon} className="size-4" />
                  Import
                </Button>
              }
            />
            <AddAtfalDialog
              trigger={
                <Button>
                  <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
                  Add Atfal
                </Button>
              }
            />
          </>
        }
      />

      <DilaNormalizer />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or Dila…"
            aria-label="Search roster"
            className="h-10 w-full rounded-xl border bg-card pr-3 pl-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
        </div>
        <Select value={dila} onValueChange={(v) => setDila(String(v ?? ALL))}>
          <SelectTrigger className="h-10 w-full rounded-xl sm:w-56">
            <SelectValue>
              {(v) =>
                v === ALL
                  ? `All Dilas (${db.atfal.length})`
                  : `${v} (${counts.find((c) => c.dila === v)?.count ?? 0})`
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Dilas ({db.atfal.length})</SelectItem>
            {counts.map((c) => (
              <SelectItem key={c.dila} value={c.dila}>
                {c.dila} ({c.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visibleSelected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2">
          <span className="text-sm font-medium">
            {visibleSelected.length} selected
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
            <Button size="sm" variant="outline" onClick={deleteSelected}>
              <HugeiconsIcon icon={Delete02Icon} className="size-4" />
              Remove
            </Button>
            <Button size="sm" onClick={() => printSelection(visibleSelected)}>
              <HugeiconsIcon icon={PrinterIcon} className="size-4" />
              Print
            </Button>
          </div>
        </div>
      )}

      <RosterTable
        rows={rows}
        selected={selected}
        onSelectedChange={setSelected}
        onPrint={(a) => printSelection([a.id])}
      />

      {db.atfal.length > 0 && (
        <div className="mt-6 flex justify-end">
          <ClearAllDialog
            trigger={
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                Clear entire roster
              </Button>
            }
          />
        </div>
      )}
    </>
  )
}
