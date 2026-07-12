-- ═══════════════════════════════════════════════════════════════════
-- AYTIV — Supabase Schema
-- Run this once in the Supabase SQL Editor (supabase.com → SQL Editor)
-- ═══════════════════════════════════════════════════════════════════

-- ── Workspaces ─────────────────────────────────────────────────────
-- Stores each workspace + its settings (hero image, user name)
-- mode = 'light' | 'dark'
create table if not exists workspaces (
  id          text        primary key,
  name        text        not null,
  mode        text        not null default 'light',
  settings    jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

-- ── Projects ───────────────────────────────────────────────────────
-- Core project record. Complex nested fields (tracks, lyrics,
-- moodboard images, quick asks, SE chat) stored as JSONB so the
-- React app gets the same shape it always had.
create table if not exists projects (
  id                  text        primary key,
  workspace_id        text        not null references workspaces(id) on delete cascade,
  name                text        not null,
  status              text        not null default 'just_started',
  progress            int         not null default 0,
  mood_image          text,
  album_art           text,
  album_title         text        default '',
  artist_name         text        default '',
  mission_statement   text        default '',
  tracks              jsonb       not null default '[]',
  lyrics              jsonb       not null default '[]',
  moodboard_images    jsonb       not null default '[]',
  quick_asks          jsonb       not null default '[]',
  chat_history        jsonb       not null default '[]',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists projects_workspace_id_idx on projects(workspace_id);

-- ── Tasks ──────────────────────────────────────────────────────────
-- Normalized tasks — enables Sprint 2 SMS task creation, calendar
-- queries across projects, and future push notification triggers.
create table if not exists tasks (
  id           text        primary key,
  project_id   text        not null references projects(id) on delete cascade,
  workspace_id text        not null references workspaces(id) on delete cascade,
  text         text        not null,
  done         boolean     not null default false,
  due_date     text,                          -- 'YYYY-MM-DD' or null
  notes        text        default '',
  sort_order   int         not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists tasks_project_id_idx    on tasks(project_id);
create index if not exists tasks_workspace_id_idx  on tasks(workspace_id);
create index if not exists tasks_due_date_idx      on tasks(due_date) where due_date is not null;

-- ── Notes ──────────────────────────────────────────────────────────
create table if not exists notes (
  id           text        primary key,
  workspace_id text        not null references workspaces(id) on delete cascade,
  project_id   text,                          -- null = not project-specific
  title        text,
  text         text        not null default '',
  topic        text,
  saved_at     timestamptz not null default now()
);
create index if not exists notes_workspace_id_idx on notes(workspace_id);

-- ── Topics ─────────────────────────────────────────────────────────
-- Tag taxonomy per workspace (Vocals, EQ, Compression, etc.)
create table if not exists topics (
  id           text        primary key,
  workspace_id text        not null references workspaces(id) on delete cascade,
  name         text        not null,
  sort_order   int         not null default 0,
  unique(workspace_id, name)
);

-- ── Chat History ───────────────────────────────────────────────────
-- Reserved for Sprint 2 SMS conversations and cross-platform chat.
-- The desktop app's per-project Session Engineer chat lives in
-- projects.chat_history (JSONB) — kept there for performance.
create table if not exists chat_history (
  id           uuid        primary key default gen_random_uuid(),
  project_id   text        references projects(id) on delete set null,
  workspace_id text        not null references workspaces(id) on delete cascade,
  role         text        not null,          -- 'user' | 'assistant'
  content      text        not null,
  source       text        default 'sms',    -- 'sms' | 'desktop' | 'web'
  created_at   timestamptz not null default now()
);
create index if not exists chat_history_workspace_id_idx on chat_history(workspace_id);

-- ── Calendar Events ────────────────────────────────────────────────
-- Explicit calendar events (distinct from tasks with due dates).
-- Currently tasks with due_date serve as calendar entries — this
-- table is ready for Sprint 2+ explicit event creation.
create table if not exists calendar_events (
  id           text        primary key,
  workspace_id text        not null references workspaces(id) on delete cascade,
  project_id   text        references projects(id) on delete cascade,
  title        text        not null,
  date         text        not null,          -- 'YYYY-MM-DD'
  color        text,
  created_at   timestamptz not null default now()
);

-- ── Conversation Log ───────────────────────────────────────────────
-- Sprint 2: debug log for SMS ↔ Claude ↔ Supabase pipeline.
-- Fields match the spec in CLAUDE.md exactly.
create table if not exists conversation_log (
  id                      uuid        primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  direction               text,               -- 'inbound' | 'outbound'
  raw_input               text,
  detected_state          text,               -- LOST | STUCK | READY | SKEPTICAL | ADVANCED
  detected_lane           text,               -- Vision | PM | Hybrid
  ai_response             text,
  supabase_write_success  boolean,
  error                   text
);

-- ═══════════════════════════════════════════════════════════════════
-- Permissions
-- No auth yet (single-user Electron app). Allow all operations via
-- the anon key. Enable RLS with user-scoped policies in Sprint 2
-- when SMS + web app introduce multiple users.
-- ═══════════════════════════════════════════════════════════════════

alter table workspaces     disable row level security;
alter table projects       disable row level security;
alter table tasks          disable row level security;
alter table notes          disable row level security;
alter table topics         disable row level security;
alter table chat_history   disable row level security;
alter table calendar_events disable row level security;
alter table conversation_log disable row level security;
