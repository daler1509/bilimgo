/**
 * Delivers course requests to Telegram.
 *
 * Fired by the `leads_notify` trigger (see supabase/schema.sql) right after a
 * request is saved, with just its id. The function reads the row itself and
 * claims it by setting `notified_at`, so a request is delivered once however
 * often the function is called, and nobody can make it send anything but
 * real, not yet delivered requests.
 *
 * The only secret needed is TELEGRAM_BOT_TOKEN (from @BotFather), set under
 * Edge Functions → Secrets. The receiving chat is whoever pressed Start in the
 * bot first: it is found with getUpdates and remembered in public.bot_chat.
 * TELEGRAM_CHAT_ID can be set to override it (a group, another person).
 */

interface LeadRow {
  id: string;
  center_name: string;
  course: string | null;
  name: string | null;
  phone: string;
  comment: string | null;
  locale: string | null;
  page: string | null;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const CHAT_ID_OVERRIDE = Deno.env.get('TELEGRAM_CHAT_ID');
const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LANGUAGE: Record<string, string> = { ru: 'русский', uz: 'узбекский', en: 'английский' };

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** "+998901234567" → "+998 90 123 45 67" */
const prettyPhone = (p: string) => p.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, '+998 $1 $2 $3 $4');

function message(r: LeadRow) {
  const lines = [
    '<b>Новая заявка на курс</b>',
    `Центр: ${escape(r.center_name)}`,
    `Курс: ${r.course ? escape(r.course) : 'нужна консультация'}`,
    `Телефон: ${escape(prettyPhone(r.phone))}`,
  ];
  if (r.name) lines.push(`Имя: ${escape(r.name)}`);
  if (r.comment) lines.push(`Комментарий: ${escape(r.comment)}`);
  if (r.locale) lines.push(`Язык сайта: ${LANGUAGE[r.locale] ?? escape(r.locale)}`);
  if (r.page) lines.push(escape(r.page));
  return lines.join('\n');
}

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...init.headers },
  });

const send = (chat: string, text: string) =>
  fetch(`${TG}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
  }).catch(() => null);

/** The chat to deliver to, and whether it was just discovered */
async function resolveChat(): Promise<{ chat: string; fresh: boolean } | null> {
  if (CHAT_ID_OVERRIDE) return { chat: CHAT_ID_OVERRIDE, fresh: false };
  const saved = (await (await rest('bot_chat?select=chat_id&limit=1')).json().catch(() => [])) as { chat_id: number }[];
  if (saved[0]) return { chat: String(saved[0].chat_id), fresh: false };

  // nobody registered yet: the first person who pressed Start in the bot
  const updates = (await fetch(`${TG}/getUpdates`).then((r) => r.json()).catch(() => null)) as {
    result?: { message?: { chat?: { id: number; type: string } } }[];
  } | null;
  const first = updates?.result?.map((u) => u.message?.chat).find((c) => c?.type === 'private');
  if (!first) return null;
  await rest('bot_chat', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({ id: true, chat_id: first.id }) });
  await send(String(first.id), 'Готово. Заявки на курсы с сайта BilimGo будут приходить сюда.');
  return { chat: String(first.id), fresh: true };
}

/** Claim a request and deliver it; the claim is released if Telegram refuses */
async function deliver(id: string, chat: string): Promise<'sent' | 'skipped' | 'failed'> {
  const claim = await rest(`leads?id=eq.${id}&notified_at=is.null`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ notified_at: new Date().toISOString() }),
  });
  if (!claim.ok) return 'failed';
  const [lead] = (await claim.json()) as LeadRow[];
  if (!lead) return 'skipped';
  const res = await send(chat, message(lead));
  if (res?.ok) return 'sent';
  await rest(`leads?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ notified_at: null }) });
  return 'failed';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!BOT_TOKEN) return new Response('TELEGRAM_BOT_TOKEN is not set', { status: 503 });

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  const id = body?.id;
  if (!id || !UUID.test(id)) return new Response('Bad request', { status: 400 });

  const target = await resolveChat();
  if (!target) return new Response('Open the bot in Telegram and press Start', { status: 503 });

  const result = await deliver(id, target.chat);

  // the first delivery after setup also sends what piled up before it
  if (target.fresh) {
    const waiting = (await (await rest('leads?select=id&notified_at=is.null&order=created_at&limit=20')).json().catch(() => [])) as { id: string }[];
    for (const lead of waiting) await deliver(lead.id, target.chat);
  }

  return result === 'failed' ? new Response('Telegram refused the message', { status: 502 }) : new Response(result === 'sent' ? 'Sent' : 'Already delivered');
});
