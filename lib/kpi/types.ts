export type WeekCompletion = {
  week_start: string;
  completed: number;
  total: number;
  rate: number;
};

export type PatternTonnage = {
  week_start: string;
  pattern: string;
  tonnage: number;
};

export type MuscleTonnage = {
  week_start: string;
  muscle_group_id: number;
  muscle_group: string;
  tonnage: number;
};

export type E1RMPoint = {
  week_start: string;
  e1rm: number;
};

export type DotsScore = {
  score: number | null;
  total: number | null;
  status: "ok" | "needs_data";
  bodyweight: number | null;
};

export type FatigueFlags = {
  volume_spike: boolean;
  volume_change: number | null;
  rpe_rising: boolean;
  rpe_change: number | null;
  pain_rising: boolean;
  pain_delta: number | null;
};

export type KpiResponse = {
  completion: {
    weeks: WeekCompletion[];
    current_streak: number;
    longest_streak: number;
  };
  tonnage_by_pattern: PatternTonnage[];
  tonnage_by_muscle: MuscleTonnage[];
  e1rm: {
    squat: E1RMPoint[];
    bench: E1RMPoint[];
    deadlift: E1RMPoint[];
  };
  dots: DotsScore;
  fatigue: FatigueFlags;
};
