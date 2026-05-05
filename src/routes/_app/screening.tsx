import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import { useEffect, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Link2, Loader2, CheckCircle2, AlertCircle, Folder } from "lucide-react";
import { ingestFromDriveLink, checkDriveHealth, type IngestResult } from "@/server/cv-ingest.functions";
import { REGIONS, regionLabel } from "@/lib/regions";
import { toast } from "sonner";

type Job = { id: string; title: string; region: string };

function ScreeningPage() {
  const { t, lang, dir } = useI18n();
  const ingest = useAuthedServerFn(ingestFromDriveLink);
  const healthCheck = useAuthedServerFn(checkDriveHealth);
  const [link, setLink] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [defaultJobId, setDefaultJobId] = useState<string>("");
  const [defaultRegion, setDefaultRegion] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<IngestResult[]>([]);
  const [summary, setSummary] = useState<{ total: number; skipped: number } | null>(null);
  const [authError, setAuthError] = useState(false);
  const [driveHealth, setDriveHealth] = useState<
    { ok: boolean; status?: number; latencyMs: number; error?: string; checkedAt: number } | null
  >(null);
  const [healthChecking, setHealthChecking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    supabase
      .from("jobs")
      .select("id,title,region")
      .eq("status", "Open")
      .order("created_at", { ascending: false })
      .then(({ data }) => setJobs((data ?? []) as Job[]));
  }, []);

  const runHealthCheck = async () => {
    setHealthChecking(true);
    try {
      const res = await healthCheck({});
      setDriveHealth({ ...res, checkedAt: Date.now() });
      return res;
    } catch (err) {
      const r = { ok: false, status: undefined as number | undefined, latencyMs: 0, error: (err as Error).message, checkedAt: Date.now() };
      setDriveHealth(r);
      return r;
    } finally {
      setHealthChecking(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
    const id = setInterval(runHealthCheck, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isTransient = (msg: string) =>
    /503|502|504|upstream|connection refused|network|timeout|fetch failed|ECONNRESET/i.test(msg);

  const runIngest = async (opts: { autoRetry?: boolean } = {}) => {
    if (!link.trim()) {
      toast.error(lang === "ar" ? "أدخل رابط Google Drive" : "Paste a Google Drive link");
      return;
    }
    // Preflight health check
    const health = await runHealthCheck();
    if (!health.ok) {
      setLastError(
        lang === "ar"
          ? `خدمة Google Drive غير متوفرة حالياً (${health.status ?? "—"}). ${health.error ?? ""}`
          : `Google Drive service is unavailable (${health.status ?? "—"}). ${health.error ?? ""}`
      );
      return;
    }

    setRunning(true);
    setResults([]);
    setSummary(null);
    setAuthError(false);
    setLastError(null);

    const MAX = opts.autoRetry ? 3 : 1;
    let lastMsg = "";
    for (let i = 1; i <= MAX; i++) {
      setAttempt(i);
      try {
        const res = await ingest({
          data: {
            link: link.trim(),
            defaultJobId: defaultJobId || null,
            defaultRegion: defaultRegion || null,
          },
        });
        setResults(res.results);
        setSummary({ total: res.total, skipped: res.skipped });
        const ok = res.results.filter((r: IngestResult) => r.ok).length;
        toast.success(
          lang === "ar"
            ? `تمت إضافة ${ok} مرشح من ${res.total}`
            : `Imported ${ok} of ${res.total} candidates`
        );
        setRunning(false);
        setAttempt(0);
        return;
      } catch (err) {
        lastMsg = (err as Error).message || "";
        if (lastMsg === "UNAUTHENTICATED" || /401|unauthor|jwt|token|sign(\s|-)?in/i.test(lastMsg)) {
          setAuthError(true);
          setRunning(false);
          setAttempt(0);
          return;
        }
        if (i < MAX && isTransient(lastMsg)) {
          const delay = 800 * 2 ** (i - 1);
          toast.message(
            lang === "ar"
              ? `فشلت المحاولة ${i}، إعادة المحاولة خلال ${Math.round(delay / 1000)} ثانية...`
              : `Attempt ${i} failed, retrying in ${Math.round(delay / 1000)}s...`
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        break;
      }
    }
    setLastError(lastMsg);
    setRunning(false);
    setAttempt(0);
  };

  const onRun = () => runIngest({ autoRetry: true });
  const onRetry = () => runIngest({ autoRetry: true });

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

      {authError && (
        <Card className="glass border-destructive/50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <div className="font-medium">
              {lang === "ar" ? "انتهت جلستك" : "Your session has expired"}
            </div>
            <div className="text-muted-foreground mt-1">
              {lang === "ar"
                ? "يرجى تسجيل الدخول مرة أخرى لمتابعة الفرز الذكي."
                : "Please sign in again to continue running AI screening."}
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/auth">
              {lang === "ar" ? "تسجيل الدخول" : "Sign in"}
            </Link>
          </Button>
        </Card>
      )}

      {lastError && !authError && (
        <Card className="glass border-destructive/50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <div className="font-medium">
              {lang === "ar" ? "فشل جلب ملفات Drive" : "Failed to fetch Drive files"}
            </div>
            <div className="text-muted-foreground mt-1 break-words">{lastError}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {lang === "ar"
                ? "تمت إعادة المحاولة تلقائياً. يمكنك المحاولة يدوياً عبر زر إعادة التشغيل."
                : "We auto-retried. You can run it again manually using the retry button."}
            </div>
          </div>
          <Button size="sm" onClick={onRetry} disabled={running}>
            {running ? (
              <>
                <Loader2 className="me-2 h-3 w-3 animate-spin" />
                {lang === "ar" ? `محاولة ${attempt}` : `Attempt ${attempt}`}
              </>
            ) : lang === "ar" ? (
              "إعادة التشغيل"
            ) : (
              "Retry now"
            )}
          </Button>
        </Card>
      )}

      {driveHealth && (
        <Card
          className={`glass p-3 flex items-center gap-3 text-sm ${
            driveHealth.ok ? "border-emerald-500/40" : "border-destructive/50"
          }`}
        >
          {driveHealth.ok ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          )}
          <div className="flex-1">
            {driveHealth.ok ? (
              <span className="text-muted-foreground">
                {lang === "ar"
                  ? `خدمة Google Drive متاحة (${driveHealth.latencyMs}ms)`
                  : `Google Drive service is available (${driveHealth.latencyMs}ms)`}
              </span>
            ) : (
              <div>
                <div className="font-medium">
                  {lang === "ar"
                    ? "خدمة Google Drive غير متوفرة حالياً"
                    : "Google Drive service is unavailable"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {driveHealth.status ? `HTTP ${driveHealth.status} — ` : ""}
                  {driveHealth.error}
                </div>
              </div>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={runHealthCheck} disabled={healthChecking}>
            {healthChecking ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : lang === "ar" ? (
              "إعادة الفحص"
            ) : (
              "Recheck"
            )}
          </Button>
        </Card>
      )}

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

        <Button onClick={onRun} disabled={running || (driveHealth ? !driveHealth.ok : false)} size="lg" className="w-full md:w-auto">
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
