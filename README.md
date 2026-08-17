# IjtemaCerts

Certificate printer for **Majlis Atfal-ul Ahmadiyya, Oyo Ilaqa** — Regional
Ijtema & IVC 2026 (24–26 August 2026).

Build a roster of Atfal, place their **name** and **Dila** on the official
certificate once, then export print-ready PDFs individually, per Dila, or for
everyone.

## Quick start

```bash
pnpm install
cp .env.example .env.local   # paste your Vercel Blob token (optional locally)
pnpm dev
```

Without a Blob token the app still works — the roster is kept in the browser
and the header shows **"This device only"**.

## Deploying to Vercel

1. Push the repo and import it in Vercel.
2. **Storage → Create → Blob**, then connect the store to the project. Vercel
   injects `BLOB_READ_WRITE_TOKEN` automatically.
3. Deploy. The roster lives at `certificates/db.json` inside the Blob store and
   is shared by everyone who opens the link.

> The app has **no login**, by design. Anyone with the URL can view, edit and
> clear the roster. Every destructive action snapshots the previous state to
> `certificates/backups/` first (last 20 kept), restorable from **Settings**.

## How it works

**Roster** — Import `.xlsx`/`.xls`/`.csv`, or type names in. The importer scans
the first 10 rows for the real header (spreadsheets usually have a title banner
above it), fuzzy-matches column names against a synonym list so `NAMES OF
ATFAL`, `Dilla`, `Jamaat` and friends all land correctly, strips `1.`/`2)`
numbering, fixes capitalisation, drops blank rows and flags duplicates. Nothing
is imported until you have seen the mapping and the preview. Dila spellings that
differ only by case or punctuation (`Oyo Town` vs `Oyo-Town`) are surfaced for
one-click merging, so "print by Dila" groups everyone together.

**Editor** — Drag each field on the certificate, or nudge with the arrow keys
(hold Shift for fine steps). Control font, weight, italic, size, alignment,
colour, letter-spacing and capitalisation. Long names shrink automatically to
stay inside their box.

**Print** — Everyone / by Dila / a selection, as one multi-page PDF (best for
printing: one file, one job) or as separate files in a ZIP.

## Notes for future work

A few decisions in here are load-bearing and easy to undo by accident:

- **`lib/certificate/geometry.ts`** holds the template's exact media box
  (843.8898 × 597.2755 pt). Field positions are stored as **0–1 fractions**, not
  pixels, which is what lets one layout render identically in a phone preview, a
  desktop preview and the PDF.
- **The preview is an SVG** using that same viewBox, so a field's `x`/`y`/`size`
  are the very numbers written into the PDF. SVG's baseline and `text-anchor`
  semantics already match PDF's.
- **Fonts are static TTFs in `public/fonts/`**, and the *same file* backs both
  the CSS `@font-face` and pdf-lib's `embedFont`. Families are prefixed
  (`CertPoppins`, not `Poppins`) so a same-named font installed on the user's
  machine can't silently change the preview. Don't swap in variable fonts —
  fontkit only embeds their default instance, so bold would render as regular.
- **`embedFont(..., { subset: false })`** is deliberate. pdf-lib's subsetter
  drops glyphs for some of these fonts (Poppins SemiBold Italic renders
  "Oyo Town" as "Oy  wn") while still reporting correct advance widths, so the
  damage is invisible until a certificate is printed.
- **The template is embedded once** via `embedPdf` and re-drawn per page. Copying
  the page instead would turn a 1 MB file into a ~300 MB one.
- **`lib/db/merge.ts`** decides what happens when two people edit at once. It has
  a real 3-way merge when the common ancestor is known and a never-delete union
  when it isn't. Read the comments before changing it.

## Scripts

| Command | |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |

`fixtures/messy-roster.csv` is a deliberately awful spreadsheet (banner rows,
`S/N` column, `Dilla` header, blank rows, `3.` prefixes, duplicate and
inconsistently-cased Dilas) for exercising the importer.
