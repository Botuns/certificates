export type ColumnRole =
  "ignore" | "name" | "firstName" | "lastName" | "otherNames" | "dila"

export type Detection = {
  /** Index of the detected header row, or null if the sheet has no header. */
  headerRow: number | null
  /** Column index -> role. */
  mapping: Record<number, ColumnRole>
  headers: string[]
  confident: boolean
}

/** Lowercase, strip accents, drop everything that isn't a letter or digit. */
export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

/**
 * Header synonyms, roughly best-first. Deliberately generous: real rosters
 * arrive with "NAMES OF ATFAL", "Dilla", "Jamaat", "S/N Name" and worse.
 */
const SYNONYMS: Record<Exclude<ColumnRole, "ignore">, string[]> = {
  name: [
    "name",
    "names",
    "fullname",
    "fullnames",
    "atfalname",
    "nameofatfal",
    "namesofatfal",
    "nameofparticipant",
    "participantname",
    "participant",
    "candidate",
    "child",
    "oruko",
    "member",
    "membername",
  ],
  firstName: ["firstname", "fname", "givenname", "first"],
  lastName: ["lastname", "surname", "lname", "familyname", "last"],
  otherNames: ["othernames", "othername", "middlename", "middlenames", "other"],
  dila: [
    "dila",
    "dilla",
    "dilaa",
    "dhila",
    "delaa",
    "dilas",
    "majlis",
    "jamaat",
    "jamat",
    "jamaah",
    "chapter",
    "circuit",
    "branch",
    "area",
    "halqa",
    "zone",
    "region",
    "station",
  ],
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    prev = curr
  }
  return prev[b.length]
}

/** 0..1 similarity, tolerant of the typos and plurals headers arrive with. */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.startsWith(b) || b.startsWith(a)) return 0.92
  if (a.includes(b) || b.includes(a)) return 0.82
  const max = Math.max(a.length, b.length)
  return 1 - levenshtein(a, b) / max
}

const MATCH_THRESHOLD = 0.7

/** Best role for a single header cell, with its score. */
function scoreHeader(raw: string): { role: ColumnRole; score: number } {
  const norm = normalizeHeader(raw)
  if (!norm) return { role: "ignore", score: 0 }

  // Serial-number columns look like names to a fuzzy matcher; rule them out.
  if (/^(sn|s|no|sno|serial|sr|num|number|idx|index|count)$/.test(norm)) {
    return { role: "ignore", score: 0 }
  }

  let best: { role: ColumnRole; score: number } = { role: "ignore", score: 0 }
  for (const [role, words] of Object.entries(SYNONYMS) as [
    Exclude<ColumnRole, "ignore">,
    string[],
  ][]) {
    for (const w of words) {
      const s = similarity(norm, w)
      if (s > best.score) best = { role, score: s }
    }
  }
  return best.score >= MATCH_THRESHOLD
    ? best
    : { role: "ignore", score: best.score }
}

/** A row is a plausible header if several cells match known column names. */
function scoreRow(row: string[]): number {
  let total = 0
  let hits = 0
  for (const cell of row) {
    const { role, score } = scoreHeader(cell)
    if (role !== "ignore") {
      total += score
      hits++
    }
  }
  return hits === 0 ? 0 : total + hits * 0.5
}

/**
 * Find the header row and map columns to roles.
 *
 * Scans the first 10 rows rather than assuming row 0, because exported rosters
 * routinely carry a title banner or blank spacer rows above the real header.
 * Falls back to positional mapping (first text column = name, second = dila)
 * when nothing header-like is found, so a bare list still imports.
 */
export function detectLayout(rows: string[][]): Detection {
  const limit = Math.min(10, rows.length)
  let bestRow = -1
  let bestScore = 0

  for (let i = 0; i < limit; i++) {
    const s = scoreRow(rows[i] ?? [])
    if (s > bestScore) {
      bestScore = s
      bestRow = i
    }
  }

  if (bestRow >= 0 && bestScore >= 1) {
    const headers = rows[bestRow] ?? []
    const mapping: Record<number, ColumnRole> = {}
    const used = new Set<ColumnRole>()

    headers.forEach((cell, idx) => {
      const { role } = scoreHeader(cell)
      // Only one column per role; later duplicates are ignored.
      if (role !== "ignore" && !used.has(role)) {
        mapping[idx] = role
        used.add(role)
      } else {
        mapping[idx] = "ignore"
      }
    })

    const hasName =
      used.has("name") || used.has("firstName") || used.has("lastName")
    if (hasName) {
      return {
        headerRow: bestRow,
        mapping,
        headers,
        confident: used.has("dila"),
      }
    }
  }

  // No usable header — treat every row as data and go by position.
  const width = Math.max(...rows.slice(0, 20).map((r) => r.length), 0)
  const mapping: Record<number, ColumnRole> = {}
  const textCols: number[] = []

  for (let c = 0; c < width; c++) {
    const sample = rows
      .slice(0, 20)
      .map((r) => (r[c] ?? "").trim())
      .filter(Boolean)
    const mostlyNumeric =
      sample.length > 0 &&
      sample.filter((v) => /^\d+[.)]?$/.test(v)).length / sample.length > 0.6
    if (sample.length && !mostlyNumeric) textCols.push(c)
    mapping[c] = "ignore"
  }

  if (textCols[0] !== undefined) mapping[textCols[0]] = "name"
  if (textCols[1] !== undefined) mapping[textCols[1]] = "dila"

  return {
    headerRow: null,
    mapping,
    headers: Array.from({ length: width }, (_, i) => `Column ${i + 1}`),
    confident: false,
  }
}

export const ROLE_LABELS: Record<ColumnRole, string> = {
  ignore: "Ignore",
  name: "Full name",
  firstName: "First name",
  lastName: "Surname",
  otherNames: "Other names",
  dila: "Dila",
}
