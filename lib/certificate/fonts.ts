export type FontVariant = { weight: number; italic: boolean; file: string }

export type FontFamily = {
  id: string
  label: string
  /** Must match the @font-face family in globals.css. */
  cssFamily: string
  category: "sans" | "serif" | "display" | "script"
  variants: FontVariant[]
}

/**
 * The same TTF file backs both the CSS @font-face (on-screen preview) and the
 * fetch() that feeds pdf-lib's embedFont (export). That shared file is the
 * whole reason the preview matches the printed certificate.
 *
 * These are static instances, not variable fonts — fontkit only embeds a
 * variable font's default instance, so bold would silently render as regular.
 */
export const FONT_FAMILIES: FontFamily[] = [
  {
    id: "poppins",
    label: "Poppins",
    cssFamily: "CertPoppins",
    category: "sans",
    variants: [
      { weight: 400, italic: false, file: "poppins-400.ttf" },
      { weight: 600, italic: false, file: "poppins-600.ttf" },
      { weight: 700, italic: false, file: "poppins-700.ttf" },
      { weight: 400, italic: true, file: "poppins-400i.ttf" },
      { weight: 600, italic: true, file: "poppins-600i.ttf" },
      { weight: 700, italic: true, file: "poppins-700i.ttf" },
    ],
  },
  {
    id: "montserrat",
    label: "Montserrat",
    cssFamily: "CertMontserrat",
    category: "sans",
    variants: [
      { weight: 400, italic: false, file: "montserrat-400.ttf" },
      { weight: 600, italic: false, file: "montserrat-600.ttf" },
      { weight: 700, italic: false, file: "montserrat-700.ttf" },
      { weight: 400, italic: true, file: "montserrat-400i.ttf" },
      { weight: 600, italic: true, file: "montserrat-600i.ttf" },
      { weight: 700, italic: true, file: "montserrat-700i.ttf" },
    ],
  },
  {
    id: "playfair",
    label: "Playfair Display",
    cssFamily: "CertPlayfair",
    category: "serif",
    variants: [
      { weight: 400, italic: false, file: "playfair-400.ttf" },
      { weight: 700, italic: false, file: "playfair-700.ttf" },
      { weight: 400, italic: true, file: "playfair-400i.ttf" },
      { weight: 700, italic: true, file: "playfair-700i.ttf" },
    ],
  },
  {
    id: "garamond",
    label: "EB Garamond",
    cssFamily: "CertGaramond",
    category: "serif",
    variants: [
      { weight: 400, italic: false, file: "garamond-400.ttf" },
      { weight: 700, italic: false, file: "garamond-700.ttf" },
      { weight: 400, italic: true, file: "garamond-400i.ttf" },
      { weight: 700, italic: true, file: "garamond-700i.ttf" },
    ],
  },
  {
    id: "cinzel",
    label: "Cinzel",
    cssFamily: "CertCinzel",
    category: "display",
    variants: [
      { weight: 400, italic: false, file: "cinzel-400.ttf" },
      { weight: 700, italic: false, file: "cinzel-700.ttf" },
    ],
  },
  {
    id: "greatvibes",
    label: "Great Vibes",
    cssFamily: "CertGreatVibes",
    category: "script",
    variants: [{ weight: 400, italic: false, file: "greatvibes-400.ttf" }],
  },
]

export const DEFAULT_FONT_ID = "playfair"

export function getFamily(id: string): FontFamily {
  return FONT_FAMILIES.find((f) => f.id === id) ?? FONT_FAMILIES[0]
}

/**
 * Pick the closest available variant. Families ship different weight sets, so
 * asking Great Vibes for 700 must resolve to its only file rather than fail.
 */
export function resolveVariant(
  fontId: string,
  weight: number,
  italic: boolean
): { family: FontFamily; variant: FontVariant } {
  const family = getFamily(fontId)
  const pool = family.variants.filter((v) => v.italic === italic)
  const candidates = pool.length ? pool : family.variants
  const variant = candidates.reduce((best, v) =>
    Math.abs(v.weight - weight) < Math.abs(best.weight - weight) ? v : best
  )
  return { family, variant }
}

export function availableWeights(fontId: string, italic: boolean): number[] {
  const family = getFamily(fontId)
  const pool = family.variants.filter((v) => v.italic === italic)
  const set = new Set(
    (pool.length ? pool : family.variants).map((v) => v.weight)
  )
  return [...set].sort((a, b) => a - b)
}

export function hasItalic(fontId: string): boolean {
  return getFamily(fontId).variants.some((v) => v.italic)
}

export const fontUrl = (file: string) => `/fonts/${file}`

const bytesCache = new Map<string, Promise<ArrayBuffer>>()

/** Fetch (and memoize) the raw TTF bytes for pdf-lib. */
export function loadFontBytes(file: string): Promise<ArrayBuffer> {
  let p = bytesCache.get(file)
  if (!p) {
    p = fetch(fontUrl(file)).then((r) => {
      if (!r.ok) throw new Error(`Failed to load font ${file}`)
      return r.arrayBuffer()
    })
    bytesCache.set(file, p)
  }
  return p
}

/**
 * Ensure the browser has the face ready before we measure with canvas —
 * measuring an unloaded family silently returns fallback-font metrics, which
 * would make the preview disagree with the export.
 */
export async function ensureFontLoaded(
  fontId: string,
  weight: number,
  italic: boolean
): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return
  const { family, variant } = resolveVariant(fontId, weight, italic)
  const spec = `${italic ? "italic " : ""}${variant.weight} 16px "${family.cssFamily}"`
  try {
    await document.fonts.load(spec, "Aa")
  } catch {
    /* non-fatal: measurement falls back, preview still renders */
  }
}

export function cssFontStack(fontId: string): string {
  const family = getFamily(fontId)
  const fallback =
    family.category === "serif" || family.category === "display"
      ? "serif"
      : family.category === "script"
        ? "cursive"
        : "sans-serif"
  return `"${family.cssFamily}", ${fallback}`
}
