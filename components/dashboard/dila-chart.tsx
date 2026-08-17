"use client"

import { cn } from "@/lib/utils"

/**
 * Atfal per Dila. A plain CSS bar chart — a charting library would be more
 * bundle than this one view is worth.
 */
export function DilaChart({
  data,
  className,
}: {
  data: { dila: string; count: number }[]
  className?: string
}) {
  const top = data.slice(0, 6)
  const max = Math.max(...top.map((d) => d.count), 1)

  if (!top.length) {
    return (
      <p
        className={cn(
          "py-8 text-center text-sm text-muted-foreground",
          className
        )}
      >
        No Dilas yet
      </p>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex h-32 items-end gap-2">
        {top.map((d, i) => (
          <div
            key={d.dila}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            <span className="text-xs font-semibold tabular-nums">
              {d.count}
            </span>
            <div
              className={cn(
                "w-full rounded-t-lg transition-all",
                i === 0 ? "bg-primary" : "bg-primary/25"
              )}
              style={{ height: `${Math.max(6, (d.count / max) * 100)}%` }}
              title={`${d.dila}: ${d.count}`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {top.map((d) => (
          <p
            key={d.dila}
            className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground"
            title={d.dila}
          >
            {d.dila}
          </p>
        ))}
      </div>
    </div>
  )
}
