/// <reference types="vitest" />
import { deriveReshuffledSeed, deriveWeekKeyFromSchedule, resolveTrainingDays } from "@/lib/train/reschedule";
import type { ActiveProgramSnapshot, PlannedSession } from "@/lib/wizard/types";

const baseProgram: ActiveProgramSnapshot = {
  seed: "seed12345678",
  seed_strategy: "static",
  plan_id: "plan-1234",
  week_key: "2026-01-05",
  restart_counter: 0,
  generated_at: new Date().toISOString(),
  fatigue_profile: "medium",
  days_per_week: 3,
  injuries: [],
  selected_programs: [{ template_id: 1 }],
  schedule: [],
  decisions_log: [],
  preview: { seed: "seed12345678", weeklySets: [], recoveryLoad: 0, warnings: [], removedSlots: 0 }
};

describe("reschedule helpers", () => {
  it("derives reshuffled seeds deterministically", () => {
    const first = deriveReshuffledSeed("abc", 1);
    const second = deriveReshuffledSeed("abc", 2);
    expect(first).toHaveLength(12);
    expect(second).toHaveLength(12);
    expect(first).not.toEqual(second);
    expect(deriveReshuffledSeed("abc", 1)).toEqual(first);
  });

  it("resolves preferred days with fallback padding", () => {
    const days = resolveTrainingDays({
      ...baseProgram,
      preferred_days: ["Tue", "Thu"],
      days_per_week: 4
    });
    expect(days.slice(0, 2)).toEqual(["Tue", "Thu"]);
    expect(days).toHaveLength(4);
  });

  it("computes a week key from schedule dates", () => {
    const schedule: PlannedSession[] = [
      { date: "2026-01-07", label: "Wed", focus: "Training", template_id: 1, program_session_key: "p1" },
      { date: "2026-01-05", label: "Mon", focus: "Training", template_id: 1, program_session_key: "p2" }
    ];
    expect(deriveWeekKeyFromSchedule(schedule)).toBe("2026-01-05");
  });
});
