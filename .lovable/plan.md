# Sortable Jobs Page

Add a sort dropdown to the Jobs page so users can reorder vacancies by priority, region, branch, or remaining headcount.

## What you'll see

A new **Sort by** dropdown placed next to the Search input in the filter toolbar, with options:

- **Default** (Region → Branch → Title — current behavior)
- **Priority** (High first)
- **Region** (workbook order: Riyadh, Jeddah, ... Jazan)
- **Branch** (HQ → Boys School → Girls School)
- **Remaining vacancies** (`headcount − hired_count`, highest first)
- **Hired count** (highest first)

Next to the dropdown, a small **direction toggle** (↑ / ↓) flips ascending/descending. Active sort is reflected in a subtle badge ("Sorted by Priority ↓").

When sort = Default, the existing Region tabs and grouped Branch tables stay exactly as they are. When any other sort is active, the page automatically switches to a **single flat table view** (one table, columns: Code · Title · Region · Branch · Priority · Headcount · Hired · Remaining · Status) so the chosen ordering is visible end-to-end. Region tabs still filter the visible rows. Switching back to Default restores the grouped view.

Bilingual labels (EN/AR), RTL-aware.

## Technical notes

- Edit only `src/routes/_app/jobs.tsx`.
- New state: `sortBy: 'default' | 'priority' | 'region' | 'branch' | 'remaining' | 'hired'` and `sortDir: 'asc' | 'desc'`.
- Add a `sortedJobs = useMemo(...)` derived from `filteredJobs`. Default sort uses existing `REGION_ORDER` / `BRANCH_ORDER`. Priority maps `High=0, Normal=1`. Region/branch sorts use the same ordered indexes. Remaining = `headcount − hired_count`. Numeric sorts respect `sortDir`.
- Render flow:
  - `sortBy === 'default'` → existing `grouped` region/branch view (unchanged).
  - Otherwise → single `<Card>` with one `<table>` listing `sortedJobs` (filtered by active region tab when not "all"). Reuse the existing row click-to-open-details and `<Highlight>` for search matches.
- Use shadcn `Select` (already installed) for the dropdown; small ghost `<Button>` for the direction toggle.
- Add 4 i18n keys: `sortBy`, `default`, `remainingVacancies`, `sortAsc`/`sortDesc` (EN + AR).
- Export-to-Excel keeps using `filteredJobs` (workbook ordering remains canonical for exports).

## Out of scope

- Multi-column sorting (single key + direction is enough).
- URL persistence of sort state (can be added later with the search-params adapter).
