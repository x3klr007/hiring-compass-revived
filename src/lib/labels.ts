// Centralized bilingual labels for roles, branches, and school types.
// Use these helpers everywhere in the UI to keep wording consistent.

export type Lang = "ar" | "en";

// Authoritative role list — only these four titles are valid in the system.
export const ROLE_TITLES = [
  "Trainer",
  "Expert Trainer",
  "Admin Supervisor",
  "Head Office",
] as const;
export type RoleTitle = (typeof ROLE_TITLES)[number];

const ROLE_AR: Record<string, string> = {
  "Trainer": "مدرب مراحل",
  "Expert Trainer": "مدرب خبير",
  "Admin Supervisor": "مشرف إداري",
  "Head Office": "الإدارة الرئيسية",
  // Legacy aliases (kept for backward compatibility while data is migrated)
  "Stage Trainer": "مدرب مراحل",
  "Headquarters": "الإدارة الرئيسية",
  "Central Admin": "الإدارة الرئيسية",
};

const ROLE_EN_NORMALIZE: Record<string, string> = {
  "Stage Trainer": "Trainer",
  "Headquarters": "Head Office",
  "Central Admin": "Head Office",
};

const BRANCH_AR: Record<string, string> = {
  "Head Office": "الإدارة الرئيسية",
  "Headquarters": "الإدارة الرئيسية",
  "Boys School": "مدارس بنين",
  "Girls School": "مدارس بنات",
};

export function roleLabel(title: string, lang: Lang): string {
  const canonical = ROLE_EN_NORMALIZE[title] ?? title;
  if (lang === "ar") return ROLE_AR[canonical] ?? ROLE_AR[title] ?? canonical;
  return canonical;
}

export function branchLabel(branch: string, lang: Lang): string {
  const canonical = branch === "Headquarters" ? "Head Office" : branch;
  if (lang === "ar") return BRANCH_AR[canonical] ?? BRANCH_AR[branch] ?? canonical;
  return canonical;
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
