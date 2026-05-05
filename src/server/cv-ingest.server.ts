// Server-only helpers for CV ingestion (Drive + parse + AI extract)
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

const DRIVE_GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

export function parseDriveLink(input: string): { kind: "folder" | "file"; id: string } | null {
  const folderMatch = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return { kind: "folder", id: folderMatch[1] };
  const fileMatch = input.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return { kind: "file", id: fileMatch[1] };
  const openMatch = input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return { kind: "file", id: openMatch[1] };
  if (/^[a-zA-Z0-9_-]{10,}$/.test(input.trim())) return { kind: "folder", id: input.trim() };
  return null;
}

export type DriveFile = { id: string; name: string; mimeType: string; size?: string };

export async function listDriveFolder(folderId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const url = `${DRIVE_GATEWAY}/files?q=${q}&fields=files(id,name,mimeType,size)&pageSize=200`;
  const res = await fetch(url, { headers: driveHeaders() });
  if (!res.ok) throw new Error(`Drive list failed [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as { files?: DriveFile[] };
  return json.files ?? [];
}

export async function getDriveFileMeta(fileId: string): Promise<DriveFile> {
  const url = `${DRIVE_GATEWAY}/files/${fileId}?fields=id,name,mimeType,size`;
  const res = await fetch(url, { headers: driveHeaders() });
  if (!res.ok) throw new Error(`Drive meta failed [${res.status}]: ${await res.text()}`);
  return (await res.json()) as DriveFile;
}

export async function downloadDriveFile(fileId: string): Promise<ArrayBuffer> {
  const url = `${DRIVE_GATEWAY}/files/${fileId}?alt=media`;
  const res = await fetch(url, { headers: driveHeaders() });
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
