/// <reference types="vitest" />
import {
  buildActiveProgramSnapshot,
  buildPreview,
  summarizeTemplate
} from "@/lib/wizard/engine";
import type { WizardPayload } from "@/lib/wizard/types";

const uuid = "00000000-0000-4000-8000-000000000000";

const baseTemplate = {
  id: 1,
  name: "Test Template",
  disciplines: ["hypertrophy"],
  methodology: "dup",
  template_json: {
    microcycle_days: [
      { focus: "Upper", exercises: [{ sets: 4 }, { sets: 3 }] },
      { focus: "Lower", exercises: [{ sets: 5 }] }
    ]
  }
};

const payload: WizardPayload = {
  user_id: uuid,
  injuries: [],
  fatigue_profile: "medium",
  equipment_profile: ["dumbbell"],
  selected_programs: [{ template_id: 1 }],
  days_per_week: 3,
  max_session_minutes: 60,
  preferred_days: ["Tue", "Thu"]
};

describe("wizard engine", () => {
  it("builds preview with warnings for injuries", () => {
    const preview = buildPreview(
      { ...payload, injuries: [{ name: "knee", severity: 4 }] },
      [baseTemplate]
    );

    expect(preview.seed).toHaveLength(12);
    expect(preview.warnings.some((warning) => warning.type === "injury_reduction")).toBe(true);
  });

  it("summarizes templates for UI", () => {
    const summary = summarizeTemplate(baseTemplate);
    expect(summary.estimatedSets).toBeGreaterThan(0);
    expect(summary.sessionCount).toBeGreaterThanOrEqual(2);
  });

  it("respects preferred days when building schedule", () => {
    const { schedule, snapshot } = buildActiveProgramSnapshot(payload, [baseTemplate]);
    expect(schedule).toHaveLength(payload.days_per_week);
    expect(snapshot.selected_programs[0].template_id).toBe(baseTemplate.id);
    expect(schedule[0].label).toContain("Tue");
  });
});
