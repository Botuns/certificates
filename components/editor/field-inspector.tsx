"use client"

import { EyeIcon, EyeOffIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  availableWeights,
  FONT_FAMILIES,
  getFamily,
  hasItalic,
} from "@/lib/certificate/fonts"
import { PAGE } from "@/lib/certificate/geometry"
import type { Field, FieldAlign } from "@/lib/types"
import { cn } from "@/lib/utils"

const ALIGNS: { value: FieldAlign; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right" },
]

const SWATCHES = [
  "#292929",
  "#000000",
  "#004700",
  "#007500",
  "#009000",
  "#6b6b6b",
]

const WEIGHT_LABELS: Record<number, string> = {
  400: "Regular",
  600: "Semibold",
  700: "Bold",
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

/** Small numeric input — the accessible fallback to dragging on the canvas. */
function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
}: {
  value: number
  onChange: (n: number) => void
  step?: number
  min?: number
  max?: number
  suffix?: string
}) {
  return (
    <div className="relative">
      <input
        type="number"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
        className="h-9 w-full rounded-lg border bg-transparent px-2.5 text-sm tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  )
}

export function FieldInspector({
  field,
  onChange,
}: {
  field: Field
  onChange: (patch: Partial<Field>) => void
}) {
  const weights = availableWeights(field.fontId, field.italic)
  const italicAvailable = hasItalic(field.fontId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-bold">{field.label}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ visible: !field.visible })}
        >
          <HugeiconsIcon
            icon={field.visible ? EyeIcon : EyeOffIcon}
            className="size-4"
          />
          {field.visible ? "Shown" : "Hidden"}
        </Button>
      </div>

      <Row label="Font">
        <Select
          value={field.fontId}
          onValueChange={(v) => {
            const id = String(v ?? field.fontId)
            // Weights differ per family, so snap to one this family ships.
            const next = availableWeights(id, field.italic)
            onChange({
              fontId: id,
              weight: next.includes(field.weight)
                ? field.weight
                : next[next.length - 1],
              italic: hasItalic(id) ? field.italic : false,
            })
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue>{(v) => getFamily(String(v)).label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                <span style={{ fontFamily: `"${f.cssFamily}", serif` }}>
                  {f.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      <div className="grid grid-cols-2 gap-3">
        <Row label="Weight">
          <Select
            value={String(field.weight)}
            onValueChange={(v) =>
              onChange({ weight: Number(v ?? field.weight) })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v) => WEIGHT_LABELS[Number(v)] ?? String(v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {weights.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {WEIGHT_LABELS[w] ?? w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label="Style">
          <div className="flex gap-1">
            <Button
              variant={field.italic ? "outline" : "secondary"}
              size="sm"
              className="flex-1"
              onClick={() => onChange({ italic: false })}
            >
              Normal
            </Button>
            <Button
              variant={field.italic ? "secondary" : "outline"}
              size="sm"
              className="flex-1 italic"
              disabled={!italicAvailable}
              title={italicAvailable ? undefined : "This font has no italic"}
              onClick={() => onChange({ italic: true })}
            >
              Italic
            </Button>
          </div>
        </Row>
      </div>

      <Row label={`Size — ${Math.round(field.size)}pt`}>
        <Slider
          value={[field.size]}
          min={8}
          max={72}
          step={1}
          onValueChange={(v) => onChange({ size: Array.isArray(v) ? v[0] : v })}
        />
      </Row>

      <Row label="Alignment">
        <div className="flex gap-1">
          {ALIGNS.map((a) => (
            <Button
              key={a.value}
              variant={field.align === a.value ? "secondary" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => onChange({ align: a.value })}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </Row>

      <div className="grid grid-cols-2 gap-3">
        <Row label="X position">
          <NumberInput
            value={field.x * 100}
            step={0.5}
            min={0}
            max={100}
            suffix="%"
            onChange={(n) => onChange({ x: Math.min(1, Math.max(0, n / 100)) })}
          />
        </Row>
        <Row label="Y position">
          <NumberInput
            value={field.y * 100}
            step={0.5}
            min={0}
            max={100}
            suffix="%"
            onChange={(n) => onChange({ y: Math.min(1, Math.max(0, n / 100)) })}
          />
        </Row>
      </div>

      <Row
        label={`Max width — ${Math.round(field.boxW * PAGE.W)}pt before shrinking`}
      >
        <Slider
          value={[field.boxW]}
          min={0.1}
          max={1}
          step={0.01}
          onValueChange={(v) => onChange({ boxW: Array.isArray(v) ? v[0] : v })}
        />
      </Row>

      <Row label={`Letter spacing — ${field.letterSpacing.toFixed(1)}pt`}>
        <Slider
          value={[field.letterSpacing]}
          min={-2}
          max={10}
          step={0.1}
          onValueChange={(v) =>
            onChange({ letterSpacing: Array.isArray(v) ? v[0] : v })
          }
        />
      </Row>

      <Row label="Colour">
        <div className="flex flex-wrap items-center gap-1.5">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Use ${c}`}
              onClick={() => onChange({ color: c })}
              style={{ backgroundColor: c }}
              className={cn(
                "size-7 rounded-full ring-offset-2 ring-offset-card transition-shadow",
                field.color.toLowerCase() === c.toLowerCase()
                  ? "ring-2 ring-primary"
                  : "ring-1 ring-border"
              )}
            />
          ))}
          <input
            type="color"
            value={field.color}
            onChange={(e) => onChange({ color: e.target.value })}
            aria-label="Custom colour"
            className="size-7 cursor-pointer rounded-full border bg-transparent p-0"
          />
        </div>
      </Row>

      <Row label="Capitalisation">
        <div className="flex gap-1">
          <Button
            variant={field.uppercase ? "outline" : "secondary"}
            size="sm"
            className="flex-1"
            onClick={() => onChange({ uppercase: false })}
          >
            As typed
          </Button>
          <Button
            variant={field.uppercase ? "secondary" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => onChange({ uppercase: true })}
          >
            UPPERCASE
          </Button>
        </div>
      </Row>
    </div>
  )
}
