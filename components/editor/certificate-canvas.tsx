"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"

import { cssFontStack, ensureFontLoaded } from "@/lib/certificate/fonts"
import { clamp01, PAGE } from "@/lib/certificate/geometry"
import { layoutField } from "@/lib/certificate/measure"
import type { Field } from "@/lib/types"
import { cn } from "@/lib/utils"

const ANCHOR = { left: "start", center: "middle", right: "end" } as const

export type CanvasValues = Record<string, string>

/**
 * The certificate preview.
 *
 * Rendered as an SVG whose viewBox is the PDF's exact media box, so a field's
 * x/y/size are the *same numbers* the exporter writes into the PDF — no unit
 * conversion, and SVG's text baseline and text-anchor semantics already match
 * PDF's. It also scales to any container width for free, which is what makes
 * the editor usable on a phone.
 */
export function CertificateCanvas({
  fields,
  values,
  selectedId,
  onSelect,
  onMove,
  interactive = true,
  className,
}: {
  fields: Field[]
  values: CanvasValues
  selectedId?: string | null
  onSelect?: (id: string) => void
  onMove?: (id: string, x: number, y: number) => void
  interactive?: boolean
  className?: string
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)

  // Bumped once the fonts a layout needs are resident. Text is not drawn until
  // then for two reasons: canvas measureText reports fallback metrics for an
  // unloaded face, and there is no canvas at all during SSR — rendering text
  // before this would both mis-size the glyphs and cause a hydration mismatch.
  // Re-running on `fields` also re-measures after a font swap.
  const [fontEpoch, setFontEpoch] = useState(0)
  const measured = fontEpoch > 0

  useEffect(() => {
    let cancelled = false
    void Promise.all(
      fields.map((f) => ensureFontLoaded(f.fontId, f.weight, f.italic))
    ).then(() => {
      if (!cancelled) setFontEpoch((n) => n + 1)
    })
    return () => {
      cancelled = true
    }
  }, [fields])

  const pointToFraction = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    }
  }, [])

  function handlePointerDown(e: React.PointerEvent, field: Field) {
    if (!interactive || !onMove) return
    e.preventDefault()
    onSelect?.(field.id)
    const p = pointToFraction(e.clientX, e.clientY)
    dragRef.current = { id: field.id, dx: p.x - field.x, dy: p.y - field.y }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag || !onMove) return
    e.preventDefault()
    const p = pointToFraction(e.clientX, e.clientY)
    onMove(drag.id, clamp01(p.x - drag.dx), clamp01(p.y - drag.dy))
  }

  function endDrag(e: React.PointerEvent) {
    if (!dragRef.current) return
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    dragRef.current = null
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5",
        className
      )}
      style={{ aspectRatio: `${PAGE.W} / ${PAGE.H}` }}
    >
      <Image
        src="/template/ijtema-certificate.png"
        alt="Certificate template"
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 60vw"
        className="pointer-events-none select-none"
      />

      <svg
        ref={svgRef}
        data-slot="certificate-canvas"
        viewBox={`0 0 ${PAGE.W} ${PAGE.H}`}
        className={cn(
          "absolute inset-0 h-full w-full",
          interactive && "touch-none"
        )}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {measured &&
          fields
            .filter((f) => f.visible)
            .map((field) => {
              const value = values[field.bind] ?? ""
              const { text, size, width } = layoutField(field, value)
              const x = field.x * PAGE.W
              const y = field.y * PAGE.H
              const selected = selectedId === field.id
              const empty = !text

              const boxX =
                field.align === "center"
                  ? x - width / 2
                  : field.align === "right"
                    ? x - width
                    : x

              return (
                <g key={field.id}>
                  {/* Hit area — a bit taller than the glyphs so it stays
                      grabbable on touch even for small text. */}
                  {interactive && (
                    <rect
                      x={boxX - 6}
                      y={y - size * 1.05}
                      width={Math.max(width, 40) + 12}
                      height={size * 1.45}
                      fill="transparent"
                      className="cursor-move"
                      onPointerDown={(e) => handlePointerDown(e, field)}
                    />
                  )}

                  {selected && interactive && (
                    <>
                      <rect
                        x={boxX - 6}
                        y={y - size * 1.05}
                        width={Math.max(width, 40) + 12}
                        height={size * 1.45}
                        className="fill-primary/8 stroke-primary"
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        pointerEvents="none"
                        rx={3}
                      />
                      {/* The shrink-to-fit boundary. */}
                      <line
                        x1={
                          field.align === "center"
                            ? x - (field.boxW * PAGE.W) / 2
                            : field.align === "right"
                              ? x - field.boxW * PAGE.W
                              : x
                        }
                        x2={
                          field.align === "center"
                            ? x + (field.boxW * PAGE.W) / 2
                            : field.align === "right"
                              ? x
                              : x + field.boxW * PAGE.W
                        }
                        y1={y + size * 0.28}
                        y2={y + size * 0.28}
                        className="stroke-primary/40"
                        strokeWidth={0.8}
                        pointerEvents="none"
                      />
                    </>
                  )}

                  <text
                    x={x}
                    y={y}
                    textAnchor={ANCHOR[field.align]}
                    fontFamily={cssFontStack(field.fontId)}
                    fontSize={size}
                    fontWeight={field.weight}
                    fontStyle={field.italic ? "italic" : "normal"}
                    letterSpacing={field.letterSpacing || undefined}
                    fill={empty ? "#9aa39a" : field.color}
                    opacity={empty ? 0.7 : 1}
                    pointerEvents="none"
                    style={{ whiteSpace: "pre" }}
                  >
                    {text || `{${field.label}}`}
                  </text>
                </g>
              )
            })}
      </svg>
    </div>
  )
}
