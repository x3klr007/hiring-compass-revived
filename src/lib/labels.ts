// Centralized bilingual labels for roles, branches, and school types.
// Use these helpers everywhere in the UI to keep wording consistent.

export type Lang = "ar" | "en";

const ROLE_AR: Record<string, string> = {
  "Stage Trainer": "مدرب مراحل",
  "Expert Trainer": "مدرب خبير",
  "Admin Supervisor": "مشرف إداري",
  "Central Admin": "إداري الإدارة الرئيسية",
  "Training Director": "مدير التدريب",
  "HR Manager": "مدير الموارد البشرية",
  "Operations Manager": "مدير العمليات",
  "QA Manager": "مدير ضمان الجودة",
  "IT Manager": "مدير تقنية المعلومات",
  "Finance Manager": "مدير المالية",
  "Recruitment Coordinator": "منسق التوظيف",
};

const BRANCH_AR: Record<string, string> = {
  "Headquarters": "الإدارة الرئيسية",
  "Boys School": "مدارس بنين",
  "Girls School": "مدارس بنات",
};

export function roleLabel(title: string, lang: Lang): string {
  if (lang === "ar") return ROLE_AR[title] ?? title;
  return title;
}

export function branchLabel(branch: string, lang: Lang): string {
  if (lang === "ar") return BRANCH_AR[branch] ?? branch;
  return branch;
}

export function genderLabel(g: "any" | "male" | "female" | null | undefined, lang: Lang): string {
  if (lang === "ar") {
    if (g === "male") return "مدارس بنين";
    if (g === "female") return "مدارس بنات";
    return "تلقائي / الكل";
  }
  if (g === "male") return "Boys school";
  if (g === "female") return "Girls school";
  return "Auto / All";
}
