-- In-app notifications. dedupe_key lets the server create some notifications (like the monthly recap) only once.
CREATE TABLE notifications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, id DESC);
CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;
CREATE UNIQUE INDEX notifications_dedupe_key ON notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Shareable reports. A report is a frozen snapshot (payload), so a public link never exposes live data.
-- The link token itself is never stored, only its hash.
CREATE TABLE shared_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('monthly', 'group')),
  title text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shared_reports_user_idx ON shared_reports (user_id, created_at DESC);
