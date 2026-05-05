import { saveAs } from "file-saver";

export type ExportJob = {
  job_code: string;
  title: string;
  region: string;
  branch: string;
  headcount: number;
  hired_count: number;
  status: string;
};

const HEADERS = [
  ["#", "#"],
  ["Job Code", "رمز الوظيفة"],
  ["Title", "المسمى الوظيفي"],
  ["Region", "المنطقة"],
  ["Branch", "الفرع"],
  ["Headcount", "العدد المطلوب"],
  ["Hired", "تم التعيين"],
  ["Remaining", "المتبقي"],
  ["Status", "الحالة"],
  ["Priority", "الأولوية"],
];

const escape = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportJobsToCsv(jobs: ExportJob[]) {
  const header = HEADERS.map(([en, ar]) => `${en} / ${ar}`).map(escape).join(",");
  const rows = jobs.map((j, i) =>
    [
      i + 1,
      j.job_code,
      j.title,
      j.region,
      j.branch,
      j.headcount,
      j.hired_count,
      Math.max(0, j.headcount - j.hired_count),
      j.status,
      j.priority,
    ]
      .map(escape)
      .join(","),
  );
  // BOM for Excel UTF-8 (preserves Arabic)
  const csv = "\uFEFF" + [header, ...rows].join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), `Available_Jobs_${stamp}.csv`);
}
