-- Joinly – Datenbank-Schema für Supabase
-- Einmal komplett im SQL-Editor des Supabase-Projekts ausführen.
-- Voraussetzung: Authentication → Sign In / Providers → "Allow anonymous sign-ins" einschalten.

create extension if not exists pgcrypto;

-- Profile: ein Eintrag pro Person (Gerät meldet sich anonym an)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 40),
  phone text not null check (char_length(phone) between 5 and 30),
  avatar_color text default '#2E2E2E',
  created_at timestamptz default now()
);

-- Private Einstellungen: sieht nur die Person selbst
create table if not exists public.profile_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  home_label text,
  home_lat double precision,
  home_lng double precision,
  interests text[] default null,          -- null = alle Aktivitäten anzeigen
  push_activities text[] default '{}'
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.memberships (
  group_id uuid references public.groups(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'pending' check (status in ('pending', 'active')),
  created_at timestamptz default now(),
  primary key (group_id, profile_id)
);

-- Eigene Aktivitäten einer Gruppe (Standard-Aktivitäten stehen in der App)
create table if not exists public.group_activities (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  icon text not null default '✨',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique (group_id, name)
);

create table if not exists public.statuses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  activity text not null check (char_length(activity) between 1 and 40),
  icon text not null default '✨',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  place_mode text not null default 'none' check (place_mode in ('none', 'search', 'meet')),
  place_name text,
  place_lat double precision,
  place_lng double precision,
  note text,
  created_at timestamptz default now(),
  check (ends_at > starts_at)
);
create index if not exists statuses_group_time on public.statuses (group_id, starts_at);

create table if not exists public.participants (
  status_id uuid references public.statuses(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (status_id, profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  status_id uuid not null references public.statuses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz default now()
);

-- Hilfsfunktionen -------------------------------------------------------

create or replace function public.is_active_member(g uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from memberships
                 where group_id = g and profile_id = auth.uid() and status = 'active');
$$;

create or replace function public.is_group_admin(g uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from memberships
                 where group_id = g and profile_id = auth.uid() and status = 'active' and role = 'admin');
$$;

create or replace function public.shares_group(p uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select p = auth.uid() or exists (
    select 1 from memberships a join memberships b on a.group_id = b.group_id
    where a.profile_id = auth.uid() and a.status = 'active' and b.profile_id = p);
$$;

-- Gruppe anlegen: Ersteller wird Admin
create or replace function public.create_group(group_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  insert into groups (name, created_by) values (group_name, auth.uid()) returning id into g;
  insert into memberships (group_id, profile_id, role, status) values (g, auth.uid(), 'admin', 'active');
  return g;
end $$;

-- Einladungsinfo (Gruppenname) ohne Mitglied zu sein
create or replace function public.invite_info(code text)
returns table (group_id uuid, group_name text) language sql security definer stable set search_path = public as $$
  select id, name from groups where invite_code = code;
$$;

-- Beitritt per Einladungslink: Anfrage wartet auf Freigabe durch Admin
create or replace function public.request_join(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  select id into g from groups where invite_code = code;
  if g is null then raise exception 'Einladung ungültig'; end if;
  insert into memberships (group_id, profile_id) values (g, auth.uid())
  on conflict do nothing;
  return g;
end $$;

-- Rechte (Row Level Security) ---------------------------------------------

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;

drop policy if exists p_priv_all on public.profile_private;
create policy p_priv_all on public.profile_private for all using (id = auth.uid()) with check (id = auth.uid());
alter table public.groups enable row level security;
alter table public.memberships enable row level security;
alter table public.group_activities enable row level security;
alter table public.statuses enable row level security;
alter table public.participants enable row level security;
alter table public.messages enable row level security;

drop policy if exists p_profiles_select on public.profiles;
create policy p_profiles_select on public.profiles for select using (public.shares_group(id));
drop policy if exists p_profiles_insert on public.profiles;
create policy p_profiles_insert on public.profiles for insert with check (id = auth.uid());
drop policy if exists p_profiles_update on public.profiles;
create policy p_profiles_update on public.profiles for update using (id = auth.uid());

drop policy if exists p_groups_select on public.groups;
create policy p_groups_select on public.groups for select using (
  exists (select 1 from public.memberships m where m.group_id = id and m.profile_id = auth.uid()));
drop policy if exists p_groups_update on public.groups;
create policy p_groups_update on public.groups for update using (public.is_group_admin(id));

drop policy if exists p_mem_select on public.memberships;
create policy p_mem_select on public.memberships for select using (
  profile_id = auth.uid() or public.is_active_member(group_id));
drop policy if exists p_mem_update on public.memberships;
create policy p_mem_update on public.memberships for update using (public.is_group_admin(group_id));
drop policy if exists p_mem_delete on public.memberships;
create policy p_mem_delete on public.memberships for delete using (
  profile_id = auth.uid() or public.is_group_admin(group_id));

drop policy if exists p_act_select on public.group_activities;
create policy p_act_select on public.group_activities for select using (public.is_active_member(group_id));
drop policy if exists p_act_insert on public.group_activities;
create policy p_act_insert on public.group_activities for insert with check (public.is_active_member(group_id));

drop policy if exists p_st_select on public.statuses;
create policy p_st_select on public.statuses for select using (public.is_active_member(group_id));
drop policy if exists p_st_insert on public.statuses;
create policy p_st_insert on public.statuses for insert with check (
  profile_id = auth.uid() and public.is_active_member(group_id));
drop policy if exists p_st_update on public.statuses;
create policy p_st_update on public.statuses for update using (profile_id = auth.uid());
drop policy if exists p_st_delete on public.statuses;
create policy p_st_delete on public.statuses for delete using (profile_id = auth.uid());

drop policy if exists p_part_select on public.participants;
create policy p_part_select on public.participants for select using (
  exists (select 1 from public.statuses s where s.id = status_id and public.is_active_member(s.group_id)));
drop policy if exists p_part_insert on public.participants;
create policy p_part_insert on public.participants for insert with check (
  profile_id = auth.uid() and
  exists (select 1 from public.statuses s where s.id = status_id and public.is_active_member(s.group_id)));
drop policy if exists p_part_delete on public.participants;
create policy p_part_delete on public.participants for delete using (profile_id = auth.uid());

drop policy if exists p_msg_select on public.messages;
create policy p_msg_select on public.messages for select using (
  exists (select 1 from public.statuses s where s.id = status_id and public.is_active_member(s.group_id)));
drop policy if exists p_msg_insert on public.messages;
create policy p_msg_insert on public.messages for insert with check (
  profile_id = auth.uid() and
  exists (select 1 from public.statuses s where s.id = status_id and public.is_active_member(s.group_id)));

grant execute on function public.create_group(text), public.invite_info(text), public.request_join(text) to authenticated;

-- Live-Updates für die App
do $$ begin
  begin alter publication supabase_realtime add table public.statuses; exception when others then null; end;
  begin alter publication supabase_realtime add table public.participants; exception when others then null; end;
  begin alter publication supabase_realtime add table public.messages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.memberships; exception when others then null; end;
end $$;
