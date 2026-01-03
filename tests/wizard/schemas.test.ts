/// <reference types="vitest" />
import { normalizeWizardPayload } from "@/lib/wizard/schemas";

const uuid = "00000000-0000-4000-8000-000000000000";

describe("wizard payload schema", () => {
  it("fills defaults for optional fields", () => {
    const result = normalizeWizardPayload({
      user_id: uuid,
      fatigue_profile: "medium",
      selected_programs: [{ template_id: 1 }],
      days_per_week: 3
    });

    expect(result.injuries).toEqual([]);
    expect(result.max_session_minutes).toBe(60);
  });

  it("rejects invalid days per week", () => {
    expect(() =>
      normalizeWizardPayload({
        user_id: uuid,
        fatigue_profile: "medium",
        selected_programs: [{ template_id: 2 }],
        days_per_week: 6
      })
    ).toThrow();
  });
});
