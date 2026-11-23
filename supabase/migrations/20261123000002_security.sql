-- DayOrbit 2.0 · 0002 · Access rules (Row Level Security)
-- Privacy is enforced here, in the database — not by hiding buttons in the app.

-- ---------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER so policies don't recurse on space_members)
-- ---------------------------------------------------------------------------
create or replace function public.is_member(p_space uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = p_space and m.user_id = auth.uid() and m.left_at is null
  );
$$;

create or replace function public.is_owner(p_space uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = p_space and m.user_id = auth.uid() and m.left_at is null and m.role = 'owner'
  );
$$;

-- Is p_user a current member of p_space?
create or replace function public.is_member_user(p_space uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = p_space and m.user_id = p_user and m.left_at is null
  );
$$;

-- Was p_user ever a member of p_space? (Former members can still settle old balances.)
create or replace function public.was_member_user(p_space uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.space_members m where m.space_id = p_space and m.user_id = p_user);
$$;

-- Do I currently share any space with p_user?
create or replace function public.shares_space_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.space_members a
    join public.space_members b on b.space_id = a.space_id
    where a.user_id = auth.uid() and a.left_at is null
      and b.user_id = p_user and b.left_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Turn RLS on everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.profile_private    enable row level security;
alter table public.spaces             enable row level security;
alter table public.space_members      enable row level security;
alter table public.space_features     enable row level security;
alter table public.space_invites      enable row level security;
alter table public.join_requests      enable row level security;
alter table public.tasks              enable row level security;
alter table public.grocery_items      enable row level security;
alter table public.bills              enable row level security;
alter table public.expenses           enable row level security;
alter table public.events             enable row level security;
alter table public.split_groups       enable row level security;
alter table public.split_expenses     enable row level security;
alter table public.split_allocations  enable row level security;
alter table public.split_settlements  enable row level security;
alter table public.medicines          enable row level security;
alter table public.medicine_doses     enable row level security;
alter table public.cycle_settings     enable row level security;
alter table public.cycle_periods      enable row level security;
alter table public.cycle_logs         enable row level security;
alter table public.health_shares      enable row level security;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
-- Display names are visible to yourself and to people you share a space with.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_space_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Age, gender and phone: only ever visible to their owner.
create policy profile_private_own on public.profile_private for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Spaces (creation, membership and invitations go through functions in 0003)
-- ---------------------------------------------------------------------------
create policy spaces_select on public.spaces for select to authenticated
  using (public.is_member(id));
create policy spaces_update on public.spaces for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));

create policy space_members_select on public.space_members for select to authenticated
  using (public.is_member(space_id));

create policy space_features_select on public.space_features for select to authenticated
  using (public.is_member(space_id));

create policy space_invites_select on public.space_invites for select to authenticated
  using (public.is_owner(space_id));

create policy join_requests_select on public.join_requests for select to authenticated
  using (user_id = auth.uid() or public.is_owner(space_id));

-- ---------------------------------------------------------------------------
-- Everyday records: any current member of the space can read and edit them
-- ---------------------------------------------------------------------------
create policy tasks_member on public.tasks for all to authenticated
  using (public.is_member(space_id))
  with check (public.is_member(space_id) and (assignee_id is null or public.is_member_user(space_id, assignee_id)));

create policy grocery_items_member on public.grocery_items for all to authenticated
  using (public.is_member(space_id)) with check (public.is_member(space_id));

create policy bills_member on public.bills for all to authenticated
  using (public.is_member(space_id)) with check (public.is_member(space_id));

create policy expenses_member on public.expenses for all to authenticated
  using (public.is_member(space_id)) with check (public.is_member(space_id));

create policy events_member on public.events for all to authenticated
  using (public.is_member(space_id)) with check (public.is_member(space_id));

-- ---------------------------------------------------------------------------
-- Split Bills
-- ---------------------------------------------------------------------------
create policy split_groups_select on public.split_groups for select to authenticated
  using (public.is_member(space_id));
create policy split_groups_insert on public.split_groups for insert to authenticated
  with check (public.is_member(space_id));
create policy split_groups_update on public.split_groups for update to authenticated
  using (public.is_member(space_id)) with check (public.is_member(space_id));
-- Deleting a trip goes through delete_split_group(), which removes its records explicitly.

create policy split_expenses_select on public.split_expenses for select to authenticated
  using (public.is_member(space_id));
-- Creator, payer or space owner may delete. Inserts/updates go through validated functions.
create policy split_expenses_delete on public.split_expenses for delete to authenticated
  using (public.is_member(space_id)
         and (created_by = auth.uid() or paid_by = auth.uid() or public.is_owner(space_id)));

create policy split_allocations_select on public.split_allocations for select to authenticated
  using (exists (select 1 from public.split_expenses e where e.id = expense_id and public.is_member(e.space_id)));

create policy split_settlements_select on public.split_settlements for select to authenticated
  using (public.is_member(space_id));
create policy split_settlements_insert on public.split_settlements for insert to authenticated
  with check (
    public.is_member(space_id)
    and recorded_by = auth.uid()
    and public.was_member_user(space_id, from_user)
    and public.was_member_user(space_id, to_user)
    and (group_id is null or exists (select 1 from public.split_groups g where g.id = group_id and g.space_id = split_settlements.space_id))
  );
create policy split_settlements_delete on public.split_settlements for delete to authenticated
  using (public.is_member(space_id)
         and (recorded_by = auth.uid() or from_user = auth.uid() or to_user = auth.uid() or public.is_owner(space_id)));

-- ---------------------------------------------------------------------------
-- Health: only the owner. Partners see shared cycle info only via get_shared_cycle().
-- ---------------------------------------------------------------------------
create policy medicines_own on public.medicines for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy medicine_doses_own on public.medicine_doses for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and exists (select 1 from public.medicines m where m.id = medicine_id and m.user_id = auth.uid()));

create policy cycle_settings_own on public.cycle_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy cycle_periods_own on public.cycle_periods for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy cycle_logs_own on public.cycle_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy health_shares_select on public.health_shares for select to authenticated
  using (owner_id = auth.uid() or grantee_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- Owners may rename and restyle a space, but never change its type or owner directly.
revoke update on public.spaces from authenticated;
grant update (name, icon, color) on public.spaces to authenticated;

-- People can edit their own profile fields, but not their id.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, theme, onboarded) on public.profiles to authenticated;
