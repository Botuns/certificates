import type { ColumnRole } from "@/lib/import/detect"

export type CleanRow = { name: string; dila: string }

export type BuildResult = {
  rows: CleanRow[]
  /** Rows dropped for having no usable name. */
  skipped: number
  /** Rows that duplicate an earlier row in the same file. */
  duplicatesInFile: number
  /** Rows that match somebody already in the roster. */
  duplicatesExisting: number
}

export type BuildOptions = {
  titleCase: boolean
  skipDuplicates: boolean
  /** Existing roster entries, used to spot re-imports. */
  existing?: { name: string; dila: string }[]
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim()

/** Strip the list numbering people leave in name cells: "1.", "12)", "3 -". */
const stripOrdinal = (s: string) => s.replace(/^\s*\d+\s*[.)\-:]\s*/, "")

export function cleanName(raw: string): string {
  return collapse(stripOrdinal(String(raw ?? "")).replace(/[_|]+/g, " "))
}

export function cleanDila(raw: string): string {
  let v = collapse(stripOrdinal(String(raw ?? "")).replace(/[_|]+/g, " "))
  // "Ibadan Dila" / "Dila: Ibadan" -> "Ibadan"
  v = v.replace(/^dil+a\s*[:\-]?\s*/i, "").replace(/\s+dil+a$/i, "")
  return collapse(v)
}

/** Title Case that leaves hyphenated and apostrophe names intact. */
export function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(
      /(^|[\s\-'’])([a-z\u00e0-\u024f])/g,
      (_, sep: string, ch: string) => sep + ch.toUpperCase()
    )
}

/** Key used to decide two spellings are "the same" Dila or person. */
export function foldKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

export function buildRows(
  grid: string[][],
  headerRow: number | null,
  mapping: Record<number, ColumnRole>,
  options: BuildOptions
): BuildResult {
  const entries = Object.entries(mapping) as [string, ColumnRole][]
  const col = (role: ColumnRole) => {
    const hit = entries.find(([, r]) => r === role)
    return hit ? Number(hit[0]) : -1
  }

  const iName = col("name")
  const iFirst = col("firstName")
  const iLast = col("lastName")
  const iOther = col("otherNames")
  const iDila = col("dila")

  const start = headerRow === null ? 0 : headerRow + 1
  const body = grid.slice(start)

  const rows: CleanRow[] = []
  const seen = new Set<string>()
  const existing = new Set(
    (options.existing ?? []).map((e) => `${foldKey(e.name)}|${foldKey(e.dila)}`)
  )

  let skipped = 0
  let duplicatesInFile = 0
  let duplicatesExisting = 0

  for (const raw of body) {
    if (!raw || raw.every((c) => !String(c ?? "").trim())) continue

    // Prefer an explicit full-name column; otherwise stitch the parts together.
    let name =
      iName >= 0
        ? cleanName(raw[iName] ?? "")
        : cleanName(
            [iFirst, iOther, iLast]
              .filter((i) => i >= 0)
              .map((i) => String(raw[i] ?? "").trim())
              .filter(Boolean)
              .join(" ")
          )

    if (!name) {
      skipped++
      continue
    }

    let dila = iDila >= 0 ? cleanDila(raw[iDila] ?? "") : ""
    if (options.titleCase) {
      name = toTitleCase(name)
      if (dila) dila = toTitleCase(dila)
    }

    const key = `${foldKey(name)}|${foldKey(dila)}`
    if (seen.has(key)) {
      duplicatesInFile++
      if (options.skipDuplicates) continue
    } else {
      seen.add(key)
    }

    if (existing.has(key)) {
      duplicatesExisting++
      if (options.skipDuplicates) continue
    }

    rows.push({ name, dila })
  }

  return { rows, skipped, duplicatesInFile, duplicatesExisting }
}

export type DilaCluster = {
  /** The spelling that will be kept — the most frequently used variant. */
  canonical: string
  variants: { value: string; count: number }[]
  total: number
}

/**
 * Group Dila spellings that differ only by case, spacing or punctuation.
 *
 * Without this, "Ibadan", "ibadan " and "IBADAN" print as three separate
 * groups, which quietly breaks "print by Dila".
 */
export function clusterDilas(values: string[]): DilaCluster[] {
  const groups = new Map<string, Map<string, number>>()

  for (const raw of values) {
    const value = raw.trim()
    if (!value) continue
    const key = foldKey(value)
    if (!key) continue
    const bucket = groups.get(key) ?? new Map<string, number>()
    bucket.set(value, (bucket.get(value) ?? 0) + 1)
    groups.set(key, bucket)
  }

  return [...groups.values()]
    .map((bucket) => {
      const variants = [...bucket.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
      return {
        canonical: variants[0].value,
        variants,
        total: variants.reduce((n, v) => n + v.count, 0),
      }
    })
    .filter((c) => c.variants.length > 1)
    .sort((a, b) => b.total - a.total)
}
