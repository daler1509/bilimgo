import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Building2, Copy, Download, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { CenterLogo } from '@/components/centers/CenterLogo';
import { Button, ButtonLink, buttonClass } from '@/components/ui/Button';
import { isCategoryId } from '@/data/categories';
import { ru } from '@/i18n/ru';
import { invalidateCenters } from '@/services/centersRepository';
import { useUi } from '@/state/ui';
import { loadCenterRows, type CenterListRow } from './centerQuery';
import { completeness } from './completeness';
import { ago, downloadCsv, dayKey, normalize, plural } from './format';
import { errorText, supabase } from './supabaseClient';
import { EmptyState, Score, SearchField, SkeletonRows, Switch, Tabs, useConfirm } from './ui';
import s from './crm.module.css';

type Tab = 'all' | 'published' | 'hidden' | 'incomplete';
type Sort = 'name' | 'updated' | 'score';

interface Row extends CenterListRow {
  score: number;
  missing: string[];
}

const categoryLabel = (id: string | undefined) => (id && isCategoryId(id) ? ru.categories[id].label : '—');

/** The catalogue: every centre with its state, completeness and the actions that matter */
export function AdminCenters() {
  const [raw, setRaw] = useState<CenterListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useUi();
  const confirm = useConfirm();

  useEffect(() => {
    if (params.get('sort') === 'score') setSort('score');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    try {
      setRaw(await loadCenterRows());
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo<Row[] | null>(
    () =>
      raw?.map((c) => {
        const r = completeness(c);
        return { ...c, score: r.score, missing: r.missing.map((m) => m.label) };
      }) ?? null,
    [raw],
  );

  const counts = useMemo(() => {
    const all = rows ?? [];
    return {
      all: all.length,
      published: all.filter((r) => r.published).length,
      hidden: all.filter((r) => !r.published).length,
      incomplete: all.filter((r) => r.score < 70).length,
    };
  }, [rows]);

  const topCategories = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows ?? []) for (const c of r.categories) seen.set(c, (seen.get(c) ?? 0) + 1);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [rows]);

  const visible = useMemo(() => {
    const needle = normalize(q);
    const list = (rows ?? []).filter((r) => {
      if (tab === 'published' && !r.published) return false;
      if (tab === 'hidden' && r.published) return false;
      if (tab === 'incomplete' && r.score >= 70) return false;
      if (cat && !r.categories.includes(cat)) return false;
      return !needle || normalize(`${r.name} ${r.brand ?? ''} ${r.branch ?? ''} ${r.id}`).includes(needle);
    });
    return list.sort((a, b) =>
      sort === 'updated' ? b.updated_at.localeCompare(a.updated_at) : sort === 'score' ? a.score - b.score || a.name.localeCompare(b.name, 'ru') : a.name.localeCompare(b.name, 'ru'),
    );
  }, [rows, tab, q, cat, sort]);

  /* ---------- changes ---------- */
  const setPublished = async (ids: string[], published: boolean) => {
    const before = raw;
    setRaw((r) => r?.map((c) => (ids.includes(c.id) ? { ...c, published } : c)) ?? null);
    setBusyId(ids.length === 1 ? ids[0]! : null);
    const { error: err } = await supabase!.from('centers').update({ published }).in('id', ids);
    setBusyId(null);
    if (err) {
      setRaw(before);
      return toast(`Не получилось: ${errorText(err)}`);
    }
    invalidateCenters();
    setPicked(new Set());
    toast(
      ids.length === 1
        ? published
          ? 'Центр показан на сайте'
          : 'Центр скрыт с сайта'
        : `${ids.length} ${plural(ids.length, 'центр', 'центра', 'центров')}: ${published ? 'показаны на сайте' : 'скрыты с сайта'}`,
    );
  };

  const remove = async (list: Row[]) => {
    const ok = await confirm({
      title: list.length === 1 ? `Удалить «${list[0]!.name}»?` : `Удалить ${list.length} ${plural(list.length, 'центр', 'центра', 'центров')}?`,
      text: 'Центр исчезнет навсегда вместе с описанием, фото и преподавателями. Чтобы только убрать его с сайта, скройте его: так его можно вернуть.',
      confirm: 'Удалить навсегда',
      danger: true,
    });
    if (!ok) return;
    const ids = list.map((c) => c.id);
    const { error: err } = await supabase!.from('centers').delete().in('id', ids);
    if (err) return toast(`Не удалилось: ${errorText(err)}`);
    invalidateCenters();
    setRaw((r) => r?.filter((c) => !ids.includes(c.id)) ?? null);
    setPicked(new Set());
    toast(ids.length === 1 ? 'Центр удалён' : 'Центры удалены');
  };

  const togglePick = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allPicked = visible.length > 0 && visible.every((r) => picked.has(r.id));
  const pickedRows = visible.filter((r) => picked.has(r.id));

  const exportCsv = () =>
    downloadCsv(
      `centry-${dayKey(Date.now())}.csv`,
      ['Название', 'Филиал', 'Сеть', 'Адрес страницы', 'На сайте', 'Заполненность %', 'Не хватает', 'Изменён'],
      visible.map((r) => [r.name, r.branch, r.brand, r.id, r.published ? 'да' : 'нет', r.score, r.missing.join(', '), r.updated_at.slice(0, 10)]),
    );

  const tabItems: { value: Tab; label: string; count: number }[] = [
    { value: 'all', label: 'Все', count: counts.all },
    { value: 'published', label: 'На сайте', count: counts.published },
    { value: 'hidden', label: 'Скрытые', count: counts.hidden },
    { value: 'incomplete', label: 'Неполные', count: counts.incomplete },
  ];

  return (
    <>
      <header className={s.head}>
        <div>
          <h1 className={s.title}>Центры</h1>
          <p className={s.subtitle}>
            {rows ? `${counts.all} ${plural(counts.all, 'центр', 'центра', 'центров')} в базе, ${counts.published} на сайте` : 'Каталог учебных центров'}
          </p>
        </div>
        <div className={s.headActions}>
          <Button variant="secondary" leading={<Download size={16} />} onClick={exportCsv} disabled={!visible.length}>
            В таблицу CSV
          </Button>
          <ButtonLink to="/admin/centers/new" variant="primary" leading={<Plus size={18} />}>
            Новый центр
          </ButtonLink>
        </div>
      </header>

      <div className={s.toolbar}>
        <Tabs value={tab} onChange={setTab} items={tabItems} label="Показать" />
      </div>
      <div className={s.toolbar}>
        <SearchField value={q} onChange={setQ} placeholder="Название, сеть или адрес страницы" />
        <select className={s.select} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Направление">
          <option value="">Все направления</option>
          {topCategories.map((id) => (
            <option key={id} value={id}>
              {categoryLabel(id)}
            </option>
          ))}
        </select>
        <select className={s.select} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Порядок">
          <option value="name">По названию</option>
          <option value="updated">Недавно изменённые</option>
          <option value="score">Сначала неполные</option>
        </select>
      </div>

      {error && (
        <p className={s.alert} role="alert">
          Не удалось загрузить центры: {error}
        </p>
      )}
      {!rows && !error && <SkeletonRows n={7} />}

      {rows && !visible.length && (
        <div className={s.tableWrap}>
          <EmptyState
            icon={Building2}
            title={rows.length ? 'Ничего не найдено' : 'В базе пока нет центров'}
            text={rows.length ? 'Измените поиск или фильтр.' : 'Добавьте первый центр или загрузите снимок командой supabase/seed-centers.mjs.'}
            action={
              !rows.length ? (
                <ButtonLink to="/admin/centers/new" variant="primary" leading={<Plus size={18} />}>
                  Новый центр
                </ButtonLink>
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
                <th>Центр</th>
                <th className={s.hideSm}>Направление</th>
                <th>Заполненность</th>
                <th className={s.hideSm}>Фото</th>
                <th>На сайте</th>
                <th className={s.hideSm}>Изменён</th>
                <th aria-label="Действия" className={s.hideXs} />
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => (
                <tr
                  key={r.id}
                  data-click
                  data-enter={i < 14 || undefined}
                  data-selected={picked.has(r.id) || undefined}
                  style={{ ['--i' as string]: i }}
                  onClick={() => navigate(`/admin/centers/${r.id}`)}
                >
                  <td className={`${s.cellCheck} ${s.hideXs}`} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className={s.check} checked={picked.has(r.id)} aria-label={`Выбрать ${r.name}`} onChange={() => togglePick(r.id)} />
                  </td>
                  <td>
                    <span className={s.cellMain}>
                      <CenterLogo center={{ name: r.name, logo: r.logo ?? undefined }} size={38} />
                      <span className={s.cellText}>
                        <Link to={`/admin/centers/${r.id}`} className={s.cellName} onClick={(e) => e.stopPropagation()}>
                          {r.name}
                          {r.branch ? <span className={s.muted}> · {r.branch}</span> : null}
                        </Link>
                        <span className={`${s.cellSub} ${s.hideXs}`}>/centers/{r.id}</span>
                      </span>
                    </span>
                  </td>
                  <td className={`${s.hideSm} ${s.muted}`}>{categoryLabel(r.categories[0])}</td>
                  <td title={r.missing.length ? `Не хватает: ${r.missing.join(', ')}` : 'Всё заполнено'}>
                    <Score value={r.score} />
                  </td>
                  <td className={`${s.hideSm} ${s.muted}`}>{r.photos?.length ?? 0}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Switch checked={r.published} busy={busyId === r.id} label={r.published ? `Скрыть «${r.name}» с сайта` : `Показать «${r.name}» на сайте`} onChange={(v) => void setPublished([r.id], v)} />
                  </td>
                  <td className={`${s.hideSm} ${s.nowrap} ${s.muted}`}>{ago(r.updated_at)}</td>
                  <td className={s.hideXs} onClick={(e) => e.stopPropagation()}>
                    <div className={s.rowActions}>
                      <Link to={`/admin/centers/${r.id}`} className={buttonClass({ variant: 'ghost', size: 'sm' })} aria-label={`Редактировать ${r.name}`} title="Редактировать">
                        <Pencil size={16} aria-hidden="true" />
                      </Link>
                      {r.published && (
                        <a className={buttonClass({ variant: 'ghost', size: 'sm' })} href={`/centers/${r.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Открыть ${r.name} на сайте`} title="Открыть на сайте">
                          <ExternalLink size={16} aria-hidden="true" />
                        </a>
                      )}
                      <Link
                        to={`/admin/centers/new?copy=${r.id}`}
                        className={buttonClass({ variant: 'ghost', size: 'sm' })}
                        aria-label={`Создать филиал по образцу ${r.name}`}
                        title="Создать по образцу (новый филиал)"
                      >
                        <Copy size={16} aria-hidden="true" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pickedRows.length > 0 && (
        <div className={s.bulk} role="region" aria-label="Действия с выбранными">
          <span>Выбрано: {pickedRows.length}</span>
          <button type="button" onClick={() => void setPublished(pickedRows.map((r) => r.id), true)}>
            Показать на сайте
          </button>
          <button type="button" onClick={() => void setPublished(pickedRows.map((r) => r.id), false)}>
            Скрыть
          </button>
          <button type="button" data-danger onClick={() => void remove(pickedRows)}>
            <Trash2 size={14} aria-hidden="true" style={{ verticalAlign: -2, marginRight: 4 }} />
            Удалить
          </button>
          <button type="button" onClick={() => setPicked(new Set())}>
            Снять выбор
          </button>
        </div>
      )}
    </>
  );
}
