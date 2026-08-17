"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import { Delete02Icon, Location01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Brand } from "@/components/shell/brand"
import { ClearAllDialog } from "@/components/roster/clear-all-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useStore } from "@/lib/db/store"
import { NAV_ITEMS, SETTINGS_ITEM } from "@/lib/nav"
import { cn } from "@/lib/utils"

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-6 pb-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
      {children}
    </p>
  )
}

function NavLink({
  href,
  label,
  icon,
  onNavigate,
}: {
  href: string
  label: string
  icon: typeof Location01Icon
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      )}
    >
      <HugeiconsIcon
        icon={icon}
        className={cn("size-5 shrink-0", active && "text-primary")}
        strokeWidth={active ? 2.2 : 1.8}
      />
      {label}
    </Link>
  )
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { db } = useStore()

  const dilas = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of db.atfal) {
      const key = a.dila.trim() || "No Dila"
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    )
  }, [db.atfal])

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-5">
        <Brand />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="px-3 pb-4">
          <SectionLabel>Overview</SectionLabel>
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} {...item} onNavigate={onNavigate} />
            ))}
          </div>

          {dilas.length > 0 && (
            <>
              <SectionLabel>Dilas</SectionLabel>
              <div className="space-y-1">
                {dilas.slice(0, 8).map(([dila, count]) => (
                  <Link
                    key={dila}
                    href={`/roster?dila=${encodeURIComponent(dila)}`}
                    onClick={onNavigate}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                      <HugeiconsIcon icon={Location01Icon} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{dila}</span>
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                      {count}
                    </span>
                  </Link>
                ))}
                {dilas.length > 8 && (
                  <Link
                    href="/roster"
                    onClick={onNavigate}
                    className="block px-3 py-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    +{dilas.length - 8} more
                  </Link>
                )}
              </div>
            </>
          )}
        </nav>
      </ScrollArea>

      <div className="border-t px-3 py-3">
        <SectionLabel>Settings</SectionLabel>
        <div className="space-y-1">
          <NavLink {...SETTINGS_ITEM} onNavigate={onNavigate} />
          <ClearAllDialog
            trigger={
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <HugeiconsIcon
                  icon={Delete02Icon}
                  className="size-5"
                  strokeWidth={1.8}
                />
                Clear roster
              </button>
            }
          />
        </div>
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-sidebar lg:block">
      <div className="sticky top-0 h-svh">
        <SidebarContent />
      </div>
    </aside>
  )
}
