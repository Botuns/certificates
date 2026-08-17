export type SheetData = { name: string; rows: string[][] }

/**
 * Read an .xlsx/.xls/.csv file into raw string grids, one per sheet.
 *
 * `xlsx` is ~400KB, so it is imported dynamically — it only loads when the
 * import dialog is actually opened, keeping first paint fast.
 */
export async function parseWorkbook(file: File): Promise<SheetData[]> {
  const XLSX = await import("xlsx")
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: "array", cellDates: false })

  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    })
    return {
      name,
      rows: rows.map((r) =>
        Array.isArray(r) ? r.map((c) => String(c ?? "")) : []
      ),
    }
  }).filter((s) => s.rows.length > 0)
}

export const ACCEPTED_TYPES =
  ".csv,.xlsx,.xls,.xlsm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
