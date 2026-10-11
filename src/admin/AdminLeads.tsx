import { useEffect, useState } from 'react';
import { Check, ExternalLink, Phone, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/Button';
import { useUi } from '@/state/ui';
import { errorText, supabase } from './supabaseClient';
import s from './admin.module.css';

/** A row of public.leads (supabase/schema.sql) */
interface LeadRow {
  id: string;
  center_id: string;
  center_name: string;
  course: string | null;
  name: string | null;
  phone: string;
  comment: string | null;
  locale: 'ru' | 'uz' | 'en' | null;
  page: string | null;
  status: 'new' | 'done' | 'spam';
  created_at: string;
}

type Status = LeadRow['status'];
const TABS: { status: Status; label: string }[] = [
  { status: 'new', label: 'Новые' },
  { status: 'done', label: 'Обработанные' },
  { status: 'spam', label: 'Спам' },
];

const LOCALE_NAME: Record<NonNullable<LeadRow['locale']>, string> = { ru: 'русский', uz: 'узбекский', en: 'английский' };

const when = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Samarkand' });

/** "+998901234567" → "+998 90 123 45 67" */
const prettyPhone = (p: string) => p.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, '+998 $1 $2 $3 $4');

/**
 * Course requests from centre pages. The Telegram bot gets them as they
 * arrive (supabase/functions/lead-to-telegram); this list is the record of
 * all of them and works before the bot is connected.
 */
export function AdminLeads() {
  const [tab, setTab] = useState<Status>('new');
  const [rows, setRows] = useState<LeadRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast } = useUi();

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(null);
    supabase!
      .from('leads')
      .select('*')
      .eq('status', tab)
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) setError(errorText(err));
        else setRows(data as LeadRow[]);
      });
    return () => {
      alive = false;
    };
  }, [tab]);

  const setStatus = async (row: LeadRow, status: Status) => {
    setBusyId(row.id);
    const { error: err } = await supabase!.from('leads').update({ status }).eq('id', row.id);
    setBusyId(null);
    if (err) return toast(`Не получилось: ${errorText(err)}`);
    setRows((r) => r?.filter((x) => x.id !== row.id) ?? null);
    toast(status === 'done' ? 'Отмечено как обработанное' : status === 'spam' ? 'Перенесено в спам' : 'Возвращено в новые');
  };

  const remove = async (row: LeadRow) => {
    if (!window.confirm(`Удалить заявку с номера ${prettyPhone(row.phone)} навсегда?`)) return;
    setBusyId(row.id);
    const { error: err } = await supabase!.from('leads').delete().eq('id', row.id);
    setBusyId(null);
    if (err) return toast(`Не удалилось: ${errorText(err)}`);
    setRows((r) => r?.filter((x) => x.id !== row.id) ?? null);
    toast('Заявка удалена');
  };

  return (
    <>
      <div className={s.pageHead}>
        <h1 className={s.pageTitle}>Заявки на курсы</h1>
      </div>
      <div className={s.toolbar}>
        <div className={s.segmented} role="group" aria-label="Статус заявок">
          {TABS.map((t) => (
            <button key={t.status} type="button" className={s.segment} aria-pressed={tab === t.status} onClick={() => setTab(t.status)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className={s.error} role="alert">
          Не удалось загрузить заявки: {error}. Если таблицы leads ещё нет, выполните заново supabase/schema.sql.
        </p>
      )}
      {rows && !rows.length && <p className={s.empty}>{tab === 'new' ? 'Новых заявок нет' : 'Здесь пока пусто'}</p>}

      <div className={s.cards} aria-busy={!rows || undefined}>
        {rows?.map((r) => (
          <article key={r.id} className={s.card} aria-labelledby={`lead-${r.id}`}>
            <div>
              <h2 className={s.cardTitle} id={`lead-${r.id}`}>
                {r.course ?? 'Консультация, курс не выбран'}
              </h2>
              <p className={s.pageMeta}>
                {when(r.created_at)}, {r.center_name}
              </p>
              <dl className={s.facts}>
                <dt>Телефон</dt>
                <dd>
                  <a href={`tel:${r.phone}`}>{prettyPhone(r.phone)}</a>
                </dd>
                {r.name && (
                  <>
                    <dt>Имя</dt>
                    <dd>{r.name}</dd>
                  </>
                )}
                {r.comment && (
                  <>
                    <dt>Комментарий</dt>
                    <dd>{r.comment}</dd>
                  </>
                )}
                {r.locale && (
                  <>
                    <dt>Язык сайта</dt>
                    <dd>{LOCALE_NAME[r.locale]}</dd>
                  </>
                )}
              </dl>
            </div>
            <div className={s.cardActions}>
              <a className={buttonClass({ variant: 'secondary', size: 'sm' })} href={`tel:${r.phone}`}>
                <Phone size={16} aria-hidden="true" />
                <span>Позвонить</span>
              </a>
              {r.status === 'new' ? (
                <>
                  <Button variant="primary" size="sm" leading={<Check size={16} />} loading={busyId === r.id} onClick={() => setStatus(r, 'done')}>
                    Обработано
                  </Button>
                  <Button variant="ghost" size="sm" leading={<ShieldAlert size={16} />} disabled={busyId === r.id} onClick={() => setStatus(r, 'spam')}>
                    Спам
                  </Button>
                </>
              ) : (
                <Button variant="secondary" size="sm" leading={<RotateCcw size={16} />} loading={busyId === r.id} onClick={() => setStatus(r, 'new')}>
                  Вернуть в новые
                </Button>
              )}
              <a className={buttonClass({ variant: 'ghost', size: 'sm' })} href={`/centers/${r.center_id}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} aria-hidden="true" />
                <span>Страница центра</span>
              </a>
              <Button variant="ghost" size="sm" leading={<Trash2 size={16} />} disabled={busyId === r.id} onClick={() => remove(r)}>
                Удалить
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
