import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { roleLabel } from "@/lib/labels";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Search, Pencil, Trash2, MapPin } from "lucide-react";
import { REGIONS, regionLabel } from "@/lib/regions";
import { toast } from "sonner";

type Candidate = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  gender: string | null;
  stage: string;
  status: string;
  score: number;
  screening_result: string | null;
  job_id: string | null;
  notes: string | null;
  created_at: string;
};

type Job = { id: string; title: string; region: string };

function CandidatesPage() {
  const { t, lang, dir } = useI18n();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [region, setRegion] = useState<string>("");
  const [gender, setGender] = useState<"" | "male" | "female">("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Candidate | null>(null);
  const [moving, setMoving] = useState<Candidate | null>(null);
  const [deleting, setDeleting] = useState<Candidate | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: j }] = await Promise.all([
      supabase.from("candidates").select("*").order("created_at", { ascending: false }),
      supabase.from("jobs").select("id,title,region"),
    ]);
    setCandidates((c ?? []) as Candidate[]);
    const map: Record<string, Job> = {};
    (j ?? []).forEach((x) => (map[x.id] = x as Job));
    setJobs(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (gender && c.gender !== gender) return false;
      if (region) {
        const job = c.job_id ? jobs[c.job_id] : null;
        const cityMatches = (c.city ?? "").toLowerCase() === region.toLowerCase();
        if (!cityMatches && (!job || job.region !== region)) return false;
      }
      if (q) {
        const s = q.toLowerCase();
        if (
          !c.full_name?.toLowerCase().includes(s) &&
          !c.email?.toLowerCase().includes(s) &&
          !(c.phone ?? "").toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [candidates, jobs, region, gender, q]);

  const byGender = (g: "male" | "female") => filtered.filter((c) => c.gender === g);

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("candidates").delete().eq("id", deleting.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(lang === "ar" ? "تم حذف المرشح" : "Candidate deleted");
      setCandidates((prev) => prev.filter((c) => c.id !== deleting.id));
    }
    setDeleting(null);
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
          <Users className="h-7 w-7" />
          {t("candidates")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {lang === "ar"
            ? "كل المرشحين، مفروزون تلقائياً حسب الجنس والمنطقة."
            : "All candidates, auto-sorted by gender and region."}
        </p>
      </div>

      <Card className="glass shadow-elegant p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setRegion("")}
            className={`px-3 py-1.5 rounded-full text-xs border ${region === "" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
          >
            {lang === "ar" ? "كل المناطق" : "All regions"}
          </button>
          {REGIONS.map((r) => (
            <button
              key={r.region}
              onClick={() => setRegion(r.region)}
              className={`px-3 py-1.5 rounded-full text-xs border ${region === r.region ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
            >
              {regionLabel(r.region, lang)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={lang === "ar" ? "بحث بالاسم أو البريد" : "Search by name or email"}
              className="ps-9"
            />
          </div>
          {(["", "male", "female"] as const).map((g) => (
            <button
              key={g || "all"}
              onClick={() => setGender(g)}
              className={`px-3 py-1.5 rounded-full text-xs border ${gender === g ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
            >
              {g === ""
                ? lang === "ar" ? "الكل" : "All"
                : g === "male"
                  ? lang === "ar" ? "بنين" : "Boys"
                  : lang === "ar" ? "بنات" : "Girls"}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {(["male", "female"] as const).map((g) => (
          <Card key={g} className="glass shadow-elegant p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">
                {g === "male"
                  ? lang === "ar" ? "بنين" : "Boys"
                  : lang === "ar" ? "بنات" : "Girls"}
              </h2>
              <Badge variant="secondary">{byGender(g).length}</Badge>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {loading && <div className="text-sm text-muted-foreground">…</div>}
              {!loading && byGender(g).length === 0 && (
                <div className="text-sm text-muted-foreground">{t("noData")}</div>
              )}
              {byGender(g).map((c) => {
                const job = c.job_id ? jobs[c.job_id] : null;
                const cityLabel = c.city ? regionLabel(c.city, lang) : null;
                return (
                  <div key={c.id} className="rounded-lg border bg-card/50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium truncate">{c.full_name}</div>
                      <Badge variant="outline">{c.stage}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">{c.email}</div>
                    {(job || cityLabel) && (
                      <div className="text-xs mt-1">
                        {job && <>{job.title} · </>}
                        {cityLabel ?? (job && regionLabel(job.region, lang))}
                      </div>
                    )}
                    {c.screening_result && (
                      <Badge variant="secondary" className="mt-2">
                        {c.screening_result}
                      </Badge>
                    )}
                    <div className="flex gap-1.5 mt-3 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => setEditing(c)}
                      >
                        <Pencil className="h-3 w-3 me-1" />
                        {lang === "ar" ? "تعديل" : "Edit"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => setMoving(c)}
                      >
                        <MapPin className="h-3 w-3 me-1" />
                        {lang === "ar" ? "نقل" : "Move"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => setDeleting(c)}
                      >
                        <Trash2 className="h-3 w-3 me-1" />
                        {lang === "ar" ? "حذف" : "Delete"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <EditDialog
        candidate={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          setEditing(null);
        }}
      />

      <MoveDialog
        candidate={moving}
        jobs={Object.values(jobs)}
        onClose={() => setMoving(null)}
        onSaved={(updated) => {
          setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          setMoving(null);
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lang === "ar" ? "تأكيد الحذف" : "Confirm delete"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "ar"
                ? `سيتم حذف المرشح "${deleting?.full_name}" نهائياً.`
                : `Candidate "${deleting?.full_name}" will be permanently deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === "ar" ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {lang === "ar" ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditDialog({
  candidate,
  onClose,
  onSaved,
}: {
  candidate: Candidate | null;
  onClose: () => void;
  onSaved: (c: Candidate) => void;
}) {
  const { lang } = useI18n();
  const [form, setForm] = useState<Partial<Candidate>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (candidate) setForm(candidate);
  }, [candidate]);

  const save = async () => {
    if (!candidate) return;
    setSaving(true);
    // duplicate email check
    if (form.email && form.email.toLowerCase() !== candidate.email.toLowerCase()) {
      const { data: dup } = await supabase
        .from("candidates")
        .select("id, full_name")
        .ilike("email", form.email)
        .neq("id", candidate.id)
        .maybeSingle();
      if (dup) {
        toast.error(
          lang === "ar"
            ? `بريد مكرر — مستخدم بواسطة ${dup.full_name}`
            : `Duplicate email — used by ${dup.full_name}`
        );
        setSaving(false);
        return;
      }
    }
    const { data, error } = await supabase
      .from("candidates")
      .update({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        city: form.city,
        gender: form.gender,
      })
      .eq("id", candidate.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
    onSaved(data as Candidate);
  };

  return (
    <Dialog open={!!candidate} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{lang === "ar" ? "تعديل المرشح" : "Edit candidate"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{lang === "ar" ? "الاسم" : "Name"}</Label>
            <Input
              value={form.full_name ?? ""}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{lang === "ar" ? "البريد الإلكتروني" : "Email"}</Label>
            <Input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{lang === "ar" ? "الجوال" : "Phone"}</Label>
            <Input
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{lang === "ar" ? "المدينة" : "City"}</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.city ?? ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            >
              <option value="">—</option>
              {REGIONS.map((r) => (
                <option key={r.region} value={r.region}>
                  {regionLabel(r.region, lang)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{lang === "ar" ? "الجنس" : "Gender"}</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.gender ?? ""}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="">—</option>
              <option value="male">{lang === "ar" ? "ذكر" : "Male"}</option>
              <option value="female">{lang === "ar" ? "أنثى" : "Female"}</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {lang === "ar" ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={save} disabled={saving}>
            {lang === "ar" ? "حفظ" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({
  candidate,
  jobs,
  onClose,
  onSaved,
}: {
  candidate: Candidate | null;
  jobs: Job[];
  onClose: () => void;
  onSaved: (c: Candidate) => void;
}) {
  const { lang } = useI18n();
  const [city, setCity] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCity(candidate?.city ?? "");
    setJobId(candidate?.job_id ?? "");
  }, [candidate]);

  const filteredJobs = city ? jobs.filter((j) => j.region === city) : jobs;

  const save = async () => {
    if (!candidate) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("candidates")
      .update({
        city: city || null,
        job_id: jobId || null,
      })
      .eq("id", candidate.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(lang === "ar" ? "تم نقل المرشح" : "Candidate moved");
    onSaved(data as Candidate);
  };

  return (
    <Dialog open={!!candidate} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {lang === "ar" ? "نقل المرشح إلى مدينة أخرى" : "Move candidate to another city"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {candidate?.full_name} ·{" "}
            {candidate?.city
              ? regionLabel(candidate.city, lang)
              : lang === "ar"
                ? "بدون مدينة"
                : "No city"}
          </div>
          <div className="space-y-1.5">
            <Label>{lang === "ar" ? "المدينة الجديدة" : "New city"}</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setJobId("");
              }}
            >
              <option value="">—</option>
              {REGIONS.map((r) => (
                <option key={r.region} value={r.region}>
                  {regionLabel(r.region, lang)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{lang === "ar" ? "الوظيفة (اختياري)" : "Job (optional)"}</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
            >
              <option value="">—</option>
              {filteredJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} — {regionLabel(j.region, lang)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {lang === "ar" ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={save} disabled={saving}>
            {lang === "ar" ? "نقل" : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const Route = createFileRoute("/_app/candidates")({
  component: CandidatesPage,
});
