import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ChevronDown, ChevronUp, Copy, Download, ExternalLink, PhoneCall, PhoneIncoming, RefreshCw, Send, Trash2 } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/Button';
import { useUi } from '@/state/ui';
import { useAdminData } from './data';
import { ago, copyText, dayKey, downloadCsv, normalize, plural, prettyPhone, telegramByPhone, whenFull } from './format';
import { errorText, supabase } from './supabaseClient';
import { Drawer, EmptyState, Pill, SearchField, SkeletonRows, Tabs, useConfirm, type PillTone } from './ui';
import s from './crm.module.css';

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
  status: Status;
  note: string | null;
  notified_at: string | null;
  handled_at: string | null;
  created_at: string;
}

type Status = 'new' | 'working' | 'done' | 'spam';
type Tab = Status | 'all';

const STATUS: Record<Status, { label: string; tone: PillTone }> = {
  new: { label: 'Новая', tone: 'new' },
  working: { label: 'В работе', tone: 'info' },
  done: { label: 'Обработана', tone: 'ok' },
  spam: { label: 'Спам', tone: 'bad' },
};
const STATUS_ORDER: Status[] = ['new', 'working', 'done', 'spam'];

const LOCALE_NAME = { ru: 'русский', uz: 'узбекский', en: 'английский' } as const;
type Period = 'all' | 'today' | '7' | '30';

/** Course requests from centre pages: the working list of the admissions desk */
export function AdminLeads() {
  const [rows, setRows] = useState<LeadRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('new');
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [centerFilter, setCenterFilter] = useState<string>('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();
  const { toast } = useUi();
  const { refresh } = useAdminData();
  const confirm = useConfirm();
  const openId = params.get('open');

  // ?center=… arrives from the dashboard
  useEffect(() => {
    const c = params.get('center');
    if (c) {
      setCenterFilter(c);
      setTab('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase!.from('leads').select('*').order('created_at', { ascending: false }).limit(1000);
    if (err) setError(errorText(err));
    else {
      setError(null);
      setRows(data as LeadRow[]);
    }
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: 0, new: 0, working: 0, done: 0, spam: 0 };
    for (const r of rows ?? []) {
      c[r.status] += 1;
      c.all += 1;
    }
    return c;
  }, [rows]);

  const centers = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows ?? []) m.set(r.center_id, r.center_name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ru'));
  }, [rows]);

  const visible = useMemo(() => {
    const needle = normalize(q);
    const digits = q.replace(/\D/g, '');
    const now = Date.now();
    const today = dayKey(now);
    return (rows ?? []).filter((r) => {
      if (tab !== 'all' && r.status !== tab) return false;
      if (centerFilter && r.center_id !== centerFilter) return false;
      if (period === 'today' && dayKey(r.created_at) !== today) return false;
      if ((period === '7' || period === '30') && now - new Date(r.created_at).getTime() > Number(period) * 864e5) return false;
      if (!needle) return true;
      return (
        (digits.length >= 3 && r.phone.includes(digits)) ||
        normalize(`${r.name ?? ''} ${r.center_name} ${r.course ?? ''} ${r.comment ?? ''}`).includes(needle)
      );
    });
  }, [rows, tab, q, period, centerFilter]);

  const open = openId ? (rows ?? []).find((r) => r.id === openId) ?? null : null;
  const openIndex = open ? visible.findIndex((r) => r.id === open.id) : -1;

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('open', id);
    else next.delete('open');
    setParams(next, { replace: true });
  };

  /* ---------- changes ---------- */
  const patch = async (ids: string[], values: Partial<Pick<LeadRow, 'status' | 'note' | 'handled_at'>>, done?: string) => {
    const before = rows;
    setRows((r) => r?.map((x) => (ids.includes(x.id) ? { ...x, ...values } : x)) ?? null);
    const { error: err } = await supabase!.from('leads').update(values).in('id', ids);
    if (err) {
      setRows(before);
      toast(`Не получилось: ${errorText(err)}`);
      return false;
    }
    if (done) toast(done);
    refresh();
    return true;
  };

  const setStatus = (ids: string[], status: Status) => {
    const handled = status === 'new' ? null : new Date().toISOString();
    const message =
      ids.length > 1
        ? `${ids.length} ${plural(ids.length, 'заявка', 'заявки', 'заявок')}: ${STATUS[status].label.toLowerCase()}`
        : `Статус: ${STATUS[status].label.toLowerCase()}`;
    return patch(ids, { status, handled_at: handled }, message);
  };

  const remove = async (ids: string[]) => {
    const ok = await confirm({
      title: ids.length > 1 ? `Удалить ${ids.length} ${plural(ids.length, 'заявку', 'заявки', 'заявок')}?` : 'Удалить заявку?',
      text: 'Заявка пропадёт навсегда. Если она просто не нужна, лучше отметить её как «Спам»: так она останется в архиве.',
      confirm: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const { error: err } = await supabase!.from('leads').delete().in('id', ids);
    setBusy(false);
    if (err) return toast(`Не удалилось: ${errorText(err)}`);
    setRows((r) => r?.filter((x) => !ids.includes(x.id)) ?? null);
    setPicked(new Set());
    if (openId && ids.includes(openId)) setOpen(null);
    toast(ids.length > 1 ? 'Заявки удалены' : 'Заявка удалена');
    refresh();
  };

  const togglePick = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allPicked = visible.length > 0 && visible.every((r) => picked.has(r.id));
  const pickedIds = [...picked].filter((id) => visible.some((r) => r.id === id));

  const exportCsv = () =>
    downloadCsv(
      `zayavki-${dayKey(Date.now())}.csv`,
      ['Дата', 'Статус', 'Телефон', 'Имя', 'Центр', 'Курс', 'Комментарий клиента', 'Заметка'],
      visible.map((r) => [whenFull(r.created_at), STATUS[r.status].label, r.phone, r.name, r.center_name, r.course, r.comment, r.note]),
    );

  const tabItems: { value: Tab; label: string; count: number }[] = [
    { value: 'new', label: 'Новые', count: counts.new },
    { value: 'working', label: 'В работе', count: counts.working },
    { value: 'done', label: 'Обработаны', count: counts.done },
    { value: 'spam', label: 'Спам', count: counts.spam },
    { value: 'all', label: 'Все', count: counts.all },
  ];

  const resetFilters = () => {
    setQ('');
    setCenterFilter('');
    setPeriod('all');
    setTab('all');
  };

  return (
    <>
      <header className={s.head}>
        <div>
          <h1 className={s.title}>Заявки на курсы</h1>
          <p className={s.subtitle}>Кто оставил номер на странице центра. Новые приходят и в Telegram-бот.</p>
        </div>
        <div className={s.headActions}>
          <Button variant="secondary" leading={<RefreshCw size={16} />} onClick={() => void load()}>
            Обновить
          </Button>
          <Button variant="secondary" leading={<Download size={16} />} onClick={exportCsv} disabled={!visible.length}>
            В таблицу CSV
          </Button>
        </div>
      </header>

      <div className={s.toolbar}>
        <Tabs value={tab} onChange={setTab} items={tabItems} label="Статус заявок" />
      </div>
      <div className={s.toolbar}>
        <SearchField value={q} onChange={setQ} placeholder="Телефон, имя, центр или курс" />
        <select className={s.select} value={centerFilter} onChange={(e) => setCenterFilter(e.target.value)} aria-label="Центр">
          <option value="">Все центры</option>
          {centers.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select className={s.select} value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Период">
          <option value="all">За всё время</option>
          <option value="today">Сегодня</option>
          <option value="7">7 дней</option>
          <option value="30">30 дней</option>
        </select>
      </div>

      {error && (
        <p className={s.alert} role="alert">
          Не удалось загрузить заявки: {error}. Если таблицы leads ещё нет или нет новых колонок, выполните заново supabase/schema.sql.
        </p>
      )}

      {!rows && !error && <SkeletonRows />}

      {rows && !visible.length && (
        <div className={s.tableWrap}>
          <EmptyState
            icon={PhoneIncoming}
            title={rows.length ? 'Под фильтр ничего не подошло' : 'Заявок пока нет'}
            text={
              rows.length
                ? 'Сбросьте поиск или выберите другой статус.'
                : 'Когда посетитель оставит номер на странице центра, заявка появится здесь и придёт в Telegram.'
            }
            action={
              rows.length ? (
                <Button variant="secondary" onClick={resetFilters}>
                  Сбросить фильтры
                </Button>
              ) : undefined
            }
          />
        </div>
      )}

      {rows && visible.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={`${s.cellCheck} ${s.hideXs}`}>
                  <input
                    type="checkbox"
                    className={s.check}
                    checked={allPicked}
                    aria-label="Выбрать все"
                    onChange={() => setPicked(allPicked ? new Set() : new Set(visible.map((r) => r.id)))}
                  />
                </th>
                <th>Клиент</th>
                <th>Что просит</th>
                <th className={s.hideSm}>Получена</th>
                <th>Статус</th>
                <th aria-label="Действия" className={s.hideXs} />
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => (
                <tr
                  key={r.id}
                  data-click
                  data-enter={i < 14 || undefined}
                  data-new={r.status === 'new' || undefined}
                  data-selected={picked.has(r.id) || openId === r.id || undefined}
                  style={{ ['--i' as string]: i }}
                  onClick={() => setOpen(r.id)}
                >
                  <td className={`${s.cellCheck} ${s.hideXs}`} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className={s.check} checked={picked.has(r.id)} aria-label={`Выбрать ${r.phone}`} onChange={() => togglePick(r.id)} />
                  </td>
                  <td>
                    <span className={`${s.cellName} ${s.nowrapName}`}>{prettyPhone(r.phone)}</span>
                    <span className={s.cellSub}>{r.name ?? 'Имя не указано'}</span>
                  </td>
                  <td>
                    <span className={`${s.cellName} ${s.truncate}`}>{r.course ?? 'Консультация'}</span>
                    <span className={s.cellSub}>{r.center_name}</span>
                  </td>
                  <td className={`${s.hideSm} ${s.nowrap} ${s.muted}`}>{ago(r.created_at)}</td>
                  <td>
                    <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
                  </td>
                  <td className={s.hideXs} onClick={(e) => e.stopPropagation()}>
                    <div className={s.rowActions}>
                      <a className={buttonClass({ variant: 'ghost', size: 'sm' })} href={`tel:${r.phone}`} aria-label={`Позвонить ${prettyPhone(r.phone)}`} title="Позвонить">
                        <PhoneCall size={16} aria-hidden="true" />
                      </a>
                      {r.status === 'new' && (
                        <Button variant="secondary" size="sm" onClick={() => void setStatus([r.id], 'working')}>
                          В работу
                        </Button>
                      )}
                      {r.status === 'working' && (
                        <Button variant="secondary" size="sm" onClick={() => void setStatus([r.id], 'done')}>
                          Обработана
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pickedIds.length > 0 && (
        <div className={s.bulk} role="region" aria-label="Действия с выбранными">
          <span>Выбрано: {pickedIds.length}</span>
          <button type="button" onClick={() => void setStatus(pickedIds, 'working').then(() => setPicked(new Set()))}>
            В работу
          </button>
          <button type="button" onClick={() => void setStatus(pickedIds, 'done').then(() => setPicked(new Set()))}>
            Обработаны
          </button>
          <button type="button" onClick={() => void setStatus(pickedIds, 'spam').then(() => setPicked(new Set()))}>
            Спам
          </button>
          <button type="button" data-danger onClick={() => void remove(pickedIds)} disabled={busy}>
            Удалить
          </button>
          <button type="button" onClick={() => setPicked(new Set())}>
            Снять выбор
          </button>
        </div>
      )}

      <Drawer
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? prettyPhone(open.phone) : ''}
        description={open ? `${open.name ?? 'Имя не указано'} · ${ago(open.created_at)}` : undefined}
        footer={
          open && (
            <>
              <Button variant="ghost" leading={<Trash2 size={16} />} onClick={() => void remove([open.id])}>
                Удалить
              </Button>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <Button
                  variant="secondary"
                  aria-label="Предыдущая заявка"
                  disabled={openIndex <= 0}
                  onClick={() => setOpen(visible[openIndex - 1]!.id)}
                  leading={<ChevronUp size={16} />}
                />
                <Button
                  variant="secondary"
                  aria-label="Следующая заявка"
                  disabled={openIndex < 0 || openIndex >= visible.length - 1}
                  onClick={() => setOpen(visible[openIndex + 1]!.id)}
                  leading={<ChevronDown size={16} />}
                />
              </span>
            </>
          )
        }
      >
        {open && (
          <LeadPanel
            key={open.id}
            lead={open}
            onStatus={(st) => void setStatus([open.id], st)}
            onNote={(note) => patch([open.id], { note: note || null }, 'Заметка сохранена')}
          />
        )}
      </Drawer>
    </>
  );
}

function LeadPanel({ lead, onStatus, onNote }: { lead: LeadRow; onStatus: (s: Status) => void; onNote: (note: string) => Promise<boolean> }) {
  const { toast } = useUi();
  const [note, setNote] = useState(lead.note ?? '');
  const saved = useRef(lead.note ?? '');

  const saveNote = async () => {
    if (note.trim() === saved.current.trim()) return;
    if (await onNote(note.trim())) saved.current = note.trim();
  };

  const copy = async () => toast((await copyText(lead.phone)) ? 'Номер скопирован' : 'Не удалось скопировать');

  return (
    <>
      <div className={s.drawerBlock}>
        <p className={s.drawerLabel}>Связаться</p>
        <div className={s.contactRow}>
          <a className={buttonClass({ variant: 'primary', size: 'md' })} href={`tel:${lead.phone}`}>
            <PhoneCall size={16} aria-hidden="true" />
            <span>Позвонить</span>
          </a>
          <a className={buttonClass({ variant: 'secondary', size: 'md' })} href={telegramByPhone(lead.phone)} target="_blank" rel="noopener noreferrer">
            <Send size={16} aria-hidden="true" />
            <span>Telegram</span>
          </a>
          <Button variant="secondary" leading={<Copy size={16} />} onClick={() => void copy()}>
            Номер
          </Button>
        </div>
      </div>

      <div className={s.drawerBlock}>
        <p className={s.drawerLabel}>Статус</p>
        <div className={s.statusRow}>
          {STATUS_ORDER.map((st) => (
            <button key={st} type="button" className={s.statusBtn} aria-pressed={lead.status === st} onClick={() => lead.status !== st && onStatus(st)}>
              <Pill tone={STATUS[st].tone} plain>
                {STATUS[st].label}
              </Pill>
            </button>
          ))}
        </div>
      </div>

      <div className={s.drawerBlock}>
        <p className={s.drawerLabel}>Заявка</p>
        <dl className={s.facts}>
          <dt>Курс</dt>
          <dd>{lead.course ?? 'Консультация, курс не выбран'}</dd>
          <dt>Центр</dt>
          <dd>
            <Link to={`/admin/centers/${lead.center_id}`}>{lead.center_name}</Link>{' '}
            <a href={`/centers/${lead.center_id}`} target="_blank" rel="noopener noreferrer" aria-label="Страница центра на сайте">
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          </dd>
          {lead.comment && (
            <>
              <dt>Комментарий</dt>
              <dd>{lead.comment}</dd>
            </>
          )}
          {lead.locale && (
            <>
              <dt>Язык сайта</dt>
              <dd>{LOCALE_NAME[lead.locale]}</dd>
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
          placeholder="Например: перезвонить после 18:00, интересует группа для ребёнка"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => void saveNote()}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void saveNote();
          }}
        />
        <p className={s.saveHint}>Сохраняется, когда вы выходите из поля</p>
      </div>

      <div className={s.drawerBlock}>
        <p className={s.drawerLabel}>История</p>
        <ol className={s.timeline}>
          <li className={s.timelineItem} data-done>
            Заявка получена
            <span className={s.timelineTime}>{whenFull(lead.created_at)}</span>
          </li>
          <li className={s.timelineItem} data-done={lead.notified_at ? true : undefined}>
            {lead.notified_at ? 'Отправлена в Telegram' : 'В Telegram не отправлялась'}
            {lead.notified_at && <span className={s.timelineTime}>{whenFull(lead.notified_at)}</span>}
          </li>
          {lead.handled_at && (
            <li className={s.timelineItem} data-done>
              {lead.status === 'done' ? 'Обработана' : lead.status === 'spam' ? 'Отмечена как спам' : 'Взята в работу'}
              <span className={s.timelineTime}>{whenFull(lead.handled_at)}</span>
            </li>
          )}
        </ol>
      </div>
    </>
  );
}
