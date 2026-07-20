-- Add password field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT 'temp-password';

-- Update existing users to have a temporary password (they'll need to reset)
UPDATE users SET password = 'temp-password-needs-reset' WHERE password = 'temp-password';

-- Create index on email for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- Add constraint to ensure password is not empty
ALTER TABLE users ADD CONSTRAINT users_password_not_empty CHECK (length(password) > 0);
