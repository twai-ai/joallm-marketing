-- Acquisition Intelligence v1 primitives

CREATE TABLE IF NOT EXISTS acquisition_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  display_name TEXT,
  primary_email TEXT,
  primary_phone TEXT,
  status TEXT NOT NULL DEFAULT 'identified',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS acquisition_persons_owner_user_id_idx ON acquisition_persons(owner_user_id);
CREATE INDEX IF NOT EXISTS acquisition_persons_organization_id_idx ON acquisition_persons(organization_id);
CREATE INDEX IF NOT EXISTS acquisition_persons_primary_phone_idx ON acquisition_persons(owner_user_id, primary_phone);
CREATE INDEX IF NOT EXISTS acquisition_persons_primary_email_idx ON acquisition_persons(owner_user_id, primary_email);

CREATE TABLE IF NOT EXISTS acquisition_person_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  person_id UUID NOT NULL REFERENCES acquisition_persons(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT acquisition_person_identities_owner_provider_external_unique
    UNIQUE (owner_user_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS acquisition_person_identities_person_id_idx
  ON acquisition_person_identities(person_id);

CREATE TABLE IF NOT EXISTS acquisition_initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS acquisition_initiatives_owner_user_id_idx
  ON acquisition_initiatives(owner_user_id);

CREATE TABLE IF NOT EXISTS acquisition_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  initiative_id UUID NOT NULL REFERENCES acquisition_initiatives(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS acquisition_campaigns_initiative_id_idx ON acquisition_campaigns(initiative_id);
CREATE INDEX IF NOT EXISTS acquisition_campaigns_owner_user_id_idx ON acquisition_campaigns(owner_user_id);

CREATE TABLE IF NOT EXISTS acquisition_source_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  external_account_id TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_success_at TIMESTAMP,
  last_error_at TIMESTAMP,
  last_error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS acquisition_source_connections_owner_user_id_idx
  ON acquisition_source_connections(owner_user_id);
CREATE INDEX IF NOT EXISTS acquisition_source_connections_provider_idx
  ON acquisition_source_connections(provider);
CREATE INDEX IF NOT EXISTS acquisition_source_connections_external_account_idx
  ON acquisition_source_connections(provider, external_account_id);

CREATE TABLE IF NOT EXISTS acquisition_raw_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  source_connection_id UUID NOT NULL REFERENCES acquisition_source_connections(id) ON DELETE CASCADE,
  external_event_id TEXT,
  event_name TEXT,
  received_at TIMESTAMP DEFAULT NOW() NOT NULL,
  occurred_at TIMESTAMP,
  headers JSONB,
  payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS acquisition_raw_records_source_connection_id_idx
  ON acquisition_raw_records(source_connection_id);
CREATE INDEX IF NOT EXISTS acquisition_raw_records_owner_user_id_idx
  ON acquisition_raw_records(owner_user_id);
CREATE INDEX IF NOT EXISTS acquisition_raw_records_payload_hash_idx
  ON acquisition_raw_records(owner_user_id, payload_hash);
CREATE INDEX IF NOT EXISTS acquisition_raw_records_processing_status_idx
  ON acquisition_raw_records(processing_status);

CREATE TABLE IF NOT EXISTS acquisition_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  source_connection_id UUID NOT NULL REFERENCES acquisition_source_connections(id) ON DELETE CASCADE,
  raw_record_id UUID NOT NULL REFERENCES acquisition_raw_records(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  external_event_id TEXT,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  received_at TIMESTAMP DEFAULT NOW() NOT NULL,
  person_id UUID REFERENCES acquisition_persons(id) ON DELETE SET NULL,
  initiative_id UUID REFERENCES acquisition_initiatives(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES acquisition_campaigns(id) ON DELETE SET NULL,
  channel TEXT,
  object_type TEXT,
  object_id TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS acquisition_events_owner_user_id_idx ON acquisition_events(owner_user_id);
CREATE INDEX IF NOT EXISTS acquisition_events_person_id_idx ON acquisition_events(person_id);
CREATE INDEX IF NOT EXISTS acquisition_events_event_type_idx ON acquisition_events(event_type);
CREATE INDEX IF NOT EXISTS acquisition_events_occurred_at_idx ON acquisition_events(owner_user_id, occurred_at);
CREATE INDEX IF NOT EXISTS acquisition_events_raw_record_id_idx ON acquisition_events(raw_record_id);

CREATE TABLE IF NOT EXISTS acquisition_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  person_id UUID NOT NULL REFERENCES acquisition_persons(id) ON DELETE CASCADE,
  initiative_id UUID REFERENCES acquisition_initiatives(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES acquisition_campaigns(id) ON DELETE SET NULL,
  source_event_id UUID NOT NULL REFERENCES acquisition_events(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  direction TEXT,
  summary TEXT,
  occurred_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS acquisition_interactions_person_id_idx ON acquisition_interactions(person_id);
CREATE INDEX IF NOT EXISTS acquisition_interactions_owner_user_id_idx ON acquisition_interactions(owner_user_id);
CREATE INDEX IF NOT EXISTS acquisition_interactions_occurred_at_idx ON acquisition_interactions(person_id, occurred_at);
CREATE INDEX IF NOT EXISTS acquisition_interactions_source_event_id_idx ON acquisition_interactions(source_event_id);
