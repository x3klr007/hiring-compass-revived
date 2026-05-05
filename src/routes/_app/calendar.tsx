import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalIcon, Video, Loader2, ExternalLink } from "lucide-react";
import { REGIONS, regionLabel } from "@/lib/regions";
import { scheduleInterview } from "@/server/calendar.functions";
import { sendInterviewInvite } from "@/server/gmail.functions";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Cand = { id: string; full_name: string; email: string };
type IV = {
  id: string;
  candidate_id: string | null;
  committee_name: string;
  region: string;
  scheduled_date: string;
  scheduled_time: string | null;
  duration_minutes: number;
  status: string;
  notes: string | null;
};

function CalendarPage() {
  const { t, lang, dir } = useI18n();
  const schedule = useServerFn(scheduleInterview);
  const sendInvite = useServerFn(sendInterviewInvite);
  const { user } = useAuth();
  const [cands, setCands] = useState<Cand[]>([]);
  const [items, setItems] = useState<IV[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    candidate_id: "",
    committee_name: "Hiring Committee 1",
    region: REGIONS[0].region,
    scheduled_date: new Date().toISOString().slice(0, 10),
    scheduled_time: "10:00",
    duration_minutes: 60,
    notes: "",
  });

  const load = async () => {
    const [{ data: c }, { data: iv }] = await Promise.all([
      supabase.from("candidates").select("id,full_name,email").order("created_at", { ascending: false }).limit(200),
      supabase.from("interview_schedule").select("*").order("scheduled_date", { ascending: false }).limit(50),
    ]);
    setCands((c ?? []) as Cand[]);
    setItems((iv ?? []) as IV[]);
  };
  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cand = cands.find((c) => c.id === form.candidate_id);
    if (!cand) {
      toast.error(lang === "ar" ? "اختر مرشحاً" : "Pick a candidate");
      return;
    }
    setBusy(true);
    try {
      const out = await schedule({
        data: {
          candidate_id: cand.id,
          candidate_name: cand.full_name,
          candidate_email: cand.email || null,
          committee_name: form.committee_name,
          region: form.region,
          scheduled_date: form.scheduled_date,
          scheduled_time: form.scheduled_time,
          duration_minutes: form.duration_minutes,
          notes: form.notes || null,
        },
      });
      const noteBlock = `Meet: ${out.meet_link ?? "—"}\nEvent: ${out.html_link}${form.notes ? `\n\n${form.notes}` : ""}`;
      const { error } = await supabase.from("interview_schedule").insert({
        candidate_id: cand.id,
        committee_name: form.committee_name,
        region: form.region,
        scheduled_date: form.scheduled_date,
        scheduled_time: form.scheduled_time,
        duration_minutes: form.duration_minutes,
        notes: noteBlock,
      });
      if (error) throw error;

      // Send the candidate an email invite. Recruiter is BCC'd so the
      // candidate never sees the recruiter's address.
      if (cand.email) {
        try {
          const subject =
            lang === "ar"
              ? `دعوة مقابلة · ${form.committee_name}`
              : `Interview invitation · ${form.committee_name}`;
          const lines =
            lang === "ar"
              ? [
                  `مرحباً ${cand.full_name}،`,
                  ``,
                  `تمت دعوتك لمقابلة مع ${form.committee_name} (${regionLabel(form.region, "ar")}).`,
                  `التاريخ: ${form.scheduled_date}  الوقت: ${form.scheduled_time}  المدة: ${form.duration_minutes} دقيقة`,
                  ``,
                  `رابط Google Meet: ${out.meet_link ?? "—"}`,
                  `رابط الحدث: ${out.html_link}`,
                  form.notes ? `\nملاحظات:\n${form.notes}` : "",
                ]
              : [
                  `Hi ${cand.full_name},`,
                  ``,
                  `You have been invited to an interview with ${form.committee_name} (${regionLabel(form.region, "en")}).`,
                  `Date: ${form.scheduled_date}  Time: ${form.scheduled_time}  Duration: ${form.duration_minutes} min`,
                  ``,
                  `Google Meet: ${out.meet_link ?? "—"}`,
                  `Event: ${out.html_link}`,
                  form.notes ? `\nNotes:\n${form.notes}` : "",
                ];
          await sendInvite({
            data: {
              to: cand.email,
              bcc: user?.email ?? null,
              subject,
              body: lines.join("\n"),
            },
          });
        } catch (mailErr) {
          console.error("invite email failed", mailErr);
          toast.warning(
            lang === "ar" ? "تم الجدول، لكن فشل إرسال البريد" : "Scheduled, but email failed",
          );
        }
      }

      toast.success(
        lang === "ar" ? "تم إنشاء المقابلة وإرسال رابط Google Meet" : "Interview scheduled · Google Meet link sent",
      );
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const meetUrl = (notes: string | null): string | null => {
    if (!notes) return null;
    const m = notes.match(/https:\/\/meet\.google\.com\/[\w-]+/);
    return m ? m[0] : null;
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
          <CalIcon className="h-7 w-7" />
          {t("calendar")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {lang === "ar"
            ? "حدد موعد المقابلة وسيُنشأ تلقائياً حدث Google Calendar مع رابط Google Meet ودعوة للمرشح."
            : "Schedule an interview — a Google Calendar event with a Google Meet link is created and the candidate is invited."}
        </p>
      </div>

      <Card className="glass shadow-elegant p-6">
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>{t("candidates")}</Label>
            <select
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.candidate_id}
              onChange={(e) => setForm({ ...form, candidate_id: e.target.value })}
            >
              <option value="">{lang === "ar" ? "— اختر —" : "— pick —"}</option>
              {cands.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} · {c.email}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{lang === "ar" ? "اللجنة" : "Committee"}</Label>
            <Input
              value={form.committee_name}
              onChange={(e) => setForm({ ...form, committee_name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t("region")}</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
            >
              {REGIONS.map((r) => (
                <option key={r.region} value={r.region}>
                  {regionLabel(r.region, lang)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{lang === "ar" ? "التاريخ" : "Date"}</Label>
            <Input
              type="date"
              value={form.scheduled_date}
              onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{lang === "ar" ? "الوقت" : "Time"}</Label>
            <Input
              type="time"
              value={form.scheduled_time}
              onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{lang === "ar" ? "المدة (دقائق)" : "Duration (min)"}</Label>
            <Input
              type="number"
              min={15}
              max={240}
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>{lang === "ar" ? "ملاحظات" : "Notes"}</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy} size="lg">
              {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Video className="me-2 h-4 w-4" />}
              {lang === "ar" ? "إنشاء المقابلة + Google Meet" : "Schedule + create Google Meet"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="glass shadow-elegant p-6">
        <h2 className="font-semibold mb-3">{lang === "ar" ? "المقابلات الأخيرة" : "Recent interviews"}</h2>
        <div className="space-y-2">
          {items.length === 0 && <div className="text-sm text-muted-foreground">{t("noData")}</div>}
          {items.map((iv) => {
            const url = meetUrl(iv.notes);
            return (
              <div key={iv.id} className="rounded-lg border bg-card/50 p-3 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">
                    {iv.committee_name} · {regionLabel(iv.region, lang)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {iv.scheduled_date} {iv.scheduled_time ?? ""} · {iv.duration_minutes}m
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{iv.status}</Badge>
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">
                        <Video className="h-3.5 w-3.5 me-1" /> Meet
                        <ExternalLink className="h-3 w-3 ms-1" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
});
