# Export Jobs to Excel — Workbook-Faithful

Add an "Export to Excel" button on `/jobs` that downloads the currently filtered list as an `.xlsx` file matching the original "Available Jobs" sheet from the source workbook.

## What you'll see

- A new **Export Excel** button next to the filter toolbar (icon: download).
- Clicking it downloads `Available_Jobs_YYYY-MM-DD.xlsx` with one sheet named **Available Jobs** that mirrors the source layout:

  ```text
  Row 1: "Available Jobs — Youth Sector"   (merged A1:I1, dark-blue banner, white bold)
  Row 2: # | Region | Branch | Stage | Job Title | Work Type | Count | Status | Branch Classification   (blue header)
  Row 3: Totals row (counts of regions / branches / titles / sum vacant)   (navy)
  Row 4+: One row per job, sorted by region → branch → title
  ```

- Row tinting matches the workbook palette:
  - **Headquarters** rows → light gold
  - **Boys School** rows → light blue (`#ADD8E6`)
  - **Girls School** rows → light pink (`#FFB6C1`)
- Column widths, frozen header (rows 1–3), and AutoFilter on the header row are preserved.
- Export respects the **active filters** (search / status / priority), so users can export a subset. Totals row recalculates from the exported set.

## Technical notes

- Add deps: `exceljs` + `file-saver` (+ `@types/file-saver`). Already capable of producing styled XLSX in the browser, no server function needed.
- New helper: `src/lib/exportJobsXlsx.ts` — pure client function `exportJobsToXlsx(jobs)` that builds the workbook with ExcelJS, applies the fills/fonts/borders/merged title cell, sorts rows by `REGION_ORDER` then `BRANCH_ORDER` then title, and triggers download via `saveAs`.
- Edit `src/routes/_app/jobs.tsx`:
  - Import the helper + `Download` icon from lucide.
  - Add a `<Button onClick={() => exportJobsToXlsx(filteredJobs)}>` in the toolbar (disabled when `filteredJobs.length === 0`).
  - Button label is bilingual via two new i18n keys `exportExcel` ("Export Excel" / "تصدير Excel") added to `src/contexts/I18nContext.tsx`.
- "Branch Classification" is derived: `Headquarters → Central Admin`, regions in {Riyadh, Jeddah, Qassim, Eastern Province, Madinah} → `Existing Branch`, others → `New Branch` (matches the source rule).
- Stage column = `"All Stages"` for school branches, `"-"` for HQ. Work Type = `"Full-time"`. These mirror the workbook constants.
- No Supabase changes; no new tables. The export runs entirely in the browser on whatever the Jobs query already returned.

## Out of scope

- Exporting other sheets (Pipeline, Dashboard, etc.) — separate feature.
- Server-side generation / emailed reports.
