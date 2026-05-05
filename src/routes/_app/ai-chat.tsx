import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Loader2, User } from "lucide-react";
import { askAssistant } from "@/server/assistant.functions";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

function AssistantPage() {
  const { t, lang, dir } = useI18n();
  const ask = useServerFn(askAssistant);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        lang === "ar"
          ? "مرحباً! أنا مساعد التوظيف الذكي لمشروع مدارس طويق. كيف يمكنني مساعدتك اليوم؟"
          : "Hi! I'm the AI hiring assistant for Tuwaiq Schools Project. How can I help today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const [{ count: openJobs }, { data: recent }] = await Promise.all([
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "Open"),
        supabase
          .from("candidates")
          .select("full_name,stage,score")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      const ctx = `Open jobs: ${openJobs ?? 0}\nRecent candidates: ${(recent ?? [])
        .map((c) => `${c.full_name} (${c.stage}, score ${c.score})`)
        .join("; ")}`;
      const out = await ask({
        data: {
          messages: next.filter((m) => m.role !== "assistant" || m !== next[0]).slice(-20) as Msg[],
          context: ctx,
        },
      });
      setMessages([...next, { role: "assistant", content: out.reply }]);
    } catch (err) {
      toast.error((err as Error).message);
      setMessages(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 h-[calc(100vh-10rem)] flex flex-col" dir={dir}>
      <div>
        <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
          <Bot className="h-7 w-7" />
          {t("aiChat")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {lang === "ar" ? "مساعد ثنائي اللغة لفرز السير، صياغة الرسائل، واقتراح القرارات." : "Bilingual assistant for screening, drafting messages, and recommending decisions."}
        </p>
      </div>
      <Card className="glass shadow-elegant flex-1 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {m.content}
              </div>
              {m.role === "user" && (
                <div className="h-8 w-8 shrink-0 rounded-full bg-primary flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {lang === "ar" ? "يفكر..." : "Thinking…"}
            </div>
          )}
        </div>
        <form onSubmit={send} className="border-t p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={lang === "ar" ? "اكتب رسالتك..." : "Type your message…"}
            disabled={busy}
          />
          <Button type="submit" disabled={busy || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_app/ai-chat")({
  component: AssistantPage,
});
