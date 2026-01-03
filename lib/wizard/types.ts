export type FatigueProfile = "low" | "medium" | "high";

export type EquipmentOption = "barbell" | "dumbbell" | "cables" | "machines" | "home-gym";

export type WizardInjury = {
  name: string;
  severity: number;
  notes?: string;
};

export type SelectedProgram = {
  template_id: number;
  weight_override?: number;
};

export type WizardPayload = {
  user_id: string;
  injuries: WizardInjury[];
  fatigue_profile: FatigueProfile;
  equipment_profile?: EquipmentOption[];
  selected_programs: SelectedProgram[];
  days_per_week: number;
  max_session_minutes?: number;
  preferred_days?: string[];
  confirm_overwrite?: boolean;
};

export type TemplateSummary = {
  id: number;
  name: string;
  methodology: string | null;
  disciplines: string[];
  estimatedSets: number;
  sessionCount: number;
  focusHint: string;
};

export type PreviewWarning =
  | { type: "under_target"; message: string }
  | { type: "recovery_load"; message: string }
  | { type: "injury_reduction"; message: string };

export type PreviewResult = {
  seed: string;
  weeklySets: { muscleGroup: string; sets: number }[];
  recoveryLoad: number;
  warnings: PreviewWarning[];
  removedSlots: number;
};

export type PlannedSession = {
  date: string;
  label: string;
  program_session_key: string;
  template_id: number;
  focus: string;
};

export type ActiveProgramSnapshot = {
  seed: string;
  generated_at: string;
  fatigue_profile: FatigueProfile;
  equipment_profile?: EquipmentOption[];
  days_per_week: number;
  max_session_minutes?: number;
  preferred_days?: string[];
  injuries: WizardInjury[];
  selected_programs: SelectedProgram[];
  schedule: PlannedSession[];
  decisions_log: string[];
  preview: PreviewResult;
};
