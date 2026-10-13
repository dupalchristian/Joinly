-- Joinly Update 4: Anmeldung mit Handynummer + PIN (funktioniert auf jedem Gerät, auch iPhone-App)
-- Voraussetzung in Supabase: Authentication → Sign In / Providers → Email → „Confirm email“ AUS.

create extension if not exists pgcrypto with schema extensions;

-- Geteilte Status dürfen auch Besucher ohne Anmeldung sehen
grant execute on function public.public_status(uuid) to anon;

-- Konto-Umzug: alte (Geräte-)Anmeldung → neue Anmeldung mit Nummer + PIN
create table if not exists public.account_transfers (
  token text primary key,
  old_id uuid not null,
  created_at timestamptz default now()
);
alter table public.account_transfers enable row level security; -- kein direkter Zugriff, nur über Funktionen

create or replace function public.create_transfer()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare tok text := encode(gen_random_bytes(18), 'hex');
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Kein Profil zum Übernehmen';
  end if;
  delete from account_transfers where old_id = auth.uid() or created_at < now() - interval '1 day';
  insert into account_transfers (token, old_id) values (tok, auth.uid());
  return tok;
end $$;

create or replace function public.claim_transfer(tok text)
returns void language plpgsql security definer set search_path = public as $$
declare o uuid; n uuid := auth.uid();
begin
  select old_id into o from account_transfers where token = tok and created_at > now() - interval '30 minutes';
  if o is null then raise exception 'Übernahme abgelaufen, bitte nochmal versuchen'; end if;
  if o = n then return; end if;
  if exists (select 1 from profiles where id = n) then
    delete from account_transfers where token = tok;
    return; -- Nummer hatte schon ein Konto: das bestehende Konto gewinnt
  end if;

  insert into profiles (id, first_name, phone, avatar_color, avatar_url, avatar_emoji, created_at)
    select n, first_name, phone, avatar_color, avatar_url, avatar_emoji, created_at from profiles where id = o;
  insert into profile_private (id, home_label, home_lat, home_lng, interests, push_activities, push_free)
    select n, home_label, home_lat, home_lng, interests, push_activities, push_free from profile_private where id = o;
  update groups set created_by = n where created_by = o;
  insert into memberships (group_id, profile_id, role, status, created_at)
    select group_id, n, role, status, created_at from memberships where profile_id = o on conflict do nothing;
  update group_activities set created_by = n where created_by = o;
  update statuses set profile_id = n where profile_id = o;
  insert into participants (status_id, profile_id, created_at)
    select status_id, n, created_at from participants where profile_id = o on conflict do nothing;
  update messages set profile_id = n where profile_id = o;
  update push_subscriptions set profile_id = n where profile_id = o;
  delete from profiles where id = o;      -- alte Mitgliedschaften/Zusagen fallen automatisch weg
  begin delete from auth.users where id = o and is_anonymous; exception when others then null; end;
  delete from account_transfers where token = tok;
end $$;

-- Admin setzt die PIN eines Mitglieds zurück (falls jemand sie vergessen hat)
create or replace function public.admin_reset_pin(member uuid, new_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if new_pin !~ '^[0-9]{6}$' then raise exception 'Die PIN muss genau 6 Ziffern haben'; end if;
  if not exists (
    select 1 from memberships a join memberships b on a.group_id = b.group_id
    where a.profile_id = auth.uid() and a.role = 'admin' and a.status = 'active' and b.profile_id = member
  ) then raise exception 'Nur der Admin der Gruppe kann das'; end if;
  update auth.users set encrypted_password = crypt('jl-' || new_pin, gen_salt('bf')), updated_at = now() where id = member;
end $$;

grant execute on function public.create_transfer(), public.claim_transfer(text), public.admin_reset_pin(uuid, text) to authenticated;
