import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseDriveLink,
  listDriveFolder,
  getDriveFileMeta,
  downloadDriveFile,
  extractTextFromBuffer,
  extractCandidateFromText,
  checkDriveGateway,
  type ExtractedCV,
} from "./cv-ingest.server";

export const checkDriveHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return await checkDriveGateway();
  });

const SUPPORTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

function isSupported(name: string, mime: string) {
  if (SUPPORTED_MIME.includes(mime)) return true;
  const l = name.toLowerCase();
  return l.endsWith(".pdf") || l.endsWith(".docx") || l.endsWith(".txt");
}

export type IngestResult = {
  source_name: string;
  ok: boolean;
  candidate_id?: string;
  extracted?: ExtractedCV;
  error?: string;
};

export const ingestFromDriveLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        link: z.string().min(5),
        defaultJobId: z.string().uuid().nullable().optional(),
        defaultRegion: z.string().nullable().optional(),
        genderFilter: z.enum(["any", "male", "female"]).nullable().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const parsed = parseDriveLink(data.link);
    if (!parsed) {
      throw new Error(
        "INVALID_LINK: Could not parse Google Drive link. Use a folder/file share link like https://drive.google.com/drive/folders/<ID> or https://drive.google.com/file/d/<ID>/view"
      );
    }

    const { supabase } = context;
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id,title,region")
      .eq("status", "Open");
    const openJobs = (jobs ?? []) as { id: string; title: string; region: string }[];

    const files =
      parsed.kind === "folder"
        ? await listDriveFolder(parsed.id)
        : [await getDriveFileMeta(parsed.id)];

    const targets = files.filter((f) => isSupported(f.name, f.mimeType));
    const results: IngestResult[] = [];
    let filteredByGender = 0;

    for (const f of targets) {
      try {
        const buf = await downloadDriveFile(f.id);
        const text = await extractTextFromBuffer(f.name, f.mimeType, buf);
        if (!text || text.trim().length < 30) {
          results.push({ source_name: f.name, ok: false, error: "Empty/unreadable CV" });
          continue;
        }
        const ex = await extractCandidateFromText(text, openJobs);

        // Gender filter
        const wantGender = data.genderFilter && data.genderFilter !== "any" ? data.genderFilter : null;
        if (wantGender && ex.gender && ex.gender !== wantGender) {
          filteredByGender += 1;
          results.push({
            source_name: f.name,
            ok: false,
            error: `FILTERED_GENDER: ${ex.full_name || f.name} (${ex.gender})`,
          });
          continue;
        }

        // Reject duplicates by email (case-insensitive)
        if (ex.email) {
          const { data: existing } = await supabase
            .from("candidates")
            .select("id, full_name, email")
            .ilike("email", ex.email)
            .maybeSingle();
          if (existing) {
            results.push({
              source_name: f.name,
              ok: false,
              error: `DUPLICATE: ${existing.full_name} <${existing.email}>`,
            });
            continue;
          }
        }

        // match suggested position to open job title (for default region)
        let job_id: string | null = data.defaultJobId ?? null;
        let region = data.defaultRegion ?? null;
        if (!job_id && ex.suggested_positions?.length) {
          const match = openJobs.find((j) =>
            ex.suggested_positions.some(
              (p) => p.toLowerCase().trim() === j.title.toLowerCase().trim()
            )
          );
          if (match) {
            job_id = match.id;
            region = region ?? match.region;
          }
        }

        const notesParts = [
          ex.fit_summary_en && `Fit (EN): ${ex.fit_summary_en}`,
          ex.fit_summary_ar && `الملاءمة: ${ex.fit_summary_ar}`,
          ex.suggested_positions?.length &&
            `Suggested: ${ex.suggested_positions.join(" | ")}`,
          ex.last_role && `Last role: ${ex.last_role}`,
          ex.years_experience != null && `Experience: ${ex.years_experience}y`,
          ex.degrees?.length && `Degrees: ${ex.degrees.join(", ")}`,
          ex.certifications?.length && `Certs: ${ex.certifications.join(", ")}`,
          ex.languages?.length && `Languages: ${ex.languages.join(", ")}`,
        ].filter(Boolean) as string[];

        const { data: inserted, error } = await supabase
          .from("candidates")
          .insert({
            full_name: ex.full_name || f.name,
            email: ex.email || `unknown+${Date.now()}@placeholder.local`,
            phone: ex.phone,
            city: ex.city,
            gender: ex.gender,
            job_id,
            source: "Google Drive",
            cv_text: text.slice(0, 100000),
            notes: notesParts.join("\n"),
            stage: "Applied",
            status: "Active",
          })
          .select("id")
          .single();

        if (error) throw new Error(error.message);
        results.push({ source_name: f.name, ok: true, candidate_id: inserted.id, extracted: ex });
      } catch (err) {
        results.push({ source_name: f.name, ok: false, error: (err as Error).message });
      }
    }

    return {
      total: targets.length,
      skipped: files.length - targets.length,
      results,
    };
  });
