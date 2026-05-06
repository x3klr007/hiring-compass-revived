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
import { roleLabel, genderLabel } from "@/lib/labels";
import { toast } from "sonner";

function parseDriveLinkClient(input: string): { kind: "folder" | "file"; id: string } | null {
  if (!input) return null;
  let s = input.trim().replace(/^["'<\s]+|["'>\s]+$/g, "");
  try { s = decodeURI(s); } catch { /* noop */ }
  const folder = s.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (folder) return { kind: "folder", id: folder[1] };
  const file = s.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]{10,})/);
  if (file) return { kind: "file", id: file[1] };
  const open = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (open) return { kind: /folder/i.test(s) ? "folder" : "file", id: open[1] };
  if (/^[a-zA-Z0-9_-]{16,}$/.test(s)) return { kind: "folder", id: s };
  return null;
}

type Job = { id: string; title: string; region: string };

function ScreeningPage() {
  const { t, lang, dir } = useI18n();
  const ingest = useAuthedServerFn(ingestFromDriveLink);
  const healthCheck = useAuthedServerFn(checkDriveHealth);
  const [link, setLink] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [roleType, setRoleType] = useState<string>(
    () => (typeof window !== "undefined" && localStorage.getItem("screening.roleType")) || "",
  );
  const [defaultRegion, setDefaultRegion] = useState<string>(
    () => (typeof window !== "undefined" && localStorage.getItem("screening.region")) || "",
  );
  const HQ_SUFFIX_AR = " — الإدارة الرئيسية";
  const HQ_SUFFIX_EN = " — HQ";
  type RoleGroup = "training" | "supervision" | "hq";
  const ROLE_TYPES: Array<{ v: string; group: RoleGroup }> = [
    { v: "Stage Trainer", group: "training" },
    { v: "Expert Trainer", group: "training" },
    { v: "Admin Supervisor", group: "supervision" },
    { v: "Training Director", group: "hq" },
    { v: "HR Manager", group: "hq" },
    { v: "Operations Manager", group: "hq" },
    { v: "QA Manager", group: "hq" },
    { v: "IT Manager", group: "hq" },
    { v: "Finance Manager", group: "hq" },
    { v: "Recruitment Coordinator", group: "hq" },
  ];
  const ROLE_GROUPS: Array<{ id: RoleGroup; ar: string; en: string }> = [
    { id: "training", ar: "تدريب", en: "Training" },
    { id: "supervision", ar: "إشراف", en: "Supervision" },
    { id: "hq", ar: "إدارة رئيسية", en: "Headquarters" },
  ];
  const [roleGroup, setRoleGroup] = useState<RoleGroup>(() => {
    if (typeof window === "undefined") return "training";
    const saved = localStorage.getItem("screening.roleGroup") as RoleGroup | null;
    return saved ?? "training";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("screening.roleGroup", roleGroup);
  }, [roleGroup]);
  const roleDisplay = (v: string) => roleLabel(v, lang);
  // Resolve to a concrete job id from (roleType, region). If multiple matches
  // exist, pick the first; if none, leave null and let the server auto-suggest.
  const defaultJobId = (() => {
    if (!roleType) return "";
    const matches = jobs.filter(
      (j) => j.title.toLowerCase().trim() === roleType.toLowerCase().trim() &&
        (!defaultRegion || j.region === defaultRegion),
    );
    return matches[0]?.id ?? "";
  })();
  const [genderFilter, setGenderFilter] = useState<"any" | "male" | "female">(
    () => ((typeof window !== "undefined" && (localStorage.getItem("screening.gender") as "any" | "male" | "female")) || "any"),
  );

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("screening.roleType", roleType);
  }, [roleType]);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("screening.region", defaultRegion);
  }, [defaultRegion]);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("screening.gender", genderFilter);
  }, [genderFilter]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<IngestResult[]>([]);
  const [summary, setSummary] = useState<{ total: number; skipped: number; filteredByGender?: number } | null>(null);
  const [authError, setAuthError] = useState(false);
  type Breaker = { state: "CLOSED" | "OPEN" | "HALF_OPEN"; failures: number; cooldownRemainingMs: number; lastError?: string };
  const [driveHealth, setDriveHealth] = useState<
    {
      ok: boolean;
      status?: number;
      latencyMs: number;
      error?: string;
      breaker?: Breaker;
      checkedAt: number;
    } | null
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
            genderFilter,
          },
        });
        setResults(res.results);
        setSummary({ total: res.total, skipped: res.skipped, filteredByGender: res.filteredByGender });
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
        // Stop retrying if circuit is open — pointless to keep hammering
        if (/CIRCUIT_OPEN/i.test(lastMsg)) {
          toast.error(
            lang === "ar"
              ? "تم إيقاف المحاولات مؤقتاً (Circuit Breaker). انتظر قليلاً ثم أعد المحاولة."
              : "Retries stopped (Circuit Breaker open). Please wait a moment and try again."
          );
          // Refresh health to surface cooldown
          runHealthCheck();
          break;
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

      {lastError && !authError && (() => {
        const m = lastError.match(/LIST_FAILED reqId=(\S+) folderId=(\S+) status=(\S+) totalMs=(\d+)(?: attempts=(\d+))? url=(\S+) reason=([\s\S]*?)(?: metrics=(\{[\s\S]*\}))?$/);
        const isListFail = !!m;
        const reqId = m?.[1];
        const folderId = m?.[2];
        const status = m?.[3];
        const totalMs = m?.[4];
        const attempts = m?.[5];
        const url = m?.[6];
        const reason = m?.[7];
        let metrics: {
          attempts: number;
          transientHits: number;
          connErrors: number;
          attemptDurations: number[];
          retryDelays: number[];
        } | null = null;
        try {
          if (m?.[8]) metrics = JSON.parse(m[8]);
        } catch { /* noop */ }
        const totalNum = totalMs ? Number(totalMs) : 0;
        const maxBar = metrics
          ? Math.max(1, ...metrics.attemptDurations, ...metrics.retryDelays)
          : 1;
        return (
          <Card className="glass border-destructive/50 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 text-sm min-w-0">
              <div className="font-medium">
                {lang === "ar" ? "فشل جلب ملفات Drive" : "Failed to fetch Drive files"}
              </div>
              {isListFail ? (
                <div className="mt-2 space-y-2">
                  <div className="text-muted-foreground break-words">
                    {lang === "ar" ? "السبب:" : "Reason:"} <span className="text-foreground">{reason}</span>
                  </div>

                  {metrics && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 font-mono">
                          {lang === "ar" ? "محاولات" : "attempts"}: <strong>{metrics.attempts}</strong>
                        </span>
                        <span className="rounded-full bg-foreground/10 px-2 py-0.5 font-mono">
                          {lang === "ar" ? "المهلة الفعلية" : "total"}: <strong>{totalNum}ms</strong>
                        </span>
                        <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 font-mono">
                          5xx/transient: <strong>{metrics.transientHits}</strong>
                        </span>
                        <span className="rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-400 px-2 py-0.5 font-mono">
                          conn-err: <strong>{metrics.connErrors}</strong>
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[11px] text-muted-foreground">
                          {lang === "ar"
                            ? "زمن كل محاولة (أزرق) ومدة الانتظار قبل المحاولة التالية (رمادي):"
                            : "Per-attempt duration (blue) and pre-retry sleep (grey):"}
                        </div>
                        {metrics.attemptDurations.map((d, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                            <span className="w-6 text-muted-foreground">#{i + 1}</span>
                            <div className="flex-1 flex items-center gap-1">
                              <div
                                className="h-3 rounded bg-primary/70"
                                style={{ width: `${(d / maxBar) * 100}%`, minWidth: 2 }}
                                title={`fetch ${d}ms`}
                              />
                              <span className="text-foreground w-14">{d}ms</span>
                              {metrics!.retryDelays[i] !== undefined && (
                                <>
                                  <div
                                    className="h-3 rounded bg-muted-foreground/40"
                                    style={{ width: `${(metrics!.retryDelays[i] / maxBar) * 100}%`, minWidth: 2 }}
                                    title={`sleep ${metrics!.retryDelays[i]}ms`}
                                  />
                                  <span className="text-muted-foreground w-14">+{metrics!.retryDelays[i]}ms</span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono text-muted-foreground">
                    <div>reqId: <span className="text-foreground">{reqId}</span></div>
                    <div>status: <span className="text-foreground">{status}</span></div>
                    <div>folderId: <span className="text-foreground break-all">{folderId}</span></div>
                    <div>duration: <span className="text-foreground">{totalMs}ms</span></div>
                    {attempts && <div>attempts: <span className="text-foreground">{attempts}</span></div>}
                    <div className="sm:col-span-2 break-all">url: <span className="text-foreground">{url}</span></div>
                  </div>
                  <details className="text-xs mt-1">
                    <summary className="cursor-pointer text-muted-foreground">
                      {lang === "ar" ? "تفاصيل السجل الكاملة" : "Full log line"}
                    </summary>
                    <pre className="mt-1 whitespace-pre-wrap break-all bg-muted/40 p-2 rounded">{lastError}</pre>
                  </details>
                </div>
              ) : (
                <div className="text-muted-foreground mt-1 break-words">{lastError}</div>
              )}
              <div className="text-xs text-muted-foreground mt-2">
                {lang === "ar"
                  ? "تمت إعادة المحاولة تلقائياً. يمكنك المحاولة يدوياً عبر زر إعادة التشغيل."
                  : "We auto-retried. You can run it again manually using the retry button."}
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
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
              {isListFail && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard?.writeText(lastError);
                    toast.success(lang === "ar" ? "تم نسخ تفاصيل السجل" : "Log details copied");
                  }}
                >
                  {lang === "ar" ? "نسخ السجل" : "Copy log"}
                </Button>
              )}
            </div>
          </Card>
        );
      })()}

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
                {driveHealth.breaker && driveHealth.breaker.state !== "CLOSED" && (
                  <div className="text-xs mt-1">
                    <Badge variant="outline" className="me-2">
                      {driveHealth.breaker.state}
                    </Badge>
                    {driveHealth.breaker.state === "OPEN"
                      ? lang === "ar"
                        ? `إعادة المحاولة تلقائياً خلال ${Math.ceil(driveHealth.breaker.cooldownRemainingMs / 1000)} ثانية`
                        : `Auto-retry in ${Math.ceil(driveHealth.breaker.cooldownRemainingMs / 1000)}s`
                      : lang === "ar"
                        ? "جارٍ اختبار التعافي..."
                        : "Probing recovery..."}
                  </div>
                )}
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
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (pasted) {
                e.preventDefault();
                setLink(pasted.trim());
              }
            }}
            placeholder="https://drive.google.com/drive/folders/…"
            dir="ltr"
            spellCheck={false}
          />
          {(() => {
            const parsed = parseDriveLinkClient(link);
            if (!link.trim()) {
              return (
                <p className="text-xs text-muted-foreground">
                  {lang === "ar"
                    ? "يدعم: مجلد كامل أو ملف واحد. الصيغ: PDF و DOCX و TXT. تأكد أن المشاركة \"أي شخص لديه الرابط\" أو مع حساب الخدمة."
                    : "Supports: a whole folder or a single file. Formats: PDF, DOCX, TXT. Make sure sharing is set to 'Anyone with the link' or shared with the service account."}
                </p>
              );
            }
            if (!parsed) {
              return (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {lang === "ar"
                    ? "تعذر تحليل الرابط. الصق رابط Drive كاملاً مثل: https://drive.google.com/drive/folders/<ID>"
                    : "Could not parse this link. Paste a full Drive URL like: https://drive.google.com/drive/folders/<ID>"}
                </p>
              );
            }
            return (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {lang === "ar"
                  ? `${parsed.kind === "folder" ? "مجلد" : "ملف"} مكتشف · المعرّف: ${parsed.id.slice(0, 12)}…`
                  : `${parsed.kind === "folder" ? "Folder" : "File"} detected · ID: ${parsed.id.slice(0, 12)}…`}
              </p>
            );
          })()}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{lang === "ar" ? "نوع الوظيفة" : "Role type"}</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRoleType("")}
                className={`px-3 py-1.5 rounded-full text-xs border transition ${roleType === "" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
              >
                {lang === "ar" ? "تلقائي" : "Auto"}
              </button>
              {ROLE_TYPES.map((r) => (
                <button
                  key={r.v}
                  type="button"
                  onClick={() => setRoleType(r.v)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${roleType === r.v ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                >
                  {roleDisplay(r.v, r.hq)}
                </button>
              ))}
            </div>
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

        <div className="space-y-2">
          <Label>{lang === "ar" ? "نوع المدرسة" : "School type"}</Label>
          <p className="text-xs text-muted-foreground">
            {lang === "ar"
              ? "حدّد نوع المدرسة لتصفية السير الذاتية المناسبة لها. اختر «تلقائي / الكل» لتضمين الجميع دون تصفية."
              : "Pick the school type to filter matching CVs. Use 'Auto / All' to include everyone without filtering."}
          </p>
          <div className="flex flex-wrap gap-2">
            {([
              { v: "any", ar: "تلقائي / الكل", en: "Auto / All" },
              { v: "male", ar: "مدارس بنين", en: "Boys school" },
              { v: "female", ar: "مدارس بنات", en: "Girls school" },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setGenderFilter(opt.v)}
                className={`px-3 py-1.5 rounded-full text-xs border transition ${
                  genderFilter === opt.v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted"
                }`}
              >
                {lang === "ar" ? opt.ar : opt.en}
              </button>
            ))}
          </div>
          {genderFilter !== "any" && (
            <p className="text-xs text-muted-foreground">
              {lang === "ar"
                ? `سيتم تجاهل السير الذاتية التي لا تناسب ${genderFilter === "male" ? "مدارس البنين" : "مدارس البنات"}.`
                : `CVs that don't match ${genderFilter === "male" ? "boys schools" : "girls schools"} will be skipped.`}
            </p>
          )}
        </div>


        {(() => {
          const rl = roleType
            ? roleDisplay(roleType, ROLE_TYPES.find((r) => r.v === roleType)?.hq)
            : (lang === "ar" ? "تلقائي" : "Auto");
          const rg = defaultRegion ? regionLabel(defaultRegion, lang) : (lang === "ar" ? "تلقائي" : "Auto");
          const sc = genderLabel(genderFilter, lang);
          return (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground mb-2">
                {lang === "ar" ? "ملخص التصفية قبل التشغيل" : "Filter summary before running"}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{lang === "ar" ? "الوظيفة:" : "Role:"} <span className="ms-1 font-semibold">{rl}</span></Badge>
                <Badge variant="outline">{lang === "ar" ? "المنطقة:" : "Region:"} <span className="ms-1 font-semibold">{rg}</span></Badge>
                <Badge variant="outline">{lang === "ar" ? "نوع المدرسة:" : "School:"} <span className="ms-1 font-semibold">{sc}</span></Badge>
              </div>
            </div>
          );
        })()}
        <Button onClick={onRun} disabled={running || (driveHealth ? !driveHealth.ok : false) || (link.trim() ? !parseDriveLinkClient(link) : false)} size="lg" className="w-full md:w-auto">
          {running ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {lang === "ar"
                ? `جاري الاستيراد والفرز...${attempt > 1 ? ` (محاولة ${attempt})` : ""}`
                : `Importing & screening...${attempt > 1 ? ` (attempt ${attempt})` : ""}`}
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
            <div className="flex items-center gap-2">
              {summary.skipped > 0 && (
                <Badge variant="secondary">
                  {summary.skipped} {lang === "ar" ? "متجاهل" : "skipped"}
                </Badge>
              )}
              {summary.filteredByGender ? (
                <Badge variant="outline">
                  {summary.filteredByGender}{" "}
                  {lang === "ar" ? "مستبعد بالجنس" : "filtered by gender"}
                </Badge>
              ) : null}
            </div>
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
                            {genderLabel(r.extracted.gender as "male" | "female", lang)}
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
