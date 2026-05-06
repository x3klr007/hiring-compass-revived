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
  getRetryPolicySnapshot,
  testRetryPolicy,
  type ExtractedCV,
  type RetryPolicy,
} from "./cv-ingest.server";

export const checkDriveHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return await checkDriveGateway();
  });

export const getRetryPolicy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return getRetryPolicySnapshot();
  });

const retryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(20),
  baseDelayMs: z.number().int().min(0).max(60_000),
  maxDelayMs: z.number().int().min(0).max(120_000),
  factor: z.number().min(1).max(10),
  jitter: z.number().min(0).max(1),
  connectionErrorBonusAttempts: z.number().int().min(0).max(20),
  connectionErrorBaseDelayMs: z.number().int().min(0).max(60_000),
  transientStatuses: z.array(z.number().int().min(100).max(599)).optional(),
});

export const testRetryPolicyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        policy: retryPolicySchema,
        folderId: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    return await testRetryPolicy({
      policy: data.policy as RetryPolicy,
      folderId: data.folderId,
    });
  });

export type DriveFailureLog = {
  id: string;
  created_at: string;
  req_id: string | null;
  folder_id: string | null;
  url: string | null;
  status: string | null;
  total_ms: number | null;
  attempts: number | null;
  reason: string | null;
  suggestion: string | null;
};

export const listDriveFailures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DriveFailureLog[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("drive_failure_logs")
      .select("id,created_at,req_id,folder_id,url,status,total_ms,attempts,reason,suggestion")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as DriveFailureLog[];
  });

export const clearDriveFailures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("drive_failure_logs")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(error.message);
    return { ok: true };
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

    // Preflight: verify DRIVE_GATEWAY availability before any fetch attempts
    const health = await checkDriveGateway();
    if (!health.ok) {
      throw new Error(
        `DRIVE_UNAVAILABLE: Drive gateway health check failed (status=${health.status ?? "n/a"}, latency=${health.latencyMs}ms${health.breaker?.state ? `, breaker=${health.breaker.state}` : ""}). ${health.error ?? ""}`.trim()
      );
    }

    const files =
      parsed.kind === "folder"
        ? await listDriveFolder(parsed.id)
        : [await getDriveFileMeta(parsed.id)];

    const targets = files.filter((f) => isSupported(f.name, f.mimeType));
    let filteredByGender = 0;

    const processOne = async (f: typeof targets[number]): Promise<IngestResult> => {
      try {
        const buf = await downloadDriveFile(f.id);
        const text = await extractTextFromBuffer(f.name, f.mimeType, buf);
        if (!text || text.trim().length < 30) {
          return { source_name: f.name, ok: false, error: "Empty/unreadable CV" };
        }
        const ex = await extractCandidateFromText(text, openJobs);

        const wantGender = data.genderFilter && data.genderFilter !== "any" ? data.genderFilter : null;
        if (wantGender && ex.gender && ex.gender !== wantGender) {
          filteredByGender += 1;
          return {
            source_name: f.name,
            ok: false,
            error: `FILTERED_GENDER: ${ex.full_name || f.name} (${ex.gender})`,
          };
        }

        if (ex.email) {
          const { data: existing } = await supabase
            .from("candidates")
            .select("id, full_name, email")
            .ilike("email", ex.email)
            .maybeSingle();
          if (existing) {
            return {
              source_name: f.name,
              ok: false,
              error: `DUPLICATE: ${existing.full_name} <${existing.email}>`,
            };
          }
        }

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
            email: ex.email || `unknown+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@placeholder.local`,
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
        return { source_name: f.name, ok: true, candidate_id: inserted.id, extracted: ex };
      } catch (err) {
        return { source_name: f.name, ok: false, error: (err as Error).message };
      }
    };

    // Bounded concurrency: process up to CONCURRENCY CVs in parallel.
    // Tuned for Drive API rate limits and Lovable AI throughput.
    const CONCURRENCY = 4;
    const results: IngestResult[] = new Array(targets.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, targets.length) }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= targets.length) return;
        results[i] = await processOne(targets[i]);
      }
    });
    await Promise.all(workers);


    return {
      total: targets.length,
      skipped: files.length - targets.length,
      filteredByGender,
      results,
    };
  });
