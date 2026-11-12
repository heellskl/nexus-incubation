# Nexus Incubation Program — лендинг

Статический сайт из одного файла: `index.html` (шрифты и логотипы встроены).

## Публикация на Vercel

**Вариант А — через терминал (быстрее всего)**
1. Установите Node.js (https://nodejs.org), распакуйте эту папку.
2. В терминале, внутри папки, выполните: `npx vercel --prod`
3. Войдите в аккаунт Vercel, на вопросы ответьте Enter (настройки по умолчанию подходят).
   Сайт получит адрес вида `https://nexus-landing.vercel.app`.

**Вариант Б — через GitHub**
1. Создайте репозиторий на GitHub и загрузите в него файлы этой папки (Add file → Upload files).
2. На vercel.com → Add New → Project → Import этот репозиторий.
3. Framework Preset: **Other**, Build Command — пусто, Output Directory — пусто → Deploy.
   Каждое изменение в репозитории будет публиковаться автоматически.

## Приём заявок — Supabase
1. Создайте проект на https://supabase.com (бесплатный тариф подходит).
2. **SQL Editor → New query** → вставьте содержимое `supabase.sql` → **Run**.
   Создастся таблица `applications`: посетители могут только добавлять заявки, читать их — нет.
3. **Project Settings → API Keys**: скопируйте **Project URL** и ключ **anon / publishable**
   (не `service_role` — его никогда нельзя вставлять на сайт).
4. Вставьте их в `index.html`, в блок `CONFIG`:
   `SUPABASE_URL: 'https://xxxx.supabase.co'`, `SUPABASE_ANON_KEY: '...'`.
5. Сохраните изменения в GitHub — Vercel опубликует сайт сам.

Заявки смотрите в **Table Editor → applications** (или в представлении `applications_readable`
с русскими названиями колонок); оттуда же можно выгрузить CSV.
Колонка `status` (`new` / `in_review` / `accepted` / `rejected`) — для отметок организаторов.

Запасной вариант без Supabase — Google Таблица: см. `google-apps-script.gs` и `SUBMIT_URL`.

## Письма по заявкам (Gmail)
Supabase отправляет три вида писем: подтверждение кандидату, уведомление организаторам
и письмо о решении, когда `status` меняется на `accepted` или `rejected`.
Код: `supabase/functions/notify-application`, триггеры: `supabase/notifications.sql`.

Секреты (Supabase → Edge Functions → Secrets):
- `GMAIL_USER` — адрес Gmail отправителя
- `GMAIL_APP_PASSWORD` — пароль приложения Google (myaccount.google.com/apppasswords, нужна двухэтапная аутентификация)
- `ORGANIZER_EMAILS` — адреса организаторов через запятую

## Контакты
В `index.html` заполните `CONTACTS: { email: '', phone: '', telegram: '', instagram: '' }` —
заполненные поля появятся в блоке «Контакты».
