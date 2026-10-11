/**
 * One-off transfer of the bundled snapshot (src/data/centers.ts) into Supabase.
 *
 *   node --env-file=.env.local supabase/seed-centers.mjs              # adds missing centres only
 *   node --env-file=.env.local supabase/seed-centers.mjs --overwrite  # replaces rows with the snapshot
 *
 * Uses the service role key (bypasses RLS) — run it only on your machine,
 * never in the browser. Logos stay as /media/logos/… paths served by the site.
 */
import { createClient } from '@supabase/supabase-js';
import { CENTER_RECORDS, DATA_CHECKED_AT } from '../src/data/centers.ts';
import { toRow } from '../src/services/centerRow.ts';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Нужны VITE_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.local (см. .env.example).');
  process.exit(1);
}

const overwrite = process.argv.includes('--overwrite');
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// «Проверено» on the site is the row's updated_at — keep the real check date, not the import time
const checked = `${DATA_CHECKED_AT}T12:00:00+05:00`;
const rows = CENTER_RECORDS.map((record) => ({ ...toRow(record), created_at: checked, updated_at: checked }));

const { data, error } = await supabase.from('centers').upsert(rows, { onConflict: 'id', ignoreDuplicates: !overwrite }).select('id');
if (error) {
  console.error('Не получилось:', error.message);
  process.exit(1);
}
console.log(
  overwrite
    ? `Готово: записано ${data.length} из ${rows.length}.`
    : `Готово: добавлено ${data.length} из ${rows.length}, существующие записи не тронуты.`,
);
