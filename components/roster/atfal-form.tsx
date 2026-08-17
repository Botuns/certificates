"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { actions, useStore } from "@/lib/db/store"
import { cleanDila, cleanName, toTitleCase } from "@/lib/import/clean"
import { uniqueDilas } from "@/lib/roster"
import type { Atfal } from "@/lib/types"

const DILA_LIST_ID = "known-dilas"

function DilaOptions({ values }: { values: string[] }) {
  return (
    <datalist id={DILA_LIST_ID}>
      {values.map((d) => (
        <option key={d} value={d} />
      ))}
    </datalist>
  )
}

/** Add a single Atfal, or paste a whole list at once. */
export function AddAtfalDialog({ trigger }: { trigger: React.ReactElement }) {
  const { db } = useStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [dila, setDila] = useState("")
  const [bulk, setBulk] = useState("")
  const [bulkDila, setBulkDila] = useState("")

  const dilas = useMemo(() => uniqueDilas(db.atfal), [db.atfal])

  const bulkNames = useMemo(
    () =>
      bulk
        .split("\n")
        .map((l) => cleanName(l))
        .filter(Boolean),
    [bulk]
  )

  function reset() {
    setName("")
    setDila("")
    setBulk("")
    setBulkDila("")
  }

  function submitOne(e: React.FormEvent) {
    e.preventDefault()
    const n = cleanName(name)
    if (!n) return
    actions.addAtfal(n, cleanDila(dila))
    toast.success(`Added ${n}`)
    // Keep the Dila so the next entry in the same group is one field away.
    setName("")
  }

  function submitBulk() {
    if (!bulkNames.length) return
    const d = cleanDila(bulkDila)
    actions.addMany(bulkNames.map((n) => ({ name: n, dila: d })))
    toast.success(`Added ${bulkNames.length} Atfal`, {
      description: d ? `Dila: ${d}` : "No Dila set",
    })
    setBulk("")
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Atfal</DialogTitle>
          <DialogDescription>
            Add one at a time, or paste a list of names that share a Dila.
          </DialogDescription>
        </DialogHeader>

        <DilaOptions values={dilas} />

        <Tabs defaultValue="single">
          <TabsList className="w-full">
            <TabsTrigger value="single" className="flex-1">
              One at a time
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex-1">
              Paste a list
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single">
            <form onSubmit={submitOne} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="atfal-name">Full name</Label>
                <Input
                  id="atfal-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Abdul-Qahar Olajide"
                  autoFocus
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="atfal-dila">Dila</Label>
                <Input
                  id="atfal-dila"
                  value={dila}
                  onChange={(e) => setDila(e.target.value)}
                  placeholder="Ibadan"
                  list={DILA_LIST_ID}
                  autoComplete="off"
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false)
                    reset()
                  }}
                >
                  Done
                </Button>
                <Button type="submit" disabled={!cleanName(name)}>
                  Add &amp; keep going
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="bulk">
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="bulk-dila">Dila for all of these</Label>
                <Input
                  id="bulk-dila"
                  value={bulkDila}
                  onChange={(e) => setBulkDila(e.target.value)}
                  placeholder="Ibadan"
                  list={DILA_LIST_ID}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-names">One name per line</Label>
                <textarea
                  id="bulk-names"
                  value={bulk}
                  onChange={(e) => setBulk(e.target.value)}
                  rows={8}
                  placeholder={
                    "Abdul-Qahar Olajide\nMuhammad Ibrahim\nYusuf Adebayo"
                  }
                  className="w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                />
                <p className="text-xs text-muted-foreground">
                  {bulkNames.length} name{bulkNames.length === 1 ? "" : "s"}{" "}
                  detected · numbering like &ldquo;1.&rdquo; is removed
                  automatically
                </p>
              </div>
              <DialogFooter>
                <Button onClick={submitBulk} disabled={!bulkNames.length}>
                  Add {bulkNames.length || ""} Atfal
                </Button>
              </DialogFooter>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Callers must pass `key={atfal?.id}` so switching rows remounts this and the
 * fields re-seed from the new record — cleaner than copying props into state
 * from an effect.
 */
export function EditAtfalDialog({
  atfal,
  open,
  onOpenChange,
}: {
  atfal: Atfal | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { db } = useStore()
  const [name, setName] = useState(atfal?.name ?? "")
  const [dila, setDila] = useState(atfal?.dila ?? "")

  const dilas = useMemo(() => uniqueDilas(db.atfal), [db.atfal])

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!atfal) return
    const n = cleanName(name)
    if (!n) return
    actions.updateAtfal(atfal.id, { name: n, dila: cleanDila(dila) })
    onOpenChange(false)
    toast.success("Saved")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Atfal</DialogTitle>
          <DialogDescription>
            This is exactly what gets printed on the certificate.
          </DialogDescription>
        </DialogHeader>

        <DilaOptions values={dilas} />

        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Full name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setName(toTitleCase(name))}
              className="text-xs font-medium text-primary hover:underline"
            >
              Fix capitalisation
            </button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-dila">Dila</Label>
            <Input
              id="edit-dila"
              value={dila}
              onChange={(e) => setDila(e.target.value)}
              list={DILA_LIST_ID}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!cleanName(name)}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
