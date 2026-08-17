import { resolveVariant } from "@/lib/certificate/fonts"
import { fitFontSize } from "@/lib/certificate/geometry"
import type { Field } from "@/lib/types"

let ctx: CanvasRenderingContext2D | null | undefined

function context(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx
  if (typeof document === "undefined") return (ctx = null)
  ctx = document.createElement("canvas").getContext("2d")
  return ctx
}

/**
 * Advance width of `text` at `size`, in the same units as the size.
 *
 * Canvas reports advance widths from the font's own metrics, so measuring at
 * N px gives the identical number pdf-lib returns from widthOfTextAtSize at
 * N pt. That equivalence is what keeps the preview and the PDF in agreement.
 */
export function measureAdvance(
  text: string,
  size: number,
  fontId: string,
  weight: number,
  italic: boolean
): number {
  const c = context()
  if (!c) return text.length * size * 0.5 // SSR fallback; re-measured on mount

  const { family, variant } = resolveVariant(fontId, weight, italic)
  c.font = `${variant.italic ? "italic " : ""}${variant.weight} ${size}px "${family.cssFamily}"`
  return c.measureText(text).width
}

export type LaidOutField = {
  field: Field
  text: string
  /** Size after shrink-to-fit, in points. */
  size: number
  width: number
  /** Whether the text had to be shrunk to fit its box. */
  shrunk: boolean
}

/** Resolve a field + value into the exact size and width that will be drawn. */
export function layoutField(field: Field, rawValue: string): LaidOutField {
  const text = field.uppercase
    ? (rawValue ?? "").trim().toUpperCase()
    : (rawValue ?? "").trim()

  const measure = (t: string, s: number) =>
    measureAdvance(t, s, field.fontId, field.weight, field.italic)

  const size = fitFontSize(field, text, measure)
  const width =
    measure(text, size) + field.letterSpacing * Math.max(0, text.length - 1)

  return { field, text, size, width, shrunk: size < field.size - 0.01 }
}
