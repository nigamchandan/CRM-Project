-- ============================================================================
-- CRM Database Schema (PostgreSQL)
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- ROLES (reference table)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- LOCATIONS (enterprise: physical sites/offices)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL UNIQUE,
  code        VARCHAR(20),                 -- short code, e.g. 'NYC', 'BLR'
  address     TEXT,
  timezone    VARCHAR(50) DEFAULT 'UTC',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active);

-- ----------------------------------------------------------------------------
-- TEAMS (engineering / support teams within a location)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  location_id  INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, location_id)
);
CREATE INDEX IF NOT EXISTS idx_teams_location ON teams(location_id);

-- ----------------------------------------------------------------------------
-- USERS  (must be created before any table that references users(id))
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(50)  NOT NULL DEFAULT 'user',   -- admin | manager | engineer | user
  avatar_url  VARCHAR(255),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- Enterprise extensions: reporting hierarchy + location/team membership
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id  INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id     INTEGER REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_manager  ON users(manager_id);
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location_id);
CREATE INDEX IF NOT EXISTS idx_users_team     ON users(team_id);

-- ----------------------------------------------------------------------------
-- PROJECTS (customer projects — every ticket belongs to a project)
--   Each project has a Project Manager who must be notified when issues arise.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id                 SERIAL PRIMARY KEY,
  name               VARCHAR(150) NOT NULL,
  code               VARCHAR(20),                                          -- short ID, e.g. 'SRS', 'ASTR'
  location_id        INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  project_manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer           VARCHAR(150),                                         -- customer / company name
  customer_email     VARCHAR(150),
  customer_phone     VARCHAR(50),
  description        TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, location_id)
);
CREATE INDEX IF NOT EXISTS idx_projects_location ON projects(location_id);
CREATE INDEX IF NOT EXISTS idx_projects_pm       ON projects(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_active   ON projects(is_active);

-- ----------------------------------------------------------------------------
-- CONTACTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  email      VARCHAR(150),
  phone      VARCHAR(50),
  company    VARCHAR(150),
  address    TEXT,
  tags       TEXT[] NOT NULL DEFAULT '{}',
  owner_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contacts_name    ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_email   ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_contacts_tags    ON contacts USING GIN (tags);

-- ----------------------------------------------------------------------------
-- LEADS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  email       VARCHAR(150),
  phone       VARCHAR(50),
  company     VARCHAR(150),
  source      VARCHAR(100),
  status      VARCHAR(30) NOT NULL DEFAULT 'new',   -- new|contacted|qualified|converted|lost
  value       NUMERIC(14,2) NOT NULL DEFAULT 0,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_status      ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);

-- ----------------------------------------------------------------------------
-- PIPELINE STAGES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  color      VARCHAR(20) NOT NULL DEFAULT '#6b7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stages_position ON pipeline_stages(position);

-- ----------------------------------------------------------------------------
-- DEALS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deals (
  id                  SERIAL PRIMARY KEY,
  title               VARCHAR(200) NOT NULL,
  value               NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency            VARCHAR(10) NOT NULL DEFAULT 'USD',
  stage_id            INTEGER REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  contact_id          INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  owner_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expected_close_date DATE,
  notes               TEXT,
  position            INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deals_stage    ON deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_owner    ON deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact  ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_position ON deals(stage_id, position);

-- ----------------------------------------------------------------------------
-- TICKET PIPELINES + STAGES (HubSpot-style)
--   A pipeline groups a fixed flow of stages a ticket moves through.
--   Each stage has a status_category that maps onto the legacy `tickets.status`
--   column for back-compat. is_sla_paused = TRUE pauses the SLA clock while
--   the ticket sits in that stage (e.g. "Waiting for Customer").
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_pipelines (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL UNIQUE,
  description TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_pipeline_stages (
  id              SERIAL PRIMARY KEY,
  pipeline_id     INTEGER NOT NULL REFERENCES ticket_pipelines(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  position        INTEGER NOT NULL DEFAULT 0,
  status_category VARCHAR(30)  NOT NULL DEFAULT 'open',  -- open|in_progress|waiting|resolved|closed|merged
  color           VARCHAR(20)  NOT NULL DEFAULT '#6b7280',
  is_closed_state BOOLEAN      NOT NULL DEFAULT FALSE,
  is_sla_paused   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (pipeline_id, name)
);
CREATE INDEX IF NOT EXISTS idx_tps_pipeline ON ticket_pipeline_stages(pipeline_id, position);

-- ----------------------------------------------------------------------------
-- TICKETS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
  id          SERIAL PRIMARY KEY,
  subject     VARCHAR(250) NOT NULL,
  description TEXT,
  status      VARCHAR(30) NOT NULL DEFAULT 'open',   -- open|in_progress|resolved|closed|escalated
  priority    VARCHAR(20) NOT NULL DEFAULT 'medium', -- low|medium|high
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  contact_id  INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tickets_status      ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority    ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);

-- Enterprise extensions: project, location, engineer, manager hierarchy, source, escalation, SLA
-- Priority value 'critical' (labelled "Urgent" in the UI to mirror HubSpot) is also supported.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pipeline_id          INTEGER REFERENCES ticket_pipelines(id)       ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pipeline_stage_id    INTEGER REFERENCES ticket_pipeline_stages(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS project_manager_id   INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS project_id           INTEGER REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS location_id          INTEGER REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS team_id              INTEGER REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_engineer_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reporting_manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS source               VARCHAR(40);     -- email|phone|portal|chat|api|other
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reporter_name        VARCHAR(150);    -- free-form when no contact selected
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reporter_email       VARCHAR(150);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reporter_phone       VARCHAR(50);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalation_level     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalated_at         TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_due_at           TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_paused_at        TIMESTAMPTZ;     -- non-NULL while in a SLA-paused stage
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at            TIMESTAMPTZ;

-- User-facing, unique ticket number derived from the primary key (e.g. TKT-00012).
-- Implemented as a STORED generated column so it is automatically populated for
-- existing rows and stays in sync without app-level logic.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'tickets' AND column_name = 'ticket_no'
  ) THEN
    ALTER TABLE tickets ADD COLUMN ticket_no VARCHAR(20)
      GENERATED ALWAYS AS ('TKT-' || LPAD(id::text, 5, '0')) STORED;
  END IF;
END$$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_ticket_no ON tickets(ticket_no);
CREATE INDEX IF NOT EXISTS idx_tickets_pipeline            ON tickets(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_tickets_pipeline_stage      ON tickets(pipeline_stage_id);
CREATE INDEX IF NOT EXISTS idx_tickets_project_manager     ON tickets(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_tickets_project             ON tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_tickets_location            ON tickets(location_id);
CREATE INDEX IF NOT EXISTS idx_tickets_team                ON tickets(team_id);
CREATE INDEX IF NOT EXISTS idx_tickets_engineer            ON tickets(assigned_engineer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_manager             ON tickets(reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_due             ON tickets(sla_due_at);
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority_due ON tickets(status, priority, sla_due_at);

-- ----------------------------------------------------------------------------
-- TICKET COMMENTS (with attachments JSONB)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_comments (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);

-- ----------------------------------------------------------------------------
-- TASKS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(250) NOT NULL,
  description  TEXT,
  due_date     TIMESTAMPTZ,
  priority     VARCHAR(20) NOT NULL DEFAULT 'medium',
  status       VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|in_progress|completed
  assigned_to  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  related_type VARCHAR(30),   -- e.g. 'lead','deal','ticket','contact'
  related_id   INTEGER,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date    ON tasks(due_date);

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,   -- e.g. lead.new, ticket.assigned
  title      VARCHAR(200) NOT NULL,
  message    TEXT,
  link       VARCHAR(500),
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user  ON notifications(user_id, is_read);

-- ----------------------------------------------------------------------------
-- SETTINGS (key/value store)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- AUDIT LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS logs (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(100) NOT NULL,
  entity     VARCHAR(50),
  entity_id  INTEGER,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_logs_user        ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_action      ON logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_entity      ON logs(entity, entity_id);
-- created_at index powers the retention sweep AND every "recent / range" filter.
CREATE INDEX IF NOT EXISTS idx_logs_created_at  ON logs(created_at DESC);
