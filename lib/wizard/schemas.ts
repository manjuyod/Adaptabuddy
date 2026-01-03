import { z } from "zod";
import type {
  EquipmentOption,
  FatigueProfile,
  WizardPayload
} from "./types";

export const equipmentOptions = [
  "barbell",
  "dumbbell",
  "cables",
  "machines",
  "home-gym"
] as const satisfies EquipmentOption[];

export const dayOptions = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const fatigueProfileSchema = z.enum(["low", "medium", "high"]);

export const injurySchema = z.object({
  name: z.string().min(1),
  severity: z.number().int().min(1).max(5),
  notes: z.string().max(200).optional()
});

export const selectedProgramSchema = z.object({
  template_id: z.number().int().positive(),
  weight_override: z.number().min(0.5).max(2).optional()
});

export const wizardPayloadSchema = z.object({
  user_id: z.string().uuid(),
  injuries: z.array(injurySchema).default([]),
  fatigue_profile: fatigueProfileSchema,
  equipment_profile: z.array(z.enum(equipmentOptions)).optional(),
  selected_programs: z
    .array(selectedProgramSchema)
    .min(1, "Pick at least one program template."),
  days_per_week: z.number().int().min(2).max(5),
  max_session_minutes: z.number().int().min(20).max(180).default(60),
  preferred_days: z.array(z.enum(dayOptions)).optional(),
  confirm_overwrite: z.boolean().optional()
});

export type WizardPayloadInput = z.infer<typeof wizardPayloadSchema>;

export const normalizeWizardPayload = (value: unknown): WizardPayload => {
  const parsed = wizardPayloadSchema.parse(value);
  return {
    ...parsed
  };
};

export const fatigueProfiles: FatigueProfile[] = ["low", "medium", "high"];
