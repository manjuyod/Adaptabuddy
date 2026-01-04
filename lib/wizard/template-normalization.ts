import { z } from "zod";
import type { HypertrophyTemplate } from "./hypertrophy-engine";

const selectionPolicySchema = z.object({
  top_k: z.number().int().positive().default(6),
  softmax_temperature: z.number().positive().default(0.9),
  novelty_decay: z.number().min(0).max(1).default(0.35)
});

const weeklyGoalSchema = z.record(
  z.string(),
  z.object({
    sets: z.number().positive(),
    priority: z.number().positive().default(1)
  })
);

const baseTemplateSchema = z.object({
  engine_version: z.literal("1").default("1"),
  template_type: z.enum(["program", "workout", "block"]).default("program"),
  canonical_name: z.string().min(1),
  tags: z.array(z.string()).default([])
});

const slotBlueprintSchema = z.object({
  slot_key: z.string().min(1),
  movement_pattern: z.string().min(1),
  priority: z.number().positive().default(1),
  min_sets: z.number().int().positive().default(3),
  max_sets: z.number().int().positive().default(3),
  reps_hint: z.tuple([z.number(), z.number()]).default([6, 10] as [number, number]),
  rpe_hint: z.tuple([z.number(), z.number()]).default([6, 9] as [number, number]),
  recovery_cost_per_set: z.number().positive().default(2.5),
  pool_key: z.string().optional(),
  required: z.boolean().default(false)
});

const constraintsSchema = z
  .object({
    avoid_tags: z.array(z.string()).optional(),
    require_equipment: z.array(z.string()).optional()
  })
  .optional();

const workoutSlotSchema = z.object({
  slot_key: z.string().min(1),
  movement_pattern: z.string().min(1),
  target_muscles: z.array(z.string()).optional(),
  priority: z.number().positive().default(1),
  min_sets: z.number().int().positive().default(3),
  max_sets: z.number().int().positive().default(3),
  reps_hint: z.tuple([z.number(), z.number()]).default([8, 12] as [number, number]),
  rpe_hint: z.tuple([z.number(), z.number()]).default([6, 9] as [number, number]),
  recovery_cost_per_set: z.number().positive().default(2.5),
  pool_key: z.string().optional(),
  required: z.boolean().default(false),
  constraints: constraintsSchema
});

export const programTemplateSchema = baseTemplateSchema
  .extend({
    template_type: z.literal("program").default("program"),
    seed_salt: z.string().optional(),
    program_weight_default: z.number().positive().default(1),
    selection_policy: selectionPolicySchema.default({
      top_k: 6,
      softmax_temperature: 0.9,
      novelty_decay: 0.35
    }),
    weekly_goals: z
      .object({
        movement_patterns: weeklyGoalSchema.default({}),
        muscle_groups: weeklyGoalSchema.default({})
      })
      .default({ movement_patterns: {}, muscle_groups: {} }),
    slot_blueprints: z.array(slotBlueprintSchema).min(1, "slot_blueprints required")
  })
  .strict();

export const workoutTemplateSchema = baseTemplateSchema
  .extend({
    template_type: z.literal("workout").default("workout"),
    day_focus: z.array(z.string()).default([]),
    slots: z.array(workoutSlotSchema).min(1, "slots required")
  })
  .strict();

export const blockTemplateSchema = baseTemplateSchema
  .extend({
    template_type: z.literal("block").default("block"),
    slots: z.array(workoutSlotSchema).min(1, "slots required")
  })
  .strict();

export const normalizedTemplateSchema = z.discriminatedUnion("template_type", [
  programTemplateSchema,
  workoutTemplateSchema,
  blockTemplateSchema
]);

export type ProgramTemplateV1 = z.infer<typeof programTemplateSchema>;
export type WorkoutTemplateV1 = z.infer<typeof workoutTemplateSchema>;
export type BlockTemplateV1 = z.infer<typeof blockTemplateSchema>;
export type NormalizedTemplate = z.infer<typeof normalizedTemplateSchema>;

export type TemplateNormalizationResult =
  | { type: "program" | "workout" | "block"; template: NormalizedTemplate }
  | { type: "hypertrophy"; template: HypertrophyTemplate };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const normalizeTemplateJson = (
  value: unknown,
  options?: { fallbackName?: string; defaultType?: "program" | "workout" | "block" }
): TemplateNormalizationResult | null => {
  if (!isRecord(value)) return null;
  if (Array.isArray((value as { pools?: unknown }).pools) && Array.isArray((value as { sessions?: unknown }).sessions)) {
    return { type: "hypertrophy", template: value as HypertrophyTemplate };
  }

  const materialized = {
    ...value,
    engine_version: (value as { engine_version?: unknown }).engine_version ?? "1",
    template_type:
      (value as { template_type?: unknown }).template_type ??
      options?.defaultType ??
      "program",
    canonical_name:
      (value as { canonical_name?: unknown }).canonical_name ??
      options?.fallbackName ??
      "Template",
    tags: Array.isArray((value as { tags?: unknown }).tags)
      ? (value as { tags: unknown }).tags
      : []
  };

  const parsed = normalizedTemplateSchema.safeParse(materialized);
  if (!parsed.success) {
    return null;
  }

  const parsedTemplate = parsed.data;
  return {
    type: parsedTemplate.template_type,
    template: parsedTemplate
  };
};

export const requireProgramTemplates = (
  templates: unknown[],
  options?: { fallbackNames?: string[] }
): ProgramTemplateV1[] => {
  const normalized: ProgramTemplateV1[] = [];
  templates.forEach((entry, index) => {
    const parsed = normalizeTemplateJson(entry, {
      fallbackName: options?.fallbackNames?.[index],
      defaultType: "program"
    });
    if (parsed?.type === "program") {
      normalized.push(parsed.template as ProgramTemplateV1);
    }
  });
  return normalized;
};

export const validateTemplatesAgainstSchema = (templates: unknown[]): void => {
  const failures: string[] = [];
  templates.forEach((value, index) => {
    const parsed = normalizeTemplateJson(value);
    if (!parsed) return;
    if (parsed.type === "hypertrophy") {
      const engineVersion =
        (value as { engine_version?: unknown }).engine_version ??
        (value as { engineVersion?: unknown }).engineVersion;
      if (engineVersion !== "1") {
        failures.push(`Template[${index}] hypertrophy engine missing engine_version 1`);
      }
      return;
    }
    const result = normalizedTemplateSchema.safeParse(parsed.template);
    if (!result.success) {
      failures.push(`Template[${index}] failed validation: ${result.error.message}`);
    }
  });

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
};
