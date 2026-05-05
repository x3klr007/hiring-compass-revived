import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal, FlaskConical, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { getRetryPolicy, testRetryPolicyFn } from "@/server/cv-ingest.functions";

type Policy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  factor: number;
  jitter: number;
  connectionErrorBonusAttempts: number;
  connectionErrorBaseDelayMs: number;
  transientStatuses?: number[];
};

type Snapshot = {
  policy: Policy;
  transientStatuses: number[];
  envVars: Record<string, string | null>;
  issues: { name: string; raw: string; reason: string }[];
};

const FIELDS: Array<{
  key: keyof Policy;
  labelAr: string;
  labelEn: string;
  step?: number;
  hint?: string;
}> = [
  { key: "maxAttempts", labelAr: "عدد المحاولات", labelEn: "Max attempts" },
  { key: "baseDelayMs", labelAr: "المهلة الابتدائية (ms)", labelEn: "Base delay (ms)" },
  { key: "maxDelayMs", labelAr: "أقصى مهلة (ms)", labelEn: "Max delay (ms)" },
  { key: "factor", labelAr: "معامل الأسي", labelEn: "Backoff factor", step: 0.1 },
  { key: "jitter", labelAr: "العشوائية (0-1)", labelEn: "Jitter (0-1)", step: 0.05 },
  { key: "connectionErrorBonusAttempts", labelAr: "محاولات إضافية للشبكة", labelEn: "Connection bonus attempts" },
  { key: "connectionErrorBaseDelayMs", labelAr: "مهلة الشبكة الأولية (ms)", labelEn: "Connection base delay (ms)" },
];

function RetrySettingsPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [statusesText, setStatusesText] = useState("");
  const [folderId, setFolderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof testRetryPolicyFn>> | null>(null);

  const load = async () => {
    try {
      const snap = await getRetryPolicy();
      setSnapshot(snap as Snapshot);
      setPolicy({ ...(snap as Snapshot).policy });
      setStatusesText((snap as Snapshot).transientStatuses.join(", "));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    if (!snapshot) return;
    setPolicy({ ...snapshot.policy });
    setStatusesText(snapshot.transientStatuses.join(", "));
    setResult(null);
  };

  const runTest = async () => {
    if (!policy) return;
    setBusy(true);
    setResult(null);
    try {
      const statuses = statusesText
        .split(/[,\s]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n >= 100 && n <= 599);
      const res = await testRetryPolicyFn({
        data: {
          policy: { ...policy, transientStatuses: statuses.length ? statuses : undefined },
          folderId: folderId.trim() || undefined,
        },
      });
      setResult(res);
      if (res.ok) toast.success(ar ? "نجح الاختبار" : "Test succeeded");
      else toast.error(ar ? "فشل الاختبار" : "Test failed");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!policy || !snapshot) {
    return (
      <div dir={dir} className="text-muted-foreground text-sm">
        {ar ? "جاري التحميل..." : "Loading..."}
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
          <SlidersHorizontal className="h-7 w-7" />
          {ar ? "سياسة إعادة المحاولة" : "Retry Policy"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ar
            ? "عرض السياسة الحالية، تعديلها محلياً، واختبارها قبل التطبيق. التعديلات هنا مؤقتة فقط — للتطبيق الدائم عدّل متغيرات البيئة."
            : "View, tweak locally, and test before applying. Changes here are ephemeral — for permanent values, update environment variables."}
        </p>
      </div>

      <Card className="glass shadow-elegant p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold">{ar ? "الإعدادات الحالية" : "Current settings"}</div>
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 me-1.5" />
            {ar ? "تحديث" : "Reload"}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label>
                {ar ? f.labelAr : f.labelEn}{" "}
                <span className="text-xs text-muted-foreground">
                  ({ar ? "افتراضي" : "default"}: {String(snapshot.policy[f.key])})
                </span>
              </Label>
              <Input
                type="number"
                step={f.step ?? 1}
                value={String(policy[f.key] ?? 0)}
                onChange={(e) =>
                  setPolicy({ ...policy, [f.key]: Number(e.target.value) } as Policy)
                }
              />
            </div>
          ))}
          <div className="space-y-2 md:col-span-2">
            <Label>
              {ar ? "حالات HTTP العابرة (مفصولة بفاصلة)" : "Transient HTTP statuses (comma-separated)"}{" "}
              <span className="text-xs text-muted-foreground">
                ({ar ? "افتراضي" : "default"}: {snapshot.transientStatuses.join(", ")})
              </span>
            </Label>
            <Input
              value={statusesText}
              onChange={(e) => setStatusesText(e.target.value)}
              placeholder="408, 429, 500, 502, 503, 504"
            />
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
          <div className="font-medium">{ar ? "متغيرات البيئة المُكتشفة" : "Detected env vars"}</div>
          {Object.entries(snapshot.envVars).map(([k, v]) => (
            <div key={k} className="font-mono">
              {k}={" "}
              {v === null ? (
                <span className="text-muted-foreground">{ar ? "(غير محدد)" : "(unset)"}</span>
              ) : (
                <span>{v}</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="glass shadow-elegant p-6 space-y-4">
        <div className="font-semibold flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          {ar ? "اختبر السياسة" : "Test the policy"}
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <Input
            placeholder={ar ? "معرّف مجلد Drive (اختياري — افتراضي root)" : "Drive folder ID (optional — defaults to root)"}
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
          />
          <Button onClick={runTest} disabled={busy}>
            <FlaskConical className="h-4 w-4 me-1.5" />
            {busy ? (ar ? "جارٍ..." : "Running...") : ar ? "تشغيل الاختبار" : "Run test"}
          </Button>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="h-4 w-4 me-1.5" />
            {ar ? "استعادة" : "Reset"}
          </Button>
        </div>

        {result && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={result.ok ? "default" : "destructive"}>
                {result.ok ? (ar ? "نجاح" : "Success") : ar ? "فشل" : "Failure"}
              </Badge>
              <span>
                {ar ? "المحاولات" : "Attempts"}: <strong>{result.attempts}</strong>
              </span>
              <span>
                {ar ? "المدة" : "Duration"}: <strong>{result.totalMs}ms</strong>
              </span>
              {result.status !== undefined && (
                <span>
                  {ar ? "الحالة" : "Status"}: <strong>{result.status}</strong>
                </span>
              )}
              <span className="text-xs text-muted-foreground font-mono">
                reqId={result.reqId}
              </span>
            </div>
            {result.error && (
              <div className="text-sm text-destructive whitespace-pre-wrap break-words">
                {result.error}
              </div>
            )}
            {result.logs.length > 0 && (
              <pre className="text-[11px] bg-background border rounded p-2 max-h-64 overflow-auto whitespace-pre-wrap">
                {result.logs.join("\n")}
              </pre>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_app/retry-settings")({
  component: RetrySettingsPage,
});
