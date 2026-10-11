import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { CenterLogo } from '@/components/centers/CenterLogo';
import { ButtonLink } from '@/components/ui/Button';
import { isCategoryId } from '@/data/categories';
import { districtFor } from '@/data/districts';
import { ru } from '@/i18n/ru';
import { formatDay } from '@/lib/dates';
import { samarkandDay } from '@/services/centerRow';
import { errorText, supabase } from './supabaseClient';
import s from './admin.module.css';

interface ListRow {
  id: string;
  name: string;
  brand: string | null;
  branch: string | null;
  logo: string | null;
  categories: string[];
  lat: number;
  lng: number;
  published: boolean;
  updated_at: string;
}

type Show = 'all' | 'published' | 'hidden';
const SHOW_LABEL: Record<Show, string> = { all: 'Все', published: 'На сайте', hidden: 'Скрытые' };

const normalize = (v: string) => v.toLowerCase().replace(/ё/g, 'е');

export function AdminCenters() {
  const [rows, setRows] = useState<ListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [show, setShow] = useState<Show>('all');

  useEffect(() => {
    let alive = true;
    supabase!
      .from('centers')
      .select('id,name,brand,branch,logo,categories,lat,lng,published,updated_at')
      .order('name')
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) setError(errorText(err));
        else setRows(data as ListRow[]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(() => {
    const needle = normalize(q.trim());
    return (rows ?? []).filter(
      (r) =>
        (show === 'all' || r.published === (show === 'published')) &&
        (!needle || normalize(`${r.name} ${r.brand ?? ''} ${r.branch ?? ''} ${r.id}`).includes(needle)),
    );
  }, [rows, q, show]);

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Центры</h1>
          {rows && <p className={s.pageMeta}>{ru.count.places(rows.length)} в базе</p>}
        </div>
        <ButtonLink to="/admin/centers/new" variant="primary" leading={<Plus size={18} />}>
          Новый центр
        </ButtonLink>
      </div>

      <div className={s.toolbar}>
        <label className={s.search}>
          <span className="sr-only">Поиск по названию</span>
          <input className={s.input} type="search" placeholder="Название, сеть или адрес страницы" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className={s.segmented} role="group" aria-label="Показать">
          {(Object.keys(SHOW_LABEL) as Show[]).map((key) => (
            <button key={key} type="button" className={s.segment} aria-pressed={show === key} onClick={() => setShow(key)}>
              {SHOW_LABEL[key]}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className={s.error} role="alert">
          Не удалось загрузить список: {error}
        </p>
      ) : (
        <div className={s.list} aria-busy={!rows || undefined}>
          <div className={`${s.row} ${s.rowHead}`} aria-hidden="true">
            <span>Центр</span>
            <span>Район</span>
            <span>Основное направление</span>
            <span>Изменён</span>
            <span>Статус</span>
          </div>
          {rows && !visible.length && (
            <p className={s.empty}>
              {rows.length ? 'Ничего не нашлось' : 'В базе пока нет центров — перенесите снимок скриптом из README или создайте первый.'}
            </p>
          )}
          {visible.map((r) => {
            const primary = r.categories.find(isCategoryId);
            return (
              <Link key={r.id} to={`/admin/centers/${r.id}`} className={s.row}>
                <span className={s.cellMain}>
                  <CenterLogo center={{ name: r.name, logo: r.logo ?? undefined }} size={36} />
                  <span className={s.cellText}>
                    <span className={s.cellName}>{r.name}</span>
                    <span className={s.cellSub}>/{r.id}</span>
                  </span>
                </span>
                <span className={s.cell}>{ru.districts[districtFor({ lat: r.lat, lng: r.lng })].label}</span>
                <span className={s.cell}>{primary ? ru.categories[primary].label : '—'}</span>
                <span className={s.cell}>{formatDay(samarkandDay(r.updated_at))}</span>
                <span className={`${s.status} ${r.published ? s.statusOn : s.statusOff}`}>{r.published ? 'На сайте' : 'Скрыт'}</span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
