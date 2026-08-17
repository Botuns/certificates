"use client"

import Link from "next/link"
import { useMemo } from "react"
import {
  ArrowRight01Icon,
  Location01Icon,
  PlusSignIcon,
  PrinterIcon,
  SparklesIcon,
  Upload01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { DilaChart } from "@/components/dashboard/dila-chart"
import { CertificateCanvas } from "@/components/editor/certificate-canvas"
import { AddAtfalDialog } from "@/components/roster/atfal-form"
import { ImportDialog } from "@/components/roster/import-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/db/store"
import { dilaCounts, dilaOf, findDuplicates, sortForPrint } from "@/lib/roster"
import { EVENT } from "@/lib/nav"

function StatCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: typeof UserGroupIcon
  label: string
  value: string | number
  tint: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
      <span
        className="grid size-11 shrink-0 place-items-center rounded-xl"
        style={{ backgroundColor: tint }}
      >
        <HugeiconsIcon icon={icon} className="size-5 text-primary" />
      </span>
      <div className="min-w-0">
        <p className="font-heading text-xl leading-tight font-bold tabular-nums">
          {value}
        </p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

export function DashboardView() {
  const { db, ready } = useStore()

  const counts = useMemo(() => dilaCounts(db.atfal), [db.atfal])
  const recent = useMemo(
    () => [...db.atfal].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
    [db.atfal]
  )
  const duplicates = useMemo(() => findDuplicates(db.atfal), [db.atfal])
  const preview = useMemo(() => sortForPrint(db.atfal)[0], [db.atfal])

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground sm:p-8">
          <HugeiconsIcon
            icon={SparklesIcon}
            className="pointer-events-none absolute -top-6 -right-6 size-44 opacity-15"
          />
          <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-80">
            {EVENT.org}
          </p>
          <h1 className="mt-2 max-w-lg font-heading text-2xl leading-tight font-bold sm:text-3xl">
            Certificates for {EVENT.title}
          </h1>
          <p className="mt-1.5 text-sm opacity-85">{EVENT.dates}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="rounded-full bg-foreground text-background hover:bg-foreground/90"
              nativeButton={false}
              render={<Link href="/editor" />}
            >
              Open editor
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
            </Button>
            <Button
              variant="secondary"
              className="rounded-full bg-white/15 text-white hover:bg-white/25"
              nativeButton={false}
              render={<Link href="/print" />}
            >
              <HugeiconsIcon icon={PrinterIcon} className="size-4" />
              Print
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={UserGroupIcon}
            label="Atfal on the roster"
            value={ready ? db.atfal.length : "—"}
            tint="color-mix(in oklab, var(--primary) 12%, transparent)"
          />
          <StatCard
            icon={Location01Icon}
            label="Dilas represented"
            value={ready ? counts.length : "—"}
            tint="color-mix(in oklab, var(--primary) 8%, transparent)"
          />
          <StatCard
            icon={PrinterIcon}
            label={
              duplicates.size
                ? `${duplicates.size} possible duplicates`
                : "Ready to print"
            }
            value={ready ? db.atfal.length - duplicates.size : "—"}
            tint="color-mix(in oklab, var(--primary) 5%, transparent)"
          />
        </div>

        {/* Empty state or roster peek */}
        {ready && db.atfal.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
            <h2 className="font-heading text-lg font-bold">
              Start with your roster
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Import the attendance spreadsheet — messy headers, numbering and
              duplicate spellings are handled for you.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <ImportDialog
                trigger={
                  <Button>
                    <HugeiconsIcon icon={Upload01Icon} className="size-4" />
                    Import spreadsheet
                  </Button>
                }
              />
              <AddAtfalDialog
                trigger={
                  <Button variant="outline">
                    <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
                    Add by hand
                  </Button>
                }
              />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-heading text-sm font-bold">Recently added</h2>
              <Link
                href="/roster"
                className="text-xs font-medium text-primary hover:underline"
              >
                See all
              </Link>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {recent.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{a.name}</td>
                    <td className="p-3 text-right">
                      <Badge variant="secondary" className="font-normal">
                        {dilaOf(a)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right rail */}
      <aside className="space-y-4">
        <div className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-heading text-sm font-bold">
            Atfal per Dila
          </h2>
          <DilaChart data={counts} />
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-heading text-sm font-bold">
            Current layout
          </h2>
          <CertificateCanvas
            fields={db.fields}
            values={{
              name: preview?.name ?? "Abdul-Qahar Olajide",
              dila: preview ? dilaOf(preview) : "Ibadan",
            }}
            interactive={false}
          />
          <Link
            href="/editor"
            className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
          >
            Change fonts and placement →
          </Link>
        </div>
      </aside>
    </div>
  )
}
