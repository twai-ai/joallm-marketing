-- Migration: Add user security table
-- Created: 2025-11-08
-- Purpose: Store security-related user data including 2FA settings and session management

CREATE TABLE IF NOT EXISTS user_security (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Two-Factor Authentication
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT,
  two_factor_backup_codes JSONB DEFAULT '[]',
  two_factor_verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Password security
  password_changed_at TIMESTAMP WITH TIME ZONE,
  password_reset_token TEXT,
  password_reset_expires TIMESTAMP WITH TIME ZONE,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  
  -- Session management
  active_sessions JSONB DEFAULT '[]',
  last_login_at TIMESTAMP WITH TIME ZONE,
  last_login_ip TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS user_security_user_id_idx ON user_security(user_id);

-- Add updated_at trigger
CREATE TRIGGER update_user_security_updated_at 
  BEFORE UPDATE ON user_security 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE user_security IS 'Security settings and authentication data for users';
COMMENT ON COLUMN user_security.two_factor_secret IS 'TOTP secret for 2FA (encrypted)';
COMMENT ON COLUMN user_security.two_factor_backup_codes IS 'Array of one-time backup codes for 2FA recovery';
COMMENT ON COLUMN user_security.active_sessions IS 'Array of active session tokens and metadata';
COMMENT ON COLUMN user_security.locked_until IS 'Account locked until this timestamp due to failed login attempts';

