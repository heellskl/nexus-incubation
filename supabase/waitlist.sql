-- Лист ожидания «Stay Tuned»: контакты потенциальных участников,
-- которым нужно сообщить об открытии регистрации.

create table if not exists public.waitlist (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  contact      text not null check (char_length(contact) between 5 and 200),
  contact_type text not null check (contact_type in ('email','phone')),
  notified_at  timestamptz
);

create unique index if not exists waitlist_contact_uniq on public.waitlist (lower(contact));

alter table public.waitlist enable row level security;

drop policy if exists "anon can join waitlist" on public.waitlist;
create policy "anon can join waitlist" on public.waitlist
  for insert to anon with check (notified_at is null);

revoke all on public.waitlist from anon, authenticated;
grant insert (contact, contact_type) on public.waitlist to anon;
