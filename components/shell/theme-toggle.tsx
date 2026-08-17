"use client"

import { Moon02Icon, Sun01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Both icons render; CSS picks one off the .dark class on <html>. This
          avoids a mounted flag, so there is no hydration mismatch and no
          setState-in-effect. */}
      <HugeiconsIcon
        icon={Moon02Icon}
        className="size-5 dark:hidden"
        strokeWidth={1.8}
      />
      <HugeiconsIcon
        icon={Sun01Icon}
        className="hidden size-5 dark:block"
        strokeWidth={1.8}
      />
    </Button>
  )
}
