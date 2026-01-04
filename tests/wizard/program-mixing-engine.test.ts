import { describe, expect, it } from "vitest";
import { previewPlan } from "@/lib/wizard/program-mixing-engine";
import type { NormalizedProgramTemplate } from "@/lib/wizard/program-mixing-engine";
import type { WizardPayload } from "@/lib/wizard/types";

const muscleGroups = [
  { id: 1, name: "Quads", slug: "quads", region: "Lower", parent_id: null, created_at: null },
  { id: 2, name: "Back", slug: "back", region: "Upper", parent_id: null, created_at: null }
];

const exercises = [
  {
    id: 10,
    canonical_name: "Back Squat",
    aliases: [],
    movement_pattern: "squat",
    equipment: ["barbell"],
    is_bodyweight: false,
    primary_muscle_group_id: 1,
    secondary_muscle_group_ids: [],
    tags: ["strength"],
    contraindications: [
      {
        target: { muscle_group_ids: [1] },
        replace_severity_min: 2,
        avoid_severity_min: 5
      }
    ],
    default_warmups: [],
    default_warmdowns: [],
    media: {},
    created_at: null
  },
  {
    id: 11,
    canonical_name: "Goblet Squat",
    aliases: [],
    movement_pattern: "squat",
    equipment: ["dumbbell"],
    is_bodyweight: false,
    primary_muscle_group_id: 1,
    secondary_muscle_group_ids: [],
    tags: ["hypertrophy"],
    contraindications: [],
    default_warmups: [],
    default_warmdowns: [],
    media: {},
    created_at: null
  },
  {
    id: 12,
    canonical_name: "Barbell Row",
    aliases: [],
    movement_pattern: "horizontal_pull",
    equipment: ["barbell"],
    is_bodyweight: false,
    primary_muscle_group_id: 2,
    secondary_muscle_group_ids: [],
    tags: ["hypertrophy"],
    contraindications: [],
    default_warmups: [],
    default_warmdowns: [],
    media: {},
    created_at: null
  }
];

const baseTemplate: NormalizedProgramTemplate = {
  id: 1,
  engine_version: "1",
  template_type: "program",
  canonical_name: "Test Program",
  tags: ["test"],
  seed_salt: "test",
  program_weight_default: 1,
  selection_policy: { top_k: 3, softmax_temperature: 0.9, novelty_decay: 0.2 },
  weekly_goals: {
    movement_patterns: {
      squat: { sets: 8, priority: 1 },
      horizontal_pull: { sets: 6, priority: 1 }
    },
    muscle_groups: {}
  },
  slot_blueprints: [
    {
      slot_key: "main_squat",
      movement_pattern: "squat",
      priority: 1,
      min_sets: 3,
      max_sets: 4,
      reps_hint: [5, 8],
      rpe_hint: [6, 9],
      recovery_cost_per_set: 10,
      pool_key: "squat_pool",
      required: true
    },
    {
      slot_key: "row_support",
      movement_pattern: "horizontal_pull",
      priority: 0.9,
      min_sets: 3,
      max_sets: 3,
      reps_hint: [8, 12],
      rpe_hint: [6, 8],
      recovery_cost_per_set: 2,
      pool_key: "row_pool",
      required: true
    }
  ]
};

const payload: WizardPayload = {
  user_id: "00000000-0000-4000-8000-000000000000",
  injuries: [],
  fatigue_profile: "low",
  equipment_profile: ["dumbbell"],
  selected_programs: [{ template_id: 1 }],
  days_per_week: 2,
  max_session_minutes: 30
};

describe("program mixing engine v1", () => {
  it("produces deterministic plans for identical inputs", () => {
    const planA = previewPlan({
      payload,
      templates: [baseTemplate],
      exercises,
      muscleGroups
    });
    const planB = previewPlan({
      payload,
      templates: [baseTemplate],
      exercises,
      muscleGroups
    });

    expect(planA.seed).toBe(planB.seed);
    expect(planA.planId).toBe(planB.planId);
    expect(planA.sessionPlans[0].slots[0].exercise_name).toBe(
      planB.sessionPlans[0].slots[0].exercise_name
    );
  });

  it("drops high fatigue slots and avoids injured exercises", () => {
    const plan = previewPlan({
      payload: {
        ...payload,
        injuries: [{ id: "inj", name: "quads", severity: 4 }],
        max_session_minutes: 20
      },
      templates: [baseTemplate],
      exercises,
      muscleGroups
    });

    const squatSlot = plan.sessionPlans[0].slots.find((slot) =>
      slot.slot_key.includes("main_squat")
    );
    expect(squatSlot?.exercise_name).toBe("Goblet Squat");

    expect((squatSlot?.sets ?? 0)).toBeLessThanOrEqual(2);
  });
});
