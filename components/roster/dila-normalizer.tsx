"use client"

import { useMemo, useState } from "react"
import { Alert02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { actions, useStore } from "@/lib/db/store"
import { clusterDilas } from "@/lib/import/clean"
import { dilaOf } from "@/lib/roster"

/**
 * Surfaces Dila spellings that are probably the same place.
 *
 * Left alone, "Oyo Town" and "Oyo-Town" print as two separate groups, which
 * silently splits a batch when someone prints "by Dila".
 */
export function DilaNormalizer() {
  const { db } = useStore()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const clusters = useMemo(
    () =>
      clusterDilas(db.atfal.map(dilaOf)).filter(
        (c) => !dismissed.has(c.canonical)
      ),
    [db.atfal, dismissed]
  )

  if (!clusters.length) return null

  function merge(canonical: string, variants: string[]) {
    for (const v of variants)
      if (v !== canonical) actions.renameDila(v, canonical)
    toast.success(`Merged into “${canonical}”`)
  }

  return (
    <div className="mb-4 space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4">
      <div className="flex items-start gap-2">
        <HugeiconsIcon
          icon={Alert02Icon}
          className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
        />
        <div>
          <p className="text-sm font-semibold">Similar Dila spellings found</p>
          <p className="text-xs text-muted-foreground">
            These look like the same Dila. Merge them so printing by Dila groups
            everyone together.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {clusters.slice(0, 5).map((c) => (
          <div
            key={c.canonical}
            className="flex flex-wrap items-center gap-2 rounded-xl bg-background/70 px-3 py-2 text-sm"
          >
            <span className="flex-1 truncate">
              {c.variants.map((v, i) => (
                <span key={v.value}>
                  {i > 0 && <span className="text-muted-foreground"> · </span>}
                  <span className="font-medium">{v.value}</span>
                  <span className="text-muted-foreground"> ({v.count})</span>
                </span>
              ))}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDismissed((s) => new Set(s).add(c.canonical))}
            >
              Keep separate
            </Button>
            <Button
              size="sm"
              onClick={() =>
                merge(
                  c.canonical,
                  c.variants.map((v) => v.value)
                )
              }
            >
              Merge to “{c.canonical}”
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
