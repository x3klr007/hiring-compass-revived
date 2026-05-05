import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
  context: z.string().max(8000).optional().nullable(),
});

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((input) => Schema.parse(input))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const sys = `You are the bilingual (Arabic + English) HR assistant for "مشروع مدارس طويق" (Tuwaiq Schools Project), a Saudi youth-sector recruitment program across 10 regions (Riyadh, Jeddah, Qassim, Eastern Province, Madinah, Hail, Abha, Al-Ahsa, Makkah, Jazan).
Reply in the same language the user wrote in. Be concise, action-oriented, professional.
You help recruiters: screen CVs, suggest fit positions, draft Arabic/English messages, plan interviews, and summarise candidate fit.${data.context ? `\n\nLive ATS context:\n${data.context}` : ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, ...data.messages],
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limited — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
      throw new Error(`AI error [${res.status}]: ${JSON.stringify(json)}`);
    }
    return { reply: (json.choices?.[0]?.message?.content as string) ?? "" };
  });
