import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

const Schema = z.object({
  candidate_id: z.string().uuid(),
  candidate_name: z.string().min(1).max(200),
  candidate_email: z.string().email().optional().nullable(),
  committee_name: z.string().min(1).max(200),
  region: z.string().min(1).max(100),
  scheduled_date: z.string().min(8).max(20),
  scheduled_time: z.string().min(4).max(8),
  duration_minutes: z.number().int().min(15).max(240).default(60),
  notes: z.string().max(2000).optional().nullable(),
});

export const scheduleInterview = createServerFn({ method: "POST" })
  .inputValidator((input) => Schema.parse(input))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GCAL = process.env.GOOGLE_CALENDAR_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!GCAL) throw new Error("GOOGLE_CALENDAR_API_KEY missing");

    const start = new Date(`${data.scheduled_date}T${data.scheduled_time}:00`);
    const end = new Date(start.getTime() + data.duration_minutes * 60_000);
    const tz = "Asia/Riyadh";

    const body = {
      summary: `Interview · ${data.candidate_name} (${data.committee_name})`,
      description:
        `Region: ${data.region}\nCandidate: ${data.candidate_name}` +
        (data.notes ? `\n\nNotes:\n${data.notes}` : ""),
      start: { dateTime: start.toISOString(), timeZone: tz },
      end: { dateTime: end.toISOString(), timeZone: tz },
      attendees: data.candidate_email
        ? [{ email: data.candidate_email, displayName: data.candidate_name }]
        : [],
      conferenceData: {
        createRequest: {
          requestId: `tuwaiq-${data.candidate_id}-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const res = await fetch(
      `${GATEWAY_URL}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GCAL,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    const json = await res.json();
    if (!res.ok) {
      throw new Error(`Calendar create failed [${res.status}]: ${JSON.stringify(json)}`);
    }

    return {
      event_id: json.id as string,
      html_link: json.htmlLink as string,
      meet_link:
        (json.hangoutLink as string) ??
        json.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri ??
        null,
    };
  });
