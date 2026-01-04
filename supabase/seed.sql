-- Consolidated Seed Data
-- Consolidated from agents_prompts/prompts P02 series

BEGIN;

-- 1. Muscle Groups
-- (Using ON CONFLICT to be idempotent)
with mg_seed as (
  select * from (values
    ('upper','Upper','Upper',null),
    ('lower','Lower','Lower',null),
    ('core','Core','Core',null),
    ('chest','Chest','Upper','upper'),
    ('upper-back','Upper Back','Upper','upper'),
    ('lats','Lats','Upper','upper'),
    ('traps','Traps','Upper','upper'),
    ('delts','Delts','Upper','upper'),
    ('biceps','Biceps','Upper','upper'),
    ('triceps','Triceps','Upper','upper'),
    ('forearms','Forearms','Upper','upper'),
    ('rotator-cuff','Rotator Cuff','Upper','upper'),
    ('glutes','Glutes','Lower','lower'),
    ('quads','Quads','Lower','lower'),
    ('hamstrings','Hamstrings','Lower','lower'),
    ('calves','Calves','Lower','lower'),
    ('adductors','Adductors','Lower','lower'),
    ('abductors','Abductors','Lower','lower'),
    ('hip-flexors','Hip Flexors','Lower','lower'),
    ('lower-back','Lower Back','Core','core'),
    ('spinal-erectors','Spinal Erectors','Core','core'),
    ('abdominals','Abdominals','Core','core'),
    ('obliques','Obliques','Core','core'),
    ('chest---clavicular','Chest - Clavicular','Upper','chest'),
    ('chest---sternal','Chest - Sternal','Upper','chest'),
    ('chest---costal','Chest - Costal','Upper','chest'),
    ('delts---anterior','Delts - Anterior','Upper','delts'),
    ('delts---lateral','Delts - Lateral','Upper','delts'),
    ('delts---posterior','Delts - Posterior','Upper','delts'),
    ('traps---upper','Traps - Upper','Upper','traps'),
    ('traps---mid/lower','Traps - Mid/Lower','Upper','traps'),
    ('rhomboids','Rhomboids','Upper','upper-back'),
    ('serratus-anterior','Serratus Anterior','Upper','upper-back'),
    ('biceps---long-head','Biceps - Long Head','Upper','biceps'),
    ('biceps---short-head','Biceps - Short Head','Upper','biceps'),
    ('triceps---long-head','Triceps - Long Head','Upper','triceps'),
    ('triceps---lateral-head','Triceps - Lateral Head','Upper','triceps'),
    ('triceps---medial-head','Triceps - Medial Head','Upper','triceps'),
    ('forearms---flexors','Forearms - Flexors','Upper','forearms'),
    ('forearms---extensors','Forearms - Extensors','Upper','forearms'),
    ('glute-max','Glute Max','Lower','glutes'),
    ('glute-med/min','Glute Med/Min','Lower','glutes'),
    ('quads---vastus-lateralis','Quads - Vastus Lateralis','Lower','quads'),
    ('quads---vastus-medialis','Quads - Vastus Medialis','Lower','quads'),
    ('quads---vastus-intermedius','Quads - Vastus Intermedius','Lower','quads'),
    ('quads---rectus-femoris','Quads - Rectus Femoris','Lower','quads'),
    ('hamstrings---biceps-femoris','Hamstrings - Biceps Femoris','Lower','hamstrings'),
    ('hamstrings---semitendinosus','Hamstrings - Semitendinosus','Lower','hamstrings'),
    ('hamstrings---semimembranosus','Hamstrings - Semimembranosus','Lower','hamstrings'),
    ('calves---gastrocnemius','Calves - Gastrocnemius','Lower','calves'),
    ('calves---soleus','Calves - Soleus','Lower','calves'),
    ('adductors---magnus','Adductors - Magnus','Lower','adductors'),
    ('adductors---longus/brevis','Adductors - Longus/Brevis','Lower','adductors'),
    ('abductors---tfl','Abductors - TFL','Lower','abductors'),
    ('hip-flexors---psoas/iliacus','Hip Flexors - Psoas/Iliacus','Lower','hip-flexors'),
    ('spinal-erectors---lumbar','Spinal Erectors - Lumbar','Core','spinal-erectors'),
    ('spinal-erectors---thoracic','Spinal Erectors - Thoracic','Core','spinal-erectors'),
    ('obliques---internal/external','Obliques - Internal/External','Core','obliques'),
    ('transverse-abdominis','Transverse Abdominis','Core','abdominals'),
    ('rectus-abdominis','Rectus Abdominis','Core','abdominals')
  ) as t(slug, name, region, parent_slug)
),
upsert as (
  insert into public.muscle_groups (slug, name, region)
  select slug, name, region
  from mg_seed
  on conflict (slug) do update
  set name = excluded.name,
      region = excluded.region
  returning slug
)
update public.muscle_groups child
set parent_id = parent.id
from mg_seed s
join public.muscle_groups parent on parent.slug = s.parent_slug
where child.slug = s.slug
  and s.parent_slug is not null;


-- 2. Exercises
-- We use a CTE map to resolve the legacy integer IDs used in the original P02_03 prompt
-- to the actual IDs generated in the database (via slug lookup).
WITH legacy_map (old_id, slug) AS (
  VALUES
    (1, 'upper'), (2, 'lower'), (3, 'core'), (4, 'chest'), (5, 'upper-back'),
    (6, 'lats'), (7, 'traps'), (8, 'delts'), (9, 'biceps'), (10, 'triceps'),
    (11, 'forearms'), (12, 'rotator-cuff'), (13, 'glutes'), (14, 'quads'), (15, 'hamstrings'),
    (16, 'calves'), (17, 'adductors'), (18, 'abductors'), (19, 'hip-flexors'), (20, 'lower-back'),
    (21, 'spinal-erectors'), (22, 'abdominals'), (23, 'obliques'), (24, 'chest---clavicular'), (25, 'chest---sternal'),
    (26, 'chest---costal'), (27, 'delts---anterior'), (28, 'delts---lateral'), (29, 'delts---posterior'), (30, 'traps---upper'),
    (31, 'traps---mid/lower'), (32, 'rhomboids'), (33, 'serratus-anterior'), (34, 'biceps---long-head'), (35, 'biceps---short-head'),
    (36, 'triceps---long-head'), (37, 'triceps---lateral-head'), (38, 'triceps---medial-head'), (39, 'forearms---flexors'), (40, 'forearms---extensors'),
    (41, 'glute-max'), (42, 'glute-med/min'), (43, 'quads---vastus-lateralis'), (44, 'quads---vastus-medialis'), (45, 'quads---vastus-intermedius'),
    (46, 'quads---rectus-femoris'), (47, 'hamstrings---biceps-femoris'), (48, 'hamstrings---semitendinosus'), (49, 'hamstrings---semimembranosus'), (50, 'calves---gastrocnemius'),
    (51, 'calves---soleus'), (52, 'adductors---magnus'), (53, 'adductors---longus/brevis'), (54, 'abductors---tfl'), (55, 'hip-flexors---psoas/iliacus'),
    (56, 'spinal-erectors---lumbar'), (57, 'spinal-erectors---thoracic'), (58, 'obliques---internal/external'), (59, 'transverse-abdominis'), (60, 'rectus-abdominis')
),
real_ids AS (
  SELECT m.old_id, g.id as real_id
  FROM legacy_map m
  JOIN public.muscle_groups g ON g.slug = m.slug
),
raw_exercises (canonical_name, aliases, movement_pattern, equipment, is_bodyweight, primary_old_id, secondary_old_ids, tags, contraindications, default_warmups, default_warmdowns, media) AS (
  VALUES
  -- (From P02_03)
  ('1-Arm DB Row', '{}'::text[], 'horizontal_pull', ARRAY['dumbbell']::text[], false, 5, ARRAY[6,9,29]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('1-Arm Lat Pulldown', '{}'::text[], 'vertical_pull', ARRAY['cable','machine']::text[], false, 6, ARRAY[9,5]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Arnold Press', '{}'::text[], 'vertical_press', ARRAY['dumbbell']::text[], false, 27, ARRAY[10,8]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Assisted Dip', '{}'::text[], 'horizontal_press', ARRAY['machine']::text[], false, 4, ARRAY[10,27]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Assisted Pull-Up', '{}'::text[], 'vertical_pull', ARRAY['machine']::text[], false, 6, ARRAY[9,5]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Back Squat', '{}'::text[], 'squat', ARRAY['barbell']::text[], false, 14, ARRAY[13,15,21]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Bar Curl', '{}'::text[], 'elbow_flexion', ARRAY['dumbbell']::text[], false, 9, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Barbell Bench Press', '{}'::text[], 'horizontal_press', ARRAY['barbell']::text[], false, 4, ARRAY[10,27]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Barbell Row', '{}'::text[], 'horizontal_pull', ARRAY['barbell']::text[], false, 5, ARRAY[6,9,29]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Barbell RDL', '{}'::text[], 'hinge', ARRAY['barbell']::text[], false, 15, ARRAY[13,20]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Bayesian Curl', ARRAY['Behind-the-Back Cable Curl','Face Away Cable Curl']::text[], 'elbow_flexion', ARRAY['cable']::text[], false, 9, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Belt Squat', '{}'::text[], 'squat', ARRAY['machine']::text[], false, 14, ARRAY[13,15]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Bench Dip', '{}'::text[], 'horizontal_press', ARRAY['bodyweight']::text[], true, 4, ARRAY[10,27]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Bicycle Crunch', '{}'::text[], 'core_flexion', ARRAY['bodyweight']::text[], true, 22, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Cable Crunch', '{}'::text[], 'core_flexion', ARRAY['cable']::text[], false, 22, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Cable Curl', '{}'::text[], 'elbow_flexion', ARRAY['cable']::text[], false, 9, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Cable Flye', '{}'::text[], 'horizontal_press', ARRAY['cable']::text[], false, 4, ARRAY[10,27]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Cable Row', '{}'::text[], 'horizontal_pull', ARRAY['cable']::text[], false, 5, ARRAY[6,9,29]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Cable Upright Row', '{}'::text[], 'horizontal_pull', ARRAY['cable']::text[], false, 5, ARRAY[6,9,29]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Chest-Supported T-Bar Row', '{}'::text[], 'horizontal_pull', ARRAY['dumbbell']::text[], false, 5, ARRAY[6,9,29]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Concentration Curl', '{}'::text[], 'elbow_flexion', ARRAY['dumbbell']::text[], false, 9, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Conventional Deadlift', '{}'::text[], 'hinge', ARRAY['barbell']::text[], false, 15, ARRAY[13,21]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Copenhagen Hip Adduction', '{}'::text[], 'hip_adduction', ARRAY['bodyweight']::text[], true, 17, ARRAY[3,13]::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Cross-Body Cable Y-Raise', '{}'::text[], 'isolation', ARRAY['cable']::text[], false, 8, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Cuffed Behind-the-Back Lateral Raise', '{}'::text[], 'isolation', ARRAY['cable']::text[], false, 28, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('DB Bulgarian Split Squat', ARRAY['Dumbbell Bulgarian Split Squat','Bulgarian Split Squat (DB)']::text[], 'squat', ARRAY['dumbbell']::text[], false, 14, ARRAY[13]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('DB Calf Jumps', '{}'::text[], 'calf', ARRAY['dumbbell']::text[], false, 16, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('DB Flye', '{}'::text[], 'horizontal_press', ARRAY['dumbbell']::text[], false, 4, ARRAY[10,27]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('DB Incline Curl', '{}'::text[], 'elbow_flexion', ARRAY['dumbbell']::text[], false, 9, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('DB Lateral Raise', '{}'::text[], 'isolation', ARRAY['dumbbell']::text[], false, 28, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('DB Preacher Curl', '{}'::text[], 'elbow_flexion', ARRAY['dumbbell']::text[], false, 9, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('DB Reverse Lunge', '{}'::text[], 'squat', ARRAY['dumbbell']::text[], false, 14, ARRAY[13]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('DB Row', '{}'::text[], 'horizontal_pull', ARRAY['dumbbell']::text[], false, 5, ARRAY[6,9,29]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('DB Scott Curl', '{}'::text[], 'elbow_flexion', ARRAY['dumbbell']::text[], false, 9, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('DB Shrug', '{}'::text[], 'isolation', ARRAY['dumbbell']::text[], false, 30, ARRAY[7]::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('DB Skull Crusher', '{}'::text[], 'elbow_extension', ARRAY['dumbbell']::text[], false, 10, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('DB Step-Up', '{}'::text[], 'squat', ARRAY['dumbbell']::text[], false, 14, ARRAY[13]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('DB Triceps Extension', '{}'::text[], 'elbow_extension', ARRAY['dumbbell']::text[], false, 10, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Dead Bug', '{}'::text[], 'core_flexion', ARRAY['dumbbell']::text[], false, 22, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Dip', '{}'::text[], 'horizontal_press', ARRAY['bodyweight']::text[], true, 4, ARRAY[10,27]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Donkey Calf Raise', '{}'::text[], 'calf', ARRAY['machine']::text[], false, 16, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Dumbbell Curl', '{}'::text[], 'elbow_flexion', ARRAY['dumbbell']::text[], false, 9, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Dumbbell RDL', '{}'::text[], 'hinge', ARRAY['dumbbell']::text[], false, 15, ARRAY[13,20]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Face Pull', '{}'::text[], 'horizontal_pull', ARRAY['cable']::text[], false, 29, ARRAY[5]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Fat-Grip DB Curl', '{}'::text[], 'elbow_flexion', ARRAY['dumbbell']::text[], false, 9, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Flat DB Press', '{}'::text[], 'horizontal_press', ARRAY['dumbbell']::text[], false, 4, ARRAY[10,27]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Front Squat', '{}'::text[], 'squat', ARRAY['barbell']::text[], false, 14, ARRAY[13,15]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Glute Bridge', '{}'::text[], 'hinge', '{}'::text[], false, 13, ARRAY[15]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Glute-Ham Raise', '{}'::text[], 'hinge', '{}'::text[], false, 15, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Goblet Squat', '{}'::text[], 'squat', '{}'::text[], false, 14, ARRAY[13,15]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Hack Squat', '{}'::text[], 'squat', ARRAY['machine']::text[], false, 14, ARRAY[13,15]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Half-Kneeling 1-Arm Lat Pulldown', '{}'::text[], 'vertical_pull', ARRAY['cable','machine']::text[], false, 6, ARRAY[9,5]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Hammer Curl', '{}'::text[], 'elbow_flexion', ARRAY['dumbbell']::text[], false, 9, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Hanging Knee Raise', '{}'::text[], 'core_flexion', ARRAY['bodyweight']::text[], true, 22, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Hanging Leg Raise', '{}'::text[], 'core_flexion', ARRAY['bodyweight']::text[], true, 22, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Helms Row', ARRAY['Helms Row (Chest Supported)','Chest Supported DB Row']::text[], 'horizontal_pull', ARRAY['dumbbell']::text[], false, 5, ARRAY[6,9,29]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('High-Bar Back Squat', '{}'::text[], 'squat', ARRAY['barbell']::text[], false, 14, ARRAY[13,15]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Hip Thrust', '{}'::text[], 'hinge', '{}'::text[], false, 13, ARRAY[15]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Incline Curl', '{}'::text[], 'elbow_flexion', ARRAY['dumbbell']::text[], false, 9, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Incline DB Press', '{}'::text[], 'horizontal_press', ARRAY['dumbbell']::text[], false, 4, ARRAY[10,27]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Kelso Shrug', ARRAY['Kelso Shrugs','Chest-Supported Shrug']::text[], 'isolation', ARRAY['dumbbell','barbell','machine']::text[], false, 30, ARRAY[7]::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Lat Pulldown', '{}'::text[], 'vertical_pull', ARRAY['cable','machine']::text[], false, 6, ARRAY[9,5]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Leg Extension', '{}'::text[], 'knee_extension', '{}'::text[], false, 14, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Leg Press', '{}'::text[], 'squat', ARRAY['machine']::text[], false, 14, ARRAY[13,15]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Leg Press Calf Raise', '{}'::text[], 'calf', ARRAY['machine']::text[], false, 16, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Lying Leg Curl', '{}'::text[], 'knee_flexion', ARRAY['machine']::text[], false, 15, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),  ('Machine Chest Press', '{}'::text[], 'horizontal_press', ARRAY['machine']::text[], false, 4, ARRAY[10,27]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Machine Crunch', '{}'::text[], 'core_flexion', ARRAY['machine']::text[], false, 22, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Machine Hip Abduction', '{}'::text[], 'hip_abduction', ARRAY['machine']::text[], false, 18, ARRAY[13]::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Machine Hip Adduction', '{}'::text[], 'hip_adduction', ARRAY['machine']::text[], false, 17, ARRAY[3,13]::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Machine Lat Pullover', '{}'::text[], 'vertical_pull', ARRAY['machine']::text[], false, 6, ARRAY[9,5]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Machine Lateral Raise', '{}'::text[], 'isolation', ARRAY['machine']::text[], false, 28, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Machine Pulldown', '{}'::text[], 'vertical_pull', ARRAY['machine']::text[], false, 6, ARRAY[9,5]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Machine Row', '{}'::text[], 'horizontal_pull', ARRAY['machine']::text[], false, 5, ARRAY[6,9,29]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Machine Shoulder Press', '{}'::text[], 'vertical_press', ARRAY['machine']::text[], false, 27, ARRAY[10,8]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Machine Shrug', '{}'::text[], 'isolation', ARRAY['machine']::text[], false, 30, ARRAY[7]::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Neutral-Grip Pullup', ARRAY['Neutral Grip Pull-Up','Neutral Grip Pullup']::text[], 'vertical_pull', ARRAY['bodyweight']::text[], true, 6, ARRAY[9,5]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Nordic Ham Curl', '{}'::text[], 'knee_flexion', ARRAY['bodyweight']::text[], true, 15, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Overhead Tricep Rope Extension', '{}'::text[], 'elbow_extension', ARRAY['cable']::text[], false, 10, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Overhead Press', '{}'::text[], 'vertical_press', ARRAY['barbell']::text[], false, 27, ARRAY[10,8]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Paused DB RDL', ARRAY['Paused Dumbbell Romanian Deadlift']::text[], 'hinge', ARRAY['dumbbell']::text[], false, 15, ARRAY[13,20]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Pec Deck', '{}'::text[], 'horizontal_press', ARRAY['machine']::text[], false, 4, ARRAY[10,27]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Plate-Loaded Neck Curls', '{}'::text[], 'elbow_flexion', ARRAY['plate']::text[], false, 9, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Plate-Weighted Crunch', '{}'::text[], 'core_flexion', ARRAY['plate']::text[], false, 22, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Preacher Curl', '{}'::text[], 'elbow_flexion', ARRAY['dumbbell']::text[], false, 9, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Pull-Up', '{}'::text[], 'vertical_pull', ARRAY['bodyweight']::text[], true, 6, ARRAY[9,5]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Push-Up', '{}'::text[], 'horizontal_press', ARRAY['bodyweight']::text[], true, 4, ARRAY[10,27]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Reverse Crunch', '{}'::text[], 'core_flexion', ARRAY['bodyweight']::text[], true, 22, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Sit-Up', '{}'::text[], 'core_flexion', ARRAY['bodyweight']::text[], true, 22, ARRAY[23]::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Romanian Deadlift', '{}'::text[], 'hinge', '{}'::text[], false, 15, ARRAY[13,20]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Rope Face Pull', '{}'::text[], 'horizontal_pull', ARRAY['cable']::text[], false, 29, ARRAY[5]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Rope Pushdown', '{}'::text[], 'elbow_extension', ARRAY['cable']::text[], false, 10, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Scott Curl', '{}'::text[], 'elbow_flexion', ARRAY['dumbbell']::text[], false, 9, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Seated Barbell Shoulder Press', '{}'::text[], 'vertical_press', ARRAY['barbell']::text[], false, 27, ARRAY[10,8]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Seated Calf Raise', '{}'::text[], 'calf', '{}'::text[], false, 16, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Seated Leg Curl', '{}'::text[], 'knee_flexion', ARRAY['machine']::text[], false, 15, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Single-Leg DB Hip Thrust', '{}'::text[], 'hinge', ARRAY['dumbbell']::text[], false, 13, ARRAY[15]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),  ('Sissy Squat', '{}'::text[], 'squat', '{}'::text[], false, 14, ARRAY[13,15]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Skull Crusher', '{}'::text[], 'elbow_extension', ARRAY['dumbbell']::text[], false, 10, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Smith Machine Bench Press', '{}'::text[], 'horizontal_press', ARRAY['smith_machine']::text[], false, 4, ARRAY[10,27]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Smith Machine Shoulder Press', '{}'::text[], 'vertical_press', ARRAY['smith_machine']::text[], false, 27, ARRAY[10,8]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Spider Curl', '{}'::text[], 'elbow_flexion', ARRAY['dumbbell']::text[], false, 9, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Standing Calf Raise', '{}'::text[], 'calf', '{}'::text[], false, 16, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Standing DB Arnold Press', '{}'::text[], 'vertical_press', ARRAY['dumbbell']::text[], false, 27, ARRAY[10,8]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Step-Up', '{}'::text[], 'squat', '{}'::text[], false, 14, ARRAY[13]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Supported Row', '{}'::text[], 'horizontal_pull', ARRAY['dumbbell']::text[], false, 5, ARRAY[6,9,29]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('T-Bar Row', '{}'::text[], 'horizontal_pull', ARRAY['dumbbell']::text[], false, 5, ARRAY[6,9,29]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('T-Bar Row + Kelso Shrug', '{}'::text[], 'horizontal_pull', ARRAY['dumbbell']::text[], false, 5, ARRAY[6,9,29]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Triceps Extension', '{}'::text[], 'elbow_extension', ARRAY['dumbbell']::text[], false, 10, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Triceps Pushdown', '{}'::text[], 'elbow_extension', ARRAY['cable']::text[], false, 10, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Upright Row', '{}'::text[], 'horizontal_pull', ARRAY['dumbbell']::text[], false, 5, ARRAY[6,9,29]::int[], ARRAY['hypertrophy','engine_seed','nippard','compound']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Y-Raise', '{}'::text[], 'isolation', '{}'::text[], false, 8, '{}'::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Zottman Curl', '{}'::text[], 'elbow_flexion', ARRAY['dumbbell']::text[], false, 9, ARRAY[11]::int[], ARRAY['hypertrophy','engine_seed','nippard','isolation']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  -- (Cardio Additions)
  ('HIIT', ARRAY['High-Intensity Interval Training','Intervals']::text[], 'conditioning', ARRAY['bodyweight']::text[], true, 3, ARRAY[1,2]::int[], ARRAY['cardio','conditioning']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Zone 2 Cardio', ARRAY['Zone2','Aerobic Base']::text[], 'conditioning', ARRAY['machine','bodyweight']::text[], true, 3, ARRAY[1,2]::int[], ARRAY['cardio','conditioning']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Incline Treadmill Walk', ARRAY['Incline Walk']::text[], 'conditioning', ARRAY['treadmill']::text[], true, 3, ARRAY[1,2]::int[], ARRAY['cardio','conditioning']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Stationary Bike', ARRAY['Bike']::text[], 'conditioning', ARRAY['bike']::text[], true, 3, ARRAY[1,2]::int[], ARRAY['cardio','conditioning']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Stair Climber', ARRAY['Stairmaster']::text[], 'conditioning', ARRAY['stair_climber']::text[], true, 3, ARRAY[1,2]::int[], ARRAY['cardio','conditioning']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Elliptical', ARRAY['Cross Trainer']::text[], 'conditioning', ARRAY['elliptical']::text[], true, 3, ARRAY[1,2]::int[], ARRAY['cardio','conditioning']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Jump Rope', ARRAY['Skipping']::text[], 'conditioning', ARRAY['jump_rope']::text[], true, 3, ARRAY[1,2]::int[], ARRAY['cardio','conditioning']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
  ('Battle Ropes', ARRAY['Rope Slams']::text[], 'conditioning', ARRAY['battle_ropes']::text[], true, 3, ARRAY[1,2]::int[], ARRAY['cardio','conditioning']::text[], '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb)

)
INSERT INTO public.exercises (
  canonical_name, aliases, movement_pattern, equipment, is_bodyweight,
  primary_muscle_group_id, secondary_muscle_group_ids, tags,
  contraindications, default_warmups, default_warmdowns, media
)
SELECT
  r.canonical_name,
  r.aliases,
  r.movement_pattern,
  r.equipment,
  r.is_bodyweight,
  pm.real_id as primary_muscle_group_id,
  -- Resolve array of secondary IDs:
  ARRAY(
    SELECT sm.real_id
    FROM unnest(r.secondary_old_ids) AS sid
    JOIN real_ids sm ON sm.old_id = sid
  ),
  r.tags,
  r.contraindications,
  r.default_warmups,
  r.default_warmdowns,
  r.media
FROM raw_exercises r
LEFT JOIN real_ids pm ON pm.old_id = r.primary_old_id
ON CONFLICT (canonical_name) DO UPDATE SET
  aliases = excluded.aliases,
  movement_pattern = excluded.movement_pattern,
  equipment = excluded.equipment,
  is_bodyweight = excluded.is_bodyweight,
  primary_muscle_group_id = excluded.primary_muscle_group_id,
  secondary_muscle_group_ids = excluded.secondary_muscle_group_ids,
  tags = excluded.tags;

-- 2b. Additional exercises and slots
-- =========================================================
-- 1) Lookup muscle group IDs (by NAME - matches your constraints)
-- =========================================================
WITH mg AS (
  SELECT name, id FROM public.muscle_groups
),
lookup AS (
  SELECT
    MAX(id) FILTER (WHERE name='Chest') AS chest_id,
    MAX(id) FILTER (WHERE name='Chest - Sternal') AS chest_sternal_id,
    MAX(id) FILTER (WHERE name='Chest - Clavicular') AS chest_clavicular_id,
    MAX(id) FILTER (WHERE name='Chest - Costal') AS chest_costal_id,
    MAX(id) FILTER (WHERE name='Delts') AS delts_id,
    MAX(id) FILTER (WHERE name='Delts - Anterior') AS delts_ant_id,
    MAX(id) FILTER (WHERE name='Delts - Lateral') AS delts_lat_id,
    MAX(id) FILTER (WHERE name='Delts - Posterior') AS delts_post_id,
    MAX(id) FILTER (WHERE name='Triceps') AS triceps_id,
    MAX(id) FILTER (WHERE name='Biceps') AS biceps_id,
    MAX(id) FILTER (WHERE name='Forearms') AS forearms_id,
    MAX(id) FILTER (WHERE name='Upper Back') AS upper_back_id,
    MAX(id) FILTER (WHERE name='Lats') AS lats_id,
    MAX(id) FILTER (WHERE name='Traps') AS traps_id,
    MAX(id) FILTER (WHERE name='Quads') AS quads_id,
    MAX(id) FILTER (WHERE name='Hamstrings') AS hams_id,
    MAX(id) FILTER (WHERE name='Glutes') AS glutes_id,
    MAX(id) FILTER (WHERE name='Adductors') AS adductors_id,
    MAX(id) FILTER (WHERE name='Abdominals') AS abs_id,
    MAX(id) FILTER (WHERE name='Obliques') AS obliques_id,
    MAX(id) FILTER (WHERE name='Spinal Erectors') AS erectors_id,
    MAX(id) FILTER (WHERE name='Lower Back') AS lowback_id,
    MAX(id) FILTER (WHERE name='Rotator Cuff') AS rotcuff_id
  FROM mg
)
INSERT INTO public.exercises (
  canonical_name, aliases, movement_pattern, equipment, is_bodyweight,
  primary_muscle_group_id, secondary_muscle_group_ids,
  tags, contraindications, default_warmups, default_warmdowns, media
)
SELECT
  e.canonical_name,
  e.aliases,
  e.movement_pattern,
  e.equipment,
  e.is_bodyweight,
  e.primary_id,
  e.secondary_ids,
  e.tags,
  e.contraindications,
  e.default_warmups,
  e.default_warmdowns,
  e.media
FROM lookup l
CROSS JOIN LATERAL (
  VALUES
  -- Main lifts / comp labels
  ('Comp Squat', ARRAY['Back Squat','Squat'], 'squat', ARRAY['barbell','rack'], FALSE,
    l.quads_id, ARRAY_REMOVE(ARRAY[l.glutes_id,l.hams_id,l.erectors_id],NULL),
    ARRAY['main_lift','powerlifting','squat','strength'],
    '[{"body_part":"knee","min_severity":3,"reason":"swap to belt squat/leg press/box squat"}]'::jsonb,
    '[]'::jsonb,'[]'::jsonb,'{"image_url":"","video_url":""}'::jsonb
  ),
  ('Comp Bench Press', ARRAY['Bench Press','BB Bench'], 'push', ARRAY['barbell','bench'], FALSE,
    COALESCE(l.chest_sternal_id,l.chest_id), ARRAY_REMOVE(ARRAY[l.delts_ant_id,l.triceps_id],NULL),
    ARRAY['main_lift','powerlifting','bench','strength'],
    '[{"body_part":"shoulder","min_severity":3,"reason":"swap to floor press/DB press; reduce ROM"}]'::jsonb,
    '[]'::jsonb,'[]'::jsonb,'{"image_url":"","video_url":""}'::jsonb
  ),
  ('Comp Deadlift', ARRAY['Deadlift','DL'], 'hinge', ARRAY['barbell'], FALSE,
    l.hams_id, ARRAY_REMOVE(ARRAY[l.glutes_id,l.erectors_id,l.traps_id,l.forearms_id],NULL),
    ARRAY['main_lift','powerlifting','deadlift','strength'],
    '[{"body_part":"lower_back","min_severity":3,"reason":"swap to trap bar/RDL; reduce load"}]'::jsonb,
    '[]'::jsonb,'[]'::jsonb,'{"image_url":"","video_url":""}'::jsonb
  ),

  -- Variations
  ('Pause Squat', ARRAY['Paused Squat'], 'squat', ARRAY['barbell','rack'], FALSE,
    l.quads_id, ARRAY_REMOVE(ARRAY[l.glutes_id,l.hams_id,l.erectors_id],NULL),
    ARRAY['variant','pause','squat','powerlifting'],
    '[{"body_part":"knee","min_severity":3,"reason":"swap to belt squat/box squat"}]'::jsonb,
    '[]'::jsonb,'[]'::jsonb,'{"image_url":"","video_url":""}'::jsonb
  ),
  ('T-shirt Pause Bench Press', ARRAY['Paused Bench'], 'push', ARRAY['barbell','bench'], FALSE,
    COALESCE(l.chest_sternal_id,l.chest_id), ARRAY_REMOVE(ARRAY[l.delts_ant_id,l.triceps_id],NULL),
    ARRAY['variant','pause','bench','powerlifting'],
    '[{"body_part":"shoulder","min_severity":3,"reason":"swap to floor press/DB press"}]'::jsonb,
    '[]'::jsonb,'[]'::jsonb,'{"image_url":"","video_url":""}'::jsonb
  ),
  ('Beltless Paused Deadlift (Below Knee)', ARRAY['Paused Deadlift Below Knee'], 'hinge', ARRAY['barbell'], FALSE,
    l.hams_id, ARRAY_REMOVE(ARRAY[l.glutes_id,l.erectors_id,l.traps_id,l.forearms_id],NULL),
    ARRAY['variant','pause','deadlift','powerlifting'],
    '[{"body_part":"lower_back","min_severity":3,"reason":"swap to RDL/trap bar"}]'::jsonb,
    '[]'::jsonb,'[]'::jsonb,'{"image_url":"","video_url":""}'::jsonb
  ),
  ('Sumo Deadlift', ARRAY['Sumo DL']::text[], 'hinge', ARRAY['barbell']::text[], FALSE,
    l.hams_id, ARRAY_REMOVE(ARRAY[l.glutes_id,l.adductors_id,l.erectors_id],NULL),
    ARRAY['variant','deadlift','powerlifting'],
    '[{"body_part":"lower_back","min_severity":3,"reason":"use trap bar or reduce ROM/load"}]'::jsonb,
    '[]'::jsonb,'[]'::jsonb,'{"image_url":"","video_url":""}'::jsonb
  ),
  ('Overhead Press', ARRAY['OHP','Shoulder Press'], 'push', ARRAY['barbell'], FALSE,
    COALESCE(l.delts_ant_id,l.delts_id), ARRAY_REMOVE(ARRAY[l.triceps_id,l.traps_id],NULL),
    ARRAY['press','strength','shoulders'],
    '[{"body_part":"shoulder","min_severity":3,"reason":"swap to landmine press; reduce ROM"}]'::jsonb,
    '[]'::jsonb,'[]'::jsonb,'{"image_url":"","video_url":""}'::jsonb
  ),

  -- Accessories
  ('Bulgarian Split Squat', ARRAY['BSS'], 'squat', ARRAY['dumbbell','bodyweight'], FALSE,
    l.quads_id, ARRAY_REMOVE(ARRAY[l.glutes_id,l.adductors_id],NULL),
    ARRAY['accessory','unilateral','legs'],
    '[{"body_part":"knee","min_severity":3,"reason":"reduce depth; swap to step-ups/leg press"}]'::jsonb,
    '[]'::jsonb,'[]'::jsonb,'{"image_url":"","video_url":""}'::jsonb
  ),
  ('DB Bench Press', ARRAY['Dumbbell Bench'], 'push', ARRAY['dumbbell','bench'], FALSE,
    COALESCE(l.chest_sternal_id,l.chest_id), ARRAY_REMOVE(ARRAY[l.delts_ant_id,l.triceps_id],NULL),
    ARRAY['accessory','hypertrophy','bench_variant'],
    '[{"body_part":"shoulder","min_severity":3,"reason":"neutral grip; reduce ROM"}]'::jsonb,
    '[]'::jsonb,'[]'::jsonb,'{"image_url":"","video_url":""}'::jsonb
  ),
  ('DB Romanian Deadlift', ARRAY['DB RDL'], 'hinge', ARRAY['dumbbell'], FALSE,
    l.hams_id, ARRAY_REMOVE(ARRAY[l.glutes_id,l.erectors_id],NULL),
    ARRAY['accessory','hinge','posterior_chain'],
    '[{"body_part":"lower_back","min_severity":3,"reason":"reduce ROM/load; swap to hip thrust"}]'::jsonb,
    '[]'::jsonb,'[]'::jsonb,'{"image_url":"","video_url":""}'::jsonb
  ),
  ('Hip Thrust', ARRAY['Barbell Hip Thrust'], 'hinge', ARRAY['barbell','bench'], FALSE,
    l.glutes_id, ARRAY_REMOVE(ARRAY[l.hams_id,l.abs_id],NULL),
    ARRAY['accessory','glutes','hypertrophy'],
    '[{"body_part":"hip","min_severity":3,"reason":"reduce ROM; swap to glute bridge"}]'::jsonb,
    '[]'::jsonb,'[]'::jsonb,'{"image_url":"","video_url":""}'::jsonb
  ),
  ('Goblet KB Front Squat', ARRAY['Goblet Squat'], 'squat', ARRAY['kettlebell','dumbbell'], FALSE,
    l.quads_id, ARRAY_REMOVE(ARRAY[l.glutes_id,l.abs_id],NULL),
    ARRAY['accessory','squat','hypertrophy'],
    '[{"body_part":"knee","min_severity":3,"reason":"reduce depth; swap to leg press"}]'::jsonb,
    '[]'::jsonb,'[]'::jsonb,'{"image_url":"","video_url":""}'::jsonb
  ),

  -- Slots
  ('Horizontal Row of Choice', ARRAY[]::text[], 'pull', ARRAY[]::text[], FALSE,
    l.upper_back_id, ARRAY_REMOVE(ARRAY[l.lats_id,l.biceps_id],NULL),
    ARRAY['slot','slot_horizontal_row','accessory','pull'],
    '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('Vertical Row of Choice', ARRAY[]::text[], 'pull', ARRAY[]::text[], FALSE,
    l.lats_id, ARRAY_REMOVE(ARRAY[l.biceps_id,l.forearms_id],NULL),
    ARRAY['slot','slot_vertical_row','accessory','pull'],
    '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('Abs of Choice', ARRAY[]::text[], 'core', ARRAY[]::text[], FALSE,
    l.abs_id, ARRAY_REMOVE(ARRAY[l.obliques_id],NULL),
    ARRAY['slot','slot_abs','core','accessory'],
    '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('Curl of Choice', ARRAY[]::text[], 'pull', ARRAY[]::text[], FALSE,
    l.biceps_id, ARRAY_REMOVE(ARRAY[l.forearms_id],NULL),
    ARRAY['slot','slot_curl','accessory','arms'],
    '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('Rear Delt Exercise of Choice (Myo Reps)', ARRAY[]::text[], 'pull', ARRAY[]::text[], FALSE,
    COALESCE(l.delts_post_id,l.delts_id), ARRAY_REMOVE(ARRAY[l.upper_back_id],NULL),
    ARRAY['slot','slot_rear_delt','myo_reps','accessory'],
    '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('Tri Exercise of Choice (Myo Reps)', ARRAY[]::text[], 'push', ARRAY[]::text[], FALSE,
    l.triceps_id, ARRAY_REMOVE(ARRAY[l.delts_id],NULL),
    ARRAY['slot','slot_triceps','myo_reps','accessory'],
    '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('Bi Exercise of Choice (Myo Reps)', ARRAY[]::text[], 'pull', ARRAY[]::text[], FALSE,
    l.biceps_id, ARRAY_REMOVE(ARRAY[l.forearms_id],NULL),
    ARRAY['slot','slot_biceps','myo_reps','accessory'],
    '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),

  -- Movement Prep items (tagged)
  ('Hip Flexion/Rotation', ARRAY[]::text[], 'mobility', ARRAY['bodyweight'], TRUE,
    l.glutes_id, ARRAY_REMOVE(ARRAY[l.adductors_id],NULL),
    ARRAY['warmup','mobility','hips'], '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('Banded Internal Rotation Stretch', ARRAY[]::text[], 'mobility', ARRAY['band'], FALSE,
    l.rotcuff_id, ARRAY_REMOVE(ARRAY[l.delts_id],NULL),
    ARRAY['warmup','mobility','shoulders','rotator_cuff'], '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('Thoracic Extension Release on Roller', ARRAY['T-Spine Extension on Roller'], 'mobility', ARRAY['foam_roller'], FALSE,
    l.upper_back_id, ARRAY_REMOVE(ARRAY[l.traps_id],NULL),
    ARRAY['warmup','mobility','t_spine'], '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('Shoulder Dislocations', ARRAY[]::text[], 'mobility', ARRAY['band','stick'], FALSE,
    l.delts_id, ARRAY_REMOVE(ARRAY[l.rotcuff_id],NULL),
    ARRAY['warmup','mobility','shoulders'], '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('Glute Release w/ Lacrosse Ball', ARRAY['Glute Release'], 'soft_tissue', ARRAY['lacrosse_ball'], FALSE,
    l.glutes_id, ARRAY[]::bigint[],
    ARRAY['warmup','soft_tissue','glutes'], '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('RDL Stability Sequence', ARRAY[]::text[], 'stability', ARRAY['bodyweight'], TRUE,
    l.hams_id, ARRAY_REMOVE(ARRAY[l.glutes_id,l.abs_id],NULL),
    ARRAY['warmup','stability','hinge_pattern'], '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('Hip Stability Lunge Sequence', ARRAY[]::text[], 'stability', ARRAY['bodyweight'], TRUE,
    l.glutes_id, ARRAY_REMOVE(ARRAY[l.quads_id,l.adductors_id],NULL),
    ARRAY['warmup','stability','hips'], '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('Glute Activation Side Plank Clamshell', ARRAY['Side Plank Clamshell'], 'activation', ARRAY['bodyweight','band'], TRUE,
    l.glutes_id, ARRAY_REMOVE(ARRAY[l.obliques_id],NULL),
    ARRAY['warmup','activation','glutes','core_stability'], '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('Bird Dog', ARRAY[]::text[], 'activation', ARRAY['bodyweight'], TRUE,
    l.abs_id, ARRAY_REMOVE(ARRAY[l.erectors_id],NULL),
    ARRAY['warmup','activation','core_stability','mcgill_big3'], '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('Floor Slides', ARRAY[]::text[], 'activation', ARRAY['bodyweight'], TRUE,
    l.rotcuff_id, ARRAY_REMOVE(ARRAY[l.delts_id],NULL),
    ARRAY['warmup','activation','shoulders','scap_control'], '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('Side Plank', ARRAY[]::text[], 'stability', ARRAY['bodyweight'], TRUE,
    l.obliques_id, ARRAY_REMOVE(ARRAY[l.abs_id],NULL),
    ARRAY['warmup','activation','core_stability'], '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  ),
  ('McGill Curl-Up', ARRAY[]::text[], 'activation', ARRAY['bodyweight'], TRUE,
    l.abs_id, ARRAY_REMOVE(ARRAY[l.obliques_id],NULL),
    ARRAY['warmup','activation','mcgill_big3','core_stability'], '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb
  )

) AS e(
  canonical_name, aliases, movement_pattern, equipment, is_bodyweight,
  primary_id, secondary_ids, tags, contraindications, default_warmups, default_warmdowns, media
)
ON CONFLICT (canonical_name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  movement_pattern = EXCLUDED.movement_pattern,
  equipment = EXCLUDED.equipment,
  is_bodyweight = EXCLUDED.is_bodyweight,
  primary_muscle_group_id = EXCLUDED.primary_muscle_group_id,
  secondary_muscle_group_ids = EXCLUDED.secondary_muscle_group_ids,
  tags = EXCLUDED.tags,
  contraindications = EXCLUDED.contraindications,
  default_warmups = EXCLUDED.default_warmups,
  default_warmdowns = EXCLUDED.default_warmdowns,
  media = EXCLUDED.media;

-- 2c. Core lift metadata (warmups/warmdowns/contraindications)
update public.exercises
set
  tags = array(select distinct t from unnest(coalesce(tags, '{}'::text[]) || ARRAY['bench','chest','press','barbell','powerlifting']::text[]) as t),
  contraindications = '[{"body_part":"shoulder","min_severity":3,"reason":"reduce depth or swap to floor press"}]'::jsonb,
  default_warmups = '[{"type":"ramp","percent":50,"reps":8},{"type":"ramp","percent":70,"reps":5}]'::jsonb,
  default_warmdowns = '[{"type":"stretch","target":"pec","duration_seconds":45}]'::jsonb,
  media = '{"image_url":"","video_url":""}'::jsonb
where canonical_name = 'Barbell Bench Press';

update public.exercises
set
  tags = array(select distinct t from unnest(coalesce(tags, '{}'::text[]) || ARRAY['squat','barbell','legs','strength']::text[]) as t),
  contraindications = '[{"body_part":"knee","min_severity":3,"reason":"use box squat or leg press"}]'::jsonb,
  default_warmups = '[{"type":"ramp","percent":40,"reps":8},{"type":"ramp","percent":60,"reps":5}]'::jsonb,
  default_warmdowns = '[{"type":"stretch","target":"quads","duration_seconds":45}]'::jsonb,
  media = '{"image_url":"","video_url":""}'::jsonb
where canonical_name = 'Back Squat';

update public.exercises
set
  tags = array(select distinct t from unnest(coalesce(tags, '{}'::text[]) || ARRAY['deadlift','hinge','posterior_chain','barbell']::text[]) as t),
  contraindications = '[{"body_part":"lower_back","min_severity":3,"reason":"swap to trap bar or RDL"}]'::jsonb,
  default_warmups = '[{"type":"ramp","percent":50,"reps":5},{"type":"ramp","percent":70,"reps":3}]'::jsonb,
  default_warmdowns = '[{"type":"breathing","target":"bracing","duration_seconds":60}]'::jsonb,
  media = '{"image_url":"","video_url":""}'::jsonb
where canonical_name = 'Conventional Deadlift';

update public.exercises
set
  tags = array(select distinct t from unnest(coalesce(tags, '{}'::text[]) || ARRAY['pushup','bodyweight','home','calisthenics']::text[]) as t),
  contraindications = '[{"body_part":"wrist","min_severity":2,"reason":"use handles or fists"}]'::jsonb,
  default_warmups = '[{"type":"prep","description":"scap push-ups 2x10"}]'::jsonb,
  default_warmdowns = '[{"type":"stretch","target":"pec","duration_seconds":30}]'::jsonb,
  media = '{"image_url":"","video_url":""}'::jsonb
where canonical_name = 'Push-Up';

update public.exercises
set
  tags = array(select distinct t from unnest(coalesce(tags, '{}'::text[]) || ARRAY['dip','bodyweight','push','chest']::text[]) as t),
  contraindications = '[{"body_part":"shoulder","min_severity":2,"reason":"limit depth or swap to push-up"}]'::jsonb,
  default_warmups = '[{"type":"prep","description":"band-assisted dips 2x8"}]'::jsonb,
  default_warmdowns = '[{"type":"stretch","target":"triceps","duration_seconds":30}]'::jsonb,
  media = '{"image_url":"","video_url":""}'::jsonb
where canonical_name = 'Dip';

update public.exercises
set
  tags = array(select distinct t from unnest(coalesce(tags, '{}'::text[]) || ARRAY['pullup','bodyweight','back','calisthenics']::text[]) as t),
  contraindications = '[{"body_part":"elbow","min_severity":3,"reason":"use neutral grip or bands"}]'::jsonb,
  default_warmups = '[{"type":"prep","description":"scap pull-ups 2x6"}]'::jsonb,
  default_warmdowns = '[{"type":"stretch","target":"lats","duration_seconds":45}]'::jsonb,
  media = '{"image_url":"","video_url":""}'::jsonb
where canonical_name = 'Pull-Up';

update public.exercises
set
  tags = array(select distinct t from unnest(coalesce(tags, '{}'::text[]) || ARRAY['row','barbell','back','hypertrophy']::text[]) as t),
  contraindications = '[{"body_part":"lower_back","min_severity":3,"reason":"swap to chest-supported row"}]'::jsonb,
  default_warmups = '[{"type":"prep","description":"empty bar row 2x10"}]'::jsonb,
  default_warmdowns = '[{"type":"stretch","target":"upper_back","duration_seconds":45}]'::jsonb,
  media = '{"image_url":"","video_url":""}'::jsonb
where canonical_name = 'Barbell Row';

update public.exercises
set
  tags = array(select distinct t from unnest(coalesce(tags, '{}'::text[]) || ARRAY['ohp','press','shoulders','strength']::text[]) as t),
  contraindications = '[{"body_part":"shoulder","min_severity":3,"reason":"use landmine press"}]'::jsonb,
  default_warmups = '[{"type":"ramp","percent":50,"reps":8},{"type":"ramp","percent":65,"reps":5}]'::jsonb,
  default_warmdowns = '[{"type":"stretch","target":"shoulders","duration_seconds":45}]'::jsonb,
  media = '{"image_url":"","video_url":""}'::jsonb
where canonical_name = 'Overhead Press';

update public.exercises
set
  tags = array(select distinct t from unnest(coalesce(tags, '{}'::text[]) || ARRAY['leg_press','machine','quads','hypertrophy']::text[]) as t),
  contraindications = '[{"body_part":"knee","min_severity":3,"reason":"reduce depth or swap to belt squat"}]'::jsonb,
  default_warmups = '[{"type":"prep","description":"empty sled 2x12"}]'::jsonb,
  default_warmdowns = '[{"type":"stretch","target":"quads","duration_seconds":45}]'::jsonb,
  media = '{"image_url":"","video_url":""}'::jsonb
where canonical_name = 'Leg Press';

update public.exercises
set
  tags = array(select distinct t from unnest(coalesce(tags, '{}'::text[]) || ARRAY['belt_squat','machine','quads','kneefriendly']::text[]) as t),
  contraindications = '[{"body_part":"spine","min_severity":2,"reason":"preferred over back squat when axial loading limited"}]'::jsonb,
  default_warmups = '[{"type":"prep","description":"light belt squat 2x10"}]'::jsonb,
  default_warmdowns = '[{"type":"stretch","target":"quads","duration_seconds":45}]'::jsonb,
  media = '{"image_url":"","video_url":""}'::jsonb
where canonical_name = 'Belt Squat';

-- 3. Templates
insert into public.templates (name, disciplines, methodology, version, template_json)
values
(
  'DUP Powerlifting',
  array['powerlifting'],
  'DUP',
  1,
  $${
    "microcycle_days": [
      {
        "day": "Mon",
        "session_key": "dup_day1",
        "focus": "Volume Squat + Bench",
        "exercises": [
          {"canonical_name": "Back Squat", "sets": 5, "reps": 5, "rpe": 7},
          {"canonical_name": "Barbell Bench Press", "sets": 5, "reps": 5, "rpe": 7},
          {"canonical_name": "Barbell Row", "sets": 4, "reps": 8, "rpe": 7}
        ]
      },
      {
        "day": "Wed",
        "session_key": "dup_day2",
        "focus": "Deadlift emphasis + OHP",
        "exercises": [
          {"canonical_name": "Conventional Deadlift", "sets": 4, "reps": 4, "rpe": 7.5},
          {"canonical_name": "Overhead Press", "sets": 4, "reps": 6, "rpe": 7},
          {"canonical_name": "Conventional Deadlift", "variation": "paused below knee", "sets": 3, "reps": 3, "rpe": 7}
        ]
      },
      {
        "day": "Fri",
        "session_key": "dup_day3",
        "focus": "Intensity Bench + Squat",
        "exercises": [
          {"canonical_name": "Barbell Bench Press", "sets": 4, "reps": 3, "rpe": 8},
          {"canonical_name": "Back Squat", "sets": 4, "reps": 3, "rpe": 8},
          {"canonical_name": "Pull-Up", "sets": 4, "reps": 8, "rir": 2}
        ]
      }
    ],
    "progression": {
      "intensity_wave": ["hypertrophy", "strength", "power"],
      "deload_every_weeks": 4,
      "notes": "Rotate high/medium/low days; add 2.5-5% when RPE <=8; drop 10-15% and cut volume in deload."
    }
  }$$::jsonb
),
(
  'RP Hypertrophy',
  array['hypertrophy'],
  'RP',
  1,
  $${
    "split": [
      {
        "day": "Push",
        "session_key": "rp_push",
        "exercises": [
          {"canonical_name": "Barbell Bench Press", "sets": 3, "reps": "8-10", "rir": 2},
          {"canonical_name": "Overhead Press", "sets": 3, "reps": "10-12", "rir": 2},
          {"canonical_name": "Dip", "sets": 3, "reps": "8-12", "rir": 1}
        ]
      },
      {
        "day": "Pull",
        "session_key": "rp_pull",
        "exercises": [
          {"canonical_name": "Pull-Up", "sets": 4, "reps": "6-10", "rir": 1},
          {"canonical_name": "Barbell Row", "sets": 4, "reps": "8-12", "rir": 1},
          {"canonical_name": "Conventional Deadlift", "sets": 2, "reps": 6, "rpe": 7.5}
        ]
      },
      {
        "day": "Legs",
        "session_key": "rp_legs",
        "exercises": [
          {"canonical_name": "Back Squat", "sets": 3, "reps": "8-10", "rir": 2},
          {"canonical_name": "Leg Press", "sets": 4, "reps": "10-15", "rir": 1},
          {"canonical_name": "Belt Squat", "sets": 3, "reps": "12-15", "rir": 1}
        ]
      }
    ],
    "progression": {
      "rule": "add 1-2 reps per set until top of range, then add load",
      "deload_signal": "drop week when average RIR <1 or fatigue high"
    }
  }$$::jsonb
),
(
  'Calisthenics Progression',
  array['calisthenics'],
  'volume-progression',
  1,
  $${
    "schedule": [
      {
        "day": "Day 1",
        "session_key": "cal_day1",
        "focus": "Horizontal push/pull",
        "exercises": [
          {"canonical_name": "Push-Up", "sets": 4, "reps": "AMRAP", "progression": ["incline", "standard", "weighted"]},
          {"canonical_name": "Barbell Row", "sets": 4, "reps": "8-12", "rir": 2},
          {"canonical_name": "Dip", "sets": 3, "reps": "6-10", "progression": ["banded", "bodyweight", "weighted"]}
        ]
      },
      {
        "day": "Day 2",
        "session_key": "cal_day2",
        "focus": "Vertical pull/legs",
        "exercises": [
          {"canonical_name": "Pull-Up", "sets": 4, "reps": "AMRAP", "progression": ["banded", "bodyweight", "weighted"]},
          {"canonical_name": "Leg Press", "sets": 4, "reps": "12-15", "rir": 2},
          {"canonical_name": "Belt Squat", "sets": 3, "reps": "10-12", "rir": 2}
        ]
      }
    ],
    "progression": {
      "rule": "aim for +1 rep per set weekly; once 12-15 reps achieved, add small load or harder variation",
      "notes": "Keep at least 1-2 reps in reserve to preserve joints"
    }
  }$$::jsonb
),
(
  'Hypertrophy Engine v1',
  array['hypertrophy'],
  'engine_pools',
  1,
  $${
    "template_type": "hypertrophy_engine_v1",
    "weeks": 4,
    "pools": [
      {
        "pool_key": "squat_quad",
        "selection_query": {"movement_pattern": "squat", "equipment": ["barbell", "dumbbell", "machine", "bodyweight"], "tags": ["hypertrophy", "engine_seed"]},
        "fallback_pool_keys": ["hinge_hamstring"],
        "default_exercise_names": ["Back Squat", "Front Squat", "Belt Squat", "Hack Squat", "Goblet Squat"]
      },
      {
        "pool_key": "hinge_hamstring",
        "selection_query": {"movement_pattern": "hinge", "equipment": ["barbell", "dumbbell"], "tags": ["hypertrophy", "engine_seed"]},
        "fallback_pool_keys": ["squat_quad"],
        "default_exercise_names": ["Barbell RDL", "Hip Thrust", "Glute Bridge", "Dumbbell RDL"]
      },
      {
        "pool_key": "hpress_chest",
        "selection_query": {"movement_pattern": "horizontal_press", "equipment": ["barbell", "dumbbell", "machine", "bodyweight"], "tags": ["hypertrophy", "engine_seed"]},
        "fallback_pool_keys": ["vpress_delts"],
        "default_exercise_names": ["Barbell Bench Press", "Incline DB Press", "Flat DB Press", "Dip", "Push-Up"]
      },
      {
        "pool_key": "vpress_delts",
        "selection_query": {"movement_pattern": "vertical_press", "equipment": ["barbell", "dumbbell", "machine"], "tags": ["hypertrophy", "engine_seed"]},
        "fallback_pool_keys": ["delts_iso"],
        "default_exercise_names": ["Overhead Press", "Arnold Press", "Standing DB Arnold Press"]
      },
      {
        "pool_key": "vpull_lats",
        "selection_query": {"movement_pattern": "vertical_pull", "equipment": ["machine", "cable", "bodyweight"], "tags": ["hypertrophy", "engine_seed"]},
        "fallback_pool_keys": ["hpull_back"],
        "default_exercise_names": ["Neutral-Grip Pullup", "Half-Kneeling 1-Arm Lat Pulldown", "Pull-Up", "Assisted Pull-Up"]
      },
      {
        "pool_key": "hpull_back",
        "selection_query": {"movement_pattern": "horizontal_pull", "equipment": ["barbell", "dumbbell", "cable", "machine"], "tags": ["hypertrophy", "engine_seed"]},
        "fallback_pool_keys": ["vpull_lats"],
        "default_exercise_names": ["Barbell Row", "1-Arm DB Row", "Cable Row", "Chest-Supported T-Bar Row", "Face Pull"]
      },
      {
        "pool_key": "biceps",
        "selection_query": {"movement_pattern": "elbow_flexion", "equipment": ["dumbbell", "cable"], "tags": ["hypertrophy", "engine_seed"]},
        "fallback_pool_keys": [],
        "default_exercise_names": ["Bayesian Curl", "Incline Curl", "Hammer Curl", "Bar Curl"]
      },
      {
        "pool_key": "triceps",
        "selection_query": {"movement_pattern": "elbow_extension", "equipment": ["dumbbell", "cable", "machine"], "tags": ["hypertrophy", "engine_seed"]},
        "fallback_pool_keys": [],
        "default_exercise_names": ["Triceps Pushdown", "DB Triceps Extension", "Skull Crusher"]
      },
      {
        "pool_key": "delts_iso",
        "selection_query": {"movement_pattern": "isolation", "equipment": ["dumbbell", "cable"], "tags": ["hypertrophy", "engine_seed"]},
        "fallback_pool_keys": [],
        "default_exercise_names": ["DB Lateral Raise", "Cross-Body Cable Y-Raise", "Cable Upright Row"]
      },
      {
        "pool_key": "abs",
        "selection_query": {"movement_pattern": "core_flexion", "equipment": ["bodyweight", "cable"], "tags": ["hypertrophy", "engine_seed"]},
        "fallback_pool_keys": [],
        "default_exercise_names": ["Cable Crunch", "Dead Bug", "Hanging Knee Raise"]
      },
      {
        "pool_key": "calves",
        "selection_query": {"movement_pattern": "calf", "equipment": ["dumbbell", "machine", "bodyweight"], "tags": ["hypertrophy", "engine_seed"]},
        "fallback_pool_keys": [],
        "default_exercise_names": ["Donkey Calf Raise", "DB Calf Jumps"]
      }
    ],
    "weak_points": {
      "lats": ["Neutral-Grip Pullup", "Half-Kneeling 1-Arm Lat Pulldown"],
      "delts": ["DB Lateral Raise", "Arnold Press"],
      "chest": ["Incline DB Press", "Flat DB Press"],
      "glutes": ["Hip Thrust", "DB Bulgarian Split Squat"],
      "triceps": ["Triceps Pushdown", "DB Triceps Extension"]
    },
    "sessions": [
      {
        "session_key": "hev1_full_body_a",
        "focus": "Full Body A (AWP)",
        "label": "Full Body AWP",
        "archetype": "awp",
        "slots": [
          {"slot_key": "squat_primary", "pool_key": "squat_quad", "movement_pattern": "squat", "target_muscles": ["quads", "glutes"], "tags": ["compound", "hypertrophy"], "sets": 4, "reps": "6-10", "rir": 2},
          {"slot_key": "press_horizontal", "pool_key": "hpress_chest", "movement_pattern": "horizontal_press", "target_muscles": ["chest"], "tags": ["compound", "hypertrophy"], "sets": 4, "reps": "8-12", "rir": 2},
          {"slot_key": "row_horizontal", "pool_key": "hpull_back", "movement_pattern": "horizontal_pull", "target_muscles": ["upper-back", "lats"], "tags": ["compound", "hypertrophy"], "sets": 4, "reps": "8-12", "rir": 1},
          {"slot_key": "vertical_press", "pool_key": "vpress_delts", "movement_pattern": "vertical_press", "target_muscles": ["delts"], "tags": ["compound", "hypertrophy"], "sets": 3, "reps": "8-10", "rir": 2},
          {"slot_key": "weak_point_1", "pool_key": "vpull_lats", "movement_pattern": "vertical_pull", "target_muscles": ["lats"], "tags": ["weak_point"], "sets": 3, "reps": "8-12", "rir": 1},
          {"slot_key": "triceps_iso", "pool_key": "triceps", "movement_pattern": "elbow_extension", "target_muscles": ["triceps"], "tags": ["isolation"], "sets": 3, "reps": "10-12", "rir": 2},
          {"slot_key": "abs_core", "pool_key": "abs", "movement_pattern": "core_flexion", "target_muscles": ["abdominals"], "tags": ["core"], "sets": 3, "reps": "12-15", "rir": 2}
        ]
      },
      {
        "session_key": "hev1_full_body_b",
        "focus": "Full Body B (Pull + Hinge)",
        "label": "Full Body Pull",
        "slots": [
          {"slot_key": "hinge_main", "pool_key": "hinge_hamstring", "movement_pattern": "hinge", "target_muscles": ["hamstrings", "glutes"], "tags": ["compound", "hypertrophy"], "sets": 4, "reps": "8-10", "rir": 2},
          {"slot_key": "vertical_pull", "pool_key": "vpull_lats", "movement_pattern": "vertical_pull", "target_muscles": ["lats"], "tags": ["compound", "hypertrophy"], "sets": 4, "reps": "8-12", "rir": 1},
          {"slot_key": "press_secondary", "pool_key": "hpress_chest", "movement_pattern": "horizontal_press", "target_muscles": ["chest"], "tags": ["compound", "hypertrophy"], "sets": 3, "reps": "10-12", "rir": 2},
          {"slot_key": "delts_iso", "pool_key": "delts_iso", "movement_pattern": "isolation", "target_muscles": ["delts"], "tags": ["isolation"], "sets": 3, "reps": "12-15", "rir": 2},
          {"slot_key": "biceps_iso", "pool_key": "biceps", "movement_pattern": "elbow_flexion", "target_muscles": ["biceps"], "tags": ["isolation"], "sets": 3, "reps": "10-12", "rir": 2},
          {"slot_key": "weak_point_2", "pool_key": "vpull_lats", "movement_pattern": "vertical_pull", "target_muscles": ["lats"], "tags": ["weak_point"], "sets": 2, "reps": "10-12", "rir": 2, "optional": true},
          {"slot_key": "abs_brace", "pool_key": "abs", "movement_pattern": "core_flexion", "target_muscles": ["abdominals"], "tags": ["core"], "sets": 3, "reps": "12-15", "rir": 2}
        ]
      },
      {
        "session_key": "hev1_full_body_c",
        "focus": "Full Body C (Pump)",
        "label": "Full Body Pump",
        "slots": [
          {"slot_key": "squat_speed", "pool_key": "squat_quad", "movement_pattern": "squat", "target_muscles": ["quads"], "tags": ["compound", "hypertrophy"], "sets": 3, "reps": "10-12", "rir": 2},
          {"slot_key": "row_back", "pool_key": "hpull_back", "movement_pattern": "horizontal_pull", "target_muscles": ["upper-back", "lats"], "tags": ["compound", "hypertrophy"], "sets": 3, "reps": "10-12", "rir": 2},
          {"slot_key": "vertical_press_pump", "pool_key": "vpress_delts", "movement_pattern": "vertical_press", "target_muscles": ["delts"], "tags": ["hypertrophy"], "sets": 3, "reps": "10-12", "rir": 2},
          {"slot_key": "triceps_finisher", "pool_key": "triceps", "movement_pattern": "elbow_extension", "target_muscles": ["triceps"], "tags": ["isolation"], "sets": 3, "reps": "12-15", "rir": 2},
          {"slot_key": "biceps_finisher", "pool_key": "biceps", "movement_pattern": "elbow_flexion", "target_muscles": ["biceps"], "tags": ["isolation"], "sets": 2, "reps": "12-15", "rir": 2},
          {"slot_key": "calves_strength", "pool_key": "calves", "movement_pattern": "calf", "target_muscles": ["calves"], "tags": ["isolation"], "sets": 4, "reps": "10-15", "rir": 2},
          {"slot_key": "abs_rotation", "pool_key": "abs", "movement_pattern": "core_flexion", "target_muscles": ["abdominals"], "tags": ["core"], "sets": 3, "reps": "12-15", "rir": 2}
        ]
      }
    ]
  }$$::jsonb
)
on conflict (name, version) do update set
  disciplines = excluded.disciplines,
  methodology = excluded.methodology,
  template_json = excluded.template_json;

-- =========================================================
INSERT INTO public.templates (name, disciplines, methodology, version, template_json)
VALUES
(
  'Prime DUP Submax (Sumo Dead)',
  ARRAY['powerlifting'],
  'prime_dup_submax',
  1,
  $${
    "warmup_phases": {
      "mobility": [
        {"canonical_name":"Hip Flexion/Rotation","sets":"1-2","reps_or_time":"30-45s"},
        {"canonical_name":"Thoracic Extension Release on Roller","sets":"1-2","reps_or_time":"30-45s"},
        {"canonical_name":"Shoulder Dislocations","sets":"1-2","reps_or_time":"10"}
      ],
      "stability": [
        {"canonical_name":"RDL Stability Sequence","sets":"1-2","reps_or_time":"10"},
        {"canonical_name":"Hip Stability Lunge Sequence","sets":"1-2","reps_or_time":"5"}
      ],
      "activation": [
        {"canonical_name":"Glute Activation Side Plank Clamshell","sets":"1-2","reps_or_time":"10"},
        {"canonical_name":"Bird Dog","sets":"1-2","reps_or_time":"10"},
        {"canonical_name":"Floor Slides","sets":"1-2","reps_or_time":"10"}
      ]
    },
    "microcycle_days": [
      {
        "session_key":"prime_dup_d1",
        "focus":"Squat + Bench Volume",
        "main_work":[
          {"canonical_name":"Comp Squat","sets":5,"reps":5,"target":"RPE 7-8"},
          {"canonical_name":"Comp Bench Press","sets":5,"reps":5,"target":"RPE 7-8"}
        ],
        "accessory_work":[
          {"canonical_name":"Horizontal Row of Choice","sets":4,"reps":"8-12","target":"RIR 1-2"},
          {"canonical_name":"Abs of Choice","sets":3,"reps":"10-15","target":"RIR 1-2"}
        ]
      },
      {
        "session_key":"prime_dup_d2",
        "focus":"Deadlift + Press",
        "main_work":[
          {"canonical_name":"Comp Deadlift","sets":4,"reps":4,"target":"RPE 7-8"},
          {"canonical_name":"Overhead Press","sets":4,"reps":6,"target":"RPE 7-8"}
        ],
        "accessory_work":[
          {"canonical_name":"Vertical Row of Choice","sets":4,"reps":"8-12","target":"RIR 1-2"},
          {"canonical_name":"Curl of Choice","sets":3,"reps":"10-15","target":"RIR 1-2"}
        ]
      },
      {
        "session_key":"prime_dup_d3",
        "focus":"Technique Variants + Accessories",
        "main_work":[
          {"canonical_name":"Pause Squat","sets":4,"reps":3,"target":"RPE 7-8"},
          {"canonical_name":"T-shirt Pause Bench Press","sets":4,"reps":3,"target":"RPE 7-8"},
          {"canonical_name":"Beltless Paused Deadlift (Below Knee)","sets":3,"reps":3,"target":"RPE 7-8"}
        ],
        "accessory_work":[
          {"canonical_name":"Bulgarian Split Squat","sets":3,"reps":"8-12","target":"RIR 1-2"},
          {"canonical_name":"DB Bench Press","sets":3,"reps":"8-12","target":"RIR 1-2"},
          {"canonical_name":"Tri Exercise of Choice (Myo Reps)","sets":1,"reps":"myo","target":"near-failure"},
          {"canonical_name":"Rear Delt Exercise of Choice (Myo Reps)","sets":1,"reps":"myo","target":"near-failure"}
        ]
      }
    ],
    "progression":{
      "rule":"If top sets <= target RPE, add 2.5-5 lb next exposure. If > target RPE, hold load and reduce sets by 1.",
      "deload_every_weeks":4
    }
  }$$::jsonb
),
(
  '5/3/1 Auto-Regulated DUP',
  ARRAY['powerlifting'],
  '531_autoreg_dup',
  1,
  $${
    "concept":"Each main lift has weekly Volume and Intensity targets; autoregulated top set + capped backoffs.",
    "lifts":["Comp Bench Press","Comp Deadlift","Overhead Press","Comp Squat"],
    "tracks":{
      "volume":[
        {"week":1,"reps":8,"target_rpe":9.0,"fatigue_percent":5,"set_cap":5},
        {"week":2,"reps":8,"target_rpe":9.0,"fatigue_percent":5,"set_cap":5},
        {"week":3,"reps":8,"target_rpe":9.0,"fatigue_percent":5,"set_cap":5},
        {"week":4,"reps":10,"target_rpe":7.0,"fatigue_percent":0,"set_cap":3}
      ],
      "intensity":[
        {"week":1,"reps":4,"target_rpe":8.5,"fatigue_percent":3,"set_cap":4},
        {"week":2,"reps":2,"target_rpe":8.5,"fatigue_percent":3,"set_cap":3},
        {"week":3,"reps":1,"target_rpe":8.0,"fatigue_percent":3,"set_cap":3},
        {"week":4,"reps":10,"target_rpe":7.0,"fatigue_percent":0,"set_cap":3}
      ]
    },
    "session_template":{
      "volume_day":{
        "main_work":[{"lift":"<lift>","mode":"top_set_plus_backoffs"}],
        "accessory_slots":["Horizontal Row of Choice","Abs of Choice","Tri Exercise of Choice (Myo Reps)"]
      },
      "intensity_day":{
        "main_work":[{"lift":"<lift>","mode":"top_set_plus_backoffs"}],
        "accessory_slots":["Vertical Row of Choice","Curl of Choice","Rear Delt Exercise of Choice (Myo Reps)"]
      }
    }
  }$$::jsonb
)
ON CONFLICT (name, version) DO UPDATE SET
  disciplines = EXCLUDED.disciplines,
  methodology = EXCLUDED.methodology,
  template_json = EXCLUDED.template_json;

-- 4. Manual alias updates (from P02_04)
-- Manual alias updates (review before running)

-- Rows marked skip_engine_slot are left unchanged.

update public.exercises set aliases = ARRAY['Bench','BB Bench','Bench Press','Barbell Bench','BB Bench Press','barbell bench press']::text[] where canonical_name = 'Barbell Bench Press' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['Squat','BB Squat','Back squat','High Bar Squat']::text[] where canonical_name = 'Back Squat' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['DL','Deadlift','Conv Deadlift','Barbell Deadlift','conventional deadlift']::text[] where canonical_name = 'Conventional Deadlift' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['PushUp','Push Up','Press Up','Press-Up','push-up']::text[] where canonical_name = 'Push-Up' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['Dips','Parallel Bar Dip','dip']::text[] where canonical_name = 'Dip' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['PullUp','Pull Up','pull-up']::text[] where canonical_name = 'Pull-Up' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['BB Row','Bent Over Row','Bent-Over Row','barbell row']::text[] where canonical_name = 'Barbell Row' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['OHP','Military Press','Standing Press','overhead press']::text[] where canonical_name = 'Overhead Press' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['45 Deg Leg Press','Sled Leg Press','45 Degree Leg Press','leg press']::text[] where canonical_name = 'Leg Press' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['Belt Squat Machine','belt squat']::text[] where canonical_name = 'Belt Squat' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['Meet Squat','Competition Squat','comp squat']::text[] where canonical_name = 'Comp Squat' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['Meet Bench','Competition Bench Press','comp bench press']::text[] where canonical_name = 'Comp Bench Press' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['Meet Deadlift','Competition Deadlift','comp deadlift']::text[] where canonical_name = 'Comp Deadlift' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['Paused Squat','Squat (Paused)','pause squat']::text[] where canonical_name = 'Pause Squat' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['Tshirt Pause Bench','T-Shirt Pause Bench','Paused Bench (T-Shirt)','Tshirt Pause Bench Press','T shirt Pause Bench Press','T-shirt Paused Bench Press','t-shirt pause bench press']::text[] where canonical_name = 'T-shirt Pause Bench Press' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['Beltless Paused Deadlift','Beltless Pause Deadlift (Below Knee)','beltless paused deadlift (below knee)']::text[] where canonical_name = 'Beltless Paused Deadlift (Below Knee)' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['BSS','RFESS','Rear Foot Elevated Split Squat','Rear-Foot Elevated Split Squat','bulgarian split squat']::text[] where canonical_name = 'Bulgarian Split Squat' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['DB Press','Flat DB Bench','Flat DB Press','Dumbbell Bench Press','db bench press']::text[] where canonical_name = 'DB Bench Press' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['DB RDL','RDL (DB)','RDL (Dumbbell)','Dumbbell Romanian Deadlift','db romanian deadlift']::text[] where canonical_name = 'DB Romanian Deadlift' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['Glute Thrust','BB Hip Thrust','Barbell Hip Thrust','hip thrust']::text[] where canonical_name = 'Hip Thrust' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['goblet kb front squat']::text[] where canonical_name = 'Goblet KB Front Squat' and (aliases is null or cardinality(aliases)=0);
-- SKIP engine-slot placeholder: Horizontal Row of Choice
-- SKIP engine-slot placeholder: Vertical Row of Choice
-- SKIP engine-slot placeholder: Abs of Choice
-- SKIP engine-slot placeholder: Curl of Choice
-- SKIP engine-slot placeholder: Rear Delt Exercise of Choice (Myo Reps)
-- SKIP engine-slot placeholder: Tri Exercise of Choice (Myo Reps)
-- SKIP engine-slot placeholder: Bi Exercise of Choice (Myo Reps)
update public.exercises set aliases = ARRAY['hip flexion/rotation']::text[] where canonical_name = 'Hip Flexion/Rotation' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['banded internal rotation stretch']::text[] where canonical_name = 'Banded Internal Rotation Stretch' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['thoracic extension release on roller']::text[] where canonical_name = 'Thoracic Extension Release on Roller' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['shoulder dislocations']::text[] where canonical_name = 'Shoulder Dislocations' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['glute release w/ lacrosse ball']::text[] where canonical_name = 'Glute Release w/ Lacrosse Ball' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['rdl stability sequence']::text[] where canonical_name = 'RDL Stability Sequence' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['hip stability lunge sequence']::text[] where canonical_name = 'Hip Stability Lunge Sequence' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['glute activation side plank clamshell']::text[] where canonical_name = 'Glute Activation Side Plank Clamshell' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['bird dog']::text[] where canonical_name = 'Bird Dog' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['floor slides']::text[] where canonical_name = 'Floor Slides' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['side plank']::text[] where canonical_name = 'Side Plank' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['McGill CurlUp','McGill Curl Up','mcgill curl-up']::text[] where canonical_name = 'McGill Curl-Up' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['SitUp','Sit Up','sit-up']::text[] where canonical_name = 'Sit-Up' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['battle ropes']::text[] where canonical_name = 'Battle Ropes' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['bi myo reps','biceps slot myo reps']::text[] where canonical_name = 'Bi Exercise of Choice (Myo Reps)' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['elliptical trainer','elliptical']::text[] where canonical_name = 'Elliptical' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['high intensity interval training','hiit']::text[] where canonical_name = 'HIIT' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['incline walk','treadmill incline walk']::text[] where canonical_name = 'Incline Treadmill Walk' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['jump rope','skipping']::text[] where canonical_name = 'Jump Rope' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['overhead tricep rope extension']::text[] where canonical_name = 'Overhead Tricep Rope Extension' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['stairmaster','stair climber']::text[] where canonical_name = 'Stair Climber' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['stationary bike','spin bike']::text[] where canonical_name = 'Stationary Bike' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['zone2','aerobic base']::text[] where canonical_name = 'Zone 2 Cardio' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['1Arm DB Row','1 Arm DB Row','1-arm db row']::text[] where canonical_name = '1-Arm DB Row' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['1Arm Lat Pulldown','1 Arm Lat Pulldown','1-arm lat pulldown']::text[] where canonical_name = '1-Arm Lat Pulldown' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['arnold press']::text[] where canonical_name = 'Arnold Press' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['assisted dip']::text[] where canonical_name = 'Assisted Dip' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['Assisted PullUp','Assisted Pull Up','assisted pull-up']::text[] where canonical_name = 'Assisted Pull-Up' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['bar curl']::text[] where canonical_name = 'Bar Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['BB RDL','barbell rdl']::text[] where canonical_name = 'Barbell RDL' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['bayesian curl']::text[] where canonical_name = 'Bayesian Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['bench dip']::text[] where canonical_name = 'Bench Dip' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['bicycle crunch']::text[] where canonical_name = 'Bicycle Crunch' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['cable crunch']::text[] where canonical_name = 'Cable Crunch' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['cable curl']::text[] where canonical_name = 'Cable Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['cable flye']::text[] where canonical_name = 'Cable Flye' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['cable row']::text[] where canonical_name = 'Cable Row' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['cable upright row']::text[] where canonical_name = 'Cable Upright Row' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['ChestSupported TBar Row','Chest Supported T Bar Row','chest-supported t-bar row']::text[] where canonical_name = 'Chest-Supported T-Bar Row' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['concentration curl']::text[] where canonical_name = 'Concentration Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['copenhagen hip adduction']::text[] where canonical_name = 'Copenhagen Hip Adduction' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['CrossBody Cable YRaise','Cross Body Cable Y Raise','cross-body cable y-raise']::text[] where canonical_name = 'Cross-Body Cable Y-Raise' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['Cuffed BehindtheBack Lateral Raise','Cuffed Behind the Back Lateral Raise','cuffed behind-the-back lateral raise']::text[] where canonical_name = 'Cuffed Behind-the-Back Lateral Raise' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['db bulgarian split squat']::text[] where canonical_name = 'DB Bulgarian Split Squat' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['db calf jumps']::text[] where canonical_name = 'DB Calf Jumps' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['db flye']::text[] where canonical_name = 'DB Flye' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['db incline curl']::text[] where canonical_name = 'DB Incline Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['db lateral raise']::text[] where canonical_name = 'DB Lateral Raise' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['db preacher curl']::text[] where canonical_name = 'DB Preacher Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['db reverse lunge']::text[] where canonical_name = 'DB Reverse Lunge' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['db row']::text[] where canonical_name = 'DB Row' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['db scott curl']::text[] where canonical_name = 'DB Scott Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['db shrug']::text[] where canonical_name = 'DB Shrug' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['db skull crusher']::text[] where canonical_name = 'DB Skull Crusher' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['DB StepUp','DB Step Up','db step-up']::text[] where canonical_name = 'DB Step-Up' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['db triceps extension']::text[] where canonical_name = 'DB Triceps Extension' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['dead bug']::text[] where canonical_name = 'Dead Bug' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['donkey calf raise']::text[] where canonical_name = 'Donkey Calf Raise' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['DB Curl','dumbbell curl']::text[] where canonical_name = 'Dumbbell Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['DB RDL','dumbbell rdl']::text[] where canonical_name = 'Dumbbell RDL' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['face pull']::text[] where canonical_name = 'Face Pull' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['FatGrip DB Curl','Fat Grip DB Curl','fat-grip db curl']::text[] where canonical_name = 'Fat-Grip DB Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['flat db press']::text[] where canonical_name = 'Flat DB Press' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['front squat']::text[] where canonical_name = 'Front Squat' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['glute bridge']::text[] where canonical_name = 'Glute Bridge' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['GluteHam Raise','Glute Ham Raise','glute-ham raise']::text[] where canonical_name = 'Glute-Ham Raise' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['goblet squat']::text[] where canonical_name = 'Goblet Squat' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['hack squat']::text[] where canonical_name = 'Hack Squat' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['HalfKneeling 1Arm Lat Pulldown','Half Kneeling 1 Arm Lat Pulldown','half-kneeling 1-arm lat pulldown']::text[] where canonical_name = 'Half-Kneeling 1-Arm Lat Pulldown' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['hammer curl']::text[] where canonical_name = 'Hammer Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['hanging knee raise']::text[] where canonical_name = 'Hanging Knee Raise' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['hanging leg raise']::text[] where canonical_name = 'Hanging Leg Raise' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['helms row']::text[] where canonical_name = 'Helms Row' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['HighBar Back Squat','High Bar Back Squat','high-bar back squat']::text[] where canonical_name = 'High-Bar Back Squat' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['incline curl']::text[] where canonical_name = 'Incline Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['incline db press']::text[] where canonical_name = 'Incline DB Press' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['kelso shrug']::text[] where canonical_name = 'Kelso Shrug' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['lat pulldown']::text[] where canonical_name = 'Lat Pulldown' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['leg extension']::text[] where canonical_name = 'Leg Extension' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['leg press calf raise']::text[] where canonical_name = 'Leg Press Calf Raise' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['lying leg curl']::text[] where canonical_name = 'Lying Leg Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['machine chest press']::text[] where canonical_name = 'Machine Chest Press' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['machine crunch']::text[] where canonical_name = 'Machine Crunch' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['machine hip abduction']::text[] where canonical_name = 'Machine Hip Abduction' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['machine hip adduction']::text[] where canonical_name = 'Machine Hip Adduction' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['machine lat pullover']::text[] where canonical_name = 'Machine Lat Pullover' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['machine lateral raise']::text[] where canonical_name = 'Machine Lateral Raise' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['machine pulldown']::text[] where canonical_name = 'Machine Pulldown' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['machine row']::text[] where canonical_name = 'Machine Row' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['machine shoulder press']::text[] where canonical_name = 'Machine Shoulder Press' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['machine shrug']::text[] where canonical_name = 'Machine Shrug' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['NeutralGrip Pullup','Neutral Grip Pullup','neutral-grip pullup']::text[] where canonical_name = 'Neutral-Grip Pullup' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['nordic ham curl']::text[] where canonical_name = 'Nordic Ham Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['Pause DB RDL','paused db rdl']::text[] where canonical_name = 'Paused DB RDL' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['pec deck']::text[] where canonical_name = 'Pec Deck' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['PlateLoaded Neck Curls','Plate Loaded Neck Curls','plate-loaded neck curls']::text[] where canonical_name = 'Plate-Loaded Neck Curls' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['PlateWeighted Crunch','Plate Weighted Crunch','plate-weighted crunch']::text[] where canonical_name = 'Plate-Weighted Crunch' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['preacher curl']::text[] where canonical_name = 'Preacher Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['reverse crunch']::text[] where canonical_name = 'Reverse Crunch' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['RDL','romanian deadlift']::text[] where canonical_name = 'Romanian Deadlift' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['rope face pull']::text[] where canonical_name = 'Rope Face Pull' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['rope pushdown']::text[] where canonical_name = 'Rope Pushdown' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['scott curl']::text[] where canonical_name = 'Scott Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['Seated BB Shoulder Press','seated barbell shoulder press']::text[] where canonical_name = 'Seated Barbell Shoulder Press' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['seated calf raise']::text[] where canonical_name = 'Seated Calf Raise' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['seated leg curl']::text[] where canonical_name = 'Seated Leg Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['SingleLeg DB Hip Thrust','Single Leg DB Hip Thrust','single-leg db hip thrust']::text[] where canonical_name = 'Single-Leg DB Hip Thrust' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['sissy squat']::text[] where canonical_name = 'Sissy Squat' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['skull crusher']::text[] where canonical_name = 'Skull Crusher' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['smith machine bench press']::text[] where canonical_name = 'Smith Machine Bench Press' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['smith machine shoulder press']::text[] where canonical_name = 'Smith Machine Shoulder Press' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['spider curl']::text[] where canonical_name = 'Spider Curl' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['standing calf raise']::text[] where canonical_name = 'Standing Calf Raise' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['standing db arnold press']::text[] where canonical_name = 'Standing DB Arnold Press' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['StepUp','Step Up','step-up']::text[] where canonical_name = 'Step-Up' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['supported row']::text[] where canonical_name = 'Supported Row' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['TBar Row','T Bar Row','t-bar row']::text[] where canonical_name = 'T-Bar Row' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['TBar Row + Kelso Shrug','T Bar Row + Kelso Shrug','t-bar row + kelso shrug']::text[] where canonical_name = 'T-Bar Row + Kelso Shrug' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['triceps extension']::text[] where canonical_name = 'Triceps Extension' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['triceps pushdown']::text[] where canonical_name = 'Triceps Pushdown' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['upright row']::text[] where canonical_name = 'Upright Row' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['YRaise','Y Raise','y-raise']::text[] where canonical_name = 'Y-Raise' and (aliases is null or cardinality(aliases)=0);
update public.exercises set aliases = ARRAY['zottman curl']::text[] where canonical_name = 'Zottman Curl' and (aliases is null or cardinality(aliases)=0);

-- Contraindications for main lifts (from P02_05)
-- Contraindications for main lifts (hyper-specific muscle_group_ids)

update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[13,14,17,41,42,43,44,45,46,52,53,56]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"Axial loading + deep knee/hip flexion; replace if affected, avoid if severe.","replacement_hints":{"pool_key":"squat_quad","movement_pattern":"squat","fallback_pool_keys":["hinge_posterior"]}}]'::jsonb where canonical_name = 'Back Squat';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[13,14,17,41,42,43,44,45,46,52,53,56]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"Competition squat (axial load); treat like back squat.","replacement_hints":{"pool_key":"squat_quad","movement_pattern":"squat"}}]'::jsonb where canonical_name = 'Comp Squat';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[13,14,17,41,42,43,44,45,46,52,53,56]},"replace_severity_min":2,"avoid_severity_min":5,"reason":"Paused/deeper time under tension; replace earlier if aggravated.","replacement_hints":{"pool_key":"squat_quad","movement_pattern":"squat"}}]'::jsonb where canonical_name = 'Pause Squat';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[14,17,43,44,45,46,52,53,56]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"Quad-dominant squat with trunk demand; replace if quads/adductors/erectors injured.","replacement_hints":{"pool_key":"squat_quad","movement_pattern":"squat"}}]'::jsonb where canonical_name = 'Front Squat';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[13,14,17,41,42,43,44,45,46,52,53]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"Unilateral knee/hip flexion; replace if quad/adductor/glute injury.","replacement_hints":{"pool_key":"squat_quad","movement_pattern":"squat","notes":"Use belt squat/leg press if balance or joint symptoms."}}]'::jsonb where canonical_name = 'Bulgarian Split Squat';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[13,14,17,41,42,43,44,45,46,52,53]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"Knee/hip flexion under load; replace if quad/adductor/glute injury.","replacement_hints":{"pool_key":"squat_quad","movement_pattern":"squat","notes":"Common substitute when spinal loading is limited."}}]'::jsonb where canonical_name = 'Leg Press';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[13,14,17,41,42,43,44,45,46,52,53]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"Lower-body squat pattern (reduced spinal load); still stresses quads/adductors.","replacement_hints":{"pool_key":"squat_quad","movement_pattern":"squat"}}]'::jsonb where canonical_name = 'Belt Squat';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[13,15,21,41,42,47,48,49,56,57]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"High hinge demand + spinal erector loading; replace if posterior chain/erectors injured.","replacement_hints":{"pool_key":"hinge_posterior","movement_pattern":"hinge"}}]'::jsonb where canonical_name = 'Conventional Deadlift';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[13,15,17,21,41,42,47,48,49,52,53,56,57]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"Hinge with higher adductor demand; replace if adductors/posterior chain/erectors injured.","replacement_hints":{"pool_key":"hinge_posterior","movement_pattern":"hinge"}}]'::jsonb where canonical_name = 'Sumo Deadlift';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[13,15,21,41,42,47,48,49,56,57]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"Hip hinge emphasizing hamstrings/erectors; replace if posterior chain injured.","replacement_hints":{"pool_key":"hinge_posterior","movement_pattern":"hinge"}}]'::jsonb where canonical_name = 'Barbell RDL';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[13,15,21,41,42,47,48,49,56,57]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"Hip hinge emphasizing hamstrings/erectors; replace if posterior chain injured.","replacement_hints":{"pool_key":"hinge_posterior","movement_pattern":"hinge"}}]'::jsonb where canonical_name = 'DB Romanian Deadlift';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[13,15,41,42,47,48,49]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"Glute-focused hip extension; replace if glute/hamstring injury.","replacement_hints":{"pool_key":"hinge_posterior","movement_pattern":"hinge","notes":"Often tolerated when spinal loading is limited."}}]'::jsonb where canonical_name = 'Hip Thrust';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[4,8,10,24,25,26,27,36,37,38]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"Horizontal press stresses pecs/anterior delts/triceps; replace if these are injured.","replacement_hints":{"pool_key":"horizontal_press_chest","movement_pattern":"horizontal_press"}}]'::jsonb where canonical_name = 'Barbell Bench Press';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[4,8,10,24,25,26,27,36,37,38]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"Competition bench press; treat like bench press.","replacement_hints":{"pool_key":"horizontal_press_chest","movement_pattern":"horizontal_press"}}]'::jsonb where canonical_name = 'Comp Bench Press';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[4,8,10,24,25,26,27,36,37,38]},"replace_severity_min":2,"avoid_severity_min":5,"reason":"Paused bench increases time under tension; replace earlier if aggravated.","replacement_hints":{"pool_key":"horizontal_press_chest","movement_pattern":"horizontal_press"}}]'::jsonb where canonical_name = 'T-shirt Pause Bench Press';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[4,8,10,24,25,26,27,36,37,38]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"DB bench press; treat like horizontal press.","replacement_hints":{"pool_key":"horizontal_press_chest","movement_pattern":"horizontal_press"}}]'::jsonb where canonical_name = 'DB Bench Press';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[1,8,10,27,36,37,38]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"Vertical press stresses anterior delts/triceps; replace if those are injured.","replacement_hints":{"pool_key":"vertical_press_delts","movement_pattern":"vertical_press"}}]'::jsonb where canonical_name = 'Overhead Press';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[5,6,7,9,21,30,31,32,34,35,56,57]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"Row stresses upper back/lats/biceps plus spinal bracing; replace if affected.","replacement_hints":{"pool_key":"horizontal_pull_back","movement_pattern":"horizontal_pull"}}]'::jsonb where canonical_name = 'Barbell Row';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[5,6,7,9,30,31,32,34,35]},"replace_severity_min":3,"avoid_severity_min":5,"reason":"Vertical pull stresses lats/biceps/upper back; replace if related muscles injured.","replacement_hints":{"pool_key":"vertical_pull_lats","movement_pattern":"vertical_pull"}}]'::jsonb where canonical_name = 'Pull-Up';
update public.exercises set contraindications = '[{"type":"injury","target":{"muscle_group_ids":[4,8,10,24,25,26,27,36,37,38]},"replace_severity_min":2,"avoid_severity_min":5,"reason":"Dips load chest/triceps/anterior delts; often irritating\u2014replace earlier if symptomatic.","replacement_hints":{"pool_key":"horizontal_press_chest","movement_pattern":"horizontal_press"}}]'::jsonb where canonical_name = 'Dip';

-- Contraindications for remaining exercises (from P02_06)
-- Auto-generated contraindication seed for remaining exercises


-- Adds contraindications only where current contraindications = [] and not engine_slot placeholders.


update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_press_chest','movement_pattern','horizontal_press')
  )
)
where e.canonical_name = 'Barbell Bench Press'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_press_chest','movement_pattern','horizontal_press')
  )
)
where e.canonical_name = 'Dip'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','vertical_pull_lats','movement_pattern','vertical_pull')
  )
)
where e.canonical_name = 'Pull-Up'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','vertical_press_upper','movement_pattern','vertical_press')
  )
)
where e.canonical_name = 'Overhead Press'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_press_chest','movement_pattern','horizontal_press')
  )
)
where e.canonical_name = 'Leg Press'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','squat_quad','movement_pattern','squat')
  )
)
where e.canonical_name = 'Belt Squat'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','hinge_posterior','movement_pattern','hinge')
  )
)
where e.canonical_name = 'Hip Thrust'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','core_stability','movement_pattern','stability')
  )
)
where e.canonical_name = 'RDL Stability Sequence'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','core_stability','movement_pattern','stability')
  )
)
where e.canonical_name = 'Hip Stability Lunge Sequence'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_pull_back','movement_pattern','horizontal_pull')
  )
)
where e.canonical_name = '1-Arm DB Row'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','vertical_pull_lats','movement_pattern','vertical_pull')
  )
)
where e.canonical_name = '1-Arm Lat Pulldown'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','vertical_press_upper','movement_pattern','vertical_press')
  )
)
where e.canonical_name = 'Arnold Press'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_press_chest','movement_pattern','horizontal_press')
  )
)
where e.canonical_name = 'Assisted Dip'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','vertical_pull_lats','movement_pattern','vertical_pull')
  )
)
where e.canonical_name = 'Assisted Pull-Up'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'Bar Curl'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','hinge_posterior','movement_pattern','hinge')
  )
)
where e.canonical_name = 'Barbell RDL'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'Bayesian Curl'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_press_chest','movement_pattern','horizontal_press')
  )
)
where e.canonical_name = 'Bench Dip'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','abs','movement_pattern','core_flexion')
  )
)
where e.canonical_name = 'Bicycle Crunch'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','abs','movement_pattern','core_flexion')
  )
)
where e.canonical_name = 'Cable Crunch'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'Cable Curl'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_press_chest','movement_pattern','horizontal_press')
  )
)
where e.canonical_name = 'Cable Flye'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_pull_back','movement_pattern','horizontal_pull')
  )
)
where e.canonical_name = 'Cable Row'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_pull_back','movement_pattern','horizontal_pull')
  )
)
where e.canonical_name = 'Cable Upright Row'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_pull_back','movement_pattern','horizontal_pull')
  )
)
where e.canonical_name = 'Chest-Supported T-Bar Row'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'Concentration Curl'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', null
  )
)
where e.canonical_name = 'Copenhagen Hip Adduction'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','isolation_general','movement_pattern','isolation')
  )
)
where e.canonical_name = 'Cross-Body Cable Y-Raise'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','isolation_general','movement_pattern','isolation')
  )
)
where e.canonical_name = 'Cuffed Behind-the-Back Lateral Raise'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','squat_quad','movement_pattern','squat')
  )
)
where e.canonical_name = 'DB Bulgarian Split Squat'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','calves','movement_pattern','calf')
  )
)
where e.canonical_name = 'DB Calf Jumps'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_press_chest','movement_pattern','horizontal_press')
  )
)
where e.canonical_name = 'DB Flye'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'DB Incline Curl'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','isolation_general','movement_pattern','isolation')
  )
)
where e.canonical_name = 'DB Lateral Raise'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'DB Preacher Curl'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','squat_quad','movement_pattern','squat')
  )
)
where e.canonical_name = 'DB Reverse Lunge'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_pull_back','movement_pattern','horizontal_pull')
  )
)
where e.canonical_name = 'DB Row'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'DB Scott Curl'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','isolation_general','movement_pattern','isolation')
  )
)
where e.canonical_name = 'DB Shrug'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','triceps','movement_pattern','elbow_extension')
  )
)
where e.canonical_name = 'DB Skull Crusher'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','squat_quad','movement_pattern','squat')
  )
)
where e.canonical_name = 'DB Step-Up'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','triceps','movement_pattern','elbow_extension')
  )
)
where e.canonical_name = 'DB Triceps Extension'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','abs','movement_pattern','core_flexion')
  )
)
where e.canonical_name = 'Dead Bug'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','calves','movement_pattern','calf')
  )
)
where e.canonical_name = 'Donkey Calf Raise'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'Dumbbell Curl'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','hinge_posterior','movement_pattern','hinge')
  )
)
where e.canonical_name = 'Dumbbell RDL'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_pull_back','movement_pattern','horizontal_pull')
  )
)
where e.canonical_name = 'Face Pull'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'Fat-Grip DB Curl'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_press_chest','movement_pattern','horizontal_press')
  )
)
where e.canonical_name = 'Flat DB Press'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','squat_quad','movement_pattern','squat')
  )
)
where e.canonical_name = 'Front Squat'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','hinge_posterior','movement_pattern','hinge')
  )
)
where e.canonical_name = 'Glute Bridge'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','hinge_posterior','movement_pattern','hinge')
  )
)
where e.canonical_name = 'Glute-Ham Raise'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','squat_quad','movement_pattern','squat')
  )
)
where e.canonical_name = 'Goblet Squat'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','squat_quad','movement_pattern','squat')
  )
)
where e.canonical_name = 'Hack Squat'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','vertical_pull_lats','movement_pattern','vertical_pull')
  )
)
where e.canonical_name = 'Half-Kneeling 1-Arm Lat Pulldown'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'Hammer Curl'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','abs','movement_pattern','core_flexion')
  )
)
where e.canonical_name = 'Hanging Knee Raise'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','abs','movement_pattern','core_flexion')
  )
)
where e.canonical_name = 'Hanging Leg Raise'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_pull_back','movement_pattern','horizontal_pull')
  )
)
where e.canonical_name = 'Helms Row'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','squat_quad','movement_pattern','squat')
  )
)
where e.canonical_name = 'High-Bar Back Squat'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'Incline Curl'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_press_chest','movement_pattern','horizontal_press')
  )
)
where e.canonical_name = 'Incline DB Press'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','isolation_general','movement_pattern','isolation')
  )
)
where e.canonical_name = 'Kelso Shrug'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','vertical_pull_lats','movement_pattern','vertical_pull')
  )
)
where e.canonical_name = 'Lat Pulldown'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', null
  )
)
where e.canonical_name = 'Leg Extension'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_press_chest','movement_pattern','horizontal_press')
  )
)
where e.canonical_name = 'Leg Press Calf Raise'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'Lying Leg Curl'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_press_chest','movement_pattern','horizontal_press')
  )
)
where e.canonical_name = 'Machine Chest Press'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','abs','movement_pattern','core_flexion')
  )
)
where e.canonical_name = 'Machine Crunch'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', null
  )
)
where e.canonical_name = 'Machine Hip Abduction'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', null
  )
)
where e.canonical_name = 'Machine Hip Adduction'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','vertical_pull_lats','movement_pattern','vertical_pull')
  )
)
where e.canonical_name = 'Machine Lat Pullover'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','isolation_general','movement_pattern','isolation')
  )
)
where e.canonical_name = 'Machine Lateral Raise'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','vertical_pull_lats','movement_pattern','vertical_pull')
  )
)
where e.canonical_name = 'Machine Pulldown'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_pull_back','movement_pattern','horizontal_pull')
  )
)
where e.canonical_name = 'Machine Row'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','vertical_press_upper','movement_pattern','vertical_press')
  )
)
where e.canonical_name = 'Machine Shoulder Press'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','isolation_general','movement_pattern','isolation')
  )
)
where e.canonical_name = 'Machine Shrug'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','vertical_pull_lats','movement_pattern','vertical_pull')
  )
)
where e.canonical_name = 'Neutral-Grip Pullup'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'Nordic Ham Curl'
  and (e.contraindications = '[]'::jsonb);
update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','hinge_posterior','movement_pattern','hinge')
  )
)
where e.canonical_name = 'Paused DB RDL'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_press_chest','movement_pattern','horizontal_press')
  )
)
where e.canonical_name = 'Pec Deck'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'Plate-Loaded Neck Curls'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','abs','movement_pattern','core_flexion')
  )
)
where e.canonical_name = 'Plate-Weighted Crunch'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'Preacher Curl'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','abs','movement_pattern','core_flexion')
  )
)
where e.canonical_name = 'Reverse Crunch'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','hinge_posterior','movement_pattern','hinge')
  )
)
where e.canonical_name = 'Romanian Deadlift'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_pull_back','movement_pattern','horizontal_pull')
  )
)
where e.canonical_name = 'Rope Face Pull'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','triceps','movement_pattern','elbow_extension')
  )
)
where e.canonical_name = 'Rope Pushdown'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'Scott Curl'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','vertical_press_upper','movement_pattern','vertical_press')
  )
)
where e.canonical_name = 'Seated Barbell Shoulder Press'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','calves','movement_pattern','calf')
  )
)
where e.canonical_name = 'Seated Calf Raise'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'Seated Leg Curl'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','hinge_posterior','movement_pattern','hinge')
  )
)
where e.canonical_name = 'Single-Leg DB Hip Thrust'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','squat_quad','movement_pattern','squat')
  )
)
where e.canonical_name = 'Sissy Squat'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','triceps','movement_pattern','elbow_extension')
  )
)
where e.canonical_name = 'Skull Crusher'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_press_chest','movement_pattern','horizontal_press')
  )
)
where e.canonical_name = 'Smith Machine Bench Press'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','vertical_press_upper','movement_pattern','vertical_press')
  )
)
where e.canonical_name = 'Smith Machine Shoulder Press'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'Spider Curl'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','calves','movement_pattern','calf')
  )
)
where e.canonical_name = 'Standing Calf Raise'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','vertical_press_upper','movement_pattern','vertical_press')
  )
)
where e.canonical_name = 'Standing DB Arnold Press'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','squat_quad','movement_pattern','squat')
  )
)
where e.canonical_name = 'Step-Up'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_pull_back','movement_pattern','horizontal_pull')
  )
)
where e.canonical_name = 'Supported Row'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_pull_back','movement_pattern','horizontal_pull')
  )
)
where e.canonical_name = 'T-Bar Row'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_pull_back','movement_pattern','horizontal_pull')
  )
)
where e.canonical_name = 'T-Bar Row + Kelso Shrug'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','triceps','movement_pattern','elbow_extension')
  )
)
where e.canonical_name = 'Triceps Extension'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','triceps','movement_pattern','elbow_extension')
  )
)
where e.canonical_name = 'Triceps Pushdown'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','horizontal_pull_back','movement_pattern','horizontal_pull')
  )
)
where e.canonical_name = 'Upright Row'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','isolation_general','movement_pattern','isolation')
  )
)
where e.canonical_name = 'Y-Raise'
  and (e.contraindications = '[]'::jsonb);

update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[ e.primary_muscle_group_id ]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 4,
    'reason', 'Injury-aware filtering: if affected muscle group is injured above threshold, replace or avoid this exercise.',
    'replacement_hints', jsonb_build_object('pool_key','biceps','movement_pattern','elbow_flexion')
  )
)
where e.canonical_name = 'Zottman Curl'
  and (e.contraindications = '[]'::jsonb);

  -- Push-Up
update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[e.primary_muscle_group_id]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Horizontal press pattern; if affected muscle group injury severity meets threshold, replace or avoid.',
    'replacement_hints', jsonb_build_object(
      'pool_key','horizontal_press_chest',
      'movement_pattern','horizontal_press'
    )
  )
)
where e.canonical_name = 'Push-Up';


-- Comp Deadlift
update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[e.primary_muscle_group_id]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 3,
    'avoid_severity_min', 5,
    'reason', 'Hinge pattern; if affected muscle group injury severity meets threshold, replace or avoid.',
    'replacement_hints', jsonb_build_object(
      'pool_key','hinge_posterior',
      'movement_pattern','hinge'
    )
  )
)
where e.canonical_name = 'Comp Deadlift';


-- Beltless Paused Deadlift (Below Knee)
update public.exercises e
set contraindications = jsonb_build_array(
  jsonb_build_object(
    'type','injury',
    'target', jsonb_build_object(
      'muscle_group_ids',
      to_jsonb(
        array_remove(
          array_cat(
            array[e.primary_muscle_group_id]::bigint[],
            coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
          ),
          null
        )
      )
    ),
    'replace_severity_min', 2,
    'avoid_severity_min', 5,
    'reason', 'Paused hinge variation increases time-under-tension near sticking point; replace earlier if affected muscle groups are injured.',
    'replacement_hints', jsonb_build_object(
      'pool_key','hinge_posterior',
      'movement_pattern','hinge'
    )
  )
)
where e.canonical_name = 'Beltless Paused Deadlift (Below Knee)';

-- 5. Cardio updates (from P02_07)
update public.exercises e
set
  aliases = ARRAY[
    'High-Intensity Interval Training',
    'High Intensity Interval Training',
    'Intervals',
    'HIIT Cardio',
    'HIIT Conditioning'
  ]::text[],
  movement_pattern = 'conditioning',
  equipment = ARRAY['bodyweight']::text[],
  is_bodyweight = true,
  tags = ARRAY['cardio','conditioning']::text[],
  contraindications = jsonb_build_array(
    jsonb_build_object(
      'type','injury',
      'target', jsonb_build_object(
        'muscle_group_ids',
        to_jsonb(
          array_remove(
            array_cat(
              array[e.primary_muscle_group_id]::bigint[],
              coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
            ),
            null
          )
        )
      ),
      'replace_severity_min', 2,
      'avoid_severity_min', 5,
      'reason', 'High-intensity conditioning can aggravate injured muscle groups; replace with lower-impact conditioning above threshold, and nix entirely at severe levels.',
      'replacement_hints', jsonb_build_object(
        'pool_key','cardio_conditioning',
        'movement_pattern','conditioning'
      )
    )
  ),
  default_warmups = '[]'::jsonb,
  default_warmdowns = '[]'::jsonb,
  media = '{}'::jsonb
where e.canonical_name = 'HIIT';

update public.exercises e
set
  aliases = ARRAY[
    'Zone2',
    'Zone 2',
    'Aerobic Base',
    'Aerobic Conditioning',
    'Steady-State Cardio'
  ]::text[],
  movement_pattern = 'conditioning',
  equipment = ARRAY['machine','bodyweight']::text[],
  is_bodyweight = true,
  tags = ARRAY['cardio','conditioning','zone2']::text[],
  contraindications = jsonb_build_array(
    jsonb_build_object(
      'type','injury',
      'target', jsonb_build_object(
        'muscle_group_ids',
        to_jsonb(
          array_remove(
            array_cat(
              array[e.primary_muscle_group_id]::bigint[],
              coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
            ),
            null
          )
        )
      ),
      'replace_severity_min', 2,
      'avoid_severity_min', 5,
      'reason', 'Sustained aerobic work: replace with lower-impact modality when injured above threshold; nix at severe levels.',
      'replacement_hints', jsonb_build_object('pool_key','cardio_conditioning','movement_pattern','conditioning')
    )
  ),
  default_warmups = '[]'::jsonb,
  default_warmdowns = '[]'::jsonb,
  media = '{}'::jsonb
where e.canonical_name = 'Zone 2 Cardio';

update public.exercises e
set
  aliases = ARRAY[
    'Incline Walk',
    'Treadmill Incline Walk',
    'Incline Walking',
    'Incline LISS'
  ]::text[],
  movement_pattern = 'conditioning',
  equipment = ARRAY['treadmill','machine']::text[],
  is_bodyweight = true,
  tags = ARRAY['cardio','conditioning','liss','treadmill']::text[],
  contraindications = jsonb_build_array(
    jsonb_build_object(
      'type','injury',
      'target', jsonb_build_object(
        'muscle_group_ids',
        to_jsonb(
          array_remove(
            array_cat(
              array[e.primary_muscle_group_id]::bigint[],
              coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
            ),
            null
          )
        )
      ),
      'replace_severity_min', 2,
      'avoid_severity_min', 5,
      'reason', 'Incline walking: replace with bike/row/elliptical when injured above threshold; nix at severe levels.',
      'replacement_hints', jsonb_build_object('pool_key','cardio_conditioning','movement_pattern','conditioning')
    )
  ),
  default_warmups = '[]'::jsonb,
  default_warmdowns = '[]'::jsonb,
  media = '{}'::jsonb
where e.canonical_name = 'Incline Treadmill Walk';

update public.exercises e
set
  aliases = ARRAY[
    'Bike',
    'Spin Bike',
    'Cycling (Stationary)',
    'Indoor Bike'
  ]::text[],
  movement_pattern = 'conditioning',
  equipment = ARRAY['bike','machine']::text[],
  is_bodyweight = true,
  tags = ARRAY['cardio','conditioning','bike']::text[],
  contraindications = jsonb_build_array(
    jsonb_build_object(
      'type','injury',
      'target', jsonb_build_object(
        'muscle_group_ids',
        to_jsonb(
          array_remove(
            array_cat(
              array[e.primary_muscle_group_id]::bigint[],
              coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
            ),
            null
          )
        )
      ),
      'replace_severity_min', 2,
      'avoid_severity_min', 5,
      'reason', 'Bike conditioning: replace with lower-impact modality when injured above threshold; nix at severe levels.',
      'replacement_hints', jsonb_build_object('pool_key','cardio_conditioning','movement_pattern','conditioning')
    )
  ),
  default_warmups = '[]'::jsonb,
  default_warmdowns = '[]'::jsonb,
  media = '{}'::jsonb
where e.canonical_name = 'Stationary Bike';

update public.exercises e
set
  aliases = ARRAY[
    'Stairmaster',
    'StepMill',
    'Stairs Machine'
  ]::text[],
  movement_pattern = 'conditioning',
  equipment = ARRAY['stair_climber','machine']::text[],
  is_bodyweight = true,
  tags = ARRAY['cardio','conditioning','stairs']::text[],
  contraindications = jsonb_build_array(
    jsonb_build_object(
      'type','injury',
      'target', jsonb_build_object(
        'muscle_group_ids',
        to_jsonb(
          array_remove(
            array_cat(
              array[e.primary_muscle_group_id]::bigint[],
              coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
            ),
            null
          )
        )
      ),
      'replace_severity_min', 2,
      'avoid_severity_min', 5,
      'reason', 'Stair conditioning: replace with lower-impact modality when injured above threshold; nix at severe levels.',
      'replacement_hints', jsonb_build_object('pool_key','cardio_conditioning','movement_pattern','conditioning')
    )
  ),
  default_warmups = '[]'::jsonb,
  default_warmdowns = '[]'::jsonb,
  media = '{}'::jsonb
where e.canonical_name = 'Stair Climber';

update public.exercises e
set
  aliases = ARRAY[
    'Elliptical Trainer',
    'Cross Trainer'
  ]::text[],
  movement_pattern = 'conditioning',
  equipment = ARRAY['elliptical','machine']::text[],
  is_bodyweight = true,
  tags = ARRAY['cardio','conditioning','elliptical']::text[],
  contraindications = jsonb_build_array(
    jsonb_build_object(
      'type','injury',
      'target', jsonb_build_object(
        'muscle_group_ids',
        to_jsonb(
          array_remove(
            array_cat(
              array[e.primary_muscle_group_id]::bigint[],
              coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
            ),
            null
          )
        )
      ),
      'replace_severity_min', 2,
      'avoid_severity_min', 5,
      'reason', 'Elliptical conditioning: replace with alternate modality when injured above threshold; nix at severe levels.',
      'replacement_hints', jsonb_build_object('pool_key','cardio_conditioning','movement_pattern','conditioning')
    )
  ),
  default_warmups = '[]'::jsonb,
  default_warmdowns = '[]'::jsonb,
  media = '{}'::jsonb
where e.canonical_name = 'Elliptical';

update public.exercises e
set
  aliases = ARRAY[
    'Skipping',
    'Rope Skipping',
    'Skipping Rope'
  ]::text[],
  movement_pattern = 'conditioning',
  equipment = ARRAY['jump_rope','rope']::text[],
  is_bodyweight = true,
  tags = ARRAY['cardio','conditioning','jump_rope']::text[],
  contraindications = jsonb_build_array(
    jsonb_build_object(
      'type','injury',
      'target', jsonb_build_object(
        'muscle_group_ids',
        to_jsonb(
          array_remove(
            array_cat(
              array[e.primary_muscle_group_id]::bigint[],
              coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
            ),
            null
          )
        )
      ),
      'replace_severity_min', 2,
      'avoid_severity_min', 5,
      'reason', 'Impact conditioning: replace with low-impact modality when injured above threshold; nix at severe levels.',
      'replacement_hints', jsonb_build_object('pool_key','cardio_conditioning','movement_pattern','conditioning')
    )
  ),
  default_warmups = '[]'::jsonb,
  default_warmdowns = '[]'::jsonb,
  media = '{}'::jsonb
where e.canonical_name = 'Jump Rope';

update public.exercises e
set
  aliases = ARRAY[
    'Battle Rope',
    'Rope Slams',
    'Rope Waves',
    'Ropes (Conditioning)'
  ]::text[],
  movement_pattern = 'conditioning',
  equipment = ARRAY['battle_ropes','rope']::text[],
  is_bodyweight = true,
  tags = ARRAY['cardio','conditioning','battle_ropes']::text[],
  contraindications = jsonb_build_array(
    jsonb_build_object(
      'type','injury',
      'target', jsonb_build_object(
        'muscle_group_ids',
        to_jsonb(
          array_remove(
            array_cat(
              array[e.primary_muscle_group_id]::bigint[],
              coalesce(e.secondary_muscle_group_ids, '{}'::bigint[])
            ),
            null
          )
        )
      ),
      'replace_severity_min', 2,
      'avoid_severity_min', 5,
      'reason', 'High-fatigue conditioning can aggravate injured muscle groups; replace with lower-impact modality above threshold and nix entirely at severe levels.',
      'replacement_hints', jsonb_build_object('pool_key','cardio_conditioning','movement_pattern','conditioning')
    )
  ),
  default_warmups = '[]'::jsonb,
  default_warmdowns = '[]'::jsonb,
  media = '{}'::jsonb
where e.canonical_name = 'Battle Ropes';

COMMIT;
