-- BilimGo — схема Supabase.
-- Выполните один раз: Dashboard → SQL Editor → New query → вставить → Run.
-- Скрипт идемпотентный: повторный запуск ничего не ломает.
--
-- Доступ:
--   centers      — все читают опубликованные; пишут только админы
--   submissions  — любой может отправить заявку; читают и меняют только админы
--   leads        — заявки на курсы со страниц центров: любой отправляет, читают админы
--   storage media — файлы публичны по ссылке; загружают только админы
-- Админ — пользователь Supabase Auth, чей id лежит в public.admins.
--
-- Выполняйте в ОТДЕЛЬНОМ проекте Supabase для BilimGo. Пользователи Auth общие
-- для всего проекта, поэтому не смешивайте каталог с другим приложением.

-- ---------------------------------------------------------------- admins

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- Политик нет намеренно: список админов меняется только из SQL Editor.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------- centers

create table if not exists public.centers (
  id            text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name          text not null check (length(btrim(name)) > 0),
  alt_name      text,
  brand         text,
  branch        text,
  kind          text not null check (kind in (
                  'learning_center', 'language_school', 'it_school', 'tutoring',
                  'kids_center', 'technopark', 'cultural_center', 'exam_prep')),
  categories    text[] not null default '{}',
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  address       jsonb,  -- {"ru": "ул. Гагарина, 86", "uz": "Gagarin koʻchasi, 86", "en": "Gagarin St, 86"}
  phones        text[],
  website       text,
  telegram      text,
  instagram     text,
  opening_hours text,
  -- тексты на трёх языках: {"ru": "…", "uz": "…", "en": "…"}, русский обязателен
  summary       jsonb,
  about         jsonb,  -- массив абзацев, каждый {"ru", "uz", "en"}
  programs      jsonb,  -- [{"title": {"ru", …}, "note": {"ru", …}}]
  ages          text[],
  audience_note jsonb,
  lessons       jsonb,  -- как проходят занятия: массив коротких фактов, каждый {"ru", "uz", "en"}
  formats       text[],
  teaching      text[],
  features      text[],
  logo          text,
  -- Цена и рейтинг хранятся только вместе с источником — выдумать их нельзя.
  price_from    jsonb check (price_from is null or (price_from ? 'amount' and price_from -> 'source' ? 'url')),
  rating        jsonb check (rating is null or (rating ? 'value' and rating -> 'source' ? 'url')),
  photos        jsonb,
  -- преподаватели, как их называет сам центр: [{"name", "role": {"ru", …}, "note": {…}, "photo": {"src", "width", "height", "credit", "sourceUrl"}}]
  teachers      jsonb,
  yandex_id     text not null check (length(btrim(yandex_id)) > 0),
  -- оценок на карточке Яндекс Карт; порядок «По популярности», на сайте не показывается
  yandex_rating_count integer check (yandex_rating_count is null or yandex_rating_count >= 0),
  sources       jsonb not null default '[]'::jsonb,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- для баз, созданных до появления сортировки «По популярности»
alter table public.centers add column if not exists yandex_rating_count integer;

-- для баз, созданных до раздела «Преподаватели»
alter table public.centers add column if not exists teachers jsonb;

-- для баз, созданных до блока «Как проходят занятия»
alter table public.centers add column if not exists lessons jsonb;

-- для баз, созданных до перевода на узбекский и английский: тексты были строками.
-- Старое значение становится JSON-строкой, сайт читает его как русский текст.
do $$
declare
  col text;
begin
  foreach col in array array['address', 'summary', 'about', 'audience_note'] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'centers' and column_name = col and data_type <> 'jsonb'
    ) then
      execute format('alter table public.centers alter column %I type jsonb using to_jsonb(%I)', col, col);
    end if;
  end loop;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists centers_touch on public.centers;
create trigger centers_touch
  before update on public.centers
  for each row execute function public.touch_updated_at();

alter table public.centers enable row level security;

drop policy if exists "centers: read published" on public.centers;
create policy "centers: read published" on public.centers
  for select to anon, authenticated
  using (published or public.is_admin());

drop policy if exists "centers: admins insert" on public.centers;
create policy "centers: admins insert" on public.centers
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "centers: admins update" on public.centers;
create policy "centers: admins update" on public.centers
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "centers: admins delete" on public.centers;
create policy "centers: admins delete" on public.centers
  for delete to authenticated
  using (public.is_admin());

grant select on public.centers to anon, authenticated;
grant insert, update, delete on public.centers to authenticated;

-- ---------------------------------------------------------------- submissions

create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 200),
  address     text not null check (length(address) <= 500),
  phone       text not null check (length(phone) <= 50),
  links       text check (length(links) <= 1000),
  directions  text check (length(directions) <= 2000),
  contact     text not null check (length(contact) <= 200),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  center_id   text references public.centers (id) on delete set null,
  note        text,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists submissions_status_created on public.submissions (status, created_at desc);

-- Простая защита от спама: не больше 30 заявок в час на весь сайт.
create or replace function public.throttle_submissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.submissions where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too many submissions' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_throttle on public.submissions;
create trigger submissions_throttle
  before insert on public.submissions
  for each row execute function public.throttle_submissions();

alter table public.submissions enable row level security;

-- Посетитель может только создать новую заявку и не может её прочитать.
drop policy if exists "submissions: anyone submits" on public.submissions;
create policy "submissions: anyone submits" on public.submissions
  for insert to anon, authenticated
  with check (status = 'pending' and center_id is null and note is null and reviewed_at is null);

drop policy if exists "submissions: admins read" on public.submissions;
create policy "submissions: admins read" on public.submissions
  for select to authenticated
  using (public.is_admin());

drop policy if exists "submissions: admins update" on public.submissions;
create policy "submissions: admins update" on public.submissions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "submissions: admins delete" on public.submissions;
create policy "submissions: admins delete" on public.submissions
  for delete to authenticated
  using (public.is_admin());

grant insert on public.submissions to anon, authenticated;
grant select, update, delete on public.submissions to authenticated;

-- ---------------------------------------------------------------- leads

-- Заявки на курсы со страницы центра. Номер в формате +998XXXXXXXXX.
-- В Telegram их пересылает Edge Function supabase/functions/lead-to-telegram (см. README).
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  center_id   text not null check (length(center_id) <= 100),
  center_name text not null check (length(center_name) <= 200),
  course      text check (length(course) <= 200),
  name        text check (length(name) <= 100),
  phone       text not null check (phone ~ '^\+998[0-9]{9}$'),
  comment     text check (length(comment) <= 500),
  locale      text check (locale in ('ru', 'uz', 'en')),
  page        text check (length(page) <= 500),
  status      text not null default 'new' check (status in ('new', 'done', 'spam')),
  -- когда заявка ушла в Telegram; ставит Edge Function lead-to-telegram
  notified_at timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.leads add column if not exists notified_at timestamptz;

create index if not exists leads_status_created on public.leads (status, created_at desc);

-- Защита от спама: не больше 60 заявок в час на сайт и 3 в час с одного номера.
create or replace function public.throttle_leads()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.leads where created_at > now() - interval '1 hour') >= 60
    or (select count(*) from public.leads where phone = new.phone and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'too many leads' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists leads_throttle on public.leads;
create trigger leads_throttle
  before insert on public.leads
  for each row execute function public.throttle_leads();

alter table public.leads enable row level security;

drop policy if exists "leads: anyone sends" on public.leads;
create policy "leads: anyone sends" on public.leads
  for insert to anon, authenticated
  with check (status = 'new' and notified_at is null);

drop policy if exists "leads: admins read" on public.leads;
create policy "leads: admins read" on public.leads
  for select to authenticated
  using (public.is_admin());

drop policy if exists "leads: admins update" on public.leads;
create policy "leads: admins update" on public.leads
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "leads: admins delete" on public.leads;
create policy "leads: admins delete" on public.leads
  for delete to authenticated
  using (public.is_admin());

grant insert on public.leads to anon, authenticated;
grant select, update, delete on public.leads to authenticated;

-- Какой Telegram-чат получает заявки: функция lead-to-telegram записывает сюда
-- того, кто первым нажал Start в боте. Одна строка, доступ только у service role.
create table if not exists public.bot_chat (
  id         boolean primary key default true check (id),
  chat_id    bigint not null,
  created_at timestamptz not null default now()
);

alter table public.bot_chat enable row level security;
revoke all on public.bot_chat from anon, authenticated;

-- Новая заявка просит Edge Function lead-to-telegram доставить её в Telegram.
-- Вызов асинхронный (pg_net), его сбой не мешает сохранить заявку.
-- Подставьте <PROJECT_REF> и <ANON_JWT> (Project Settings → API → anon, legacy) вашего проекта.
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/functions/v1/lead-to-telegram',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_JWT>'),
      body := jsonb_build_object('id', new.id)
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists leads_notify on public.leads;
create trigger leads_notify
  after insert on public.leads
  for each row execute function public.notify_lead();

-- триггерные функции вызывают таблицы; через API их вызывать не нужно
revoke execute on function public.notify_lead() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.throttle_submissions() from public, anon, authenticated;
revoke execute on function public.throttle_leads() from public, anon, authenticated;

-- ---------------------------------------------------------------- storage

-- Логотипы и фото: публичные ссылки, до 5 МБ, только изображения.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "media: admins read" on storage.objects;
create policy "media: admins read" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and public.is_admin());

drop policy if exists "media: admins upload" on storage.objects;
create policy "media: admins upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "media: admins update" on storage.objects;
create policy "media: admins update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.is_admin());

drop policy if exists "media: admins delete" on storage.objects;
create policy "media: admins delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());

-- ---------------------------------------------------------------- первый админ
-- 1. Authentication → Users → Add user (email + пароль).
-- 2. Выполните, подставив свою почту:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'admin@example.com'
--   on conflict do nothing;
