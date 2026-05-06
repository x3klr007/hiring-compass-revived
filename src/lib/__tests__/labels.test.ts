import { describe, it, expect } from "vitest";
import { ROLE_TITLES, roleLabel, branchLabel } from "@/lib/labels";

describe("approved role titles", () => {
  it("contains exactly the four canonical roles", () => {
    expect([...ROLE_TITLES].sort()).toEqual(
      ["Admin Supervisor", "Expert Trainer", "Head Office", "Trainer"].sort(),
    );
  });

  it("normalizes legacy titles to canonical English labels", () => {
    expect(roleLabel("Stage Trainer", "en")).toBe("Trainer");
    expect(roleLabel("Headquarters", "en")).toBe("Head Office");
    expect(roleLabel("Central Admin", "en")).toBe("Head Office");
  });

  it("returns Arabic labels for canonical titles", () => {
    expect(roleLabel("Trainer", "ar")).toBe("مدرب مراحل");
    expect(roleLabel("Expert Trainer", "ar")).toBe("مدرب خبير");
    expect(roleLabel("Admin Supervisor", "ar")).toBe("مشرف إداري");
    expect(roleLabel("Head Office", "ar")).toBe("الإدارة الرئيسية");
  });

  it("normalizes Headquarters branch to Head Office", () => {
    expect(branchLabel("Headquarters", "en")).toBe("Head Office");
    expect(branchLabel("Headquarters", "ar")).toBe("الإدارة الرئيسية");
  });
});

type Job = { id: string; title: string };
type Candidate = { id: string; job_id: string | null };

describe("candidate ↔ job linkage integrity", () => {
  const jobs: Job[] = [
    { id: "j1", title: "Trainer" },
    { id: "j2", title: "Expert Trainer" },
    { id: "j3", title: "Admin Supervisor" },
    { id: "j4", title: "Head Office" },
  ];

  it("every job uses an approved role title", () => {
    for (const j of jobs) {
      expect(ROLE_TITLES).toContain(j.title as (typeof ROLE_TITLES)[number]);
    }
  });

  it("rejects candidates with empty job_id when linkage is required", () => {
    const candidates: Candidate[] = [
      { id: "c1", job_id: "j1" },
      { id: "c2", job_id: null },
      { id: "c3", job_id: "" },
    ];
    const orphans = candidates.filter((c) => !c.job_id);
    expect(orphans.map((c) => c.id)).toEqual(["c2", "c3"]);
  });

  it("filtering candidates by job only matches approved-role jobs", () => {
    const jobMap = new Map(jobs.map((j) => [j.id, j]));
    const candidates: Candidate[] = [
      { id: "c1", job_id: "j1" },
      { id: "c2", job_id: "j99" }, // dangling
    ];
    const valid = candidates.filter((c) => {
      const j = c.job_id ? jobMap.get(c.job_id) : null;
      return !!j && (ROLE_TITLES as readonly string[]).includes(j.title);
    });
    expect(valid.map((c) => c.id)).toEqual(["c1"]);
  });
});
