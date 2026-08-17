/**
 * Hand-off of "print these specific people" from the roster to the print page.
 *
 * Module state rather than sessionStorage or the URL: navigation between the
 * two pages is client-side, so this survives the trip, avoids stuffing hundreds
 * of ids into a query string, and can't be read back stale after a reload.
 */
let selection: string[] = []

export function setPrintSelection(ids: string[]) {
  selection = [...ids]
}

export function getPrintSelection(): string[] {
  return selection
}
