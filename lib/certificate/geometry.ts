import type { Field } from "@/lib/types"

/**
 * Exact media box of public/template/ijtema-certificate.pdf, measured from the
 * file. Everything else is derived from these two numbers.
 */
export const PAGE = { W: 843.8898, H: 597.2755 } as const
export const PAGE_ASPECT = PAGE.W / PAGE.H

/** Fraction (0..1, origin top-left) -> PDF point (origin bottom-left). */
export function toPdfPoint(x: number, y: number) {
  return { x: x * PAGE.W, y: (1 - y) * PAGE.H }
}

export function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

export function fieldText(field: Field, raw: string) {
  const t = (raw ?? "").trim()
  return field.uppercase ? t.toUpperCase() : t
}

/**
 * Shrink `size` until `width` fits within the field's box.
 *
 * `measure` is injected so the preview (canvas measureText) and the export
 * (pdf-lib widthOfTextAtSize) can share this exact algorithm — both read
 * advance widths from the same TTF, so they land on the same size.
 */
export function fitFontSize(
  field: Field,
  text: string,
  measure: (text: string, size: number) => number,
  minSize = 6
): number {
  const maxWidth = field.boxW * PAGE.W
  if (maxWidth <= 0 || !text) return field.size

  let size = field.size
  // Analytic first guess: advance width scales linearly with size.
  const w =
    measure(text, size) + field.letterSpacing * Math.max(0, text.length - 1)
  if (w > maxWidth) size = Math.max(minSize, (size * maxWidth) / w)

  // Then step down for the tracking term, which is not size-proportional.
  for (let i = 0; i < 40; i++) {
    const width =
      measure(text, size) + field.letterSpacing * Math.max(0, text.length - 1)
    if (width <= maxWidth || size <= minSize) break
    size = Math.max(minSize, size - 0.25)
  }
  return size
}

/** Left edge of the text run, given its measured width and the field anchor. */
export function alignedX(field: Field, textWidth: number) {
  const anchor = field.x * PAGE.W
  if (field.align === "center") return anchor - textWidth / 2
  if (field.align === "right") return anchor - textWidth
  return anchor
}

export function hexToRgb01(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return { r: 0, g: 0, b: 0 }
  return {
    r: parseInt(m[1], 16) / 255,
    g: parseInt(m[2], 16) / 255,
    b: parseInt(m[3], 16) / 255,
  }
}

/**
 * Default layout, derived from measurements of the template:
 *   - the blank rule sits at y=0.5530, spanning x 0.0563..0.6844 (centre 0.3703)
 *   - the bottom-right block (x .55-.97, y .78-.90) is empty
 */
export function defaultFields(): Field[] {
  return [
    {
      id: "name",
      label: "Name",
      bind: "name",
      x: 0.3703,
      y: 0.537,
      boxW: 0.6,
      align: "center",
      fontId: "playfair",
      weight: 700,
      italic: false,
      size: 34,
      color: "#292929",
      letterSpacing: 0,
      uppercase: false,
      visible: true,
    },
    {
      id: "dila",
      label: "Dila",
      bind: "dila",
      x: 0.92,
      y: 0.86,
      boxW: 0.35,
      align: "right",
      fontId: "poppins",
      weight: 600,
      italic: false,
      size: 16,
      color: "#007500",
      letterSpacing: 0,
      uppercase: false,
      visible: true,
    },
  ]
}
