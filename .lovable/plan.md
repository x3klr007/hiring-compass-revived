# Jobs Page — Search & Filtering

Add a filter toolbar to `/jobs` so users can quickly narrow down the 45 vacancies without losing the existing region/branch grouping.

## What you'll see

A compact toolbar above the region tabs with:

- **Search box** — matches `title` (English/Arabic substring) and `job_code` (e.g. "JOB-047"). Debounced, case-insensitive.
- **Status filter** — multi-select chips: `Open`, `Filled`, `On Hold`.
- **Priority filter** — chips: `High`, `Normal`.
- **Clear filters** button — appears when any filter is active; shows a count badge ("3 of 45").

The region tabs and per-branch tables remain. Tab counts and the summary stats (Total / Open / Regions / Branches) update live to reflect only the filtered set. Empty regions/branches are hidden when filters exclude them. If nothing matches, a friendly empty state replaces the tables.

Fully bilingual (EN/AR) with RTL-aware spacing.

## Technical notes

- Edit only `src/routes/_app/jobs.tsx` — pure client-side filtering on the already-fetched `jobs` query (no DB or RLS changes; dataset is small).
- New local state: `search: string`, `statuses: Set<string>`, `priorities: Set<string>`. Wrap in `useMemo` that returns `filteredJobs`, then feed `filteredJobs` into the existing `grouped` / `totals` memos (refactor those to accept the filtered list).
- UI built from existing shadcn primitives: `Input` (with `Search` icon from lucide), `Badge`/`Button` for toggleable chips, no new deps.
- Add new i18n keys to `src/contexts/I18nContext.tsx`: `searchPlaceholder`, `filters`, `clearFilters`, `noMatches`, `showing` (EN + AR).
- Region tab counts derived from `filteredJobs` so a tab disappears (or shows 0) when its region has no matches; auto-fall back to "all" if the active tab becomes empty.
- Preserve existing `REGION_ORDER` / `BRANCH_ORDER` sorting and the priority/status badges in the table rows.

## Out of scope

- No URL/search-param persistence (can add later with the zod adapter if you want shareable filtered views).
- No edit/create job actions — filtering only.
