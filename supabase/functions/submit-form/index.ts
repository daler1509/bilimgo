/**
 * Accepts the site's two public forms behind a Cloudflare Turnstile check:
 * a course request (`kind: "lead"`) and an «add a centre» application
 * (`kind: "submission"`).
 *
 * The browser sends the form and the Turnstile token; the function verifies
 * the token with Cloudflare and only then writes the row with the service
 * role. Once the site key is configured, direct anonymous inserts are closed
 * (see supabase/captcha.sql), so the form can't be bypassed by calling the
 * REST API.
 *
 * Secret (Edge Functions → Secrets): TURNSTILE_SECRET_KEY.
 * Deployed with verify_jwt = false: the browser has only the publishable key,
 * and the captcha token is what authorises a request.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET_KEY');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Only the columns a visitor may set, trimmed to what the table accepts */
const FORMS: Record<string, { table: string; pick: (d: Record<string, unknown>) => Record<string, unknown> | null }> = {
  lead: {
    table: 'leads',
    pick: (d) => {
      const phone = typeof d.phone === 'string' ? d.phone.trim() : '';
      const centerId = str(d.center_id, 100);
      const centerName = str(d.center_name, 200);
      if (!/^\+998[0-9]{9}$/.test(phone) || !centerId || !centerName) return null;
      const locale = d.locale === 'ru' || d.locale === 'uz' || d.locale === 'en' ? d.locale : null;
      return {
        center_id: centerId,
        center_name: centerName,
        course: str(d.course, 200),
        name: str(d.name, 100),
        phone,
        comment: str(d.comment, 500),
        locale,
        page: str(d.page, 500),
      };
    },
  },
  submission: {
    table: 'submissions',
    pick: (d) => {
      const name = str(d.name, 200);
      const address = str(d.address, 500);
      const phone = str(d.phone, 50);
      const contact = str(d.contact, 200);
      if (!name || !address || !phone || !contact) return null;
      return { name, address, phone, contact, links: str(d.links, 1000), directions: str(d.directions, 2000) };
    },
  },
};

async function humanVerified(token: string, ip: string | null) {
  const body = new URLSearchParams({ secret: TURNSTILE_SECRET!, response: token });
  if (ip) body.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body }).catch(() => null);
  const result = (await res?.json().catch(() => null)) as { success?: boolean } | null;
  return result?.success === true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'method' });
  if (!TURNSTILE_SECRET) return reply(503, { error: 'captcha_not_configured' });

  const body = (await req.json().catch(() => null)) as { kind?: string; token?: string; data?: Record<string, unknown> } | null;
  const form = body?.kind ? FORMS[body.kind] : undefined;
  if (!form || !body?.token || typeof body.token !== 'string' || body.token.length > 4096 || typeof body.data !== 'object' || !body.data) {
    return reply(400, { error: 'bad_request' });
  }

  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  if (!(await humanVerified(body.token, ip))) return reply(403, { error: 'captcha' });

  const row = form.pick(body.data);
  if (!row) return reply(400, { error: 'invalid' });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${form.table}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (res.ok) return reply(201, { ok: true });

  const detail = (await res.json().catch(() => null)) as { message?: string } | null;
  if (/too many/i.test(detail?.message ?? '')) return reply(429, { error: 'throttled' });
  return reply(res.status >= 500 ? 502 : 400, { error: 'rejected' });
});
