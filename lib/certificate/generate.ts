import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib"

import {
  alignedX,
  fieldText,
  fitFontSize,
  hexToRgb01,
  PAGE,
  toPdfPoint,
} from "@/lib/certificate/geometry"
import type { Field } from "@/lib/types"

export type CertificateRecord = { name: string; dila: string }

export type GenerateInput = {
  templateBytes: ArrayBuffer
  fields: Field[]
  records: CertificateRecord[]
  /** TTF bytes keyed by font file name, e.g. "playfair-700.ttf". */
  fontBytes: Record<string, ArrayBuffer>
  /** Which file each field should use — resolved before we get here. */
  fieldFontFiles: Record<string, string>
}

function valueFor(field: Field, record: CertificateRecord): string {
  return field.bind === "dila" ? record.dila : record.name
}

function drawField(
  page: PDFPage,
  field: Field,
  font: PDFFont,
  record: CertificateRecord
) {
  const text = fieldText(field, valueFor(field, record))
  if (!text) return

  const measure = (t: string, s: number) => font.widthOfTextAtSize(t, s)
  const size = fitFontSize(field, text, measure)
  const spacing = field.letterSpacing
  const width =
    measure(text, size) + spacing * Math.max(0, [...text].length - 1)

  const { y } = toPdfPoint(field.x, field.y)
  const startX = alignedX(field, width)
  const { r, g, b } = hexToRgb01(field.color)
  const color = rgb(r, g, b)

  if (spacing === 0) {
    page.drawText(text, { x: startX, y, size, font, color })
    return
  }

  // pdf-lib has no character-spacing option, so tracked text is drawn one
  // glyph at a time. Iterating code points (not UTF-16 units) keeps accented
  // and combined characters intact.
  let cursor = startX
  for (const ch of text) {
    page.drawText(ch, { x: cursor, y, size, font, color })
    cursor += measure(ch, size) + spacing
  }
}

/**
 * Build a multi-page PDF, one page per record.
 *
 * The template is embedded exactly once and re-drawn on every page, so 300
 * certificates cost one copy of the artwork rather than 300 — the difference
 * between a ~1MB file and a ~300MB one.
 */
export async function generateCertificates(
  input: GenerateInput,
  onProgress?: (done: number, total: number) => void
): Promise<Uint8Array> {
  const { templateBytes, fields, records, fontBytes, fieldFontFiles } = input

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  const [template] = await doc.embedPdf(templateBytes)

  // One embedded font per distinct file, shared across every page.
  //
  // subset:false is deliberate. pdf-lib's subsetter silently drops glyphs for
  // some of these fonts — Poppins SemiBold Italic renders "Oyo Town" as
  // "Oy  wn", with the metrics still reporting correct advance widths, so the
  // damage is invisible until someone looks at a printed certificate. Full
  // embedding cannot lose a glyph. It costs ~150-400KB per font in the output,
  // which is minor next to the ~940KB of shared artwork.
  const fonts = new Map<string, PDFFont>()
  for (const [file, bytes] of Object.entries(fontBytes)) {
    fonts.set(file, await doc.embedFont(bytes, { subset: false }))
  }

  const visible = fields.filter((f) => f.visible)
  const total = records.length

  for (let i = 0; i < total; i++) {
    const record = records[i]
    const page = doc.addPage([PAGE.W, PAGE.H])
    page.drawPage(template)

    for (const field of visible) {
      const font = fonts.get(fieldFontFiles[field.id])
      if (font) drawField(page, field, font, record)
    }

    if (onProgress && (i % 25 === 0 || i === total - 1))
      onProgress(i + 1, total)
  }

  return doc.save({ useObjectStreams: true })
}
