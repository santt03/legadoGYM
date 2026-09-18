CREATE TABLE IF NOT EXISTS gyms (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  logo_data_url text,
  default_membership_months integer NOT NULL DEFAULT 1 CHECK (default_membership_months IN (1,3,6,12)),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS logo_data_url text;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS default_membership_months integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES gyms(id),
  email text UNIQUE,
  username text UNIQUE,
  password_hash text,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('ADMIN', 'TRAINER')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users (lower(username));

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES gyms(id),
  first_name text NOT NULL,
  last_name text NOT NULL,
  dni text,
  phone text NOT NULL,
  birth_date date,
  weight_kg numeric(5,2),
  objective text NOT NULL DEFAULT '',
  start_date date NOT NULL,
  end_date date NOT NULL,
  inactive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_period CHECK (end_date >= start_date),
  CONSTRAINT valid_weight CHECK (weight_kg IS NULL OR weight_kg > 0)
);

CREATE INDEX IF NOT EXISTS members_gym_name_idx ON members (gym_id, last_name, first_name);
CREATE INDEX IF NOT EXISTS members_gym_end_date_idx ON members (gym_id, end_date);
ALTER TABLE members ADD COLUMN IF NOT EXISTS dni text;
CREATE UNIQUE INDEX IF NOT EXISTS members_gym_dni_idx ON members (gym_id, dni) WHERE dni IS NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_dni_format') THEN
    ALTER TABLE members ADD CONSTRAINT members_dni_format CHECK (dni IS NULL OR dni ~ '^[0-9]{7,8}$');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES gyms(id),
  name text NOT NULL,
  muscle_group text NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id, name)
);

CREATE TABLE IF NOT EXISTS muscle_groups (
  id uuid PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES gyms(id),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80 AND name NOT LIKE '%,%')
);
CREATE UNIQUE INDEX IF NOT EXISTS muscle_groups_gym_name_idx ON muscle_groups (gym_id, lower(name));

CREATE TABLE IF NOT EXISTS training_plans (
  id uuid PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES gyms(id),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  name text NOT NULL,
  objective text NOT NULL DEFAULT '',
  start_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS training_plans_member_idx ON training_plans (gym_id, member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS training_weeks (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  week_number integer NOT NULL CHECK (week_number BETWEEN 1 AND 12),
  UNIQUE (plan_id, week_number)
);
ALTER TABLE training_weeks DROP CONSTRAINT IF EXISTS training_weeks_week_number_check;
ALTER TABLE training_weeks ADD CONSTRAINT training_weeks_week_number_check CHECK (week_number BETWEEN 1 AND 12);

CREATE TABLE IF NOT EXISTS training_days (
  id uuid PRIMARY KEY,
  week_id uuid NOT NULL REFERENCES training_weeks(id) ON DELETE CASCADE,
  name text NOT NULL,
  muscle_group text NOT NULL DEFAULT '',
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (week_id, position)
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id uuid PRIMARY KEY,
  day_id uuid NOT NULL REFERENCES training_days(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position >= 0),
  sets integer NOT NULL CHECK (sets > 0),
  reps text NOT NULL,
  load text NOT NULL DEFAULT '',
  rest_seconds integer CHECK (rest_seconds IS NULL OR rest_seconds >= 0),
  notes text NOT NULL DEFAULT '',
  UNIQUE (day_id, position)
);

INSERT INTO gyms (id, name) VALUES ('00000000-0000-4000-8000-000000000001', 'Legado Gym')
ON CONFLICT (id) DO NOTHING;

INSERT INTO muscle_groups (id, gym_id, name)
SELECT gen_random_uuid(), '00000000-0000-4000-8000-000000000001', name
FROM (VALUES ('Pecho'), ('Espalda'), ('Piernas'), ('Hombros'), ('Tríceps'), ('Bíceps')) AS defaults(name)
WHERE NOT EXISTS (SELECT 1 FROM muscle_groups g WHERE g.gym_id='00000000-0000-4000-8000-000000000001' AND lower(g.name)=lower(defaults.name));
INSERT INTO muscle_groups (id, gym_id, name)
SELECT gen_random_uuid(), e.gym_id, e.muscle_group FROM exercises e
WHERE NOT EXISTS (SELECT 1 FROM muscle_groups g WHERE g.gym_id=e.gym_id AND lower(g.name)=lower(e.muscle_group))
GROUP BY e.gym_id, e.muscle_group;

UPDATE exercises SET muscle_group='Hombros' WHERE gym_id='00000000-0000-4000-8000-000000000001' AND lower(muscle_group)='hombro';
UPDATE exercises SET muscle_group='Tríceps' WHERE gym_id='00000000-0000-4000-8000-000000000001' AND translate(lower(muscle_group),'é','e')='triceps';
DELETE FROM muscle_groups WHERE gym_id='00000000-0000-4000-8000-000000000001' AND lower(name)='hombro';
DELETE FROM muscle_groups WHERE gym_id='00000000-0000-4000-8000-000000000001' AND translate(lower(name),'é','e')='triceps';

CREATE TABLE IF NOT EXISTS food_groups (
  id uuid PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES gyms(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id, name)
);

INSERT INTO food_groups (id, gym_id, name)
SELECT gen_random_uuid(), '00000000-0000-4000-8000-000000000001', group_name
FROM (VALUES ('Proteínas'), ('Carbohidratos'), ('Grasas'), ('Frutas'), ('Verduras'), ('Lácteos')) AS defaults(group_name)
WHERE NOT EXISTS (SELECT 1 FROM food_groups WHERE gym_id='00000000-0000-4000-8000-000000000001' AND lower(name)=lower(group_name));

CREATE TABLE IF NOT EXISTS foods (
  id uuid PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES gyms(id),
  group_id uuid REFERENCES food_groups(id) ON DELETE RESTRICT,
  name text NOT NULL,
  calories numeric(7,2) NOT NULL DEFAULT 0 CHECK (calories >= 0),
  protein numeric(7,2) NOT NULL DEFAULT 0 CHECK (protein >= 0),
  carbs numeric(7,2) NOT NULL DEFAULT 0 CHECK (carbs >= 0),
  fat numeric(7,2) NOT NULL DEFAULT 0 CHECK (fat >= 0),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id, name)
);
ALTER TABLE foods ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES food_groups(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS foods_gym_name_idx ON foods (gym_id, lower(name));

UPDATE foods f SET group_id=g.id
FROM food_groups g,
  (VALUES
    ('Aceite de oliva','Grasas'), ('Almendras','Grasas'), ('Palta','Grasas'),
    ('Arroz blanco cocido','Carbohidratos'), ('Avena','Carbohidratos'), ('Batata','Carbohidratos'), ('Pan integral','Carbohidratos'),
    ('Atún en lata al agua','Proteínas'), ('Carne vacuna magra','Proteínas'), ('Huevos','Proteínas'), ('Pechuga de pollo','Proteínas'),
    ('Banana','Frutas'), ('Manzana','Frutas'),
    ('Leche descremada','Lácteos'), ('Queso untable','Lácteos'), ('Yogur natural','Lácteos')
  ) AS defaults(food_name,group_name)
WHERE f.gym_id='00000000-0000-4000-8000-000000000001' AND f.group_id IS NULL
  AND lower(f.name)=lower(defaults.food_name) AND g.gym_id=f.gym_id AND g.name=defaults.group_name;

CREATE TABLE IF NOT EXISTS diets (
  id uuid PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES gyms(id),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  name text NOT NULL,
  objective text NOT NULL DEFAULT '',
  start_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS diets_member_idx ON diets (gym_id, member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS diet_weeks (
  id uuid PRIMARY KEY,
  diet_id uuid NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
  week_number integer NOT NULL CHECK (week_number BETWEEN 1 AND 12),
  UNIQUE (diet_id, week_number)
);
ALTER TABLE diet_weeks DROP CONSTRAINT IF EXISTS diet_weeks_week_number_check;
ALTER TABLE diet_weeks ADD CONSTRAINT diet_weeks_week_number_check CHECK (week_number BETWEEN 1 AND 12);

CREATE TABLE IF NOT EXISTS diet_days (
  id uuid PRIMARY KEY,
  week_id uuid NOT NULL REFERENCES diet_weeks(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (week_id, position)
);

CREATE TABLE IF NOT EXISTS diet_meals (
  id uuid PRIMARY KEY,
  day_id uuid NOT NULL REFERENCES diet_days(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (day_id, position)
);

CREATE TABLE IF NOT EXISTS diet_items (
  id uuid PRIMARY KEY,
  meal_id uuid NOT NULL REFERENCES diet_meals(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
  quantity text NOT NULL DEFAULT '',
  grams numeric(8,2) CHECK (grams IS NULL OR grams > 0),
  notes text NOT NULL DEFAULT '',
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (meal_id, position)
);
