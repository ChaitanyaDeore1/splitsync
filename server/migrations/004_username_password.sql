ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN username text;
ALTER TABLE users ADD COLUMN password_hash text;

CREATE UNIQUE INDEX users_username_key ON users (lower(username)) WHERE username IS NOT NULL;
