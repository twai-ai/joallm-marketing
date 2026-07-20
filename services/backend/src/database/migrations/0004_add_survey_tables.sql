-- Migration: Add survey tables for build-measure-learn feedback
-- Created: 2024-10-23

-- Survey responses table (anonymous feedback collection)
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type TEXT NOT NULL CHECK (user_type IN ('developer', 'business', 'analyst', 'casual')),
  company_size TEXT CHECK (company_size IN ('1-10', '11-50', '51-200', '201-1000', '1000+')),
  industry TEXT,
  current_tools JSONB NOT NULL,
  primary_use_case TEXT NOT NULL,
  pain_points JSONB NOT NULL,
  feature_requests JSONB NOT NULL,
  budget TEXT CHECK (budget IN ('free', 'under-100', '100-500', '500-2000', '2000+')),
  contact_email TEXT,
  additional_comments TEXT,
  source TEXT DEFAULT 'landing-page' CHECK (source IN ('landing-page', 'demo', 'referral', 'social-media', 'other')),
  ip_address TEXT,
  user_agent TEXT,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Survey analytics table (aggregated insights)
CREATE TABLE IF NOT EXISTS survey_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL, -- YYYY-MM-DD format
  user_type TEXT NOT NULL CHECK (user_type IN ('developer', 'business', 'analyst', 'casual')),
  total_responses INTEGER NOT NULL,
  top_pain_points JSONB,
  top_features JSONB,
  average_budget TEXT CHECK (average_budget IN ('free', 'under-100', '100-500', '500-2000', '2000+')),
  industry_distribution JSONB,
  use_case_distribution JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS survey_responses_user_type_idx ON survey_responses(user_type);
CREATE INDEX IF NOT EXISTS survey_responses_completed_at_idx ON survey_responses(completed_at);
CREATE INDEX IF NOT EXISTS survey_responses_source_idx ON survey_responses(source);

CREATE INDEX IF NOT EXISTS survey_analytics_date_idx ON survey_analytics(date);
CREATE INDEX IF NOT EXISTS survey_analytics_user_type_idx ON survey_analytics(user_type);
