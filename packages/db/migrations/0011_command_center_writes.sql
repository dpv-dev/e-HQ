create table if not exists command_center_settings (
  workspace_id text not null,
  key text not null,
  value_json jsonb not null,
  status text not null,
  updated_by_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, key)
);

create table if not exists command_center_integration_states (
  workspace_id text not null,
  integration_id text not null,
  enabled boolean not null,
  status text not null,
  updated_by_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, integration_id)
);

create table if not exists command_center_user_permissions (
  workspace_id text not null,
  user_id text not null,
  email text not null,
  role text not null,
  permissions_json jsonb not null,
  updated_by_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists command_center_settings_workspace_idx
  on command_center_settings (workspace_id);

create index if not exists command_center_integration_states_workspace_idx
  on command_center_integration_states (workspace_id);

create index if not exists command_center_user_permissions_workspace_idx
  on command_center_user_permissions (workspace_id);
