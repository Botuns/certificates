"use client"

import {
  Alert02Icon,
  CloudSavingDone01Icon,
  Refresh01Icon,
  UnavailableIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { actions, useStore } from "@/lib/db/store"
import { cn } from "@/lib/utils"

export function SyncBadge({ className }: { className?: string }) {
  const { status, error, ready, configured } = useStore()

  if (!ready) return null

  if (!configured) {
    return (
      <span
        title="No Vercel Blob store is linked, so changes stay on this device only."
        className={cn(
          "flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400",
          className
        )}
      >
        <HugeiconsIcon icon={UnavailableIcon} className="size-3.5" />
        <span className="hidden sm:inline">This device only</span>
      </span>
    )
  }

  if (status === "error") {
    return (
      <button
        type="button"
        onClick={() => actions.retry()}
        title={error ?? "Save failed"}
        className={cn(
          "flex items-center gap-1.5 rounded-full bg-destructive/12 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20",
          className
        )}
      >
        <HugeiconsIcon icon={Alert02Icon} className="size-3.5" />
        <span className="hidden sm:inline">Not saved · retry</span>
      </button>
    )
  }

  if (status === "saving") {
    return (
      <span
        className={cn(
          "flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground",
          className
        )}
      >
        <HugeiconsIcon icon={Refresh01Icon} className="size-3.5 animate-spin" />
        <span className="hidden sm:inline">Saving…</span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground",
        className
      )}
    >
      <HugeiconsIcon
        icon={CloudSavingDone01Icon}
        className="size-3.5 text-primary"
      />
      <span className="hidden sm:inline">Saved</span>
    </span>
  )
}
