-- Joinly Update 5: Zusage/Vielleicht/Absage, Verspätung, Live-Standort, Fotos, Verlauf, Abzeichen

-- Antworten: yes = dabei, maybe = komme vielleicht nach, no = abgesagt
alter table public.participants add column if not exists response text not null default 'yes';
do $$ begin
  alter table public.participants add constraint participants_response_check check (response in ('yes', 'maybe', 'no'));
exception when duplicate_object then null; end $$;
alter table public.participants add column if not exists late_minutes int check (late_minutes is null or late_minutes between 1 and 600);
alter table public.participants add column if not exists updated_at timestamptz default now();

drop policy if exists p_part_update on public.participants;
create policy p_part_update on public.participants for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Push nur bei echter Zusage
drop trigger if exists participants_push on public.participants;
create trigger participants_push after insert on public.participants
  for each row when (NEW.response = 'yes') execute function public.notify_push('join');
drop trigger if exists participants_push_upd on public.participants;
create trigger participants_push_upd after update of response on public.participants
  for each row when (NEW.response = 'yes' and OLD.response <> 'yes') execute function public.notify_push('join');

-- Live-Standort während einer Aktivität
create table if not exists public.live_locations (
  status_id uuid references public.statuses(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy real,
  updated_at timestamptz default now(),
  primary key (status_id, profile_id)
);
alter table public.live_locations enable row level security;
drop policy if exists p_loc_select on public.live_locations;
create policy p_loc_select on public.live_locations for select using (
  exists (select 1 from public.statuses s where s.id = status_id and public.is_active_member(s.group_id)));
drop policy if exists p_loc_write on public.live_locations;
create policy p_loc_write on public.live_locations for all using (profile_id = auth.uid()) with check (
  profile_id = auth.uid() and exists (select 1 from public.statuses s where s.id = status_id and public.is_active_member(s.group_id)));

-- Fotos zu einer Aktivität
create table if not exists public.status_photos (
  id uuid primary key default gen_random_uuid(),
  status_id uuid not null references public.statuses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  url text not null,
  path text,
  created_at timestamptz default now()
);
create index if not exists status_photos_status on public.status_photos (status_id, created_at);
alter table public.status_photos enable row level security;
drop policy if exists p_photo_select on public.status_photos;
create policy p_photo_select on public.status_photos for select using (
  exists (select 1 from public.statuses s where s.id = status_id and public.is_active_member(s.group_id)));
drop policy if exists p_photo_insert on public.status_photos;
create policy p_photo_insert on public.status_photos for insert with check (
  profile_id = auth.uid() and exists (select 1 from public.statuses s where s.id = status_id and public.is_active_member(s.group_id)));
drop policy if exists p_photo_delete on public.status_photos;
create policy p_photo_delete on public.status_photos for delete using (
  profile_id = auth.uid() or exists (select 1 from public.statuses s where s.id = status_id and s.profile_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('status-photos', 'status-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;
drop policy if exists "joinly photo read" on storage.objects;
create policy "joinly photo read" on storage.objects for select using (bucket_id = 'status-photos');
drop policy if exists "joinly photo insert" on storage.objects;
create policy "joinly photo insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'status-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "joinly photo delete" on storage.objects;
create policy "joinly photo delete" on storage.objects for delete to authenticated
  using (bucket_id = 'status-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Zähler für Abzeichen: beendete Aktivitäten pro Person und Aktivität (als Gastgeber oder mit Zusage)
create or replace function public.activity_counts(g uuid)
returns table (profile_id uuid, activity text, n bigint)
language sql security definer stable set search_path = public as $$
  select x.pid, x.activity, count(*)::bigint
  from (
    select s.profile_id as pid, s.activity from statuses s where s.ends_at < now() and s.kind = 'plan'
    union all
    select p.profile_id, s.activity from participants p join statuses s on s.id = p.status_id
    where s.ends_at < now() and s.kind = 'plan' and p.response = 'yes' and p.profile_id <> s.profile_id
  ) x
  where public.is_active_member(g)
    and x.pid in (select m.profile_id from memberships m where m.group_id = g and m.status = 'active')
  group by x.pid, x.activity;
$$;
grant execute on function public.activity_counts(uuid) to authenticated;

-- Geteilter Status: Antworten mitliefern
create or replace function public.public_status(sid uuid)
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'group_id', s.group_id, 'group_name', g.name, 'kind', s.kind,
    'activity', s.activity, 'icon', s.icon, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
    'place_mode', s.place_mode, 'place_name', s.place_name, 'place_address', s.place_address,
    'place_lat', s.place_lat, 'place_lng', s.place_lng, 'note', s.note,
    'profile_id', s.profile_id,
    'author', jsonb_build_object('id', a.id, 'first_name', a.first_name, 'avatar_color', a.avatar_color,
                                 'avatar_url', a.avatar_url, 'avatar_emoji', a.avatar_emoji),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('profile_id', p.id, 'response', pa.response, 'late_minutes', pa.late_minutes, 'profiles',
               jsonb_build_object('id', p.id, 'first_name', p.first_name, 'avatar_color', p.avatar_color,
                                  'avatar_url', p.avatar_url, 'avatar_emoji', p.avatar_emoji)))
      from participants pa join profiles p on p.id = pa.profile_id where pa.status_id = s.id), '[]'::jsonb))
  from statuses s join groups g on g.id = s.group_id join profiles a on a.id = s.profile_id
  where s.id = sid;
$$;
grant execute on function public.public_status(uuid) to anon, authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.live_locations; exception when others then null; end;
  begin alter publication supabase_realtime add table public.status_photos; exception when others then null; end;
end $$;
