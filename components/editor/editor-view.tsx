"use client"

import { useEffect, useMemo, useState } from "react"
import { PrinterIcon, Refresh01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { toast } from "sonner"

import { CertificateCanvas } from "@/components/editor/certificate-canvas"
import { FieldInspector } from "@/components/editor/field-inspector"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { actions, useStore } from "@/lib/db/store"
import { dilaOf, sortForPrint } from "@/lib/roster"
import { cn } from "@/lib/utils"

const SAMPLE = "__sample__"
const NUDGE = 0.002
const NUDGE_FINE = 0.0005

export function EditorView() {
  const { db } = useStore()
  const [selectedFieldId, setSelectedFieldId] = useState<string>("name")
  const [previewId, setPreviewId] = useState<string>(SAMPLE)
  const [sampleName, setSampleName] = useState("Abdul-Qahar Olajide")
  const [sampleDila, setSampleDila] = useState("Ibadan")

  const roster = useMemo(() => sortForPrint(db.atfal), [db.atfal])
  const field =
    db.fields.find((f) => f.id === selectedFieldId) ?? db.fields[0] ?? null

  const values = useMemo(() => {
    if (previewId !== SAMPLE) {
      const hit = db.atfal.find((a) => a.id === previewId)
      if (hit) return { name: hit.name, dila: dilaOf(hit) }
    }
    return { name: sampleName, dila: sampleDila }
  }, [previewId, db.atfal, sampleName, sampleDila])

  // Arrow keys nudge the selected field; Shift = finer steps.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!field) return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return
      }
      const step = e.shiftKey ? NUDGE_FINE : NUDGE
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      const move = moves[e.key]
      if (!move) return
      e.preventDefault()
      actions.updateField(field.id, {
        x: Math.min(1, Math.max(0, field.x + move[0])),
        y: Math.min(1, Math.max(0, field.y + move[1])),
      })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [field])

  return (
    <>
      <PageHeader
        title="Certificate editor"
        description="Drag each field into place, or nudge it with the arrow keys. This layout is used for every certificate."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                actions.resetFields()
                toast.success("Layout reset to defaults")
              }}
            >
              <HugeiconsIcon icon={Refresh01Icon} className="size-4" />
              Reset
            </Button>
            <Button nativeButton={false} render={<Link href="/print" />}>
              <HugeiconsIcon icon={PrinterIcon} className="size-4" />
              Print
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <CertificateCanvas
            fields={db.fields}
            values={values}
            selectedId={field?.id}
            onSelect={setSelectedFieldId}
            onMove={(id, x, y) => actions.updateField(id, { x, y })}
          />

          <div className="rounded-2xl border bg-card p-4">
            <Label className="text-xs text-muted-foreground">
              Preview with
            </Label>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Select
                value={previewId}
                onValueChange={(v) => setPreviewId(String(v ?? SAMPLE))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v) => {
                      if (v === SAMPLE) return "Sample text"
                      const hit = db.atfal.find((a) => a.id === v)
                      return hit
                        ? `${hit.name} — ${dilaOf(hit)}`
                        : "Sample text"
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SAMPLE}>Sample text</SelectItem>
                  {roster.slice(0, 100).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} — {dilaOf(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {previewId === SAMPLE && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="sample-name"
                    className="text-xs text-muted-foreground"
                  >
                    Sample name
                  </Label>
                  <Input
                    id="sample-name"
                    value={sampleName}
                    onChange={(e) => setSampleName(e.target.value)}
                    placeholder="Type a long name to test the fit"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="sample-dila"
                    className="text-xs text-muted-foreground"
                  >
                    Sample Dila
                  </Label>
                  <Input
                    id="sample-dila"
                    value={sampleDila}
                    onChange={(e) => setSampleDila(e.target.value)}
                  />
                </div>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Long names shrink automatically to stay inside their box — try the
              longest name on your roster here.
            </p>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            {db.fields.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFieldId(f.id)}
                className={cn(
                  "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  f.id === field?.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {field && (
            <div className="rounded-2xl border bg-card p-4">
              <FieldInspector
                field={field}
                onChange={(patch) => actions.updateField(field.id, patch)}
              />
            </div>
          )}
        </aside>
      </div>
    </>
  )
}
