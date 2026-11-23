-- Backend tests: money maths, invites & approvals, Split Bills, privacy (RLS), health sharing.
-- Run with scripts/test-db.sh (plain Postgres + 00_local_auth_shim.sql). Any failure aborts.
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

-- ---------------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to authenticated, anon;

create function tests.as_user(p_name text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', current_setting('t.' || p_name), false);
  perform set_config('role', 'authenticated', false);
end $$;

create function tests.expect_error(p_sql text, p_like text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm like p_like then return; end if;
    raise exception 'expected error like "%" but got "%" from: %', p_like, sqlerrm, p_sql;
  end;
  raise exception 'expected error like "%" but it succeeded: %', p_like, p_sql;
end $$;

create function tests.eq(p_actual anyelement, p_expected anyelement, p_what text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL %: expected %, got %', p_what, p_expected, p_actual;
  end if;
end $$;

grant execute on all functions in schema tests to authenticated, anon;

-- Net balance (paise) for one person in one trip: paid - share + sent - received.
create function tests.net(p_group uuid, p_user uuid) returns bigint language sql as $$
  select
    coalesce((select sum(amount_minor) from public.split_expenses where group_id = p_group and paid_by = p_user), 0)
  - coalesce((select sum(a.share_minor) from public.split_allocations a join public.split_expenses e on e.id = a.expense_id
               where e.group_id = p_group and a.user_id = p_user), 0)
  + coalesce((select sum(amount_minor) from public.split_settlements where group_id = p_group and from_user = p_user), 0)
  - coalesce((select sum(amount_minor) from public.split_settlements where group_id = p_group and to_user = p_user), 0);
$$;
grant execute on function tests.net(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- People (sign-up trigger creates profile + private My Space)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'aarav@example.com',    '{"full_name":"Aarav"}'),
  ('00000000-0000-0000-0000-00000000000b', 'diya@example.com',     '{"full_name":"Diya"}'),
  ('00000000-0000-0000-0000-00000000000c', 'kabir@example.com',    '{"full_name":"Kabir"}'),
  ('00000000-0000-0000-0000-00000000000d', 'meera@example.com',    '{"full_name":"Meera"}'),
  ('00000000-0000-0000-0000-00000000000e', 'rohan@example.com',    '{"full_name":"Rohan"}'),
  ('00000000-0000-0000-0000-00000000000f', 'stranger@example.com', '{}');

select set_config('t.aarav',    '00000000-0000-0000-0000-00000000000a', false),
       set_config('t.diya',     '00000000-0000-0000-0000-00000000000b', false),
       set_config('t.kabir',    '00000000-0000-0000-0000-00000000000c', false),
       set_config('t.meera',    '00000000-0000-0000-0000-00000000000d', false),
       set_config('t.rohan',    '00000000-0000-0000-0000-00000000000e', false),
       set_config('t.stranger', '00000000-0000-0000-0000-00000000000f', false);

do $$ begin
  perform tests.eq((select count(*) from public.profiles), 6::bigint, 'profiles created by trigger');
  perform tests.eq((select count(*) from public.spaces where type = 'personal'), 6::bigint, 'one My Space each');
  perform tests.eq((select display_name from public.profiles where id = current_setting('t.stranger')::uuid), 'stranger', 'name falls back to email');
end $$;

-- ---------------------------------------------------------------------------
-- Money maths: must match src/lib/split.js test vectors
-- ---------------------------------------------------------------------------
do $$ begin
  perform tests.eq(public.split_allocate(150000, array[1,1,1]::bigint[]), array[50000,50000,50000]::bigint[], '₹1,500 / 3');
  perform tests.eq(public.split_allocate(150000, array[1,1,1,1,1,1,1]::bigint[]),
                   array[21429,21429,21429,21429,21428,21428,21428]::bigint[], '₹1,500 / 7 (paisa rounding)');
  perform tests.eq(public.split_allocate(1000, array[1,1,1]::bigint[]), array[334,333,333]::bigint[], '₹10 / 3');
  perform tests.eq(public.split_allocate(90000, array[2,1,1]::bigint[]), array[45000,22500,22500]::bigint[], 'shares 2:1:1 on ₹900');
  perform tests.eq(public.split_compute(200000, 'percent', array[50,30,20]::numeric[], 3), array[100000,60000,40000]::bigint[], '50/30/20 of ₹2,000');
  perform tests.eq(public.split_compute(100000, 'percent', array[33.33,33.33,33.34]::numeric[], 3), array[33330,33330,33340]::bigint[], 'percent with decimals');
  perform tests.eq(public.split_compute(90000, 'exact', array[40000,30000,20000]::numeric[], 3), array[40000,30000,20000]::bigint[], 'exact');
  perform tests.expect_error($q$select public.split_compute(200000, 'percent', array[50,30,10]::numeric[], 3)$q$, 'percent_sum');
  perform tests.expect_error($q$select public.split_compute(90000, 'exact', array[40000,30000,10000]::numeric[], 3)$q$, 'exact_sum');
  perform tests.expect_error($q$select public.split_compute(90000, 'shares', array[2,0,1]::numeric[], 3)$q$, 'shares_invalid');
  perform tests.expect_error($q$select public.split_allocate(90000, array[]::bigint[])$q$, 'no_participants');
end $$;

-- ---------------------------------------------------------------------------
-- Create a shared space and invite people (request → owner approval)
-- ---------------------------------------------------------------------------
select tests.as_user('aarav');
select set_config('t.goa', (public.create_space('friends', 'Goa Gang')).id::text, false);
select set_config('t.token', (select token from public.create_invite(current_setting('t.goa')::uuid)), false);

do $$ begin
  perform tests.eq((select count(*) from public.list_my_spaces()), 2::bigint, 'Aarav sees My Space + Goa Gang');
  perform tests.eq((select enabled from public.space_features where space_id = current_setting('t.goa')::uuid and feature_key = 'split'), true, 'friends: split on by default');
  perform tests.eq((select count(*) from public.space_features where space_id = current_setting('t.goa')::uuid and feature_key = 'health'), 0::bigint, 'no health feature in shared spaces');
end $$;
reset role;

-- Anonymous visitors can preview an invite (to show who invited them) but read nothing else.
set role anon;
do $$
declare v jsonb := public.get_invite_preview(current_setting('t.token'));
begin
  perform tests.eq(v ->> 'status', 'valid', 'anon preview status');
  perform tests.eq(v ->> 'name', 'Goa Gang', 'anon preview name');
  perform tests.eq(v ->> 'inviter_name', 'Aarav', 'anon preview inviter');
  perform tests.expect_error($q$select count(*) from public.spaces$q$, 'permission denied%');
end $$;
reset role;

do $$
declare u text;
begin
  foreach u in array array['diya', 'kabir', 'meera', 'rohan'] loop
    perform tests.as_user(u);
    perform tests.eq(public.request_to_join(current_setting('t.token')), 'pending', u || ' requests to join');
    perform tests.eq(public.request_to_join(current_setting('t.token')), 'pending', u || ' second tap does not duplicate');
    perform tests.eq((select count(*) from public.spaces where id = current_setting('t.goa')::uuid), 0::bigint, u || ' cannot see space before approval');
    perform tests.eq((select my_status from (select public.get_invite_preview(current_setting('t.token')) ->> 'my_status' as my_status) x), 'pending', u || ' preview says pending');
    reset role;
  end loop;

  perform tests.as_user('aarav');
  perform tests.eq((select count(*) from public.list_join_requests(current_setting('t.goa')::uuid)), 4::bigint, 'owner sees 4 requests');
  perform tests.eq(public.request_to_join(current_setting('t.token')), 'owner', 'owner opening own link');
  perform public.decide_join_request(r.id, true) from public.list_join_requests(current_setting('t.goa')::uuid) r;
  perform tests.eq((select member_count from public.list_my_spaces() where id = current_setting('t.goa')::uuid), 5::bigint, '5 members after approvals');
  reset role;

  perform tests.as_user('diya');
  perform tests.eq((select count(*) from public.list_space_members(current_setting('t.goa')::uuid)), 5::bigint, 'Diya sees members');
  perform tests.eq(public.request_to_join(current_setting('t.token')), 'already_member', 'already a member');
  reset role;

  perform tests.as_user('stranger');
  perform tests.eq((select count(*) from public.list_space_members(current_setting('t.goa')::uuid)), 0::bigint, 'stranger sees no members');
  reset role;
end $$;

-- Revoked / unknown invites
select tests.as_user('aarav');
select set_config('t.token2', (select token from public.create_invite(current_setting('t.goa')::uuid)), false);
select public.revoke_invite((select id from public.space_invites where token = current_setting('t.token2')));
reset role;
select tests.as_user('stranger');
do $$ begin
  perform tests.eq(public.request_to_join(current_setting('t.token2')), 'revoked', 'revoked invite');
  perform tests.eq(public.request_to_join('nope'), 'invalid', 'unknown invite');
  perform tests.eq(public.get_invite_preview(current_setting('t.token2')) ? 'name', false, 'revoked preview hides the space name');
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Split Bills: the Goa Trip
-- ---------------------------------------------------------------------------
select tests.as_user('aarav');
insert into public.split_groups (space_id, name, kind, starts_on, ends_on)
values (current_setting('t.goa')::uuid, 'Goa Trip', 'trip', '2026-11-14', '2026-11-18');
select set_config('t.trip', (select id::text from public.split_groups where name = 'Goa Trip'), false);

do $$
declare
  g uuid := current_setting('t.goa')::uuid;
  t uuid := current_setting('t.trip')::uuid;
  a uuid := current_setting('t.aarav')::uuid;
  d uuid := current_setting('t.diya')::uuid;
  k uuid := current_setting('t.kabir')::uuid;
  m uuid := current_setting('t.meera')::uuid;
  r uuid := current_setting('t.rohan')::uuid;
  v_id uuid;
begin
  perform public.create_split_expense(g, t, 'Villa, 4 nights', 1200000, a, '2026-11-14', 'equal', array[a,d,k,m,r]);
  perform public.create_split_expense(g, t, 'Beach shack dinner', 150000, d, '2026-11-14', 'equal', array[a,d,k]);
  perform public.create_split_expense(g, t, 'Scooter rentals', 240000, k, '2026-11-15', 'equal', array[a,d,k,m]);
  v_id := public.create_split_expense(g, t, 'Cab to airport', 180000, m, '2026-11-18', 'equal', array[a,d,k,m,r],
                                      null, null, null, '11111111-1111-1111-1111-111111111111');
  -- Same client request id again → same expense, no duplicate
  perform tests.eq(public.create_split_expense(g, t, 'Cab to airport', 180000, m, '2026-11-18', 'equal', array[a,d,k,m,r],
                                               null, null, null, '11111111-1111-1111-1111-111111111111'), v_id, 'idempotent create');
  perform tests.eq((select count(*) from public.split_expenses where group_id = t), 4::bigint, '4 costs on the trip');

  -- Only selected people are charged: Meera and Rohan owe nothing for the dinner.
  perform tests.eq((select count(*) from public.split_allocations sa join public.split_expenses e on e.id = sa.expense_id
                    where e.title = 'Beach shack dinner'), 3::bigint, 'dinner charged to 3 people only');

  perform tests.eq(tests.net(t, a),  814000::bigint, 'Aarav gets back ₹8,140');
  perform tests.eq(tests.net(t, d), -236000::bigint, 'Diya owes ₹2,360');
  perform tests.eq(tests.net(t, k), -146000::bigint, 'Kabir owes ₹1,460');
  perform tests.eq(tests.net(t, m), -156000::bigint, 'Meera owes ₹1,560');
  perform tests.eq(tests.net(t, r), -276000::bigint, 'Rohan owes ₹2,760');

  -- Validation
  perform tests.expect_error(format($q$select public.create_split_expense(%L, %L, 'x', 200000, %L, null, 'percent', array[%L,%L]::uuid[], array[50,40]::numeric[])$q$, g, t, a, a, d), 'percent_sum');
  perform tests.expect_error(format($q$select public.create_split_expense(%L, %L, 'x', 1000, %L, null, 'equal', array[%L]::uuid[])$q$, g, t, a, current_setting('t.stranger')), 'participant_not_member');
  perform tests.expect_error(format($q$select public.create_split_expense(%L, %L, 'x', 0, %L, null, 'equal', array[%L]::uuid[])$q$, g, t, a, a), 'invalid_amount');
  perform tests.expect_error(format($q$select public.create_split_expense(%L, %L, 'x', 1000, %L, null, 'equal', array[]::uuid[])$q$, g, t, a), 'no_participants');
end $$;
reset role;

-- Rohan records a partial payment of ₹2,000 → still owes ₹760.
select tests.as_user('rohan');
insert into public.split_settlements (space_id, group_id, from_user, to_user, amount_minor, method)
values (current_setting('t.goa')::uuid, current_setting('t.trip')::uuid, current_setting('t.rohan')::uuid, current_setting('t.aarav')::uuid, 200000, 'upi');
do $$ begin
  perform tests.eq(tests.net(current_setting('t.trip')::uuid, current_setting('t.rohan')::uuid), -76000::bigint, 'Rohan still owes ₹760');
  -- Can't record a payment for someone outside the space
  perform tests.expect_error(format($q$insert into public.split_settlements (space_id, group_id, from_user, to_user, amount_minor) values (%L, %L, %L, %L, 100)$q$,
    current_setting('t.goa'), current_setting('t.trip'), current_setting('t.stranger'), current_setting('t.aarav')), '%row-level security%');
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Privacy (RLS)
-- ---------------------------------------------------------------------------
select tests.as_user('aarav');
select set_config('t.aarav_space', (select id::text from public.spaces where type = 'personal' and owner_id = auth.uid()), false);
insert into public.tasks (space_id, title) values (current_setting('t.aarav_space')::uuid, 'Private dentist appointment');
insert into public.medicines (name, dose, times) values ('Vitamin D3', '1 tablet', array['08:00']);
insert into public.profile_private (user_id, age, phone) values (auth.uid(), 29, '9876543210');
do $$ begin
  perform tests.expect_error(format($q$select public.create_invite(%L)$q$, current_setting('t.aarav_space')), 'personal_space_is_private');
  perform tests.expect_error($q$update public.spaces set type = 'family'$q$, 'permission denied%');
  perform tests.expect_error(format($q$select public.create_split_expense(%L, null, 'x', 100, %L, null, 'equal', array[%L]::uuid[])$q$,
    current_setting('t.aarav_space'), current_setting('t.aarav'), current_setting('t.aarav')), 'split_needs_shared_space');
end $$;
reset role;

do $$
declare u text;
begin
  foreach u in array array['diya', 'stranger'] loop
    perform tests.as_user(u);
    perform tests.eq((select count(*) from public.tasks where space_id = current_setting('t.aarav_space')::uuid), 0::bigint, u || ' cannot read Aarav''s My Space');
    perform tests.eq((select count(*) from public.medicines), 0::bigint, u || ' cannot read anyone''s medicines');
    perform tests.eq((select count(*) from public.profile_private where user_id = current_setting('t.aarav')::uuid), 0::bigint, u || ' cannot read Aarav''s age/phone');
    perform tests.expect_error(format($q$insert into public.tasks (space_id, title) values (%L, 'sneaky')$q$, current_setting('t.aarav_space')), '%row-level security%');
    reset role;
  end loop;

  perform tests.as_user('stranger');
  perform tests.eq((select count(*) from public.split_expenses), 0::bigint, 'stranger sees no split costs');
  perform tests.eq((select count(*) from public.profiles), 1::bigint, 'stranger only sees own profile');
  reset role;

  perform tests.as_user('diya');
  perform tests.eq((select count(*) from public.profiles), 5::bigint, 'Diya sees Goa Gang profiles + own');
  perform tests.expect_error(format($q$insert into public.tasks (space_id, title, assignee_id) values (%L, 'x', %L)$q$,
    current_setting('t.goa'), current_setting('t.stranger')), '%row-level security%');
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Features: legacy names map, unknown names don't break saving, data is kept
-- ---------------------------------------------------------------------------
select tests.as_user('aarav');
do $$ begin
  perform tests.eq(public.set_feature(current_setting('t.goa')::uuid, 'groceries', false), true, 'legacy name groceries → shopping');
  perform tests.eq((select enabled from public.space_features where space_id = current_setting('t.goa')::uuid and feature_key = 'shopping'), false, 'shopping hidden');
  perform tests.eq(public.set_feature(current_setting('t.goa')::uuid, 'meals', true), false, 'unknown feature ignored');
  perform tests.expect_error(format($q$select public.set_feature(%L, 'health', true)$q$, current_setting('t.goa')), 'health_personal_only');
end $$;
reset role;
select tests.as_user('diya');
do $$ begin
  perform tests.expect_error(format($q$select public.set_feature(%L, 'tasks', false)$q$, current_setting('t.goa')), 'not_owner');
  perform tests.expect_error(format($q$select public.remove_member(%L, %L)$q$, current_setting('t.goa'), current_setting('t.kabir')), 'not_owner');
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Older (legacy) split records: preview counts, then delete only those
-- ---------------------------------------------------------------------------
insert into public.split_expenses (space_id, group_id, title, amount_minor, paid_by, legacy)
values (current_setting('t.goa')::uuid, null, 'Old pizza night', 120000, current_setting('t.diya')::uuid, true),
       (current_setting('t.goa')::uuid, null, 'Old movie tickets', 90000, current_setting('t.aarav')::uuid, true);
insert into public.split_settlements (space_id, group_id, from_user, to_user, amount_minor, legacy)
values (current_setting('t.goa')::uuid, null, current_setting('t.kabir')::uuid, current_setting('t.diya')::uuid, 40000, true);
insert into public.bills (space_id, title, amount_minor, due_date) values (current_setting('t.goa')::uuid, 'Netflix', 64900, current_date);

select tests.as_user('aarav');
do $$
declare s jsonb := public.legacy_split_summary(current_setting('t.goa')::uuid);
begin
  perform tests.eq((s ->> 'expenses')::int, 2, 'legacy expenses counted');
  perform tests.eq((s ->> 'settlements')::int, 1, 'legacy payments counted');
  perform tests.eq((s ->> 'total_minor')::bigint, 210000::bigint, 'legacy total');
  perform tests.expect_error(format($q$select public.delete_legacy_split_records(%L, 3, 1)$q$, current_setting('t.goa')), 'counts_changed');
  perform public.delete_legacy_split_records(current_setting('t.goa')::uuid, 2, 1);
  perform tests.eq((select count(*) from public.split_expenses where space_id = current_setting('t.goa')::uuid and group_id is null), 0::bigint, 'legacy gone');
  perform tests.eq((select count(*) from public.split_expenses where group_id = current_setting('t.trip')::uuid), 4::bigint, 'Goa Trip untouched');
  perform tests.eq((select count(*) from public.bills where space_id = current_setting('t.goa')::uuid), 1::bigint, 'Bills untouched');
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Couple space + consent-based cycle sharing
-- ---------------------------------------------------------------------------
select tests.as_user('aarav');
select set_config('t.couple', (public.create_space('couple', 'Aarav & Meera')).id::text, false);
select set_config('t.ctoken', (select token from public.create_invite(current_setting('t.couple')::uuid)), false);
reset role;
select tests.as_user('meera');
select public.request_to_join(current_setting('t.ctoken'));
reset role;
select tests.as_user('diya');
select public.request_to_join(current_setting('t.ctoken'));
reset role;
select tests.as_user('aarav');
do $$ begin
  perform public.decide_join_request((select id from public.list_join_requests(current_setting('t.couple')::uuid) where user_id = current_setting('t.meera')::uuid), true);
  perform tests.expect_error(format($q$select public.decide_join_request(%L, true)$q$,
    (select id from public.list_join_requests(current_setting('t.couple')::uuid) where user_id = current_setting('t.diya')::uuid)), 'couple_full');
end $$;
reset role;

select tests.as_user('meera');
insert into public.cycle_periods (start_date, end_date) values ('2026-09-17', '2026-09-21'), ('2026-10-15', '2026-10-19'), ('2026-11-12', '2026-11-16');
insert into public.cycle_logs (log_date, flow, body, note) values ('2026-11-12', 'heavy', array['cramps'], 'private note');
select public.set_health_share(current_setting('t.aarav')::uuid, current_setting('t.couple')::uuid, array['period_dates', 'prediction']);
reset role;

select tests.as_user('aarav');
do $$
declare v jsonb := public.get_shared_cycle(current_setting('t.meera')::uuid);
begin
  perform tests.eq(jsonb_array_length(v -> 'periods'), 3, 'partner sees shared period dates');
  perform tests.eq(v ->> 'next_period_start', '2026-12-10', 'partner sees next-period estimate');
  perform tests.eq(v ? 'logs', false, 'partner never sees logs or notes');
  perform tests.eq((select count(*) from public.cycle_periods), 0::bigint, 'partner cannot read the table directly');
  perform tests.eq((select count(*) from public.cycle_logs), 0::bigint, 'partner cannot read logs');
  -- Removing Meera from the couple space ends sharing automatically.
  perform public.remove_member(current_setting('t.couple')::uuid, current_setting('t.meera')::uuid);
  perform tests.expect_error(format($q$select public.get_shared_cycle(%L)$q$, current_setting('t.meera')), 'not_shared');
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Leaving, ownership, deleting
-- ---------------------------------------------------------------------------
select tests.as_user('aarav');
do $$ begin
  perform tests.expect_error(format($q$select public.leave_space(%L)$q$, current_setting('t.goa')), 'transfer_ownership_first');
  perform tests.expect_error(format($q$select public.leave_space(%L)$q$, current_setting('t.aarav_space')), 'cannot_leave_personal');
  perform tests.expect_error(format($q$select public.delete_space(%L, 'Goa gang!!')$q$, current_setting('t.goa')), 'name_mismatch');
  perform tests.expect_error(format($q$select public.delete_space(%L, 'My Space')$q$, current_setting('t.aarav_space')), 'cannot_delete_personal');
  perform public.transfer_ownership(current_setting('t.goa')::uuid, current_setting('t.diya')::uuid);
  perform public.leave_space(current_setting('t.goa')::uuid);
  perform tests.eq((select count(*) from public.spaces where id = current_setting('t.goa')::uuid), 0::bigint, 'Aarav lost access after leaving');
end $$;
reset role;

select tests.as_user('diya');
do $$ begin
  perform tests.eq((select role from public.list_my_spaces() where id = current_setting('t.goa')::uuid)::text, 'owner', 'Diya is the new owner');
  -- ₹8,140 minus the ₹2,000 Rohan paid back = ₹6,140, still tracked after Aarav left.
  perform tests.eq(tests.net(current_setting('t.trip')::uuid, current_setting('t.aarav')::uuid), 614000::bigint, 'former member''s balance is kept');
  perform tests.eq((select count(*) from public.list_space_members(current_setting('t.goa')::uuid) where left_at is not null), 1::bigint, 'former member still listed for history');
  perform public.delete_space(current_setting('t.goa')::uuid, 'Goa Gang');
  perform tests.eq((select count(*) from public.list_my_spaces() where id = current_setting('t.goa')::uuid), 0::bigint, 'space deleted');
end $$;
reset role;

do $$ begin
  perform tests.eq((select count(*) from public.split_expenses where space_id = current_setting('t.goa')::uuid), 0::bigint, 'split records removed with the space');
end $$;

\echo 'All backend tests passed.'
