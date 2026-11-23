-- DayOrbit 2.0 · 0001 · Schema
-- Money is stored as integer paise (amount_minor). Dates without a time are `date`.
-- Every shared record carries space_id; health records belong to a single user.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.space_type   as enum ('personal', 'family', 'couple', 'friends', 'office', 'custom');
create type public.member_role  as enum ('owner', 'member');
create type public.join_status  as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.split_method as enum ('equal', 'exact', 'percent', 'shares');
create type public.pay_method   as enum ('upi', 'cash', 'bank', 'other');
create type public.group_kind   as enum ('trip', 'event');
create type public.flow_level   as enum ('none', 'spotting', 'light', 'medium', 'heavy');

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '' check (char_length(display_name) <= 80),
  avatar_url    text,
  theme         text not null default 'system' check (theme in ('system', 'light', 'dark')),
  onboarded     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Optional details. Visible only to the person themselves (see RLS).
create table public.profile_private (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  age            smallint check (age between 1 and 130),
  gender         text check (char_length(gender) <= 40),
  phone_country  text check (char_length(phone_country) <= 6),
  phone          text check (char_length(phone) <= 20),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Spaces, members, features, invitations
-- ---------------------------------------------------------------------------
create table public.spaces (
  id          uuid primary key default gen_random_uuid(),
  type        public.space_type not null,
  name        text not null check (char_length(trim(name)) between 1 and 60),
  icon        text not null default 'home' check (char_length(icon) <= 24),
  color       text not null default 'indigo' check (color in ('indigo', 'honey', 'teal', 'rose', 'slate', 'plum')),
  owner_id    uuid not null references auth.users (id),
  created_at  timestamptz not null default now()
);
-- Exactly one personal space per person.
create unique index spaces_one_personal_per_user on public.spaces (owner_id) where type = 'personal';

create table public.space_members (
  space_id   uuid not null references public.spaces (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.member_role not null default 'member',
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,             -- kept for history (split balances of former members)
  primary key (space_id, user_id)
);
create index space_members_active_user on public.space_members (user_id) where left_at is null;

-- Turning a feature off hides it. It never deletes data.
create table public.space_features (
  space_id     uuid not null references public.spaces (id) on delete cascade,
  feature_key  text not null check (feature_key in ('tasks', 'shopping', 'bills', 'expenses', 'calendar', 'split', 'health')),
  enabled      boolean not null default true,
  primary key (space_id, feature_key)
);

create table public.space_invites (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  token       text not null unique,
  created_by  uuid not null references auth.users (id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  revoked_at  timestamptz
);

create table public.join_requests (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  invite_id   uuid references public.space_invites (id) on delete set null,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  status      public.join_status not null default 'pending',
  created_at  timestamptz not null default now(),
  decided_by  uuid references auth.users (id) on delete set null,
  decided_at  timestamptz
);
create unique index join_requests_one_pending on public.join_requests (space_id, user_id) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Everyday: tasks, shopping, bills, daily expenses, events
-- ---------------------------------------------------------------------------
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces (id) on delete cascade,
  title         text not null check (char_length(trim(title)) between 1 and 200),
  notes         text check (char_length(notes) <= 2000),
  due_date      date,
  due_time      time,
  assignee_id   uuid references public.profiles (id) on delete set null,
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  completed_by  uuid references auth.users (id) on delete set null
);
create index tasks_space_open on public.tasks (space_id, completed_at, due_date);

create table public.grocery_items (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces (id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 1 and 120),
  quantity      text check (char_length(quantity) <= 40),
  section       text not null default 'Other' check (char_length(section) <= 40),
  added_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  purchased_at  timestamptz,
  purchased_by  uuid references auth.users (id) on delete set null
);
create index grocery_items_space on public.grocery_items (space_id, purchased_at);

create table public.bills (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces (id) on delete cascade,
  title         text not null check (char_length(trim(title)) between 1 and 120),
  amount_minor  bigint not null check (amount_minor > 0),
  due_date      date not null,
  recurrence    text not null default 'none' check (recurrence in ('none', 'weekly', 'monthly', 'quarterly', 'yearly')),
  paid_at       timestamptz,
  paid_by       uuid references auth.users (id) on delete set null,
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index bills_space_due on public.bills (space_id, paid_at, due_date);

create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces (id) on delete cascade,
  title         text not null check (char_length(trim(title)) between 1 and 120),
  amount_minor  bigint not null check (amount_minor > 0),
  category      text not null default 'Other' check (char_length(category) <= 40),
  spent_on      date not null default current_date,
  note          text check (char_length(note) <= 500),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index expenses_space_date on public.expenses (space_id, spent_on desc);

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 120),
  starts_on   date not null,
  start_time  time,
  end_time    time,
  location    text check (char_length(location) <= 120),
  notes       text check (char_length(notes) <= 1000),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index events_space_date on public.events (space_id, starts_on);

-- ---------------------------------------------------------------------------
-- Split Bills: trips & events, shared expenses, allocations, settlements
-- ---------------------------------------------------------------------------
create table public.split_groups (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces (id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 1 and 80),
  kind         public.group_kind not null default 'trip',
  starts_on    date,
  ends_on      date,
  description  text check (char_length(description) <= 500),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index split_groups_space on public.split_groups (space_id);

create table public.split_expenses (
  id                 uuid primary key default gen_random_uuid(),
  space_id           uuid not null references public.spaces (id) on delete cascade,
  -- NULL group = an "Older cost" created before Trips & Events existed (legacy = true).
  -- NO ACTION (not RESTRICT) so deleting a whole space can cascade cleanly.
  group_id           uuid references public.split_groups (id),
  title              text not null check (char_length(trim(title)) between 1 and 120),
  amount_minor       bigint not null check (amount_minor > 0),
  paid_by            uuid not null references public.profiles (id),
  spent_on           date not null default current_date,
  method             public.split_method not null default 'equal',
  category           text check (char_length(category) <= 40),
  notes              text check (char_length(notes) <= 500),
  legacy             boolean not null default false,
  client_request_id  uuid unique,
  created_by         uuid default auth.uid() references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index split_expenses_scope on public.split_expenses (space_id, group_id);

-- One row per person who shares an expense. People not listed owe nothing for it.
create table public.split_allocations (
  expense_id   uuid not null references public.split_expenses (id) on delete cascade,
  user_id      uuid not null references public.profiles (id),
  share_minor  bigint not null check (share_minor >= 0),
  input_value  numeric,   -- exact paise, percent, or share weight as entered
  primary key (expense_id, user_id)
);

-- A record of money paid back outside DayOrbit. It never moves money.
create table public.split_settlements (
  id                 uuid primary key default gen_random_uuid(),
  space_id           uuid not null references public.spaces (id) on delete cascade,
  group_id           uuid references public.split_groups (id),
  from_user          uuid not null references public.profiles (id),
  to_user            uuid not null references public.profiles (id),
  amount_minor       bigint not null check (amount_minor > 0),
  paid_on            date not null default current_date,
  method             public.pay_method not null default 'upi',
  note               text check (char_length(note) <= 300),
  legacy             boolean not null default false,
  client_request_id  uuid unique,
  recorded_by        uuid default auth.uid() references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  check (from_user <> to_user)
);
create index split_settlements_scope on public.split_settlements (space_id, group_id);

-- ---------------------------------------------------------------------------
-- Health (always private to one person)
-- ---------------------------------------------------------------------------
create table public.medicines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 80),
  dose        text check (char_length(dose) <= 60),
  times       text[] not null default '{}'::text[],      -- e.g. {08:00,21:30}
  notes       text check (char_length(notes) <= 300),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.medicine_doses (
  medicine_id  uuid not null references public.medicines (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dose_date    date not null,
  slot         text not null,
  taken_at     timestamptz not null default now(),
  primary key (medicine_id, dose_date, slot)
);

create table public.cycle_settings (
  user_id             uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  typical_cycle       smallint not null default 28 check (typical_cycle between 15 and 60),
  typical_period      smallint not null default 5 check (typical_period between 1 and 14),
  show_fertile        boolean not null default true,
  discreet            boolean not null default true,
  remind_days_before  smallint not null default 2 check (remind_days_before between 0 and 7),
  daily_checkin       boolean not null default false,
  updated_at          timestamptz not null default now()
);

create table public.cycle_periods (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_date  date not null,
  end_date    date,
  created_at  timestamptz not null default now(),
  unique (user_id, start_date),
  check (end_date is null or end_date >= start_date)
);

create table public.cycle_logs (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date    date not null,
  flow        public.flow_level,
  feelings    text[] not null default '{}'::text[],
  body        text[] not null default '{}'::text[],
  note        text check (char_length(note) <= 500),
  updated_at  timestamptz not null default now(),
  primary key (user_id, log_date)
);

-- Consent-based sharing of cycle information with a partner in a couple space.
create table public.health_shares (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  grantee_id      uuid not null references auth.users (id) on delete cascade,
  space_id        uuid not null references public.spaces (id) on delete cascade,
  scopes          text[] not null check (cardinality(scopes) > 0 and scopes <@ array['period_dates', 'prediction']::text[]),
  created_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  last_viewed_at  timestamptz,
  check (owner_id <> grantee_id)
);
create unique index health_shares_one_active on public.health_shares (owner_id, grantee_id, space_id) where revoked_at is null;
