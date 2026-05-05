import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

const Schema = z.object({
  to: z.string().email(),
  bcc: z.string().email().optional().nullable(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
});

function b64url(s: string) {
  // UTF-8 safe base64url
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildRaw({ to, bcc, subject, body }: z.infer<typeof Schema>) {
  const headers = [
    `To: ${to}`,
    bcc ? `Bcc: ${bcc}` : null,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ].filter(Boolean);
  return b64url(`${headers.join("\r\n")}\r\n\r\n${body}`);
}

export const sendInterviewInvite = createServerFn({ method: "POST" })
  .inputValidator((input) => Schema.parse(input))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GMAIL = process.env.GOOGLE_MAIL_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!GMAIL) throw new Error("GOOGLE_MAIL_API_KEY missing");

    const raw = buildRaw(data);
    const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GMAIL,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Gmail send failed [${res.status}]: ${JSON.stringify(json)}`);
    return { id: json.id as string, threadId: json.threadId as string };
  });
