import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function b64url(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encSubject(s: string) {
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(s)))}?=`;
}

function buildRaw(opts: {
  to: string;
  cc?: string | null;
  replyTo?: string | null;
  subject: string;
  body: string;
}) {
  const headers = [
    `To: ${opts.to}`,
    opts.cc ? `Cc: ${opts.cc}` : null,
    opts.replyTo ? `Reply-To: ${opts.replyTo}` : null,
    `Subject: ${encSubject(opts.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ].filter(Boolean);
  return b64url(`${headers.join("\r\n")}\r\n\r\n${opts.body}`);
}

export function fillPlaceholders(text: string, vars: Record<string, string | null | undefined>) {
  return text.replace(/\[(\w+)\]/g, (_m, key: string) => {
    const k = Object.keys(vars).find((x) => x.toLowerCase() === key.toLowerCase());
    const v = k ? vars[k] : undefined;
    return v == null || v === "" ? `[${key}]` : String(v);
  });
}

const SendSchema = z.object({
  candidateId: z.string().uuid().nullable().optional(),
  templateKey: z.string().min(1),
  lang: z.enum(["en", "ar"]).default("ar"),
  to: z.string().email(),
  // override subject/body if user edited them in the dialog
  subjectOverride: z.string().optional().nullable(),
  bodyOverride: z.string().optional().nullable(),
  // dynamic vars to substitute in template
  vars: z.record(z.string(), z.string()).optional().default({}),
});

export const sendCandidateMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SendSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load template if no override is provided
    let subject = data.subjectOverride ?? "";
    let body = data.bodyOverride ?? "";
    if (!subject || !body) {
      const { data: tpl, error } = await supabase
        .from("message_templates")
        .select("subject_en,subject_ar,body_en,body_ar")
        .eq("template_key", data.templateKey)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!tpl) throw new Error(`Template not found: ${data.templateKey}`);
      const isAr = data.lang === "ar";
      subject ||= (isAr ? tpl.subject_ar : tpl.subject_en) ?? "";
      body ||= (isAr ? tpl.body_ar : tpl.body_en) ?? "";
    }

    // Apply placeholders
    const filledSubject = fillPlaceholders(subject, data.vars);
    const filledBody = fillPlaceholders(body, data.vars);

    // Resolve secondary admin (CC)
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key,value")
      .in("key", ["secondary_admin_email", "cc_admin_on_messages"]);
    const map = new Map<string, unknown>();
    (settings ?? []).forEach((r: { key: string; value: unknown }) => map.set(r.key, r.value));
    const ccEnabled = map.get("cc_admin_on_messages") !== false;
    const adminEmailRaw = map.get("secondary_admin_email");
    const adminEmail =
      typeof adminEmailRaw === "string" ? adminEmailRaw : null;
    const cc = ccEnabled && adminEmail ? adminEmail : null;
    const replyTo = adminEmail; // ensure replies also reach the secondary admin

    // Send via Gmail
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GMAIL = process.env.GOOGLE_MAIL_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!GMAIL) throw new Error("GOOGLE_MAIL_API_KEY missing");

    const raw = buildRaw({ to: data.to, cc, replyTo, subject: filledSubject, body: filledBody });

    let providerId: string | null = null;
    let status = "sent";
    let errorMsg: string | null = null;
    try {
      const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GMAIL,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Gmail [${res.status}]: ${JSON.stringify(json).slice(0, 400)}`);
      providerId = (json as { id?: string }).id ?? null;
    } catch (e) {
      status = "failed";
      errorMsg = (e as Error).message;
    }

    // Log
    await supabase.from("message_log").insert({
      candidate_id: data.candidateId ?? null,
      template_key: data.templateKey,
      channel: "email",
      recipient: data.to,
      cc,
      subject: filledSubject,
      body: filledBody,
      status,
      provider_message_id: providerId,
      error: errorMsg,
      sent_by: userId,
    });

    if (status === "failed") throw new Error(errorMsg ?? "Send failed");
    return { ok: true, providerMessageId: providerId, cc };
  });
