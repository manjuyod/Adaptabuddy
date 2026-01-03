export type Contraindication = {
  type?: string | null;
  target?: { muscle_group_ids?: number[] | null } | null;
  replace_severity_min?: number | null;
  avoid_severity_min?: number | null;
  reason?: string | null;
  replacement_hints?: Record<string, unknown> | null;
};

export type WarmEntry =
  | string
  | {
      name?: string;
      title?: string;
      note?: string;
      description?: string;
    }
  | Record<string, unknown>;

export type MediaInfo = {
  image_url?: string | null;
  video_url?: string | null;
  [key: string]: unknown;
};

export type LibraryExercise = {
  id: number;
  canonical_name: string;
  aliases: string[];
  movement_pattern: string;
  equipment: string[];
  is_bodyweight: boolean;
  primary_muscle_group_id: number | null;
  secondary_muscle_group_ids: number[];
  tags: string[];
  contraindications: Contraindication[];
  default_warmups: WarmEntry[];
  default_warmdowns: WarmEntry[];
  media: MediaInfo;
  created_at: string | null;
};

export type MuscleGroup = {
  id: number;
  name: string;
  slug: string;
  region: string;
  parent_id: number | null;
  created_at: string | null;
};
