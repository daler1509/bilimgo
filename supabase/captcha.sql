-- Включайте ПОСЛЕ того, как в Vercel задан VITE_TURNSTILE_SITE_KEY, а в Supabase —
-- секрет TURNSTILE_SECRET_KEY, и проверка заявок на сайте проходит.
--
-- Закрывает прямую запись в таблицы через REST API: после этого заявки принимает
-- только Edge Function submit-form, и только с токеном капчи. Без этого бот мог бы
-- обойти форму и слать заявки напрямую с публичным ключом.
--
-- Откат — выполнить supabase/schema.sql заново (политики пересоздаются).

drop policy if exists "leads: anyone sends" on public.leads;
drop policy if exists "submissions: anyone submits" on public.submissions;
revoke insert on public.leads from anon, authenticated;
revoke insert on public.submissions from anon, authenticated;
