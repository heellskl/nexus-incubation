-- Письма по заявкам: триггер вызывает Edge Function notify-application
-- при новой заявке и при смене статуса (accepted / rejected).

alter table public.applications
  add column if not exists confirmation_sent_at   timestamptz,
  add column if not exists organizers_notified_at timestamptz,
  add column if not exists decision_sent_status   text;

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_application()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url     := 'https://zqaxkadgypgixwbbitks.supabase.co/functions/v1/notify-application',
    -- публичный anon-ключ: функция сама читает заявку из базы и не доверяет данным запроса
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxYXhrYWRneXBnaXh3YmJpdGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0ODYzMzcsImV4cCI6MjExMDA2MjMzN30.204oXRRjg64QiwBoppNI4CIYvps2HIp-szy-et-F5K8'
    ),
    body    := jsonb_build_object('id', new.id),
    timeout_milliseconds := 15000
  );
  return new;
end;
$$;

revoke all on function public.notify_application() from public, anon, authenticated;

drop trigger if exists applications_notify_insert on public.applications;
create trigger applications_notify_insert
  after insert on public.applications
  for each row execute function public.notify_application();

drop trigger if exists applications_notify_status on public.applications;
create trigger applications_notify_status
  after update of status on public.applications
  for each row
  when (old.status is distinct from new.status and new.status in ('accepted','rejected'))
  execute function public.notify_application();
