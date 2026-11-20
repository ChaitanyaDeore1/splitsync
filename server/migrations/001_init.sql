-- Money is always stored as whole paise (bigint). 100 paise = 1 rupee.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE otps (
  email text PRIMARY KEY,
  name text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE expense_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  category text NOT NULL CHECK (category IN ('flatmates', 'travel', 'friends_family')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A member belongs to one group. user_id is NULL for a person who has no account yet.
CREATE TABLE group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES expense_groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 60),
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, group_id) -- lets other tables prove a member is in the same group
);
CREATE UNIQUE INDEX group_members_user_key ON group_members (group_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX group_members_name_key ON group_members (group_id, lower(display_name));
CREATE INDEX group_members_user_idx ON group_members (user_id);

CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES expense_groups(id) ON DELETE CASCADE,
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 100),
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  paid_by uuid NOT NULL,
  split_method text NOT NULL CHECK (split_method IN ('equal', 'exact', 'percentage', 'shares')),
  category text NOT NULL CHECK (category IN ('food', 'groceries', 'rent', 'utilities', 'travel', 'stay', 'other')),
  expense_date date NOT NULL,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, group_id),
  FOREIGN KEY (paid_by, group_id) REFERENCES group_members (id, group_id)
);
CREATE INDEX expenses_group_date_idx ON expenses (group_id, expense_date DESC, created_at DESC);

CREATE TABLE expense_splits (
  expense_id uuid NOT NULL,
  group_id uuid NOT NULL,
  member_id uuid NOT NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise >= 0),
  PRIMARY KEY (expense_id, member_id),
  FOREIGN KEY (expense_id, group_id) REFERENCES expenses (id, group_id) ON DELETE CASCADE,
  FOREIGN KEY (member_id, group_id) REFERENCES group_members (id, group_id)
);
CREATE INDEX expense_splits_member_idx ON expense_splits (member_id);

-- The database itself refuses an expense whose shares do not add up exactly (checked at COMMIT).
CREATE FUNCTION check_split_total() RETURNS trigger AS $$
BEGIN
  IF (SELECT COALESCE(SUM(amount_paise), 0) FROM expense_splits WHERE expense_id = NEW.id) <> NEW.amount_paise THEN
    RAISE EXCEPTION 'Shares of expense % do not add up to its amount', NEW.id;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER expenses_split_total AFTER INSERT ON expenses
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_split_total();

CREATE TABLE settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES expense_groups(id) ON DELETE CASCADE,
  from_member uuid NOT NULL,
  to_member uuid NOT NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_member <> to_member),
  FOREIGN KEY (from_member, group_id) REFERENCES group_members (id, group_id),
  FOREIGN KEY (to_member, group_id) REFERENCES group_members (id, group_id)
);
CREATE INDEX settlements_group_idx ON settlements (group_id, created_at DESC);

-- A repeated request with the same key returns the saved response instead of paying twice.
CREATE TABLE idempotency_keys (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (char_length(key) BETWEEN 8 AND 100),
  request_hash text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- Activity timeline and audit log in one append-only table.
CREATE TABLE activity (
  id bigserial PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES expense_groups(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_id uuid,
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_group_idx ON activity (group_id, created_at DESC);

CREATE FUNCTION forbid_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'activity records cannot be changed or deleted';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER activity_append_only BEFORE UPDATE OR DELETE ON activity
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
