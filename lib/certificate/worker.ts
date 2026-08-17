/// <reference lib="webworker" />

import {
  generateCertificates,
  type GenerateInput,
} from "@/lib/certificate/generate"

export type WorkerRequest = { id: number; input: GenerateInput }

export type WorkerResponse =
  | { id: number; type: "progress"; done: number; total: number }
  | { id: number; type: "done"; bytes: ArrayBuffer }
  | { id: number; type: "error"; message: string }

const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const { id, input } = event.data

  void (async () => {
    try {
      const bytes = await generateCertificates(input, (done, total) => {
        ctx.postMessage({
          id,
          type: "progress",
          done,
          total,
        } satisfies WorkerResponse)
      })
      // Copy into a fresh buffer so it can be transferred without detaching
      // anything the caller might still hold.
      const out = bytes.slice().buffer as ArrayBuffer
      ctx.postMessage(
        { id, type: "done", bytes: out } satisfies WorkerResponse,
        [out]
      )
    } catch (err) {
      ctx.postMessage({
        id,
        type: "error",
        message: err instanceof Error ? err.message : "Generation failed",
      } satisfies WorkerResponse)
    }
  })()
})
