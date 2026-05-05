import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import { sendCandidateMessage } from "@/server/messaging.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Save, Star } from "lucide-react";
import { toast } from "sonner";

type Candidate = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_id: string | null;
};

type Job = { id: string; title: string; region: string };

type Tmpl = {
  template_key: string;
  name: string;
  subject_en: string | null;
  subject_ar: string | null;
  body_en: string;
  body_ar: string;
};

type Scorecard = {
  tech_30: number;
  pers_25: number;
  exp_20: number;
  learn_15: number;
  comm_10: number;
  comments: string | null;
};

const STAGE_TEMPLATE_HINT: Record<string, string> = {
  Applied: "application_confirmation",
  Screening: "interview_invitation",
  Interview: "interview_reminder",
  Offer: "final_acceptance",
  Hired: "documents_request",
  Rejected: "rejection",
};

export function CandidateActionDialog({
  candidate,
  open,
  onOpenChange,
  onChanged,
  defaultTab = "evaluate",
}: {
  candidate: Candidate | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
  defaultTab?: "evaluate" | "message";
}) {
  const { lang, dir } = useI18n();
  const send = useAuthedServerFn(sendCandidateMessage);

  const [job, setJob] = useState<Job | null>(null);
  const [templates, setTemplates] = useState<Tmpl[]>([]);
  const [tplKey, setTplKey] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const [sc, setSc] = useState<Scorecard>({
    tech_30: 0,
    pers_25: 0,
    exp_20: 0,
    learn_15: 0,
    comm_10: 0,
    comments: "",
  });
  const [savingSc, setSavingSc] = useState(false);

  // Load templates + job + existing scorecard
  useEffect(() => {
    if (!open || !candidate) return;
    (async () => {
      const [{ data: t }, { data: j }, { data: existing }] = await Promise.all([
        supabase.from("message_templates").select("template_key,name,subject_en,subject_ar,body_en,body_ar").order("name"),
        candidate.job_id
          ? supabase.from("jobs").select("id,title,region").eq("id", candidate.job_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("scorecards")
          .select("tech_30,pers_25,exp_20,learn_15,comm_10,comments")
          .eq("candidate_id", candidate.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setTemplates((t ?? []) as Tmpl[]);
      setJob((j ?? null) as Job | null);
      if (existing) setSc(existing as Scorecard);
      else setSc({ tech_30: 0, pers_25: 0, exp_20: 0, learn_15: 0, comm_10: 0, comments: "" });
    })();
  }, [open, candidate]);

  // Pick a sensible default template based on stage hint
  useEffect(() => {
    if (!templates.length) return;
    const def = templates.find((x) => x.template_key === "interview_invitation") ?? templates[0];
    setTplKey(def.template_key);
  }, [templates]);

  // When template changes, fill subject/body with localized version
  useEffect(() => {
    const tpl = templates.find((x) => x.template_key === tplKey);
    if (!tpl) return;
    const isAr = lang === "ar";
    setSubject((isAr ? tpl.subject_ar : tpl.subject_en) ?? "");
    setBody((isAr ? tpl.body_ar : tpl.body_en) ?? "");
  }, [tplKey, templates, lang]);

  const total = sc.tech_30 + sc.pers_25 + sc.exp_20 + sc.learn_15 + sc.comm_10;

  const vars = useMemo(
    () => ({
      Name: candidate?.full_name ?? "",
      Position: job?.title ?? "",
      Date: "",
      Time: "",
      Location: job?.region ?? "",
    }),
    [candidate, job]
  );

  const insertVar = (key: string) => {
    setBody((b) => `${b}[${key}]`);
  };

  const onSend = async () => {
    if (!candidate) return;
    if (!candidate.email) {
      toast.error(lang === "ar" ? "لا يوجد بريد للمرشح" : "No candidate email");
      return;
    }
    setSending(true);
    try {
      const res = await send({
        data: {
          candidateId: candidate.id,
          templateKey: tplKey,
          lang,
          to: candidate.email,
          subjectOverride: subject,
          bodyOverride: body,
          vars,
        },
      });
      toast.success(
        lang === "ar"
          ? `تم الإرسال${res.cc ? ` (نسخة إلى ${res.cc})` : ""}`
          : `Sent${res.cc ? ` (CC ${res.cc})` : ""}`
      );
      onChanged?.();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const onSaveScorecard = async () => {
    if (!candidate) return;
    setSavingSc(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const evaluatorId = userRes.user?.id ?? null;
      const evaluatorName = userRes.user?.user_metadata?.full_name ?? userRes.user?.email ?? null;
      const { error } = await supabase.from("scorecards").insert({
        candidate_id: candidate.id,
        evaluator_id: evaluatorId,
        evaluator_name: evaluatorName,
        tech_30: sc.tech_30,
        pers_25: sc.pers_25,
        exp_20: sc.exp_20,
        learn_15: sc.learn_15,
        comm_10: sc.comm_10,
        total,
        comments: sc.comments,
      });
      if (error) throw error;
      // Reflect into candidate score
      await supabase.from("candidates").update({ score: total }).eq("id", candidate.id);
      toast.success(lang === "ar" ? "تم حفظ التقييم" : "Scorecard saved");
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingSc(false);
    }
  };

  if (!candidate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            {candidate.full_name}
            {job?.title && <Badge variant="outline">{job.title}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="mt-2">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="evaluate">
              {lang === "ar" ? "تقييم المقابلة" : "Interview Scorecard"}
            </TabsTrigger>
            <TabsTrigger value="message">
              {lang === "ar" ? "إرسال رسالة" : "Send Message"}
            </TabsTrigger>
          </TabsList>

          {/* SCORECARD */}
          <TabsContent value="evaluate" className="space-y-4 mt-4">
            {(
              [
                ["tech_30", lang === "ar" ? "المهارات التقنية" : "Technical Skills", 30],
                ["pers_25", lang === "ar" ? "المهارات الشخصية" : "Personal Skills", 25],
                ["exp_20", lang === "ar" ? "الخبرة العملية" : "Work Experience", 20],
                ["learn_15", lang === "ar" ? "القدرة على التعلم" : "Learning Ability", 15],
                ["comm_10", lang === "ar" ? "التواصل والعرض" : "Communication", 10],
              ] as const
            ).map(([key, label, max]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <Label>
                    {label} <span className="text-muted-foreground">/ {max}</span>
                  </Label>
                  <Badge variant="secondary">{(sc as any)[key]}</Badge>
                </div>
                <Slider
                  value={[(sc as any)[key]]}
                  min={0}
                  max={max}
                  step={1}
                  onValueChange={(v) => setSc((s) => ({ ...s, [key]: v[0] }))}
                />
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <span className="font-semibold">{lang === "ar" ? "المجموع" : "Total"}</span>
              <Badge className="text-base">{total} / 100</Badge>
            </div>
            <div className="space-y-1.5">
              <Label>{lang === "ar" ? "ملاحظات" : "Comments"}</Label>
              <Textarea
                rows={3}
                value={sc.comments ?? ""}
                onChange={(e) => setSc((s) => ({ ...s, comments: e.target.value }))}
                placeholder={lang === "ar" ? "ملاحظات المقابلة..." : "Interview notes..."}
              />
            </div>
            <DialogFooter>
              <Button onClick={onSaveScorecard} disabled={savingSc}>
                {savingSc ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
                {lang === "ar" ? "حفظ التقييم" : "Save Scorecard"}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* MESSAGE */}
          <TabsContent value="message" className="space-y-3 mt-4">
            <div className="space-y-1.5">
              <Label>{lang === "ar" ? "نوع الرسالة" : "Message Type"}</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={tplKey}
                onChange={(e) => setTplKey(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.template_key} value={t.template_key}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>{lang === "ar" ? "إلى" : "To"}</Label>
              <Input value={candidate.email} readOnly />
            </div>

            <div className="space-y-1.5">
              <Label>{lang === "ar" ? "الموضوع" : "Subject"}</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{lang === "ar" ? "النص" : "Body"}</Label>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(vars).map((k) => (
                    <Button
                      key={k}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs"
                      onClick={() => insertVar(k)}
                    >
                      [{k}]
                    </Button>
                  ))}
                </div>
              </div>
              <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                {lang === "ar"
                  ? "سيتم استبدال [Name] و[Position] و[Location] تلقائياً عند الإرسال."
                  : "[Name], [Position], [Location] are auto-filled on send."}
              </p>
            </div>

            <DialogFooter>
              <Button onClick={onSend} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Send className="h-4 w-4 me-2" />}
                {lang === "ar" ? "إرسال" : "Send"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
