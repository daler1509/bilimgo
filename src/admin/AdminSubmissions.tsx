import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AlertTriangle, Check, ExternalLink, FilePlus2, Phone, RotateCcw, Trash2, X } from 'lucide-react';
import { Button, ButtonLink, buttonClass } from '@/components/ui/Button';
import { useUi } from '@/state/ui';
import type { SubmissionRow } from './centerDraft';
import { useAdminData } from './data';
import { ago, normalize, plural, whenFull } from './format';
import { errorText, supabase } from './supabaseClient';
import { Drawer, EmptyState, Pill, SearchField, SkeletonRows, Tabs, useConfirm, type PillTone } from './ui';
import s from './crm.module.css';

type Status = SubmissionRow['status'];
type Tab = Status | 'all';

const STATUS: Record<Status, { label: string; tone: PillTone }> = {
  pending: { label: 'Ждёт проверки', tone: 'new' },
  approved: { label: 'Одобрена', tone: 'ok' },
  rejected: { label: 'Отклонена', tone: 'bad' },
};

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

interface CenterName {
  id: string;
  name: string;
  branch: string | null;
}

/** Applications from centre owners («Добавить центр» on the site) */
export function AdminSubmissions() {
  const [rows, setRows] = useState<SubmissionRow[] | null>(null);
  const [known, setKnown] = useState<CenterName[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pending');
  const [q, setQ] = useState('');
  const [params, setParams] = useSearchParams();
  const { toast } = useUi();
  const { refresh } = useAdminData();
  const confirm = useConfirm();
  const openId = params.get('open');

  const load = useCallback(async () => {
    const [subs, centers] = await Promise.all([
      supabase!.from('submissions').select('*').order('created_at', { ascending: false }).limit(500),
      supabase!.from('centers').select('id,name,branch'),
    ]);
    if (subs.error) setError(errorText(subs.error));
    else {
      setError(null);
      setRows(subs.data as SubmissionRow[]);
    }
    setKnown((centers.data as CenterName[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: 0, pending: 0, approved: 0, rejected: 0 };
    for (const r of rows ?? []) {
      c[r.status] += 1;
      c.all += 1;
    }
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const needle = normalize(q);
    return (rows ?? []).filter((r) => (tab === 'all' || r.status === tab) && (!needle || normalize(`${r.name} ${r.address} ${r.contact} ${r.phone}`).includes(needle)));
  }, [rows, tab, q]);

  const open = openId ? (rows ?? []).find((r) => r.id === openId) ?? null : null;

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('open', id);
    else next.delete('open');
    setParams(next, { replace: true });
  };

  const similar = useCallback(
    (row: SubmissionRow) => {
      const name = normalize(row.name);
      if (name.length < 4) return null;
      return known.find((c) => normalize(c.name).includes(name) || name.includes(normalize(c.name))) ?? null;
    },
    [known],
  );

  const patch = async (row: SubmissionRow, values: Partial<Pick<SubmissionRow, 'status' | 'note' | 'reviewed_at'>>, done?: string) => {
    const before = rows;
    setRows((r) => r?.map((x) => (x.id === row.id ? { ...x, ...values } : x)) ?? null);
    const { error: err } = await supabase!.from('submissions').update(values).eq('id', row.id);
    if (err) {
      setRows(before);
      toast(`Не получилось: ${errorText(err)}`);
      return false;
    }
    if (done) toast(done);
    refresh();
    return true;
  };

  const remove = async (row: SubmissionRow) => {
    const ok = await confirm({
      title: `Удалить заявку «${row.name}»?`,
      text: 'Заявка пропадёт навсегда. Это для спама: обычные заявки лучше отклонять, чтобы они остались в архиве.',
      confirm: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    const { error: err } = await supabase!.from('submissions').delete().eq('id', row.id);
    if (err) return toast(`Не удалилось: ${errorText(err)}`);
    setRows((r) => r?.filter((x) => x.id !== row.id) ?? null);
    setOpen(null);
    toast('Заявка удалена');
    refresh();
  };

  const tabItems: { value: Tab; label: string; count: number }[] = [
    { value: 'pending', label: 'Новые', count: counts.pending },
    { value: 'approved', label: 'Одобренные', count: counts.approved },
    { value: 'rejected', label: 'Отклонённые', count: counts.rejected },
    { value: 'all', label: 'Все', count: counts.all },
  ];

  return (
    <>
      <header className={s.head}>
        <div>
          <h1 className={s.title}>Новые центры</h1>
          <p className={s.subtitle}>Заявки владельцев со страницы «Добавить центр». Сверьте факты, прежде чем публиковать.</p>
        </div>
      </header>

      <div className={s.toolbar}>
        <Tabs value={tab} onChange={setTab} items={tabItems} label="Статус заявок" />
        <SearchField value={q} onChange={setQ} placeholder="Название, адрес или контакт" />
      </div>

      {error && (
        <p className={s.alert} role="alert">
          Не удалось загрузить заявки: {error}
        </p>
      )}
      {!rows && !error && <SkeletonRows n={4} />}

      {rows && !visible.length && (
        <div className={s.tableWrap}>
          <EmptyState
            icon={FilePlus2}
            title={tab === 'pending' && !q ? 'Новых заявок нет' : 'Ничего не найдено'}
            text={tab === 'pending' && !q ? 'Когда владелец центра пришлёт заявку, она появится здесь.' : 'Измените поиск или откройте другой статус.'}
          />
        </div>
      )}

      {rows && visible.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Центр</th>
                <th className={s.hideSm}>Контакт</th>
                <th className={s.hideSm}>Получена</th>
                <th>Статус</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => {
                const dup = r.status === 'pending' ? similar(r) : null;
                return (
                  <tr
                    key={r.id}
                    data-click
                    data-enter={i < 14 || undefined}
                    data-new={r.status === 'pending' || undefined}
                    data-selected={openId === r.id || undefined}
                    style={{ ['--i' as string]: i }}
                    onClick={() => setOpen(r.id)}
                  >
                    <td>
                      <span className={s.cellName}>{r.name}</span>
                      <span className={`${s.cellSub} ${s.truncate}`}>{r.address}</span>
                      {dup && (
                        <span className={s.cellSub} style={{ color: 'var(--color-warning)' }}>
                          Похоже на «{dup.name}», он уже в каталоге
                        </span>
                      )}
                    </td>
                    <td className={`${s.hideSm} ${s.muted}`}>{r.contact}</td>
                    <td className={`${s.hideSm} ${s.nowrap} ${s.muted}`}>{ago(r.created_at)}</td>
                    <td>
                      <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className={s.rowActions}>
                        {r.status === 'pending' && (
                          <ButtonLink to={`/admin/centers/new?from=${r.id}`} variant="secondary" size="sm" leading={<Check size={15} />}>
                            Создать
                          </ButtonLink>
                        )}
                        {r.status === 'approved' && r.center_id && (
                          <ButtonLink to={`/admin/centers/${r.center_id}`} variant="secondary" size="sm">
                            Открыть
                          </ButtonLink>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.name ?? ''}
        description={open ? `${STATUS[open.status].label} · ${ago(open.created_at)}` : undefined}
        footer={
          open && (
            <>
              <Button variant="ghost" leading={<Trash2 size={16} />} onClick={() => void remove(open)}>
                Удалить
              </Button>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                {open.status === 'pending' && (
                  <>
                    <Button
                      variant="secondary"
                      leading={<X size={16} />}
                      onClick={() => void patch(open, { status: 'rejected', reviewed_at: new Date().toISOString() }, 'Заявка отклонена')}
                    >
                      Отклонить
                    </Button>
                    <ButtonLink to={`/admin/centers/new?from=${open.id}`} variant="primary" leading={<Check size={16} />}>
                      Создать центр
                    </ButtonLink>
                  </>
                )}
                {open.status === 'rejected' && (
                  <Button variant="secondary" leading={<RotateCcw size={16} />} onClick={() => void patch(open, { status: 'pending', reviewed_at: null }, 'Заявка снова в новых')}>
                    Вернуть в новые
                  </Button>
                )}
                {open.status === 'approved' && open.center_id && (
                  <ButtonLink to={`/admin/centers/${open.center_id}`} variant="primary" leading={<ExternalLink size={16} />}>
                    Открыть центр
                  </ButtonLink>
                )}
              </span>
            </>
          )
        }
      >
        {open && <SubmissionPanel key={open.id} row={open} duplicate={similar(open)} onNote={(note) => patch(open, { note: note || null }, 'Заметка сохранена')} />}
      </Drawer>
      <span className="sr-only" aria-live="polite">
        {counts.pending} {plural(counts.pending, 'новая заявка', 'новые заявки', 'новых заявок')}
      </span>
    </>
  );
}

function SubmissionPanel({ row, duplicate, onNote }: { row: SubmissionRow; duplicate: CenterName | null; onNote: (note: string) => Promise<boolean> }) {
  const [note, setNote] = useState(row.note ?? '');
  const saved = useRef(row.note ?? '');

  const save = async () => {
    if (note.trim() === saved.current.trim()) return;
    if (await onNote(note.trim())) saved.current = note.trim();
  };

  return (
    <>
      {duplicate && row.status === 'pending' && (
        <div className={s.drawerBlock}>
          <p className={s.alert} style={{ background: 'var(--color-warning-subtle)', color: 'var(--color-warning)', display: 'flex', gap: 10 }}>
            <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              В каталоге уже есть похожий центр: <Link to={`/admin/centers/${duplicate.id}`}>{duplicate.name}{duplicate.branch ? `, ${duplicate.branch}` : ''}</Link>. Возможно, это его филиал или повтор.
            </span>
          </p>
        </div>
      )}

      <div className={s.drawerBlock}>
        <p className={s.drawerLabel}>Контакты владельца</p>
        <dl className={s.facts}>
          <dt>Контакт</dt>
          <dd>{row.contact}</dd>
          <dt>Телефон центра</dt>
          <dd>
            <a href={`tel:${row.phone.replace(/[^\d+]/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Phone size={13} aria-hidden="true" /> {row.phone}
            </a>
          </dd>
        </dl>
      </div>

      <div className={s.drawerBlock}>
        <p className={s.drawerLabel}>О центре</p>
        <dl className={s.facts}>
          <dt>Название</dt>
          <dd>{row.name}</dd>
          <dt>Адрес</dt>
          <dd>{row.address}</dd>
          {row.links && (
            <>
              <dt>Ссылки</dt>
              <dd>
                <Links text={row.links} />
              </dd>
            </>
          )}
          {row.directions && (
            <>
              <dt>Направления</dt>
              <dd>{row.directions}</dd>
            </>
          )}
        </dl>
      </div>

      <div className={s.drawerBlock}>
        <p className={s.drawerLabel}>Заметка для себя</p>
        <textarea
          className={s.textarea}
          value={note}
          maxLength={1000}
          placeholder="Что проверили, почему отклонили"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => void save()}
        />
        <p className={s.saveHint}>Сохраняется, когда вы выходите из поля</p>
      </div>

      <div className={s.drawerBlock}>
        <p className={s.drawerLabel}>История</p>
        <ol className={s.timeline}>
          <li className={s.timelineItem} data-done>
            Заявка получена
            <span className={s.timelineTime}>{whenFull(row.created_at)}</span>
          </li>
          {row.reviewed_at && (
            <li className={s.timelineItem} data-done>
              {row.status === 'approved' ? 'Центр создан' : 'Заявка отклонена'}
              <span className={s.timelineTime}>{whenFull(row.reviewed_at)}</span>
            </li>
          )}
        </ol>
        {row.status === 'pending' && (
          <p className={s.saveHint} style={{ marginTop: 12 }}>
            Кнопка «Создать центр» откроет форму с уже заполненными полями. Заявка станет «Одобренной», когда вы сохраните центр.
          </p>
        )}
      </div>
      <a className={buttonClass({ variant: 'ghost', size: 'sm' })} style={{ marginTop: 8 }} href={`https://yandex.uz/maps/?text=${encodeURIComponent(`${row.name} ${row.address}`)}`} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={15} aria-hidden="true" />
        <span>Найти на Яндекс Картах</span>
      </a>
    </>
  );
}
