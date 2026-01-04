import { describe, expect, it } from "vitest";
import {
  adaptNextWeek,
  applyWeekRules,
  generateSchedule
} from "@/lib/program/engine";
import type { ActiveProgramSnapshot, SessionPlan } from "@/lib/wizard/types";

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

const template = {
  template_type: "hypertrophy_engine_v1",
  weeks: 4,
  pools: [
    {
      pool_key: "squat_quad",
      selection_query: { movement_pattern: "squat", equipment: ["barbell"], tags: ["hypertrophy", "engine_seed"] },
      fallback_pool_keys: [],
      default_exercise_names: ["Back Squat"]
    },
    {
      pool_key: "vpull_lats",
      selection_query: { movement_pattern: "vertical_pull", equipment: ["bodyweight"], tags: ["hypertrophy", "engine_seed"] },
      fallback_pool_keys: [],
      default_exercise_names: ["Neutral-Grip Pullup"]
    }
  ],
  sessions: [
    {
      session_key: "day1",
      focus: "Lower/Upper",
      slots: [
        { slot_key: "squat", pool_key: "squat_quad", movement_pattern: "squat", sets: 3, rpe: 8 },
        { slot_key: "pull", pool_key: "vpull_lats", movement_pattern: "vertical_pull", sets: 3, rpe: 7 }
      ]
    }
  ]
};

describe("program engine", () => {
  it("builds deterministic schedules", () => {
    const payload = {
      user_id: "00000000-0000-4000-8000-000000000000",
      injuries: [],
      fatigue_profile: "medium" as const,
      equipment_profile: ["barbell"] as const,
      selected_programs: [{ template_id: 1 }],
      days_per_week: 3,
      max_session_minutes: 60
    };

    const planA = generateSchedule({
      template,
      templateId: 1,
      exercises,
      muscleGroups,
      payload,
      seed: "seed123456",
      startWeekKey: "2024-01-01"
    });

    const planB = generateSchedule({
      template,
      templateId: 1,
      exercises,
      muscleGroups,
      payload,
      seed: "seed123456",
      startWeekKey: "2024-01-01"
    });

    expect(planA.planId).toBe(planB.planId);
    expect(planA.schedule.map((s) => s.program_session_key)).toEqual(
      planB.schedule.map((s) => s.program_session_key)
    );
    expect(planA.sessionPlans[0].slots[0].exercise_name).toBe(
      planB.sessionPlans[0].slots[0].exercise_name
    );
  });

  it("applies deload rules and auto-regulation", () => {
    const sessionPlans: SessionPlan[] = [
      {
        template_id: 1,
        program_session_key: "plan_day1",
        focus: "Day 1",
        label: "Day 1",
        week_offset: 0,
        slots: [
          {
            slot_key: "squat",
            pool_key: "squat_quad",
            exercise_id: 10,
            exercise_name: "Back Squat",
            movement_pattern: "squat",
            primary_muscle_group_id: 1,
            secondary_muscle_group_ids: [],
            tags: [],
            sets: 4,
            reps: 8,
            rpe: 8,
            rir: 1
          }
        ]
      }
    ];

    const adjusted = applyWeekRules({
      sessionPlans,
      weekRule: { week: 1, volume_multiplier: 0.75, rpe_ceiling: 7.5, deload: true },
      autoRegulation: { plan_day1_squat: { rpeDelta: -0.5, reason: "overshoot" } }
    });

    expect(adjusted[0].slots[0].sets).toBeLessThan(4);
    expect(adjusted[0].slots[0].rpe).toBeLessThanOrEqual(7.5);
    expect(adjusted[0].slots[0].applied_rules?.length).toBeGreaterThan(0);
  });

  it("adapts next week when fatigue and pain flags appear", () => {
    const payload = {
      user_id: "00000000-0000-4000-8000-000000000000",
      injuries: [],
      fatigue_profile: "medium" as const,
      equipment_profile: ["barbell"] as const,
      selected_programs: [{ template_id: 1 }],
      days_per_week: 2,
      max_session_minutes: 60
    };

    const basePlan = generateSchedule({
      template,
      templateId: 1,
      exercises,
      muscleGroups,
      payload,
      seed: "seed-adapt",
      startWeekKey: "2024-01-01"
    });

    const activeProgram: ActiveProgramSnapshot = {
      seed: "seed-adapt",
      seed_strategy: "static",
      plan_id: basePlan.planId,
      week_key: basePlan.weekKey,
      restart_counter: 0,
      generated_at: new Date().toISOString(),
      fatigue_profile: "medium",
      equipment_profile: ["barbell"],
      days_per_week: 2,
      preferred_days: ["Mon", "Wed"],
      injuries: [],
      selected_programs: [{ template_id: 1 }],
      schedule: basePlan.schedule,
      decisions_log: [],
      preview: {
        seed: "seed-adapt",
        weeklySets: basePlan.preview.weeklySets,
        recoveryLoad: basePlan.preview.recoveryLoad,
        warnings: [],
        removedSlots: basePlan.preview.removedSlots
      },
      pool_preferences: [],
      session_plans: basePlan.sessionPlans
    };

    const performance = [
      {
        exercise_key: `${basePlan.sessionPlans[0].program_session_key}_${basePlan.sessionPlans[0].slots[0].slot_key}`,
        avg_rpe: 9,
        avg_rir: 0,
        pain: 8,
        sets: 4,
        session_date: "2024-01-08"
      }
    ];

    const adaptation = adaptNextWeek({
      activeProgram,
      template,
      templateId: 1,
      performance,
      fatigueHistory: [
        { week: "2023-12-25", sets: 10 },
        { week: "2024-01-01", sets: 16 }
      ],
      payload,
      exercises,
      muscleGroups,
      seed: "seed-adapt"
    });

    expect(adaptation.nextWeekRule.deload).toBe(true);
    expect(adaptation.substitutions.length).toBeGreaterThan(0);
    expect(adaptation.sessionPlans.length).toBeGreaterThan(0);
  });
});
