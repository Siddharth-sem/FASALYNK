ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(40);

UPDATE users
SET username = 'user_' || REPLACE(SUBSTRING(id::TEXT FROM 1 FOR 8), '-', '')
WHERE username IS NULL;

ALTER TABLE users ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users(username);