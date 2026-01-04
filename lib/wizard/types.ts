export type FatigueProfile = "low" | "medium" | "high";

export type EquipmentOption = "barbell" | "dumbbell" | "cables" | "machines" | "home-gym";

export type WizardInjury = {
  id: string;
  name: string;
  severity: number;
  notes?: string;
};

export type SelectedProgram = {
  template_id: number;
  weight_override?: number;
};

export type PoolSelectionQuery = {
  movement_pattern: string;
  equipment?: string[];
  tags?: string[];
};

export type ExercisePool = {
  pool_key: string;
  selection_query: PoolSelectionQuery;
  fallback_pool_keys: string[];
  default_exercise_names: string[];
};

export type PoolPreference = {
  pool_key: string;
  pinned?: string;
  banned?: string[];
};

export type WeakPointSelection = {
  focus: string;
  option1: string;
  option2?: string;
};

export type SlotDescriptor = {
  slot_key: string;
  pool_key: string;
  movement_pattern: string;
  target_muscles?: string[];
  equipment?: string[];
  tags?: string[];
  sets?: number;
  reps?: number | string;
  rir?: number;
  rpe?: number;
  optional?: boolean;
};

export type ResolvedSlot = {
  slot_key: string;
  pool_key: string;
  exercise_id: number | null;
  exercise_name: string;
  movement_pattern: string | null;
  primary_muscle_group_id: number | null;
  secondary_muscle_group_ids: number[];
  tags: string[];
  sets?: number;
  reps?: number | string | null;
  rir?: number | null;
  rpe?: number | null;
  optional?: boolean;
  skip_reason?: string | null;
};

export type SessionPlan = {
  template_id: number;
  program_session_key: string;
  focus: string;
  label: string;
  week_offset: number;
  slots: ResolvedSlot[];
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
  pool_preferences?: PoolPreference[];
  weak_point_selection?: WeakPointSelection | null;
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
  week?: number;
};

export type ActiveProgramSnapshot = {
  seed: string;
  seed_strategy: "static" | "reshuffle";
  plan_id: string;
  week_key: string;
  restart_counter: number;
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
  pool_preferences?: PoolPreference[];
  weak_point_selection?: WeakPointSelection | null;
  session_plans?: SessionPlan[];
};
