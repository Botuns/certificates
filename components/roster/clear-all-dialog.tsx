"use client"

import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { actions, useStore } from "@/lib/db/store"

const CONFIRM_WORD = "DELETE"

export function ClearAllDialog({ trigger }: { trigger: React.ReactElement }) {
  const { db } = useStore()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")

  const count = db.atfal.length
  const armed = typed.trim().toUpperCase() === CONFIRM_WORD

  function confirm() {
    if (!armed) return
    actions.clearAll()
    setOpen(false)
    setTyped("")
    toast.success(`Cleared ${count} Atfal`, {
      description: "A backup was saved first — restore it from Settings.",
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setTyped("")
      }}
    >
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear the entire roster?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes all {count} Atfal for everyone using this link. A
            backup is saved automatically first, and you can restore it from
            Settings.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-clear">
            Type <span className="font-mono font-semibold">{CONFIRM_WORD}</span>{" "}
            to confirm
          </Label>
          <Input
            id="confirm-clear"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirm()}
            autoComplete="off"
            placeholder={CONFIRM_WORD}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!armed || count === 0}
            onClick={(e) => {
              e.preventDefault()
              confirm()
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Clear roster
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
