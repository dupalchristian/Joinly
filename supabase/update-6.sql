-- Joinly Update 6: Bucket List (Ideen ohne festen Termin, Lust sammeln, Terminfindung)
-- Kann gefahrlos mehrfach ausgeführt werden.

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  icon text not null default '✨',
  note text check (note is null or char_length(note) <= 300),
  timeframe text check (timeframe is null or char_length(timeframe) <= 40),
  stage text not null default 'idea' check (stage in ('idea', 'poll', 'planned')),
  created_at timestamptz not null default now()
);
create index if not exists ideas_group on public.ideas (group_id, created_at desc);
create index if not exists ideas_profile on public.ideas (profile_id);

-- „Hätte Lust“ / „Vielleicht“
create table if not exists public.idea_votes (
  idea_id uuid not null references public.ideas(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  response text not null check (response in ('yes', 'maybe')),
  created_at timestamptz not null default now(),
  primary key (idea_id, profile_id)
);
create index if not exists idea_votes_profile on public.idea_votes (profile_id);

-- Terminvorschläge (Zeiträume) für die Abstimmung
create table if not exists public.idea_options (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists idea_options_idea on public.idea_options (idea_id);

create table if not exists public.idea_option_votes (
  option_id uuid not null references public.idea_options(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ok boolean not null,
  primary key (option_id, profile_id)
);
create index if not exists idea_option_votes_profile on public.idea_option_votes (profile_id);

-- Aus einer Idee geplante Aktivität
alter table public.statuses add column if not exists idea_id uuid references public.ideas(id) on delete set null;
create index if not exists statuses_idea on public.statuses (idea_id);

-- Hilfsfunktionen für die Rechte
create or replace function public.idea_group(i uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select group_id from public.ideas where id = i
$$;
create or replace function public.can_manage_idea(i uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ideas x where x.id = i
    and (x.profile_id = (select auth.uid()) or public.is_group_admin(x.group_id)))
$$;
create or replace function public.option_idea(o uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select idea_id from public.idea_options where id = o
$$;
revoke execute on function public.idea_group(uuid), public.can_manage_idea(uuid), public.option_idea(uuid) from public, anon;
grant execute on function public.idea_group(uuid), public.can_manage_idea(uuid), public.option_idea(uuid) to authenticated;

alter table public.ideas enable row level security;
alter table public.idea_votes enable row level security;
alter table public.idea_options enable row level security;
alter table public.idea_option_votes enable row level security;

-- Ideen: nur Mitglieder der Gruppe sehen sie; ändern darf Ersteller oder Admin
drop policy if exists p_ideas_select on public.ideas;
create policy p_ideas_select on public.ideas for select to authenticated using (public.is_active_member(group_id));
drop policy if exists p_ideas_insert on public.ideas;
create policy p_ideas_insert on public.ideas for insert to authenticated
  with check (profile_id = (select auth.uid()) and public.is_active_member(group_id));
drop policy if exists p_ideas_update on public.ideas;
create policy p_ideas_update on public.ideas for update to authenticated
  using (profile_id = (select auth.uid()) or public.is_group_admin(group_id))
  with check (public.is_active_member(group_id));
drop policy if exists p_ideas_delete on public.ideas;
create policy p_ideas_delete on public.ideas for delete to authenticated
  using (profile_id = (select auth.uid()) or public.is_group_admin(group_id));

-- Lust-Stimmen: sehen alle Mitglieder, ändern nur die eigene
drop policy if exists p_iv_select on public.idea_votes;
create policy p_iv_select on public.idea_votes for select to authenticated using (public.is_active_member(public.idea_group(idea_id)));
drop policy if exists p_iv_insert on public.idea_votes;
create policy p_iv_insert on public.idea_votes for insert to authenticated
  with check (profile_id = (select auth.uid()) and public.is_active_member(public.idea_group(idea_id)));
drop policy if exists p_iv_update on public.idea_votes;
create policy p_iv_update on public.idea_votes for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
drop policy if exists p_iv_delete on public.idea_votes;
create policy p_iv_delete on public.idea_votes for delete to authenticated using (profile_id = (select auth.uid()));

-- Terminvorschläge: sehen alle Mitglieder, anlegen/löschen Ersteller oder Admin
drop policy if exists p_io_select on public.idea_options;
create policy p_io_select on public.idea_options for select to authenticated using (public.is_active_member(public.idea_group(idea_id)));
drop policy if exists p_io_insert on public.idea_options;
create policy p_io_insert on public.idea_options for insert to authenticated with check (public.can_manage_idea(idea_id));
drop policy if exists p_io_delete on public.idea_options;
create policy p_io_delete on public.idea_options for delete to authenticated using (public.can_manage_idea(idea_id));

-- Termin-Stimmen: sehen alle Mitglieder, ändern nur die eigene
drop policy if exists p_iov_select on public.idea_option_votes;
create policy p_iov_select on public.idea_option_votes for select to authenticated
  using (public.is_active_member(public.idea_group(public.option_idea(option_id))));
drop policy if exists p_iov_insert on public.idea_option_votes;
create policy p_iov_insert on public.idea_option_votes for insert to authenticated
  with check (profile_id = (select auth.uid()) and public.is_active_member(public.idea_group(public.option_idea(option_id))));
drop policy if exists p_iov_update on public.idea_option_votes;
create policy p_iov_update on public.idea_option_votes for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
drop policy if exists p_iov_delete on public.idea_option_votes;
create policy p_iov_delete on public.idea_option_votes for delete to authenticated using (profile_id = (select auth.uid()));

grant select, insert, update, delete on public.ideas, public.idea_votes, public.idea_options, public.idea_option_votes to authenticated;

-- Push: neue Idee an die Gruppe, Terminfindung an alle Interessierten
drop trigger if exists ideas_push on public.ideas;
create trigger ideas_push after insert on public.ideas
  for each row execute function public.notify_push('idea');
drop trigger if exists ideas_poll_push on public.ideas;
create trigger ideas_poll_push after update of stage on public.ideas
  for each row when (NEW.stage = 'poll' and OLD.stage <> 'poll') execute function public.notify_push('idea_poll');

-- Live-Updates
do $$ begin
  begin alter publication supabase_realtime add table public.ideas; exception when others then null; end;
  begin alter publication supabase_realtime add table public.idea_votes; exception when others then null; end;
  begin alter publication supabase_realtime add table public.idea_options; exception when others then null; end;
  begin alter publication supabase_realtime add table public.idea_option_votes; exception when others then null; end;
end $$;
