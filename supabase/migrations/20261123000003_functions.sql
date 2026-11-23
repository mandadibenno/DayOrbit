-- DayOrbit 2.0 · 0003 · Server functions (RPC) and triggers
-- Error messages are short stable codes (e.g. 'not_owner'); the app maps them to friendly text.

-- ===========================================================================
-- Defaults
-- ===========================================================================
create or replace function public.all_feature_keys(p_type public.space_type)
returns text[] language sql immutable set search_path = public as $$
  select case when p_type = 'personal'
    then array['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'health']
    else array['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'split'] end;
$$;

create or replace function public.default_features(p_type public.space_type)
returns text[] language sql immutable set search_path = public as $$
  select case p_type
    when 'personal' then array['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'health']
    when 'family'   then array['tasks', 'shopping', 'bills', 'expenses', 'calendar']
    when 'couple'   then array['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'split']
    when 'friends'  then array['tasks', 'shopping', 'calendar', 'split']
    when 'office'   then array['tasks', 'calendar', 'expenses']
    else                 array['tasks', 'shopping', 'calendar']
  end;
$$;

create or replace function public.default_color(p_type public.space_type)
returns text language sql immutable set search_path = public as $$
  select case p_type when 'personal' then 'indigo' when 'family' then 'honey' when 'couple' then 'rose'
    when 'friends' then 'teal' when 'office' then 'slate' else 'plum' end;
$$;

create or replace function public.default_icon(p_type public.space_type)
returns text language sql immutable set search_path = public as $$
  select case p_type when 'personal' then 'user' when 'family' then 'home' when 'couple' then 'heart'
    when 'friends' then 'users' when 'office' then 'briefcase' else 'star' end;
$$;

-- ===========================================================================
-- Account setup: profile + private My Space (also backfills existing users)
-- ===========================================================================
create or replace function public.setup_user(p_user uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_space uuid;
begin
  insert into public.profiles (id, display_name)
  values (p_user, left(coalesce(nullif(trim(p_name), ''), 'Friend'), 80))
  on conflict (id) do nothing;

  select id into v_space from public.spaces where owner_id = p_user and type = 'personal';
  if v_space is null then
    insert into public.spaces (type, name, icon, color, owner_id)
    values ('personal', 'My Space', 'user', 'indigo', p_user)
    returning id into v_space;
    insert into public.space_members (space_id, user_id, role) values (v_space, p_user, 'owner');
    insert into public.space_features (space_id, feature_key, enabled)
    select v_space, k, true from unnest(public.default_features('personal')) as k;
  end if;

  insert into public.cycle_settings (user_id) values (p_user) on conflict (user_id) do nothing;
  return v_space;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.setup_user(new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Called by the app after sign-in. Safe to call repeatedly; returns the My Space id.
create or replace function public.ensure_my_setup()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)) into v_name
  from auth.users where id = auth.uid();
  return public.setup_user(auth.uid(), v_name);
end $$;

-- ===========================================================================
-- Guards
-- ===========================================================================
-- My Space can never gain other members.
create or replace function public.guard_personal_members()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.spaces s where s.id = new.space_id and s.type = 'personal' and s.owner_id <> new.user_id) then
    raise exception 'personal_space_is_private';
  end if;
  return new;
end $$;

drop trigger if exists space_members_personal_guard on public.space_members;
create trigger space_members_personal_guard
  before insert or update on public.space_members
  for each row execute function public.guard_personal_members();

-- When someone leaves or is removed, health sharing in that space ends automatically.
create or replace function public.on_member_left()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.left_at is not null and old.left_at is null then
    update public.health_shares
       set revoked_at = now()
     where space_id = new.space_id and revoked_at is null
       and (owner_id = new.user_id or grantee_id = new.user_id);
  end if;
  return new;
end $$;

drop trigger if exists space_members_left on public.space_members;
create trigger space_members_left
  after update of left_at on public.space_members
  for each row execute function public.on_member_left();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists split_expenses_touch on public.split_expenses;
create trigger split_expenses_touch before update on public.split_expenses
  for each row execute function public.touch_updated_at();
drop trigger if exists cycle_logs_touch on public.cycle_logs;
create trigger cycle_logs_touch before update on public.cycle_logs
  for each row execute function public.touch_updated_at();
drop trigger if exists cycle_settings_touch on public.cycle_settings;
create trigger cycle_settings_touch before update on public.cycle_settings
  for each row execute function public.touch_updated_at();
drop trigger if exists profile_private_touch on public.profile_private;
create trigger profile_private_touch before update on public.profile_private
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- Spaces
-- ===========================================================================
create or replace function public.list_my_spaces()
returns table (
  id uuid, type public.space_type, name text, icon text, color text, owner_id uuid,
  role public.member_role, member_count bigint, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select s.id, s.type, s.name, s.icon, s.color, s.owner_id, m.role,
         (select count(*) from public.space_members x where x.space_id = s.id and x.left_at is null),
         s.created_at
  from public.spaces s
  join public.space_members m on m.space_id = s.id and m.user_id = auth.uid() and m.left_at is null
  order by (s.type = 'personal') desc, s.created_at;
$$;

-- Members (including former members, so old split records keep their names).
create or replace function public.list_space_members(p_space uuid)
returns table (
  user_id uuid, role public.member_role, joined_at timestamptz, left_at timestamptz,
  display_name text, avatar_url text
)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.role, m.joined_at, m.left_at, p.display_name, p.avatar_url
  from public.space_members m
  join public.profiles p on p.id = m.user_id
  where m.space_id = p_space and public.is_member(p_space)
  order by m.left_at nulls first, (m.role = 'owner') desc, m.joined_at;
$$;

create or replace function public.create_space(
  p_type public.space_type,
  p_name text,
  p_icon text default null,
  p_color text default null,
  p_features text[] default null
)
returns public.spaces language plpgsql security definer set search_path = public as $$
declare
  v_space public.spaces;
  v_features text[];
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_type = 'personal' then raise exception 'personal_space_exists'; end if;

  insert into public.spaces (type, name, icon, color, owner_id)
  values (p_type, trim(p_name), coalesce(p_icon, public.default_icon(p_type)),
          coalesce(p_color, public.default_color(p_type)), auth.uid())
  returning * into v_space;

  insert into public.space_members (space_id, user_id, role) values (v_space.id, auth.uid(), 'owner');

  v_features := coalesce(p_features, public.default_features(p_type));
  insert into public.space_features (space_id, feature_key, enabled)
  select v_space.id, k, k = any (v_features) from unnest(public.all_feature_keys(p_type)) as k;

  return v_space;
end $$;

-- Turn a feature on/off. Legacy names from DayOrbit 1.x are mapped; unknown names are ignored
-- (returns false) instead of failing the whole save.
create or replace function public.set_feature(p_space uuid, p_key text, p_enabled boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_type public.space_type;
  v_key text := case lower(trim(p_key))
    when 'groceries' then 'shopping' when 'grocery' then 'shopping'
    when 'todo' then 'tasks' when 'todos' then 'tasks'
    when 'split_bills' then 'split' when 'splitbills' then 'split'
    when 'money' then 'bills' when 'daily_expenses' then 'expenses'
    when 'events' then 'calendar' when 'reminders' then 'tasks'
    else lower(trim(p_key)) end;
begin
  if not public.is_owner(p_space) then raise exception 'not_owner'; end if;
  select type into v_type from public.spaces where id = p_space;
  if not (v_key = any (public.all_feature_keys(v_type))) then
    if v_key = 'health' then raise exception 'health_personal_only'; end if;
    return false;
  end if;
  insert into public.space_features (space_id, feature_key, enabled)
  values (p_space, v_key, p_enabled)
  on conflict (space_id, feature_key) do update set enabled = excluded.enabled;
  return true;
end $$;

create or replace function public.transfer_ownership(p_space uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_space) then raise exception 'not_owner'; end if;
  if (select type from public.spaces where id = p_space) = 'personal' then raise exception 'personal_space_is_private'; end if;
  if p_user = auth.uid() then return; end if;
  if not public.is_member_user(p_space, p_user) then raise exception 'not_member'; end if;
  update public.space_members set role = 'member' where space_id = p_space and user_id = auth.uid();
  update public.space_members set role = 'owner'  where space_id = p_space and user_id = p_user;
  update public.spaces set owner_id = p_user where id = p_space;
end $$;

create or replace function public.remove_member(p_space uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_space) then raise exception 'not_owner'; end if;
  if p_user = auth.uid() then raise exception 'cannot_remove_self'; end if;
  update public.space_members set left_at = now()
   where space_id = p_space and user_id = p_user and left_at is null;
  if not found then raise exception 'not_member'; end if;
end $$;

create or replace function public.leave_space(p_space uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role public.member_role;
  v_type public.space_type;
begin
  select m.role, s.type into v_role, v_type
  from public.space_members m join public.spaces s on s.id = m.space_id
  where m.space_id = p_space and m.user_id = auth.uid() and m.left_at is null;
  if not found then raise exception 'not_member'; end if;
  if v_type = 'personal' then raise exception 'cannot_leave_personal'; end if;
  if v_role = 'owner' then
    if exists (select 1 from public.space_members where space_id = p_space and user_id <> auth.uid() and left_at is null) then
      raise exception 'transfer_ownership_first';
    end if;
    raise exception 'delete_instead';
  end if;
  update public.space_members set left_at = now() where space_id = p_space and user_id = auth.uid();
end $$;

-- Permanently deletes the space and everything in it. Requires the exact name.
create or replace function public.delete_space(p_space uuid, p_confirm_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_space public.spaces;
begin
  select * into v_space from public.spaces where id = p_space;
  if not found or not public.is_owner(p_space) then raise exception 'not_owner'; end if;
  if v_space.type = 'personal' then raise exception 'cannot_delete_personal'; end if;
  if trim(coalesce(p_confirm_name, '')) <> trim(v_space.name) then raise exception 'name_mismatch'; end if;
  delete from public.spaces where id = p_space;
end $$;

-- ===========================================================================
-- Invitations & join requests
-- ===========================================================================
create or replace function public.create_invite(p_space uuid)
returns table (id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_space) then raise exception 'not_owner'; end if;
  if (select type from public.spaces s where s.id = p_space) = 'personal' then raise exception 'personal_space_is_private'; end if;
  return query
  insert into public.space_invites (space_id, token, created_by)
  values (p_space,
          replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
          auth.uid())
  returning space_invites.id, space_invites.token, space_invites.expires_at;
end $$;

create or replace function public.revoke_invite(p_invite uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_space uuid;
begin
  select space_id into v_space from public.space_invites where id = p_invite;
  if v_space is null or not public.is_owner(v_space) then raise exception 'not_owner'; end if;
  update public.space_invites set revoked_at = now() where id = p_invite and revoked_at is null;
end $$;

-- Works before sign-in (anon) so the invite page can say who invited you.
-- Hides the space details unless the invitation is still valid.
create or replace function public.get_invite_preview(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_inv public.space_invites;
  v_space public.spaces;
  v_status text;
  v_my text := 'none';
begin
  select * into v_inv from public.space_invites where token = p_token;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  select * into v_space from public.spaces where id = v_inv.space_id;

  v_status := case when v_inv.revoked_at is not null then 'revoked'
                   when v_inv.expires_at < now() then 'expired'
                   else 'valid' end;

  if auth.uid() is not null then
    if v_space.owner_id = auth.uid() then v_my := 'owner';
    elsif public.is_member_user(v_space.id, auth.uid()) then v_my := 'member';
    elsif exists (select 1 from public.join_requests r where r.space_id = v_space.id and r.user_id = auth.uid() and r.status = 'pending') then v_my := 'pending';
    elsif exists (select 1 from public.join_requests r where r.space_id = v_space.id and r.user_id = auth.uid() and r.status = 'rejected'
                   and r.decided_at > now() - interval '30 days') then v_my := 'rejected';
    end if;
  end if;

  if v_status <> 'valid' and v_my not in ('owner', 'member') then
    return jsonb_build_object('status', v_status, 'my_status', v_my);
  end if;

  return jsonb_build_object(
    'status', v_status,
    'my_status', v_my,
    'space_id', v_space.id,
    'name', v_space.name,
    'type', v_space.type,
    'icon', v_space.icon,
    'color', v_space.color,
    'member_count', (select count(*) from public.space_members m where m.space_id = v_space.id and m.left_at is null),
    'inviter_name', (select p.display_name from public.profiles p where p.id = v_inv.created_by)
  );
end $$;

-- Returns: pending | already_member | owner | invalid | expired | revoked | full
create or replace function public.request_to_join(p_token text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_inv public.space_invites;
  v_space public.spaces;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_inv from public.space_invites where token = p_token;
  if not found then return 'invalid'; end if;
  if v_inv.revoked_at is not null then return 'revoked'; end if;
  if v_inv.expires_at < now() then return 'expired'; end if;

  select * into v_space from public.spaces where id = v_inv.space_id;
  if v_space.type = 'personal' then return 'invalid'; end if;
  if v_space.owner_id = auth.uid() then return 'owner'; end if;
  if public.is_member_user(v_space.id, auth.uid()) then return 'already_member'; end if;
  if exists (select 1 from public.join_requests where space_id = v_space.id and user_id = auth.uid() and status = 'pending') then
    return 'pending';
  end if;

  perform public.ensure_my_setup();
  insert into public.join_requests (space_id, invite_id, user_id) values (v_space.id, v_inv.id, auth.uid());
  return 'pending';
end $$;

create or replace function public.cancel_join_request(p_space uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.join_requests set status = 'cancelled', decided_at = now()
   where space_id = p_space and user_id = auth.uid() and status = 'pending';
end $$;

-- Owner view of who is waiting (requesters aren't members yet, so names come from here).
create or replace function public.list_join_requests(p_space uuid)
returns table (id uuid, user_id uuid, display_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.user_id, p.display_name, r.created_at
  from public.join_requests r join public.profiles p on p.id = r.user_id
  where r.space_id = p_space and r.status = 'pending' and public.is_owner(p_space)
  order by r.created_at;
$$;

-- My own requests, with the space name I'm waiting for.
create or replace function public.list_my_join_requests()
returns table (
  id uuid, space_id uuid, space_name text, space_type public.space_type, color text, icon text,
  status public.join_status, created_at timestamptz, decided_at timestamptz, owner_name text
)
language sql stable security definer set search_path = public as $$
  select r.id, s.id, s.name, s.type, s.color, s.icon, r.status, r.created_at, r.decided_at, p.display_name
  from public.join_requests r
  join public.spaces s on s.id = r.space_id
  join public.profiles p on p.id = s.owner_id
  where r.user_id = auth.uid()
  order by r.created_at desc;
$$;

create or replace function public.decide_join_request(p_request uuid, p_approve boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_req public.join_requests;
  v_type public.space_type;
begin
  select * into v_req from public.join_requests where id = p_request for update;
  if not found or not public.is_owner(v_req.space_id) then raise exception 'not_owner'; end if;
  if v_req.status <> 'pending' then return v_req.status::text; end if;

  if p_approve then
    select type into v_type from public.spaces where id = v_req.space_id;
    if v_type = 'couple' and (select count(*) from public.space_members where space_id = v_req.space_id and left_at is null) >= 2 then
      raise exception 'couple_full';
    end if;
    insert into public.space_members (space_id, user_id, role) values (v_req.space_id, v_req.user_id, 'member')
    on conflict (space_id, user_id) do update set left_at = null, joined_at = now(), role = 'member';
  end if;

  update public.join_requests
     set status = case when p_approve then 'approved'::public.join_status else 'rejected'::public.join_status end,
         decided_by = auth.uid(), decided_at = now()
   where id = p_request;
  return case when p_approve then 'approved' else 'rejected' end;
end $$;

-- ===========================================================================
-- Split Bills — money maths (mirrors src/lib/split.js exactly)
-- ===========================================================================
-- Largest-remainder allocation in integer paise: floor every share, then hand the
-- leftover paise one at a time to the biggest remainders (ties: earlier position).
create or replace function public.split_allocate(p_total bigint, p_weights bigint[])
returns bigint[] language plpgsql immutable set search_path = public as $$
declare
  n int := coalesce(array_length(p_weights, 1), 0);
  w_sum numeric := 0;
  result bigint[] := '{}';
  rems numeric[] := '{}';
  allocated bigint := 0;
  leftover bigint;
  i int;
  pos int;
begin
  if n = 0 then raise exception 'no_participants'; end if;
  if p_total is null or p_total <= 0 then raise exception 'invalid_amount'; end if;
  for i in 1 .. n loop
    if p_weights[i] is null or p_weights[i] < 0 then raise exception 'invalid_weight'; end if;
    w_sum := w_sum + p_weights[i];
  end loop;
  if w_sum <= 0 then raise exception 'invalid_weight'; end if;

  for i in 1 .. n loop
    result := result || floor((p_total::numeric * p_weights[i]) / w_sum)::bigint;
    rems := rems || mod(p_total::numeric * p_weights[i], w_sum);
    allocated := allocated + result[i];
  end loop;

  leftover := p_total - allocated;
  for pos in
    select t.ord::int from unnest(rems) with ordinality as t (r, ord) order by t.r desc, t.ord asc limit leftover
  loop
    result[pos] := result[pos] + 1;
  end loop;
  return result;
end $$;

-- Turns a split method + inputs into exact paise per participant.
--   equal   → inputs ignored
--   shares  → whole-number weights ≥ 1
--   percent → percentages with up to 2 decimals; must total exactly 100
--   exact   → paise per person; must total exactly the amount
create or replace function public.split_compute(p_total bigint, p_method public.split_method, p_inputs numeric[], p_n int)
returns bigint[] language plpgsql immutable set search_path = public as $$
declare
  w bigint[] := '{}';
  s numeric := 0;
  i int;
begin
  if p_method = 'equal' then
    return public.split_allocate(p_total, array_fill(1::bigint, array[p_n]));
  end if;
  if coalesce(array_length(p_inputs, 1), 0) <> p_n then raise exception 'inputs_mismatch'; end if;

  if p_method = 'shares' then
    for i in 1 .. p_n loop
      if p_inputs[i] is null or p_inputs[i] < 1 or p_inputs[i] <> trunc(p_inputs[i]) then raise exception 'shares_invalid'; end if;
      w := w || p_inputs[i]::bigint;
    end loop;
    return public.split_allocate(p_total, w);
  elsif p_method = 'percent' then
    for i in 1 .. p_n loop
      if p_inputs[i] is null or p_inputs[i] < 0 or round(p_inputs[i] * 100) <> p_inputs[i] * 100 then raise exception 'percent_invalid'; end if;
      w := w || round(p_inputs[i] * 100)::bigint;
      s := s + round(p_inputs[i] * 100);
    end loop;
    if s <> 10000 then raise exception 'percent_sum'; end if;
    return public.split_allocate(p_total, w);
  else -- exact
    for i in 1 .. p_n loop
      if p_inputs[i] is null or p_inputs[i] < 0 or p_inputs[i] <> trunc(p_inputs[i]) then raise exception 'exact_invalid'; end if;
      w := w || p_inputs[i]::bigint;
      s := s + p_inputs[i];
    end loop;
    if s <> p_total then raise exception 'exact_sum'; end if;
    return w;
  end if;
end $$;

create or replace function public.check_split_people(p_space uuid, p_paid_by uuid, p_participants uuid[])
returns void language plpgsql stable security definer set search_path = public as $$
declare
  n int := coalesce(array_length(p_participants, 1), 0);
begin
  if n = 0 then raise exception 'no_participants'; end if;
  if (select count(distinct x) from unnest(p_participants) as x) <> n then raise exception 'duplicate_participant'; end if;
  if not public.is_member_user(p_space, p_paid_by) then raise exception 'payer_not_member'; end if;
  if exists (select 1 from unnest(p_participants) as x where not public.is_member_user(p_space, x)) then
    raise exception 'participant_not_member';
  end if;
end $$;

create or replace function public.create_split_expense(
  p_space uuid,
  p_group uuid,
  p_title text,
  p_amount bigint,
  p_paid_by uuid,
  p_spent_on date,
  p_method public.split_method,
  p_participants uuid[],
  p_inputs numeric[] default null,
  p_category text default null,
  p_notes text default null,
  p_client_request_id uuid default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_shares bigint[];
  n int := coalesce(array_length(p_participants, 1), 0);
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_member(p_space) then raise exception 'not_member'; end if;

  -- Same request twice (double tap, flaky network) → same expense, no duplicate.
  if p_client_request_id is not null then
    select id into v_id from public.split_expenses where client_request_id = p_client_request_id;
    if found then return v_id; end if;
  end if;

  if (select type from public.spaces where id = p_space) = 'personal' then raise exception 'split_needs_shared_space'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  if p_group is not null and not exists (select 1 from public.split_groups g where g.id = p_group and g.space_id = p_space) then
    raise exception 'group_not_in_space';
  end if;
  perform public.check_split_people(p_space, p_paid_by, p_participants);

  v_shares := public.split_compute(p_amount, p_method, p_inputs, n);

  insert into public.split_expenses (space_id, group_id, title, amount_minor, paid_by, spent_on, method,
                                     category, notes, legacy, client_request_id, created_by)
  values (p_space, p_group, trim(p_title), p_amount, p_paid_by, coalesce(p_spent_on, current_date), p_method,
          p_category, p_notes, false, p_client_request_id, auth.uid())
  returning id into v_id;

  insert into public.split_allocations (expense_id, user_id, share_minor, input_value)
  select v_id, p_participants[i], v_shares[i], case when p_method = 'equal' then null else p_inputs[i] end
  from generate_subscripts(p_participants, 1) as i;

  return v_id;
end $$;

create or replace function public.update_split_expense(
  p_expense uuid,
  p_title text,
  p_amount bigint,
  p_paid_by uuid,
  p_spent_on date,
  p_method public.split_method,
  p_participants uuid[],
  p_inputs numeric[] default null,
  p_category text default null,
  p_notes text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_exp public.split_expenses;
  v_shares bigint[];
  n int := coalesce(array_length(p_participants, 1), 0);
begin
  select * into v_exp from public.split_expenses where id = p_expense for update;
  if not found or not public.is_member(v_exp.space_id) then raise exception 'not_member'; end if;
  if not (v_exp.created_by = auth.uid() or v_exp.paid_by = auth.uid() or public.is_owner(v_exp.space_id)) then
    raise exception 'not_allowed';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  perform public.check_split_people(v_exp.space_id, p_paid_by, p_participants);
  v_shares := public.split_compute(p_amount, p_method, p_inputs, n);

  update public.split_expenses
     set title = trim(p_title), amount_minor = p_amount, paid_by = p_paid_by,
         spent_on = coalesce(p_spent_on, spent_on), method = p_method, category = p_category, notes = p_notes
   where id = p_expense;

  delete from public.split_allocations where expense_id = p_expense;
  insert into public.split_allocations (expense_id, user_id, share_minor, input_value)
  select p_expense, p_participants[i], v_shares[i], case when p_method = 'equal' then null else p_inputs[i] end
  from generate_subscripts(p_participants, 1) as i;
  return p_expense;
end $$;

-- Deletes a trip/event together with its costs and payments. Owner or creator only.
create or replace function public.delete_split_group(p_group uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_group public.split_groups;
  v_exp int;
  v_set int;
begin
  select * into v_group from public.split_groups where id = p_group;
  if not found or not public.is_member(v_group.space_id) then raise exception 'not_member'; end if;
  if not (public.is_owner(v_group.space_id) or v_group.created_by = auth.uid()) then raise exception 'not_allowed'; end if;
  delete from public.split_settlements where group_id = p_group;
  get diagnostics v_set = row_count;
  delete from public.split_expenses where group_id = p_group;
  get diagnostics v_exp = row_count;
  delete from public.split_groups where id = p_group;
  return jsonb_build_object('expenses', v_exp, 'settlements', v_set);
end $$;

-- "Older costs": split records made before Trips & Events (group_id is null).
create or replace function public.legacy_split_summary(p_space uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member(p_space) then raise exception 'not_member'; end if;
  return jsonb_build_object(
    'expenses', (select count(*) from public.split_expenses where space_id = p_space and group_id is null),
    'settlements', (select count(*) from public.split_settlements where space_id = p_space and group_id is null),
    'total_minor', (select coalesce(sum(amount_minor), 0) from public.split_expenses where space_id = p_space and group_id is null)
  );
end $$;

-- Owner only. Deletes ONLY ungrouped Split Bills records (never Bills & Money or Daily Expenses).
-- The expected counts must match the preview the owner saw, so nothing surprising is removed.
create or replace function public.delete_legacy_split_records(p_space uuid, p_expected_expenses int, p_expected_settlements int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_exp int;
  v_set int;
begin
  if not public.is_owner(p_space) then raise exception 'not_owner'; end if;
  select count(*) into v_exp from public.split_expenses where space_id = p_space and group_id is null;
  select count(*) into v_set from public.split_settlements where space_id = p_space and group_id is null;
  if v_exp <> p_expected_expenses or v_set <> p_expected_settlements then raise exception 'counts_changed'; end if;
  delete from public.split_settlements where space_id = p_space and group_id is null;
  delete from public.split_expenses where space_id = p_space and group_id is null;
  return jsonb_build_object('expenses', v_exp, 'settlements', v_set);
end $$;

create or replace function public.move_expenses_to_group(p_expenses uuid[], p_group uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_space uuid;
  v_count int;
begin
  select space_id into v_space from public.split_groups where id = p_group;
  if v_space is null or not public.is_member(v_space) then raise exception 'not_member'; end if;
  update public.split_expenses set group_id = p_group, legacy = false
   where id = any (p_expenses) and space_id = v_space and group_id is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ===========================================================================
-- Health sharing (cycle) — explicit, scoped, revocable
-- ===========================================================================
create or replace function public.set_health_share(p_grantee uuid, p_space uuid, p_scopes text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if (select type from public.spaces where id = p_space) is distinct from 'couple' then raise exception 'couple_space_only'; end if;
  if not public.is_member(p_space) or not public.is_member_user(p_space, p_grantee) or p_grantee = auth.uid() then
    raise exception 'not_member';
  end if;
  if p_scopes is null or cardinality(p_scopes) = 0 then
    update public.health_shares set revoked_at = now()
     where owner_id = auth.uid() and grantee_id = p_grantee and space_id = p_space and revoked_at is null;
    return null;
  end if;

  select id into v_id from public.health_shares
   where owner_id = auth.uid() and grantee_id = p_grantee and space_id = p_space and revoked_at is null;
  if v_id is null then
    insert into public.health_shares (owner_id, grantee_id, space_id, scopes)
    values (auth.uid(), p_grantee, p_space, p_scopes) returning id into v_id;
  else
    update public.health_shares set scopes = p_scopes where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function public.revoke_health_share(p_share uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.health_shares set revoked_at = now()
   where id = p_share and owner_id = auth.uid() and revoked_at is null;
end $$;

-- What a partner may see: only the scopes the owner ticked, only while both are in the couple space.
create or replace function public.get_shared_cycle(p_owner uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_share public.health_shares;
  v_settings public.cycle_settings;
  v_last date;
  v_avg int;
  v_result jsonb;
begin
  select * into v_share from public.health_shares
   where owner_id = p_owner and grantee_id = auth.uid() and revoked_at is null
     and public.is_member_user(space_id, p_owner) and public.is_member_user(space_id, auth.uid())
   order by created_at desc limit 1;
  if not found then raise exception 'not_shared'; end if;

  select * into v_settings from public.cycle_settings where user_id = p_owner;
  select max(start_date) into v_last from public.cycle_periods where user_id = p_owner;

  select coalesce(round(avg(len))::int, v_settings.typical_cycle, 28) into v_avg
  from (
    select start_date - lag(start_date) over (order by start_date) as len
    from (select start_date from public.cycle_periods where user_id = p_owner order by start_date desc limit 7) recent
  ) d
  where len between 15 and 60;

  v_result := jsonb_build_object(
    'owner_name', (select display_name from public.profiles where id = p_owner),
    'scopes', to_jsonb(v_share.scopes)
  );
  if 'period_dates' = any (v_share.scopes) then
    v_result := v_result || jsonb_build_object('periods', coalesce((
      select jsonb_agg(jsonb_build_object('start_date', start_date, 'end_date', end_date) order by start_date desc)
      from (select start_date, end_date from public.cycle_periods where user_id = p_owner order by start_date desc limit 6) p
    ), '[]'::jsonb));
  end if;
  if 'prediction' = any (v_share.scopes) and v_last is not null then
    v_result := v_result || jsonb_build_object('next_period_start', v_last + v_avg, 'range_days', 2);
  end if;

  update public.health_shares set last_viewed_at = now() where id = v_share.id;
  return v_result;
end $$;

create or replace function public.delete_all_cycle_data()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.cycle_logs where user_id = auth.uid();
  delete from public.cycle_periods where user_id = auth.uid();
  update public.health_shares set revoked_at = now() where owner_id = auth.uid() and revoked_at is null;
  update public.cycle_settings
     set typical_cycle = 28, typical_period = 5, show_fertile = true, discreet = true,
         remind_days_before = 2, daily_checkin = false
   where user_id = auth.uid();
end $$;

-- ===========================================================================
-- Realtime for shared lists (only if the Supabase publication exists)
-- ===========================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.tasks, public.grocery_items;
  end if;
end $$;

-- ===========================================================================
-- Function privileges
-- ===========================================================================
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.setup_user(uuid, text) from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
grant execute on function public.get_invite_preview(text) to anon;
