-- Таблица заявок лендинга Nexus Incubation Program.
-- Запустите целиком в Supabase: SQL Editor → New query → вставить → Run.

create table if not exists public.applications (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  role                  text not null check (role in ('volunteer','speaker','mentor','tracker')),
  role_title            text not null,
  name                  text not null check (char_length(name) between 2 and 200),
  email                 text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  phone                 text not null check (char_length(phone) between 6 and 40),
  telegram              text check (char_length(telegram) <= 100),
  city                  text not null check (char_length(city) <= 120),
  not_student_confirmed boolean not null default false,
  details               jsonb not null default '{}'::jsonb check (pg_column_size(details) < 20000),
  status                text not null default 'new'
                        check (status in ('new','in_review','accepted','rejected')),
  -- ментор и трекер обязаны подтвердить, что не являются студентами
  constraint pro_roles_not_students check (role not in ('mentor','tracker') or not_student_confirmed)
);

create index if not exists applications_role_created_idx on public.applications (role, created_at desc);

-- Безопасность: посетители сайта (роль anon) могут только ДОБАВЛЯТЬ заявки.
-- Читать, менять и удалять их могут только организаторы в панели Supabase.
alter table public.applications enable row level security;

drop policy if exists "anon can submit applications" on public.applications;
create policy "anon can submit applications"
  on public.applications
  for insert
  to anon
  with check (status = 'new');

revoke all on public.applications from anon;
grant insert (role, role_title, name, email, phone, telegram, city, not_student_confirmed, details)
  on public.applications to anon;

-- Удобное представление для просмотра заявок в Table Editor / экспорта в CSV
create or replace view public.applications_readable
with (security_invoker = true) as
select
  created_at,
  role_title                     as "Роль",
  name                           as "Имя",
  email                          as "Email",
  phone                          as "Телефон",
  telegram                       as "Telegram",
  city                           as "Город",
  details->>'years'              as "Опыт",
  coalesce(details->>'experience', details->>'about', details->>'motivation') as "О себе / опыт",
  details->>'link'               as "Ссылка",
  status                         as "Статус",
  details                        as "Все ответы"
from public.applications
order by created_at desc;

revoke all on public.applications_readable from anon, authenticated;
