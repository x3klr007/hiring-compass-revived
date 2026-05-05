import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type DashboardExportData = {
  generatedAt: Date;
  filters: { region: string; branch: string };
  fillRate: number;
  kpis: { label: string; value: number | string; sub?: string }[];
  byRegion: { region: string; total: number; hired: number }[];
  byRole: [string, number][];
  totals: { headcount: number; hired: number; open: number };
};

export function exportDashboardPdf(data: DashboardExportData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Dashboard Report", margin, 50);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(
    `Generated: ${data.generatedAt.toLocaleString()}`,
    margin,
    68,
  );
  doc.text(
    `Filters — Region: ${data.filters.region} | Branch: ${data.filters.branch}`,
    margin,
    82,
  );

  // Fill rate banner
  doc.setDrawColor(220);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, 100, pageWidth - margin * 2, 60, 6, 6, "F");
  doc.setTextColor(20);
  doc.setFontSize(12);
  doc.text("Vacancy Fill Rate", margin + 16, 122);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.fillRate}%`, margin + 16, 152);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(
    `${data.totals.hired} / ${data.totals.headcount} filled · ${data.totals.open} open`,
    margin + 100,
    152,
  );

  // KPI table
  autoTable(doc, {
    startY: 180,
    head: [["KPI", "Value", "Detail"]],
    body: data.kpis.map((k) => [k.label, String(k.value), k.sub ?? ""]),
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: margin, right: margin },
  });

  // Regional distribution
  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20,
    head: [["Region", "Hired", "Total", "Fill %"]],
    body: data.byRegion.map((r) => [
      r.region,
      String(r.hired),
      String(r.total),
      r.total ? `${Math.round((r.hired / r.total) * 100)}%` : "0%",
    ]),
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129] },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20);
    },
  });

  // By role
  const totalHc = data.totals.headcount || 1;
  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20,
    head: [["Role", "Headcount", "Share"]],
    body: data.byRole.map(([title, count]) => [
      title,
      String(count),
      `${Math.round((count / totalHc) * 100)}%`,
    ]),
    theme: "grid",
    headStyles: { fillColor: [99, 102, 241] },
    margin: { left: margin, right: margin },
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 20,
      { align: "right" },
    );
  }

  const stamp = data.generatedAt.toISOString().slice(0, 10);
  doc.save(`dashboard-report-${stamp}.pdf`);
}
