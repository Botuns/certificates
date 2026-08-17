"use client"

import { useMemo, useState } from "react"
import {
  Delete02Icon,
  Edit02Icon,
  MoreVerticalIcon,
  PrinterIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import { EditAtfalDialog } from "@/components/roster/atfal-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { actions } from "@/lib/db/store"
import { dilaOf, findDuplicates } from "@/lib/roster"
import type { Atfal } from "@/lib/types"
import { cn } from "@/lib/utils"

export function RosterTable({
  rows,
  selected,
  onSelectedChange,
  onPrint,
}: {
  rows: Atfal[]
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
  onPrint?: (atfal: Atfal) => void
}) {
  const [editing, setEditing] = useState<Atfal | null>(null)
  const duplicates = useMemo(() => findDuplicates(rows), [rows])

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someSelected = rows.some((r) => selected.has(r.id))

  function toggleAll() {
    if (allSelected) {
      const next = new Set(selected)
      for (const r of rows) next.delete(r.id)
      onSelectedChange(next)
    } else {
      onSelectedChange(new Set([...selected, ...rows.map((r) => r.id)]))
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedChange(next)
  }

  function remove(atfal: Atfal) {
    actions.removeAtfal(atfal.id)
    const next = new Set(selected)
    next.delete(atfal.id)
    onSelectedChange(next)
    toast.success(`Removed ${atfal.name}`)
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed py-16 text-center">
        <p className="font-medium">No Atfal here yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Import a spreadsheet or add names by hand to get started.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="w-10 p-3">
                <Checkbox
                  checked={allSelected}
                  indeterminate={!allSelected && someSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="p-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Name
              </th>
              <th className="p-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Dila
              </th>
              <th className="w-24 p-3 text-right text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr
                key={a.id}
                className={cn(
                  "border-b transition-colors last:border-0 hover:bg-muted/30",
                  selected.has(a.id) && "bg-primary/5"
                )}
              >
                <td className="p-3">
                  <Checkbox
                    checked={selected.has(a.id)}
                    onCheckedChange={() => toggleOne(a.id)}
                    aria-label={`Select ${a.name}`}
                  />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.name}</span>
                    {duplicates.has(a.id) && (
                      <Badge
                        variant="outline"
                        className="text-amber-600 dark:text-amber-400"
                      >
                        duplicate
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant="secondary" className="font-normal">
                    {dilaOf(a)}
                  </Badge>
                </td>
                <td className="p-3">
                  <RowActions
                    atfal={a}
                    onEdit={() => setEditing(a)}
                    onRemove={() => remove(a)}
                    onPrint={onPrint}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards, because a 4-column table is unusable at 390px */}
      <div className="space-y-2 md:hidden">
        {rows.map((a) => (
          <div
            key={a.id}
            className={cn(
              "flex items-center gap-3 rounded-2xl border bg-card p-3",
              selected.has(a.id) && "border-primary/40 bg-primary/5"
            )}
          >
            <Checkbox
              checked={selected.has(a.id)}
              onCheckedChange={() => toggleOne(a.id)}
              aria-label={`Select ${a.name}`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{a.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {dilaOf(a)}
              </p>
            </div>
            <RowActions
              atfal={a}
              onEdit={() => setEditing(a)}
              onRemove={() => remove(a)}
              onPrint={onPrint}
            />
          </div>
        ))}
      </div>

      <EditAtfalDialog
        key={editing?.id ?? "none"}
        atfal={editing}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
      />
    </>
  )
}

function RowActions({
  atfal,
  onEdit,
  onRemove,
  onPrint,
}: {
  atfal: Atfal
  onEdit: () => void
  onRemove: () => void
  onPrint?: (atfal: Atfal) => void
}) {
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${atfal.name}`}
            >
              <HugeiconsIcon icon={MoreVerticalIcon} className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {onPrint && (
            <DropdownMenuItem onClick={() => onPrint(atfal)}>
              <HugeiconsIcon icon={PrinterIcon} className="size-4" />
              Print certificate
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onEdit}>
            <HugeiconsIcon icon={Edit02Icon} className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={onRemove}>
            <HugeiconsIcon icon={Delete02Icon} className="size-4" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
