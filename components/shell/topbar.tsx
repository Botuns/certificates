"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Menu01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Brand } from "@/components/shell/brand"
import { SidebarContent } from "@/components/shell/sidebar"
import { SyncBadge } from "@/components/shell/sync-badge"
import { ThemeToggle } from "@/components/shell/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { EVENT } from "@/lib/nav"

export function Topbar() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  function search(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `/roster?q=${encodeURIComponent(q)}` : "/roster")
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
              >
                <HugeiconsIcon icon={Menu01Icon} className="size-5" />
              </Button>
            }
          />
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        <Link href="/" className="lg:hidden">
          <Brand />
        </Link>

        <form onSubmit={search} className="hidden max-w-xl flex-1 lg:block">
          <div className="relative">
            <HugeiconsIcon
              icon={Search01Icon}
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Atfal by name or Dila…"
              aria-label="Search Atfal"
              className="h-11 w-full rounded-full border bg-card pr-4 pl-11 text-sm transition-shadow outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2">
          <SyncBadge />
          <ThemeToggle />
          <div className="hidden items-center gap-2.5 border-l pl-3 sm:flex">
            <span className="grid size-9 place-items-center rounded-full bg-primary/12 text-sm font-bold text-primary">
              OI
            </span>
            <div className="hidden leading-tight md:block">
              <p className="text-sm font-semibold">Oyo Ilaqa</p>
              <p className="text-xs text-muted-foreground">{EVENT.dates}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
