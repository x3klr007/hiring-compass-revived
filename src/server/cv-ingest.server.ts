// Server-only helpers for CV ingestion (Drive + parse + AI extract)
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

const DRIVE_GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ---------- Circuit Breaker ----------
type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";
const BREAKER = {
  state: "CLOSED" as BreakerState,
  failures: 0,
  openedAt: 0,
  lastError: "" as string,
  // tunables
  FAILURE_THRESHOLD: 3,
  COOLDOWN_MS: 30_000,
};

function breakerSnapshot() {
  const now = Date.now();
  const cooldownRemainingMs =
    BREAKER.state === "OPEN"
      ? Math.max(0, BREAKER.COOLDOWN_MS - (now - BREAKER.openedAt))
      : 0;
  return {
    state: BREAKER.state,
    failures: BREAKER.failures,
    cooldownRemainingMs,
    lastError: BREAKER.lastError || undefined,
  };
}

function shouldShortCircuit(): boolean {
  if (BREAKER.state !== "OPEN") return false;
  if (Date.now() - BREAKER.openedAt >= BREAKER.COOLDOWN_MS) {
    BREAKER.state = "HALF_OPEN";
    console.log("[breaker] cooldown elapsed → HALF_OPEN (probing)");
    return false;
  }
  return true;
}

function isTransientStatus(status: number) {
  return status === 502 || status === 503 || status === 504;
}

function recordSuccess() {
  if (BREAKER.state !== "CLOSED") {
    console.log(`[breaker] ${BREAKER.state} → CLOSED (probe ok)`);
  }
  BREAKER.state = "CLOSED";
  BREAKER.failures = 0;
  BREAKER.lastError = "";
}

function recordFailure(reason: string) {
  BREAKER.lastError = reason.slice(0, 300);
  if (BREAKER.state === "HALF_OPEN") {
    BREAKER.state = "OPEN";
    BREAKER.openedAt = Date.now();
    console.warn(`[breaker] HALF_OPEN probe failed → OPEN for ${BREAKER.COOLDOWN_MS}ms`);
    return;
  }
  BREAKER.failures += 1;
  if (BREAKER.failures >= BREAKER.FAILURE_THRESHOLD) {
    BREAKER.state = "OPEN";
    BREAKER.openedAt = Date.now();
    console.warn(
      `[breaker] threshold ${BREAKER.failures}/${BREAKER.FAILURE_THRESHOLD} reached → OPEN for ${BREAKER.COOLDOWN_MS}ms`
    );
  }
}

class CircuitOpenError extends Error {
  cooldownRemainingMs: number;
  constructor(cooldownRemainingMs: number, lastError?: string) {
    super(
      `CIRCUIT_OPEN: Drive gateway temporarily disabled (retry in ${Math.ceil(
        cooldownRemainingMs / 1000
      )}s)${lastError ? ` — last error: ${lastError}` : ""}`
    );
    this.name = "CircuitOpenError";
    this.cooldownRemainingMs = cooldownRemainingMs;
  }
}

function driveHeaders() {
  const lov = process.env.LOVABLE_API_KEY;
  const gd = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY missing");
  if (!gd) throw new Error("GOOGLE_DRIVE_API_KEY missing — connect Google Drive");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": gd,
  };
}

export async function checkDriveGateway(): Promise<{
  ok: boolean;
  status?: number;
  latencyMs: number;
  error?: string;
  breaker: ReturnType<typeof breakerSnapshot>;
}> {
  const t0 = Date.now();
  // If breaker is OPEN, short-circuit without hitting the gateway.
  if (shouldShortCircuit()) {
    const snap = breakerSnapshot();
    return {
      ok: false,
      latencyMs: 0,
      error: `Circuit open — retry in ${Math.ceil(snap.cooldownRemainingMs / 1000)}s`,
      breaker: snap,
    };
  }
  try {
    const headers = driveHeaders();
    const url = `${DRIVE_GATEWAY}/files?pageSize=1&fields=files(id)`;
    const res = await fetch(url, { headers });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = body.slice(0, 300) || `HTTP ${res.status}`;
      if (isTransientStatus(res.status)) recordFailure(err);
      else recordSuccess(); // non-transient (e.g. 401/403/404) — gateway is up
      return { ok: false, status: res.status, latencyMs, error: err, breaker: breakerSnapshot() };
    }
    recordSuccess();
    return { ok: true, status: res.status, latencyMs, breaker: breakerSnapshot() };
  } catch (err) {
    const msg = (err as Error).message;
    recordFailure(msg);
    return { ok: false, latencyMs: Date.now() - t0, error: msg, breaker: breakerSnapshot() };
  }
}

export function getDriveBreakerState() {
  // Refresh state if cooldown elapsed
  shouldShortCircuit();
  return breakerSnapshot();
}

export function parseDriveLink(input: string): { kind: "folder" | "file"; id: string } | null {
  if (!input) return null;
  // Normalize: trim, strip wrapping quotes/spaces, decode common encodings
  let s = input.trim().replace(/^["'<\s]+|["'>\s]+$/g, "");
  try {
    s = decodeURI(s);
  } catch {
    /* noop */
  }
  // Handle "Open with → Drive" share links and "u/0/" prefix
  // Examples handled:
  //   https://drive.google.com/drive/folders/<ID>?usp=sharing
  //   https://drive.google.com/drive/u/0/folders/<ID>
  //   https://drive.google.com/drive/u/1/mobile/folders/<ID>
  //   https://drive.google.com/file/d/<ID>/view?usp=drivesdk
  //   https://drive.google.com/open?id=<ID>
  //   https://docs.google.com/spreadsheets/d/<ID>/edit
  //   raw ID
  const folderMatch = s.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (folderMatch) return { kind: "folder", id: folderMatch[1] };
  const fileMatch = s.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]{10,})/);
  if (fileMatch) return { kind: "file", id: fileMatch[1] };
  const openMatch = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (openMatch) {
    // open?id= can be either folder or file — try to infer from query
    const isFolder = /folder/i.test(s);
    return { kind: isFolder ? "folder" : "file", id: openMatch[1] };
  }
  // Bare ID
  if (/^[a-zA-Z0-9_-]{16,}$/.test(s)) return { kind: "folder", id: s };
  return null;
}

export type DriveFile = { id: string; name: string; mimeType: string; size?: string };

// ---------- Configurable retry policy ----------
export type RetryPolicy = {
  maxAttempts: number;        // total attempts (incl. first)
  baseDelayMs: number;        // initial backoff
  maxDelayMs: number;         // cap per attempt
  factor: number;             // exponential factor
  jitter: number;             // 0..1 random jitter ratio
  // Extra attempts ONLY for connection-level errors (refused / DNS / reset / delayed connect)
  connectionErrorBonusAttempts: number;
  connectionErrorBaseDelayMs: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 400,
  maxDelayMs: 8_000,
  factor: 2,
  jitter: 0.25,
  connectionErrorBonusAttempts: 3,
  connectionErrorBaseDelayMs: 1_000,
};

const CONNECTION_ERROR_RE =
  /(connection refused|delayed connect|econnrefused|econnreset|enotfound|eai_again|socket hang up|fetch failed|network|upstream connect error|disconnect\/reset before headers|reset reason)/i;

function isConnectionError(msg: string) {
  return CONNECTION_ERROR_RE.test(msg);
}

function backoffDelay(attempt: number, base: number, factor: number, max: number, jitter: number) {
  const raw = Math.min(base * Math.pow(factor, attempt - 1), max);
  const j = 1 + (Math.random() * 2 - 1) * jitter;
  return Math.max(0, Math.round(raw * j));
}

function newReqId(prefix = "req") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  label: string,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  reqId: string = newReqId("fetch"),
): Promise<Response> {
  // Circuit breaker short-circuit
  if (shouldShortCircuit()) {
    const snap = breakerSnapshot();
    console.warn(`[${label}][${reqId}] short-circuited by breaker (cooldown ${snap.cooldownRemainingMs}ms)`);
    throw new CircuitOpenError(snap.cooldownRemainingMs, snap.lastError);
  }
  const isProbe = BREAKER.state === "HALF_OPEN";
  const baseMax = isProbe ? 1 : policy.maxAttempts;
  let lastErr: unknown;
  let lastStatus: number | undefined;
  let lastBody: string | undefined;
  let connectionRetriesUsed = 0;
  const headerKeys = Object.keys((init.headers ?? {}) as Record<string, string>);
  const hasAuth = headerKeys.includes("Authorization");
  const hasConnKey = headerKeys.includes("X-Connection-Api-Key");

  let attempt = 0;
  while (true) {
    attempt += 1;
    const t0 = Date.now();
    let connError = false;
    try {
      console.log(
        `[${label}][${reqId}] attempt ${attempt} → ${url} (auth=${hasAuth}, connKey=${hasConnKey}, probe=${isProbe}, connRetries=${connectionRetriesUsed})`,
      );
      const res = await fetch(url, init);
      const dur = Date.now() - t0;
      lastStatus = res.status;
      if (isTransientStatus(res.status)) {
        lastBody = await res.clone().text().catch(() => "<unreadable>");
        if (attempt < baseMax) {
          const delay = backoffDelay(attempt, policy.baseDelayMs, policy.factor, policy.maxDelayMs, policy.jitter);
          console.warn(`[${label}][${reqId}] attempt ${attempt} transient ${res.status} in ${dur}ms — retrying in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        recordFailure(`HTTP ${res.status}`);
        console.error(`[${label}][${reqId}] FAILED after ${attempt} attempts — HTTP ${res.status}`);
        throw new Error(`${label} last status ${res.status}: ${lastBody?.slice(0, 300) ?? ""}`);
      }
      console.log(`[${label}][${reqId}] attempt ${attempt} done status=${res.status} in ${dur}ms`);
      recordSuccess();
      return res;
    } catch (err) {
      const dur = Date.now() - t0;
      const msg = (err as Error)?.message ?? "unknown";
      lastErr = err;
      connError = isConnectionError(msg);
      console.warn(`[${label}][${reqId}] attempt ${attempt} threw in ${dur}ms (connError=${connError}): ${msg}`);

      const allowance =
        baseMax + (connError && !isProbe ? policy.connectionErrorBonusAttempts : 0);
      if (attempt < allowance) {
        if (connError) connectionRetriesUsed += 1;
        const delay = connError
          ? backoffDelay(
              connectionRetriesUsed,
              policy.connectionErrorBaseDelayMs,
              policy.factor,
              policy.maxDelayMs,
              policy.jitter,
            )
          : backoffDelay(attempt, policy.baseDelayMs, policy.factor, policy.maxDelayMs, policy.jitter);
        console.warn(`[${label}][${reqId}] retrying in ${delay}ms (allowance=${allowance})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      break;
    }
  }
  const reason = lastErr
    ? `network error: ${(lastErr as Error)?.message ?? "unknown"}`
    : `last status ${lastStatus}: ${lastBody?.slice(0, 300) ?? ""}`;
  console.error(
    `[${label}][${reqId}] FAILED after ${attempt} attempts (connRetries=${connectionRetriesUsed}) — url=${url}, ${reason}`,
  );
  recordFailure(reason);
  throw new Error(`${label} ${reason}`);
}

export async function listDriveFolder(folderId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const url = `${DRIVE_GATEWAY}/files?q=${q}&fields=files(id,name,mimeType,size)&pageSize=200`;
  const start = Date.now();
  console.log(`[listDriveFolder] folderId=${folderId} url=${url}`);
  let res: Response;
  try {
    res = await fetchWithRetry(url, { headers: driveHeaders() }, "Drive list");
  } catch (err) {
    console.error(`[listDriveFolder] giving up after ${Date.now() - start}ms — folderId=${folderId}`, err);
    throw err;
  }
  if (!res.ok) {
    const body = await res.text();
    console.error(`[listDriveFolder] non-OK status=${res.status} folderId=${folderId} totalMs=${Date.now() - start} body=${body.slice(0, 500)}`);
    throw new Error(`Drive list failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { files?: DriveFile[] };
  console.log(`[listDriveFolder] ok folderId=${folderId} files=${json.files?.length ?? 0} totalMs=${Date.now() - start}`);
  return json.files ?? [];
}

export async function getDriveFileMeta(fileId: string): Promise<DriveFile> {
  const url = `${DRIVE_GATEWAY}/files/${fileId}?fields=id,name,mimeType,size`;
  const res = await fetchWithRetry(url, { headers: driveHeaders() }, "Drive meta");
  if (!res.ok) throw new Error(`Drive meta failed [${res.status}]: ${await res.text()}`);
  return (await res.json()) as DriveFile;
}

export async function downloadDriveFile(fileId: string): Promise<ArrayBuffer> {
  const url = `${DRIVE_GATEWAY}/files/${fileId}?alt=media`;
  const res = await fetchWithRetry(url, { headers: driveHeaders() }, "Drive download");
  if (!res.ok) throw new Error(`Drive download failed [${res.status}]: ${await res.text()}`);
  return await res.arrayBuffer();
}

export async function extractTextFromBuffer(name: string, mime: string, buf: ArrayBuffer): Promise<string> {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
    return result.value;
  }
  if (mime.startsWith("text/") || lower.endsWith(".txt")) {
    return new TextDecoder().decode(buf);
  }
  throw new Error(`Unsupported file type: ${mime || name}`);
}

export type ExtractedCV = {
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  gender: "male" | "female" | null;
  years_experience: number | null;
  last_role: string | null;
  degrees: string[];
  certifications: string[];
  languages: string[];
  suggested_positions: string[];
  fit_summary_en: string;
  fit_summary_ar: string;
};

export async function extractCandidateFromText(cvText: string, openJobs: { title: string; region?: string }[]): Promise<ExtractedCV> {
  const lov = process.env.LOVABLE_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY missing");

  const jobsList = openJobs.length
    ? openJobs.map((j) => `- ${j.title}${j.region ? ` (${j.region})` : ""}`).join("\n")
    : "(no open jobs provided)";

  const sys = `You extract candidate info from CVs for a Saudi school recruitment system.
Infer gender from the candidate's first name (Arabic or English). Return null if unsure.
Suggest 1–3 positions from the open jobs list that best match this CV (use exact titles).
Provide a 1–2 sentence fit summary in English AND Arabic, focused on whether they're a good hire for the suggested role.
Return ONLY JSON matching the schema. No markdown.`;

  const schema = {
    type: "object",
    properties: {
      full_name: { type: "string" },
      email: { type: "string" },
      phone: { type: ["string", "null"] },
      city: { type: ["string", "null"] },
      gender: { type: ["string", "null"], enum: ["male", "female", null] },
      years_experience: { type: ["number", "null"] },
      last_role: { type: ["string", "null"] },
      degrees: { type: "array", items: { type: "string" } },
      certifications: { type: "array", items: { type: "string" } },
      languages: { type: "array", items: { type: "string" } },
      suggested_positions: { type: "array", items: { type: "string" } },
      fit_summary_en: { type: "string" },
      fit_summary_ar: { type: "string" },
    },
    required: ["full_name", "email", "suggested_positions", "fit_summary_en", "fit_summary_ar"],
    additionalProperties: false,
  };

  const res = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lov}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `Open jobs:\n${jobsList}\n\nCV TEXT:\n${cvText.slice(0, 18000)}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: { name: "save_candidate", description: "Save extracted candidate", parameters: schema },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_candidate" } },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 429) throw new Error("AI rate limit. Try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Top up in Settings → Workspace → Usage.");
    throw new Error(`AI failed [${res.status}]: ${txt}`);
  }

  const json = await res.json();
  const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no tool call");
  return JSON.parse(args) as ExtractedCV;
}
