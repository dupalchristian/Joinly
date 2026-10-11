-- Joinly Update 3: Profilbilder und Avatare
-- Einmal komplett im SQL-Editor ausführen (nach Update 2).

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists avatar_emoji text;

-- Speicherplatz für Profilbilder (öffentlich lesbar, jeder darf nur in seinen eigenen Ordner schreiben)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "joinly avatar read" on storage.objects;
create policy "joinly avatar read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "joinly avatar insert" on storage.objects;
create policy "joinly avatar insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "joinly avatar update" on storage.objects;
create policy "joinly avatar update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "joinly avatar delete" on storage.objects;
create policy "joinly avatar delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Geteilter Status: jetzt mit Profilbildern
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
      select jsonb_agg(jsonb_build_object('profile_id', p.id, 'profiles',
               jsonb_build_object('id', p.id, 'first_name', p.first_name, 'avatar_color', p.avatar_color,
                                  'avatar_url', p.avatar_url, 'avatar_emoji', p.avatar_emoji)))
      from participants pa join profiles p on p.id = pa.profile_id where pa.status_id = s.id), '[]'::jsonb))
  from statuses s join groups g on g.id = s.group_id join profiles a on a.id = s.profile_id
  where s.id = sid;
$$;
