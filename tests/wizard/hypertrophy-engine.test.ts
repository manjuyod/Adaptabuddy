import { describe, expect, it, vi } from "vitest";
import {
  buildHypertrophyPlan,
  type HypertrophyTemplate,
  __internal
} from "@/lib/wizard/hypertrophy-engine";
import type { WizardInjury } from "@/lib/wizard/types";

const muscleGroups = [
  { id: 1, name: "Quads", slug: "quads", region: "Lower", parent_id: null, created_at: null },
  { id: 2, name: "Lats", slug: "lats", region: "Upper", parent_id: null, created_at: null }
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
    tags: ["hypertrophy", "engine_seed"],
    contraindications: [],
    default_warmups: [],
    default_warmdowns: [],
    media: {},
    created_at: null
  },
  {
    id: 11,
    canonical_name: "Front Squat",
    aliases: [],
    movement_pattern: "squat",
    equipment: ["barbell"],
    is_bodyweight: false,
    primary_muscle_group_id: 1,
    secondary_muscle_group_ids: [],
    tags: ["hypertrophy", "engine_seed"],
    contraindications: [],
    default_warmups: [],
    default_warmdowns: [],
    media: {},
    created_at: null
  },
  {
    id: 12,
    canonical_name: "Neutral-Grip Pullup",
    aliases: [],
    movement_pattern: "vertical_pull",
    equipment: ["bodyweight"],
    is_bodyweight: true,
    primary_muscle_group_id: 2,
    secondary_muscle_group_ids: [],
    tags: ["hypertrophy", "engine_seed"],
    contraindications: [],
    default_warmups: [],
    default_warmdowns: [],
    media: {},
    created_at: null
  }
];

const template: HypertrophyTemplate = {
  template_type: "hypertrophy_engine_v1",
  weeks: 1,
  pools: [
    {
      pool_key: "squat_quad",
      selection_query: {
        movement_pattern: "squat",
        equipment: ["barbell"],
        tags: ["hypertrophy", "engine_seed"]
      },
      fallback_pool_keys: [],
      default_exercise_names: ["Back Squat", "Front Squat"]
    },
    {
      pool_key: "vpull_lats",
      selection_query: {
        movement_pattern: "vertical_pull",
        equipment: ["bodyweight"],
        tags: ["hypertrophy", "engine_seed"]
      },
      fallback_pool_keys: [],
      default_exercise_names: ["Neutral-Grip Pullup"]
    }
  ],
  weak_points: {
    lats: ["Neutral-Grip Pullup", "Half-Kneeling 1-Arm Lat Pulldown"]
  },
  sessions: [
    {
      session_key: "test_session",
      focus: "Test Session",
      slots: [
        {
          slot_key: "squat",
          pool_key: "squat_quad",
          movement_pattern: "squat",
          target_muscles: ["quads"],
          sets: 2
        },
        {
          slot_key: "weak_point_2",
          pool_key: "vpull_lats",
          movement_pattern: "vertical_pull",
          target_muscles: ["lats"],
          optional: true,
          sets: 2
        }
      ]
    }
  ]
};

describe("hypertrophy engine", () => {
  it("respects banned exercises when resolving pools", () => {
    const plan = buildHypertrophyPlan({
      template,
      templateId: 99,
      exercises,
      muscleGroups,
      payload: {
        days_per_week: 2,
        fatigue_profile: "medium",
        max_session_minutes: 60,
        equipment_profile: ["barbell"],
        pool_preferences: [{ pool_key: "squat_quad", banned: ["Back Squat"] }],
        weak_point_selection: { focus: "lats", option1: "Neutral-Grip Pullup" }
      },
      injuries: [],
      seed: "abc123seed"
    });

    const squatSlot = plan.sessionPlans[0].slots.find((slot) => slot.slot_key === "squat");
    expect(squatSlot?.exercise_name).toBe("Front Squat");
  });

  it("skips optional weak point when recovery is limited", () => {
    const injuries: WizardInjury[] = [{ id: "inj-1", name: "shoulder", severity: 5 }];
    const plan = buildHypertrophyPlan({
      template,
      templateId: 100,
      exercises,
      muscleGroups,
      payload: {
        days_per_week: 2,
        fatigue_profile: "medium",
        equipment_profile: ["barbell"],
        max_session_minutes: 60,
        pool_preferences: [],
        weak_point_selection: { focus: "lats", option1: "Neutral-Grip Pullup", option2: "Neutral-Grip Pullup" }
      },
      injuries,
      seed: "seed456789"
    });

    const weakSlot = plan.sessionPlans[0].slots.find((slot) => slot.slot_key === "weak_point_2");
    expect(weakSlot?.skip_reason).toBe("recovery_hold");
    expect(plan.preview.removedSlots).toBeGreaterThan(0);
  });

  it("calculates next date using UTC day to avoid timezone drift", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T01:00:00Z"));

    const nextMonday = __internal.nextDateForDay("Mon");
    expect(nextMonday).toBe("2024-01-08");

    vi.useRealTimers();
  });

  it("adds days without slipping during DST or offset parsing", () => {
    const result = __internal.addDays("2024-03-10", 1);
    expect(result).toBe("2024-03-11");
  });
});
