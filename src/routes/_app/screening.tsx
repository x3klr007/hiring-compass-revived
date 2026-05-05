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
import { Sparkles, Link2, Loader2, CheckCircle2, AlertCircle, Folder } from "lucide-react";
import { ingestFromDriveLink, type IngestResult } from "@/server/cv-ingest.functions";
import { REGIONS, regionLabel } from "@/lib/regions";
import { toast } from "sonner";

type Job = { id: string; title: string; region: string };

function ScreeningPage() {
  const { t, lang, dir } = useI18n();
  const ingest = useServerFn(ingestFromDriveLink);
  const [link, setLink] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [defaultJobId, setDefaultJobId] = useState<string>("");
  const [defaultRegion, setDefaultRegion] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<IngestResult[]>([]);
  const [summary, setSummary] = useState<{ total: number; skipped: number } | null>(null);

  useEffect(() => {
    supabase
      .from("jobs")
      .select("id,title,region")
      .eq("status", "Open")
      .order("created_at", { ascending: false })
      .then(({ data }) => setJobs((data ?? []) as Job[]));
  }, []);

  const onRun = async () => {
    if (!link.trim()) {
      toast.error(lang === "ar" ? "أدخل رابط Google Drive" : "Paste a Google Drive link");
      return;
    }
    setRunning(true);
    setResults([]);
    setSummary(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        toast.error(lang === "ar" ? "يرجى تسجيل الدخول" : "Please sign in");
        setRunning(false);
        return;
      }
      const res = await ingest({
        headers: { Authorization: `Bearer ${token}` },
        data: {
          link: link.trim(),
          defaultJobId: defaultJobId || null,
          defaultRegion: defaultRegion || null,
        },
      });
      setResults(res.results);
      setSummary({ total: res.total, skipped: res.skipped });
      const ok = res.results.filter((r) => r.ok).length;
      toast.success(
        lang === "ar"
          ? `تمت إضافة ${ok} مرشح من ${res.total}`
          : `Imported ${ok} of ${res.total} candidates`
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
          <Sparkles className="h-7 w-7" />
          {t("aiScreening")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {lang === "ar"
            ? "ألصق رابط مجلد Google Drive يحتوي على السير الذاتية. سيقوم الذكاء الاصطناعي بقراءتها واستخراج البيانات واقتراح الوظائف المناسبة."
            : "Paste a Google Drive folder/file link. The AI reads each CV, extracts the candidate's info, infers gender, and suggests matching positions."}
        </p>
      </div>

      <Card className="glass shadow-elegant p-6 space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            {lang === "ar" ? "رابط Google Drive" : "Google Drive link"}
          </Label>
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/…"
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground">
            {lang === "ar"
              ? "يدعم: مجلد كامل أو ملف واحد. الصيغ: PDF و DOCX و TXT."
              : "Supports: a whole folder or a single file. Formats: PDF, DOCX, TXT."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{lang === "ar" ? "الوظيفة الافتراضية (اختياري)" : "Default job (optional)"}</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={defaultJobId}
              onChange={(e) => setDefaultJobId(e.target.value)}
            >
              <option value="">
                {lang === "ar" ? "— اقتراح الذكاء الاصطناعي —" : "— Let AI suggest —"}
              </option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} — {j.region}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t("region")} ({lang === "ar" ? "اختياري" : "optional"})</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDefaultRegion("")}
                className={`px-3 py-1.5 rounded-full text-xs border transition ${defaultRegion === "" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
              >
                {lang === "ar" ? "تلقائي" : "Auto"}
              </button>
              {REGIONS.map((r) => (
                <button
                  key={r.region}
                  type="button"
                  onClick={() => setDefaultRegion(r.region)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${defaultRegion === r.region ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                >
                  {regionLabel(r.region, lang)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button onClick={onRun} disabled={running} size="lg" className="w-full md:w-auto">
          {running ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {lang === "ar" ? "جاري الاستيراد والفرز..." : "Importing & screening..."}
            </>
          ) : (
            <>
              <Sparkles className="me-2 h-4 w-4" />
              {lang === "ar" ? "ابدأ الفرز الذكي" : "Run AI Screening"}
            </>
          )}
        </Button>
      </Card>

      {summary && (
        <Card className="glass shadow-elegant p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2">
              <Folder className="h-4 w-4" />
              {lang === "ar"
                ? `النتائج: ${results.filter((r) => r.ok).length} / ${summary.total}`
                : `Results: ${results.filter((r) => r.ok).length} / ${summary.total}`}
            </div>
            {summary.skipped > 0 && (
              <Badge variant="secondary">
                {summary.skipped} {lang === "ar" ? "متجاهل" : "skipped"}
              </Badge>
            )}
          </div>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border bg-card/50 p-3 text-sm"
              >
                {r.ok ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.source_name}</div>
                  {r.ok && r.extracted ? (
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <div>
                        <span className="font-medium text-foreground">{r.extracted.full_name}</span>
                        {r.extracted.gender && (
                          <Badge variant="outline" className="ms-2">
                            {r.extracted.gender === "female"
                              ? lang === "ar"
                                ? "أنثى"
                                : "Female"
                              : lang === "ar"
                                ? "ذكر"
                                : "Male"}
                          </Badge>
                        )}
                      </div>
                      {r.extracted.suggested_positions?.length > 0 && (
                        <div>
                          {lang === "ar" ? "اقتراح: " : "Suggested: "}
                          {r.extracted.suggested_positions.join(" • ")}
                        </div>
                      )}
                      <div className="italic">
                        {lang === "ar" ? r.extracted.fit_summary_ar : r.extracted.fit_summary_en}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-destructive mt-1">{r.error}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_app/screening")({
  component: ScreeningPage,
});
