import { Certificate01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { cn } from "@/lib/utils"

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <HugeiconsIcon
          icon={Certificate01Icon}
          className="size-5"
          strokeWidth={2}
        />
      </span>
      <span className="font-heading text-lg leading-none font-bold tracking-tight">
        Ijtema<span className="text-primary">Certs</span>
      </span>
    </div>
  )
}
