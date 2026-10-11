-- Joinly Update 2: „Bin gerade frei“, „Kommt vorbei“, Status teilen, Push-Nachrichten
-- Einmal im SQL-Editor ausführen. Vorher JOINLY_SECRET durch das geheime Wort ersetzen.

-- Art des Status: plan = normale Aktivität, free = gerade frei, open = kommt vorbei
alter table public.statuses add column if not exists place_address text;
alter table public.statuses add column if not exists kind text not null default 'plan';
do $$ begin
  alter table public.statuses add constraint statuses_kind_check check (kind in ('plan', 'free', 'open'));
exception when duplicate_object then null; end $$;

alter table public.profile_private add column if not exists push_free boolean not null default true;

-- Push-Anmeldungen der Geräte
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists p_push_own on public.push_subscriptions;
create policy p_push_own on public.push_subscriptions for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create or replace function public.save_push_subscription(ep text, key_p256dh text, key_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  insert into push_subscriptions (endpoint, profile_id, p256dh, auth)
  values (ep, auth.uid(), key_p256dh, key_auth)
  on conflict (endpoint) do update set profile_id = excluded.profile_id, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;

-- Geteilter Status: Wer den Link hat, sieht die wichtigsten Infos
create or replace function public.public_status(sid uuid)
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'group_id', s.group_id, 'group_name', g.name, 'kind', s.kind,
    'activity', s.activity, 'icon', s.icon, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
    'place_mode', s.place_mode, 'place_name', s.place_name, 'place_address', s.place_address,
    'place_lat', s.place_lat, 'place_lng', s.place_lng, 'note', s.note,
    'profile_id', s.profile_id,
    'author', jsonb_build_object('id', a.id, 'first_name', a.first_name, 'avatar_color', a.avatar_color),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('profile_id', p.id, 'profiles',
               jsonb_build_object('id', p.id, 'first_name', p.first_name, 'avatar_color', p.avatar_color)))
      from participants pa join profiles p on p.id = pa.profile_id where pa.status_id = s.id), '[]'::jsonb))
  from statuses s join groups g on g.id = s.group_id join profiles a on a.id = s.profile_id
  where s.id = sid;
$$;

-- Zusage über geteilten Link (auch ohne Mitglied zu sein). Stellt zugleich eine Beitrittsanfrage.
create or replace function public.join_status_guest(sid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Bitte zuerst Vorname und Handynummer eintragen';
  end if;
  select group_id into g from statuses where id = sid and ends_at > now();
  if g is null then raise exception 'Diesen Status gibt es nicht mehr'; end if;
  insert into participants (status_id, profile_id) values (sid, auth.uid()) on conflict do nothing;
  insert into memberships (group_id, profile_id) values (g, auth.uid()) on conflict do nothing;
end $$;

grant execute on function public.save_push_subscription(text, text, text), public.public_status(uuid), public.join_status_guest(uuid) to authenticated;

-- Push auslösen: neue Status und neue Zusagen gehen an die Funktion joinly-push
create extension if not exists pg_net;

create or replace function public.notify_push()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://igfelgxeiygndnkcznar.supabase.co/functions/v1/joinly-push',
    body := jsonb_build_object('type', TG_ARGV[0], 'record', to_jsonb(NEW)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-joinly-secret', 'JOINLY_SECRET')
  );
  return NEW;
exception when others then
  return NEW; -- Push darf das Speichern nie verhindern
end $$;

drop trigger if exists statuses_push on public.statuses;
create trigger statuses_push after insert on public.statuses
  for each row execute function public.notify_push('status');
drop trigger if exists participants_push on public.participants;
create trigger participants_push after insert on public.participants
  for each row execute function public.notify_push('join');
