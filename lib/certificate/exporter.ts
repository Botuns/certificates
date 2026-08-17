"use client"

import { loadFontBytes, resolveVariant } from "@/lib/certificate/fonts"
import type {
  CertificateRecord,
  GenerateInput,
} from "@/lib/certificate/generate"
import type { WorkerRequest, WorkerResponse } from "@/lib/certificate/worker"
import { safeFileName } from "@/lib/roster"
import type { Field } from "@/lib/types"

export const TEMPLATE_URL = "/template/ijtema-certificate.pdf"

let templatePromise: Promise<ArrayBuffer> | null = null

/** Fetch the template once per page load and reuse the bytes. */
function loadTemplate(): Promise<ArrayBuffer> {
  templatePromise ??= fetch(TEMPLATE_URL).then((r) => {
    if (!r.ok) throw new Error("Could not load the certificate template")
    return r.arrayBuffer()
  })
  return templatePromise
}

/** Resolve every font a layout needs, de-duplicated by file. */
async function loadFonts(fields: Field[]) {
  const fieldFontFiles: Record<string, string> = {}
  const files = new Set<string>()

  for (const field of fields) {
    if (!field.visible) continue
    const { variant } = resolveVariant(field.fontId, field.weight, field.italic)
    fieldFontFiles[field.id] = variant.file
    files.add(variant.file)
  }

  const entries = await Promise.all(
    [...files].map(async (file) => [file, await loadFontBytes(file)] as const)
  )

  return { fieldFontFiles, fontBytes: Object.fromEntries(entries) }
}

/**
 * Build the generator input. ArrayBuffers are copied because posting them to
 * the worker transfers (and detaches) them — the cached originals must survive
 * for the next export.
 */
async function buildInput(
  fields: Field[],
  records: CertificateRecord[]
): Promise<GenerateInput> {
  const [template, { fieldFontFiles, fontBytes }] = await Promise.all([
    loadTemplate(),
    loadFonts(fields),
  ])

  return {
    templateBytes: template.slice(0),
    fields,
    records,
    fontBytes: Object.fromEntries(
      Object.entries(fontBytes).map(([k, v]) => [k, v.slice(0)])
    ),
    fieldFontFiles,
  }
}

let worker: Worker | null = null
let requestId = 0

function getWorker(): Worker | null {
  if (typeof Worker === "undefined") return null
  if (worker) return worker
  try {
    worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    })
    return worker
  } catch {
    return null // fall back to the main thread
  }
}

export type ProgressFn = (done: number, total: number) => void

/**
 * Generate a multi-page PDF, off the main thread when possible so the UI keeps
 * responding while a few hundred certificates render.
 */
export async function generatePdfBytes(
  fields: Field[],
  records: CertificateRecord[],
  onProgress?: ProgressFn
): Promise<Uint8Array> {
  const input = await buildInput(fields, records)
  const w = getWorker()

  if (!w) {
    const { generateCertificates } = await import("@/lib/certificate/generate")
    return generateCertificates(input, onProgress)
  }

  const id = ++requestId

  return new Promise<Uint8Array>((resolve, reject) => {
    function cleanup() {
      w!.removeEventListener("message", onMessage)
      w!.removeEventListener("error", onError)
    }

    function onMessage(event: MessageEvent<WorkerResponse>) {
      const msg = event.data
      if (msg.id !== id) return
      if (msg.type === "progress") {
        onProgress?.(msg.done, msg.total)
      } else if (msg.type === "done") {
        cleanup()
        resolve(new Uint8Array(msg.bytes))
      } else {
        cleanup()
        reject(new Error(msg.message))
      }
    }

    function onError(event: ErrorEvent) {
      cleanup()
      reject(new Error(event.message || "Certificate worker failed"))
    }

    w.addEventListener("message", onMessage)
    w.addEventListener("error", onError)

    const transfer: Transferable[] = [
      input.templateBytes,
      ...Object.values(input.fontBytes),
    ]
    w.postMessage({ id, input } satisfies WorkerRequest, transfer)
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes.slice().buffer as ArrayBuffer], {
    type: "application/pdf",
  })
}

/** Open the PDF in a new tab and trigger the print dialog. */
export function printBytes(bytes: Uint8Array) {
  const url = URL.createObjectURL(pdfBlob(bytes))
  const win = window.open(url, "_blank")
  if (!win) {
    URL.revokeObjectURL(url)
    throw new Error(
      "Your browser blocked the print window. Allow pop-ups and retry."
    )
  }
  win.addEventListener("load", () => {
    try {
      win.focus()
      win.print()
    } catch {
      /* the user can still print from the viewer */
    }
  })
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** One PDF per record, zipped. */
export async function generateZip(
  fields: Field[],
  records: (CertificateRecord & { id?: string })[],
  onProgress?: ProgressFn
): Promise<Blob> {
  const JSZip = (await import("jszip")).default
  const zip = new JSZip()
  const used = new Set<string>()

  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    const bytes = await generatePdfBytes(fields, [record])

    const base = safeFileName(
      record.dila ? `${record.dila} - ${record.name}` : record.name
    )
    let name = `${base}.pdf`
    for (let n = 2; used.has(name); n++) name = `${base} (${n}).pdf`
    used.add(name)

    zip.file(name, bytes)
    onProgress?.(i + 1, records.length)
  }

  return zip.generateAsync({ type: "blob", compression: "STORE" })
}
