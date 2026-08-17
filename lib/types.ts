export type FieldAlign = "left" | "center" | "right"

/**
 * A text field stamped onto the certificate.
 *
 * Position and width are stored as 0..1 fractions of the page, never pixels —
 * that is what lets the same layout render identically in a 320px phone
 * preview, a 900px desktop preview and the 843.89pt PDF.
 */
export type Field = {
  id: string
  label: string
  /** Which Atfal property fills this field. */
  bind: "name" | "dila"
  /** 0..1 from the left edge. Anchor depends on `align`. */
  x: number
  /** 0..1 from the top edge. This is the text baseline. */
  y: number
  /** 0..1 — box width used for shrink-to-fit. */
  boxW: number
  align: FieldAlign
  fontId: string
  weight: number
  italic: boolean
  /** Font size in PDF points. */
  size: number
  color: string
  /** Extra tracking in points. */
  letterSpacing: number
  uppercase: boolean
  visible: boolean
}

export type Atfal = {
  id: string
  name: string
  dila: string
  createdAt: number
}

export type Database = {
  /** Bumped on every successful write; used to detect concurrent edits. */
  rev: number
  atfal: Atfal[]
  fields: Field[]
  updatedAt: number
}

export type BackupEntry = {
  pathname: string
  url: string
  size: number
  uploadedAt: string
}

/** Selection modes for a print run. */
export type PrintScope =
  | { kind: "all" }
  | { kind: "dila"; dilas: string[] }
  | { kind: "selected"; ids: string[] }

export type GenerateProgress = { done: number; total: number }
