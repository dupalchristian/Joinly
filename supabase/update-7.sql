-- Joinly Update 7: bessere Push-Nachrichten
--  • Erinnerung ca. 30 Min. vor dem Start an alle, die dabei sind
--  • Nachricht an den Ersteller bei „Komme evtl. nach“
--  • Nachricht an den Ideengeber, wenn jemand bei einer Bucket-List-Idee „Hätte Lust“ sagt
-- Vorher muss update-6.sql (Bucket List) gelaufen sein.
-- Kann gefahrlos mehrfach ausgeführt werden.

-- Zusage-Nachricht auch bei „Komme evtl. nach“
drop trigger if exists participants_push on public.participants;
create trigger participants_push after insert on public.participants
  for each row when (NEW.response in ('yes', 'maybe')) execute function public.notify_push('join');
drop trigger if exists participants_push_upd on public.participants;
create trigger participants_push_upd after update of response on public.participants
  for each row when (NEW.response in ('yes', 'maybe') and OLD.response is distinct from NEW.response)
  execute function public.notify_push('join');

-- „Hätte Lust“ bei einer Idee → Nachricht an den Ideengeber
drop trigger if exists idea_votes_push on public.idea_votes;
create trigger idea_votes_push after insert on public.idea_votes
  for each row when (NEW.response = 'yes') execute function public.notify_push('idea_vote');
drop trigger if exists idea_votes_push_upd on public.idea_votes;
create trigger idea_votes_push_upd after update of response on public.idea_votes
  for each row when (NEW.response = 'yes' and OLD.response <> 'yes') execute function public.notify_push('idea_vote');

-- Erinnerung vor dem Start
alter table public.statuses add column if not exists reminded_at timestamptz;

-- Wird die Startzeit verschoben, gibt es wieder eine Erinnerung
create or replace function public.reset_reminder()
returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.starts_at is distinct from OLD.starts_at then NEW.reminded_at := null; end if;
  return NEW;
end $$;
drop trigger if exists statuses_reset_reminder on public.statuses;
create trigger statuses_reset_reminder before update of starts_at on public.statuses
  for each row execute function public.reset_reminder();

-- Sobald reminded_at gesetzt wird, geht die Erinnerung raus (über die bestehende Push-Funktion)
drop trigger if exists statuses_reminder_push on public.statuses;
create trigger statuses_reminder_push after update of reminded_at on public.statuses
  for each row when (NEW.reminded_at is not null and OLD.reminded_at is null)
  execute function public.notify_push('reminder');

-- Fällige Erinnerungen markieren: Aktivität startet in 5–30 Min., wurde nicht gerade erst angelegt
create or replace function public.joinly_due_reminders()
returns void language sql security definer set search_path = public as $$
  update public.statuses set reminded_at = now()
  where kind = 'plan' and reminded_at is null
    and starts_at > now() + interval '5 minutes'
    and starts_at <= now() + interval '30 minutes'
    and created_at < now() - interval '15 minutes'
    and exists (select 1 from public.participants p
                where p.status_id = statuses.id and p.response = 'yes' and p.profile_id <> statuses.profile_id);
$$;
revoke execute on function public.joinly_due_reminders() from public, anon, authenticated;

-- Alle 5 Minuten prüfen (pg_cron ist bei Supabase kostenlos dabei)
create extension if not exists pg_cron;
do $$ begin
  perform cron.unschedule('joinly-reminders');
exception when others then null; end $$;
select cron.schedule('joinly-reminders', '*/5 * * * *', 'select public.joinly_due_reminders()');
