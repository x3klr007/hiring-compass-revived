export type RegionPlan = {
  region: string;
  name_ar: string;
  classification: "Existing + Admin" | "Existing Branch" | "New Branch";
  targetJobs: number;
  classrooms: number;
  students: number;
};

export const REGIONS: RegionPlan[] = [
  { region: "Riyadh",           name_ar: "الرياض",         classification: "Existing + Admin", targetJobs: 7, classrooms: 15, students: 300 },
  { region: "Jeddah",           name_ar: "جدة",            classification: "Existing Branch",  targetJobs: 2, classrooms: 12, students: 240 },
  { region: "Qassim",           name_ar: "القصيم",         classification: "Existing Branch",  targetJobs: 2, classrooms: 12, students: 240 },
  { region: "Eastern Province", name_ar: "المنطقة الشرقية", classification: "Existing Branch",  targetJobs: 2, classrooms: 12, students: 240 },
  { region: "Madinah",          name_ar: "المدينة المنورة", classification: "Existing Branch",  targetJobs: 2, classrooms: 12, students: 240 },
  { region: "Hail",             name_ar: "حائل",           classification: "New Branch",       targetJobs: 6, classrooms: 6,  students: 120 },
  { region: "Abha",             name_ar: "أبها",           classification: "New Branch",       targetJobs: 6, classrooms: 6,  students: 120 },
  { region: "Al-Ahsa",          name_ar: "الأحساء",        classification: "New Branch",       targetJobs: 6, classrooms: 6,  students: 120 },
  { region: "Makkah",           name_ar: "مكة المكرمة",    classification: "New Branch",       targetJobs: 6, classrooms: 6,  students: 120 },
  { region: "Jazan",            name_ar: "جازان",          classification: "New Branch",       targetJobs: 6, classrooms: 6,  students: 120 },
];

export const REGION_NAMES = REGIONS.map((r) => r.region);

export function regionLabel(region: string, lang: "ar" | "en"): string {
  const r = REGIONS.find((x) => x.region === region);
  if (!r) return region;
  return lang === "ar" ? r.name_ar : r.region;
}
