## What we're porting

The GitHub repo `hiring-compass` is a partially-built Lovable ATS (Vite + react-router-dom + Supabase). The zip (`Nasheen_ATS_Final_Handover.zip`) is an older, fuller Express/Drizzle build with a richer feature set and the **authoritative recruitment data** extracted from the original Saudi Arabic Excel workbook (45 positions, 10 regions/branches, Arabic pipeline columns, 100-point committee rubric).

We'll rebuild it inside this project's stack (TanStack Start + Lovable Cloud/Supabase + Lovable AI Gateway), keeping the data model from the workbook, fixing the broken AI/provider pieces, and shipping bilingual AR/EN from day one.

## Stack mapping (old → new)

| Old | New |
|---|---|
| `react-router-dom` `<BrowserRouter>` + `App.tsx` | TanStack Start file routes in `src/routes/` |
| Supabase Edge Functions (`ats-agent`, `screen-cv`) | `createServerFn` handlers in `src/server/*.functions.ts` |
| Direct provider keys (Gemini/OpenAI in old `.env`) | Lovable AI Gateway via `LOVABLE_API_KEY` |
| `tailwind.config.ts` + Tailwind v3 | Existing Tailwind v4 in `src/styles.css` (extend tokens) |
| Drizzle ORM (zip) | Lovable Cloud (Supabase) with the migration from the repo as starting point |

## Phase 1 — Foundation & data model

1. **Enable Lovable Cloud** (Supabase + AI Gateway).
2. **Migration** — port the 280-line SQL migration from the repo (`profiles`, `user_roles` enum + `has_role()`, `jobs`, `pipeline_stages`, `candidates`, with auto-codes, stage-change triggers, tier auto-routing). Extend it with workbook-aligned tables:
   - `branches` (10 Saudi regions: Riyadh HQ, Jeddah, Dammam, Abha, Al Ahsa, …) seeded from `workbook_summary.json`
   - `interviews` (date, committee, interviewer, result, notes)
   - `offers` (status, salary, currency, expected start, accepted_at)
   - `committees` (e.g. "الشبانات", "الخزمري")
   - `score_rubric` columns on `candidates`: technical(0-30), personal(0-25), experience(0-20), learning(0-15), communication(0-10), total(0-100)
   - `audit_log` (actor, action, entity, entity_id, before/after JSON, ts)
   - `templates` (email/SMS templates, AR + EN bodies)
   - `cv_files` (storage ref, parsed text, vision_used flag)
3. **Storage bucket** `cvs` for resume uploads (PDF/DOCX/TXT) with RLS.
4. **Seed script** that loads the 45 positions / 10 branches / committees from the workbook JSON files included in the zip.

## Phase 2 — App shell, auth, i18n

5. **Routes scaffolding** under `src/routes/`:
   ```text
   __root.tsx              → providers (QueryClient, I18n, Auth, Tooltip, Toaster), <html dir>
   index.tsx               → redirect to /dashboard or /auth
   auth.tsx                → email/password + (later) Google OAuth
   _app.tsx                → authenticated layout w/ AppShell + <Outlet />
   _app/dashboard.tsx
   _app/jobs.tsx
   _app/candidates.tsx
   _app/candidates.$id.tsx
   _app/pipeline.tsx       (kanban)
   _app/calendar.tsx
   _app/screening.tsx
   _app/assistant.tsx
   _app/templates.tsx      (admin)
   _app/audit.tsx          (admin)
   _app/settings.tsx       (admin)
   ```
6. **AppShell** — sidebar nav (port from repo's `AppShell.tsx`), role-aware menu, language toggle, user menu, RTL/LTR aware.
7. **AuthContext** — Supabase auth, `onAuthStateChange` first then `getSession`. `_app` layout uses `beforeLoad` to redirect unauthenticated users to `/auth`. Admin-only routes guarded by checking `user_roles`.
8. **I18nProvider** — port `I18nContext.tsx` (176 lines) from repo. AR/EN strings, persistent toggle, sets `<html dir="rtl|ltr" lang>`. Add Cairo + Plus Jakarta Sans via Google Fonts in `__root.tsx` head and theme tokens in `styles.css`. Default direction respects user pref, falls back to AR per Nasheen brand.
9. **Glassmorphic theme tokens** — extend `src/styles.css` with mesh gradient utilities, `backdrop-blur` surface tokens, brand palette (deep blue/teal accents to match handover screenshots).

## Phase 3 — Core ATS modules

10. **Jobs** — list/create/edit requisitions; columns: code, title, region, branch, headcount, hired, status, opened_at. Filter by region/status.
11. **Candidates** — searchable table with Arabic-safe text fields, stage badge, score chip, tier badge, owner, source, applied date. Inline create + detail drawer. Resume upload → storage → metadata extraction.
12. **Pipeline (Kanban)** — columns from `pipeline_stages` (Applied → Screening → Interview → Offer → Hired / Rejected). Drag-and-drop stage moves trigger the stage-change DB trigger; SLA chip per card based on `stage_entry_date + sla_days`.
13. **Settings (admin)** — manage stages (name, order, SLA, color), branches/regions, committees, sources, users + roles.

## Phase 4 — AI features (fixing the broken old stuff)

14. **Screening server function** (`src/server/screening.functions.ts`):
    - Input: candidate id + CV file ref + job context
    - Reads CV text from storage; if text extraction is empty/low-quality, falls back to **vision** by sending the PDF page images to `google/gemini-2.5-pro` (multimodal)
    - Uses Lovable AI Gateway with **tool-calling** to return structured rubric: `{ technical, personal, experience, learning, communication, total, recommendation, rationale_ar, rationale_en }`
    - Writes result to `candidates`, fires `apply_tiering` trigger which auto-routes Tier 1 (≥85) to Committee, Tier 2 (70–84) to Personal Interview, Tier 3 (<70) to manual review
    - Logs to `audit_log`
15. **AI Assistant** (`src/routes/_app/assistant.tsx` + streaming `src/routes/api/assistant.ts` server route):
    - Streaming SSE chat using AI Gateway, line-by-line parsing per the streaming guide
    - System prompt grounds the assistant in the user's data via tool calls (`list_candidates`, `get_funnel_metrics`, `find_overdue`, `summarize_pipeline`)
    - Markdown rendering with `react-markdown`
    - 429/402 surfaced as toasts
16. **Templates** — email/SMS templates with AR+EN bodies and `{{candidate.name}}` etc. placeholders; "Generate with AI" button creates a draft via the Gateway.

## Phase 5 — Visibility, audit, calendar

17. **Dashboard** — Recharts funnel (Applied → Hired conversion), KPI cards (open reqs, candidates in motion, time-to-hire, offer acceptance), regional tracker (10 branches × headcount vs hired), recruiter workload, recent alerts. Glassmorphic cards.
18. **Calendar** — interview schedule view (month/week), create/edit interviews; placeholders for Google Calendar OAuth (deferred — surface as "Connect Google" button that no-ops with a toast until user provides creds).
19. **Audit Log** — chronological list with filters (actor, entity, action, date range). Read from `audit_log` table populated by triggers + server functions.
20. **Alerts** — derived view: SLA breaches, stale offers, candidates idle >N days. Surfaced in dashboard + dedicated dropdown in shell.

## Phase 6 — Import / export & polish

21. **CSV import** for candidates with the workbook's Arabic header mapping (`اسم المرشح` → `full_name`, etc.) — mapping table derived from `workbook_en_extracted_data.json`.
22. **CSV / XLSX export** per entity using `jszip` + a small SheetJS-compatible writer or server-side via a server function.
23. **Seed the 45 positions + 10 branches** from the workbook JSON on first admin login (idempotent).
24. **Empty states, loading skeletons, error boundaries** on every route. `errorComponent` + `notFoundComponent` per route, root `notFoundComponent` already present.

## Things that are explicitly NOT in this plan (yet)

- Google Calendar / Meet OAuth wiring — UI placeholder only; we'll add real OAuth when the user provides Google credentials.
- Email/SMS sending — templates compose & preview only; outbound delivery later (SendGrid / Twilio when keys provided).
- Public careers page — out of scope for now.

## Technical details

- **Auth & RLS**: roles in `user_roles` table (admin/recruiter), `has_role()` SECURITY DEFINER, RLS policies copied from the repo migration. First-ever signup auto-promoted to admin via the `handle_new_user` trigger.
- **Server boundary**: every Supabase write uses `requireSupabaseAuth` middleware; admin-only writes additionally check `has_role`. No service-role usage from loaders/components.
- **AI**: all model calls go through Lovable AI Gateway via server functions / server routes. Default model `google/gemini-3-flash-preview`; vision fallback uses `google/gemini-2.5-pro`. Structured output via tool-calling.
- **i18n storage**: language preference in `localStorage` + on `profiles.preferred_language`; `<html dir lang>` updated in `__root.tsx` based on context.
- **File parsing**: lightweight PDF/DOCX text extraction in the server function (pure-JS libs that work in the Worker runtime — `pdfjs-dist` legacy build for PDF; for DOCX, `mammoth` browser build). If extraction yields <200 chars, switch to vision.
- **Audit log**: triggers on `candidates`/`jobs`/`offers` write before/after JSON; server functions append manual entries (login, import, export, AI screen).

## Suggested execution order (for the build phase)

```text
1. Cloud + migration + seed         (Phase 1)
2. Routes + AppShell + Auth + i18n  (Phase 2)
3. Jobs + Candidates + Pipeline     (Phase 3)
4. Screening + Assistant            (Phase 4)
5. Dashboard + Calendar + Audit     (Phase 5)
6. Import/Export + polish           (Phase 6)
```

Each phase is independently usable — the app is functional after Phase 3, AI-augmented after Phase 4, and feature-complete after Phase 6.

Approve this plan and I'll switch to build mode and start with Phase 1 (Lovable Cloud + the migration + seed).