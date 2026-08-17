"use client"

import { useEffect } from "react"

import { initStore } from "@/lib/db/store"

/** Kicks off the cache-then-revalidate boot exactly once per page load. */
export function StoreBoot() {
  useEffect(() => {
    initStore()
  }, [])
  return null
}
