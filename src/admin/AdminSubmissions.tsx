import { useEffect, useState } from 'react';
import { Check, ExternalLink, RotateCcw, Trash2, X } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useUi } from '@/state/ui';
import type { SubmissionRow } from './centerDraft';
import { errorText, supabase } from './supabaseClient';
import s from './admin.module.css';

type Status = SubmissionRow['status'];
const TABS: { status: Status; label: string }[] = [
  { status: 'pending', label: 'Новые' },
  { status: 'approved', label: 'Одобренные' },
  { status: 'rejected', label: 'Отклонённые' },
];

const when = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Samarkand' });

/** Links in an application are shown as text with only http(s) made clickable — never trusted as markup */
function Links({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\s+)/).map((part, i) =>
        /^https?:\/\/\S+$/i.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function AdminSubmissions() {
  const [tab, setTab] = useState<Status>('pending');
  const [rows, setRows] = useState<SubmissionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast } = useUi();

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(null);
    supabase!
      .from('submissions')
      .select('*')
      .eq('status', tab)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) setError(errorText(err));
        else setRows(data as SubmissionRow[]);
      });
    return () => {
      alive = false;
    };
  }, [tab]);

  const setStatus = async (row: SubmissionRow, status: Status) => {
    setBusyId(row.id);
    const { error: err } = await supabase!
      .from('submissions')
      .update({ status, reviewed_at: status === 'pending' ? null : new Date().toISOString() })
      .eq('id', row.id);
    setBusyId(null);
    if (err) return toast(`Не получилось: ${errorText(err)}`);
    setRows((r) => r?.filter((x) => x.id !== row.id) ?? null);
    toast(status === 'rejected' ? 'Заявка отклонена' : 'Заявка возвращена в новые');
  };

  const remove = async (row: SubmissionRow) => {
    if (!window.confirm(`Удалить заявку «${row.name}» навсегда? Это для спама — обычные заявки лучше отклонять.`)) return;
    setBusyId(row.id);
    const { error: err } = await supabase!.from('submissions').delete().eq('id', row.id);
    setBusyId(null);
    if (err) return toast(`Не удалилось: ${errorText(err)}`);
    setRows((r) => r?.filter((x) => x.id !== row.id) ?? null);
    toast('Заявка удалена');
  };

  return (
    <>
      <div className={s.pageHead}>
        <h1 className={s.pageTitle}>Заявки на добавление центра</h1>
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
          Не удалось загрузить заявки: {error}
        </p>
      )}
      {rows && !rows.length && <p className={s.empty}>{tab === 'pending' ? 'Новых заявок нет' : 'Здесь пока пусто'}</p>}

      <div className={s.cards} aria-busy={!rows || undefined}>
        {rows?.map((r) => (
          <article key={r.id} className={s.card} aria-labelledby={`sub-${r.id}`}>
            <div>
              <h2 className={s.cardTitle} id={`sub-${r.id}`}>
                {r.name}
              </h2>
              <p className={s.pageMeta}>{when(r.created_at)}</p>
              <dl className={s.facts}>
                <dt>Адрес</dt>
                <dd>{r.address}</dd>
                <dt>Телефон</dt>
                <dd>{r.phone}</dd>
                {r.links && (
                  <>
                    <dt>Ссылки</dt>
                    <dd>
                      <Links text={r.links} />
                    </dd>
                  </>
                )}
                {r.directions && (
                  <>
                    <dt>Направления</dt>
                    <dd>{r.directions}</dd>
                  </>
                )}
                <dt>Контакт</dt>
                <dd>{r.contact}</dd>
              </dl>
            </div>
            <div className={s.cardActions}>
              {r.status === 'pending' && (
                <>
                  <ButtonLink to={`/admin/centers/new?from=${r.id}`} variant="primary" size="sm" leading={<Check size={16} />}>
                    Создать центр
                  </ButtonLink>
                  <Button variant="secondary" size="sm" leading={<X size={16} />} loading={busyId === r.id} onClick={() => setStatus(r, 'rejected')}>
                    Отклонить
                  </Button>
                </>
              )}
              {r.status === 'approved' && r.center_id && (
                <ButtonLink to={`/admin/centers/${r.center_id}`} variant="secondary" size="sm" leading={<ExternalLink size={16} />}>
                  Открыть центр
                </ButtonLink>
              )}
              {r.status === 'rejected' && (
                <Button variant="secondary" size="sm" leading={<RotateCcw size={16} />} loading={busyId === r.id} onClick={() => setStatus(r, 'pending')}>
                  Вернуть в новые
                </Button>
              )}
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
