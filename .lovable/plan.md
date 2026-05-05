Complete the remaining modules so every nav item has a real page.

### 1. Calendar (`/calendar`) — Google Calendar + Meet

- New server function `src/server/calendar.functions.ts` → `scheduleInterview` calls the Google Calendar gateway (`/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`) to create an event with a Google Meet link and email the candidate.
- New page `src/routes/_app/calendar.tsx`:
  - Form: pick candidate (from DB), committee name, region tab (10 regions), date, time, duration, notes.
  - On submit → call `scheduleInterview`, save row in `interview_schedule` (with `notes` containing the Meet link), show a toast with the Meet URL.
  - Below the form: list of upcoming `interview_schedule` rows with Meet links.  
  clone [https://github.com/x3klr007/hiring-compass.git](https://github.com/x3klr007/hiring-compass.git) and get the zip with the data of jobs avaliable and find excel sheets in the zip file and analyze it and add it to the app 

### 2. AI Assistant (`/ai-chat`)

- Server function `src/server/assistant.functions.ts` → `askAssistant` using Lovable AI Gateway (`google/gemini-2.5-flash`), bilingual HR system prompt with optional ATS context (open jobs count, recent candidates).
- Page `src/routes/_app/ai-chat.tsx`: chat UI (message list + input), language follows current i18n.

### 3. Templates (`/templates`)

- Page `src/routes/_app/templates.tsx`: list `message_templates` with channel badge; admin can edit body_en / body_ar / subject inline; "New template" dialog.

### 4. Audit Log (`/audit`)

- Page `src/routes/_app/audit.tsx`: read-only paginated list of `audit_log` ordered by `created_at desc`, showing actor, action, entity, details JSON pretty-printed. Admin-only; show "no permission" otherwise.

### 5. Settings (`/settings`)

- Page `src/routes/_app/settings.tsx`:
  - Profile section: edit `full_name`, `preferred_language` (writes to `profiles`).
  - Admin-only: list users + their roles from `user_roles`, add/remove roles via `supabase.from('user_roles').insert/delete`.
  - Branches & committees read-only summary tables.

### Cleanup

- Remove now-unused exports from `src/routes/_app/-stubs.tsx` (or delete the file) since every nav target has a real route file.

No DB migrations required — all tables (`interview_schedule`, `message_templates`, `audit_log`, `profiles`, `user_roles`) already exist with correct RLS.