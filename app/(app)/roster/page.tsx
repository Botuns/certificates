import { Suspense } from "react"

import { RosterView } from "@/components/roster/roster-view"

export const metadata = { title: "Roster · IjtemaCerts" }

export default function RosterPage() {
  return (
    <Suspense
      fallback={<div className="h-40 animate-pulse rounded-2xl bg-muted" />}
    >
      <RosterView />
    </Suspense>
  )
}
