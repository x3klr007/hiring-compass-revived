# Job Details Modal

Make every row in the Jobs table clickable. Opens a modal with a rich overview of that vacancy.

## What you'll see

Click anywhere on a job row → a centered dialog opens with:

- **Header**: Job title (large) + bilingual subtitle, plus colored badges for `priority`, `status`, and a branch-classification chip (HQ / Existing / New Branch).
- **Identity strip**: monospace `job_code`, region (with map-pin icon), branch (with branch icon), opened-on date.
- **Hiring progress card**: big "X / Y filled" with a progress bar (`hired_count / headcount`), a `Remaining: N` chip, and color tone (green when fully filled, amber when partial, primary when empty).
- **Pipeline stats card** (live, from `candidates` joined on `job_id`): total candidates for this job, breakdown by stage (Applied / Screening / Interview / Offer / Hired / Rejected) shown as small chips. Falls back to "No candidates yet" when empty.
- **Description**: long-form `description` text in a muted panel; if null, shows a friendly placeholder ("No description provided").
- **Footer**: timestamps (created_at, opened_at, target_fill_date if set) and a "Close" button.

Bilingual EN/AR with RTL-aware spacing. Clicking outside or pressing Esc closes it.

## Technical notes

- Edit only `src/routes/_app/jobs.tsx`. No DB schema changes (`description`, `opened_at`, `target_fill_date` already exist on `jobs`).
- Add a controlled `selectedJob: Job | null` state. Make the `<tr>` `cursor-pointer hover:bg-muted/40` and bind `onClick={() => setSelectedJob(j)}`.
- Use shadcn `Dialog` (already installed) for the modal; `Progress` for the fill bar.
- Pipeline stats: a small `useQuery({ queryKey: ['job-candidates', selectedJob.id], enabled: !!selectedJob })` hook fetches `candidates` filtered by `job_id` and groups by `stage` client-side. Lightweight (RLS already permits authenticated reads).
- Add 4 i18n keys: `noDescription`, `remaining`, `pipelineOverview`, `openedOn` (EN + AR).
- Keep all existing filtering/grouping/export logic intact.

## Out of scope

- Editing job fields from the modal (read-only view for now).
- Linking through to a per-job pipeline page — can come later.
