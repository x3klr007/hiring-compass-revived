import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export type ExportJob = {
  job_code: string;
  title: string;
  region: string;
  branch: string;
  headcount: number;
  hired_count: number;
  status: string;
  priority: string;
};

const REGION_ORDER = [
  "Riyadh", "Jeddah", "Qassim", "Eastern Province", "Madinah",
  "Hail", "Abha", "Al-Ahsa", "Makkah", "Jazan",
];
const BRANCH_ORDER = ["Headquarters", "Boys School", "Girls School"];
const EXISTING = new Set(["Riyadh", "Jeddah", "Qassim", "Eastern Province", "Madinah"]);

const FILLS = {
  title: "FF1F4E78",
  header: "FF4472C4",
  totals: "FF1F3864",
  boys: "FFADD8E6",
  girls: "FFFFB6C1",
  hq: "FFFFE699",
};

function branchClassification(region: string, branch: string) {
  if (branch === "Headquarters") return "Central Admin";
  return EXISTING.has(region) ? "Existing Branch" : "New Branch";
}

function rowFill(branch: string) {
  if (branch === "Headquarters") return FILLS.hq;
  if (branch === "Girls School") return FILLS.girls;
  return FILLS.boys;
}

export async function exportJobsToXlsx(jobs: ExportJob[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Tuwaiq ATS";
  wb.created = new Date();

  const ws = wb.addWorksheet("Available Jobs", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  ws.columns = [
    { width: 6 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 22 },
    { width: 14 }, { width: 8 }, { width: 12 }, { width: 22 },
  ];

  ws.mergeCells("A1:I1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "Available Jobs — Youth Sector";
  titleCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14 };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILLS.title } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 26;

  const headers = ["#", "Region", "Branch", "Stage", "Job Title", "Work Type", "Count", "Status", "Branch Classification"];
  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILLS.header } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = {
      top: { style: "thin", color: { argb: "FFBFBFBF" } },
      bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
      left: { style: "thin", color: { argb: "FFBFBFBF" } },
      right: { style: "thin", color: { argb: "FFBFBFBF" } },
    };
  });
  headerRow.height = 22;

  const sorted = [...jobs].sort((a, b) => {
    const ra = REGION_ORDER.indexOf(a.region);
    const rb = REGION_ORDER.indexOf(b.region);
    if (ra !== rb) return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
    const ba = BRANCH_ORDER.indexOf(a.branch);
    const bb = BRANCH_ORDER.indexOf(b.branch);
    if (ba !== bb) return (ba === -1 ? 999 : ba) - (bb === -1 ? 999 : bb);
    return a.title.localeCompare(b.title);
  });

  const totalCount = sorted.reduce((a, j) => a + (j.headcount || 0), 0);
  const regions = new Set(sorted.map((j) => j.region));
  const branches = new Set(sorted.map((j) => `${j.region}|${j.branch}`));
  const titles = new Set(sorted.map((j) => j.title));
  const totalsRow = ws.getRow(3);
  const totals = [
    "Total",
    `${regions.size} Regions`,
    `${branches.size} Branches + Admin`,
    "-",
    `${titles.size} Titles`,
    "-",
    totalCount,
    `${sorted.filter((j) => j.status === "Open").length} Vacant`,
    "-",
  ];
  totals.forEach((v, i) => {
    const c = totalsRow.getCell(i + 1);
    c.value = v;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILLS.totals } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  totalsRow.height = 20;

  sorted.forEach((j, idx) => {
    const r = ws.addRow([
      idx + 1,
      j.region,
      j.branch,
      j.branch === "Headquarters" ? "-" : "All Stages",
      j.title,
      "Full-time",
      j.headcount,
      j.status === "Open" ? "Vacant" : j.status,
      branchClassification(j.region, j.branch),
    ]);
    const fill = rowFill(j.branch);
    r.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = {
        top: { style: "hair", color: { argb: "FFD9D9D9" } },
        bottom: { style: "hair", color: { argb: "FFD9D9D9" } },
        left: { style: "hair", color: { argb: "FFD9D9D9" } },
        right: { style: "hair", color: { argb: "FFD9D9D9" } },
      };
    });
  });

  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: headers.length } };

  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  saveAs(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Available_Jobs_${stamp}.xlsx`,
  );
}
