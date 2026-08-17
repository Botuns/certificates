import { foldKey } from "@/lib/import/clean"
import type { Atfal } from "@/lib/types"

export const NO_DILA = "No Dila"

export const dilaOf = (a: Atfal) => a.dila.trim() || NO_DILA

/** Alphabetical by Dila, then by name — the order certificates print in. */
export function sortForPrint(list: Atfal[]): Atfal[] {
  return [...list].sort(
    (a, b) => dilaOf(a).localeCompare(dilaOf(b)) || a.name.localeCompare(b.name)
  )
}

export function dilaCounts(list: Atfal[]): { dila: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const a of list) counts.set(dilaOf(a), (counts.get(dilaOf(a)) ?? 0) + 1)
  return [...counts.entries()]
    .map(([dila, count]) => ({ dila, count }))
    .sort((a, b) => b.count - a.count || a.dila.localeCompare(b.dila))
}

export function uniqueDilas(list: Atfal[]): string[] {
  return [...new Set(list.map(dilaOf))].sort((a, b) => a.localeCompare(b))
}

export function groupByDila(list: Atfal[]): Map<string, Atfal[]> {
  const groups = new Map<string, Atfal[]>()
  for (const a of sortForPrint(list)) {
    const key = dilaOf(a)
    const bucket = groups.get(key)
    if (bucket) bucket.push(a)
    else groups.set(key, [a])
  }
  return groups
}

export function filterRoster(
  list: Atfal[],
  { query, dila }: { query?: string; dila?: string | null }
): Atfal[] {
  const q = foldKey(query ?? "")
  return list.filter((a) => {
    if (dila && dilaOf(a) !== dila) return false
    if (!q) return true
    return foldKey(a.name).includes(q) || foldKey(dilaOf(a)).includes(q)
  })
}

/** Names that appear more than once with the same Dila. */
export function findDuplicates(list: Atfal[]): Set<string> {
  const seen = new Map<string, string>()
  const dupes = new Set<string>()
  for (const a of list) {
    const key = `${foldKey(a.name)}|${foldKey(a.dila)}`
    const first = seen.get(key)
    if (first) {
      dupes.add(first)
      dupes.add(a.id)
    } else {
      seen.set(key, a.id)
    }
  }
  return dupes
}

export function safeFileName(value: string): string {
  return (
    value
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "certificate"
  )
}
