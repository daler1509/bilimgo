import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { GraduationCap, UserRound } from 'lucide-react';
import { loadCenterRows, type CenterListRow } from './centerQuery';
import { normalize, plural } from './format';
import { errorText } from './supabaseClient';
import { EmptyState, Pill, SearchField, SkeletonRows, Tabs } from './ui';
import s from './crm.module.css';

/** The name teachers carry until the real one is filled in */
const PLACEHOLDER_NAME = 'Имя Фамилия';

interface TeacherRow {
  key: string;
  centerId: string;
  centerName: string;
  published: boolean;
  name: string;
  role: string;
  note: string;
  photo: string | null;
  placeholder: boolean;
}

type Tab = 'all' | 'placeholder' | 'nophoto';

function flatten(centers: CenterListRow[]): TeacherRow[] {
  return centers.flatMap((c) =>
    (c.teachers ?? []).map((t, i) => ({
      key: `${c.id}-${i}`,
      centerId: c.id,
      centerName: c.branch ? `${c.name}, ${c.branch}` : c.name,
      published: c.published,
      name: t.name,
      role: t.role?.ru ?? '',
      note: t.note?.ru ?? '',
      photo: t.photo?.src ?? null,
      placeholder: t.name.trim() === PLACEHOLDER_NAME,
    })),
  );
}

/** Everyone the catalogue names as a teacher, across centres. Editing happens in the centre's own page. */
export function AdminTeachers() {
  const [centers, setCenters] = useState<CenterListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [centerId, setCenterId] = useState('');

  useEffect(() => {
    loadCenterRows()
      .then(setCenters)
      .catch((e) => setError(errorText(e)));
  }, []);

  const all = useMemo(() => flatten(centers ?? []), [centers]);
  const withoutTeachers = useMemo(() => (centers ?? []).filter((c) => c.published && !(c.teachers?.length)), [centers]);

  const counts = useMemo(
    () => ({ all: all.length, placeholder: all.filter((t) => t.placeholder).length, nophoto: all.filter((t) => !t.photo).length }),
    [all],
  );

  const visible = useMemo(() => {
    const needle = normalize(q);
    return all.filter(
      (t) =>
        (tab === 'all' || (tab === 'placeholder' && t.placeholder) || (tab === 'nophoto' && !t.photo)) &&
        (!centerId || t.centerId === centerId) &&
        (!needle || normalize(`${t.name} ${t.role} ${t.centerName}`).includes(needle)),
    );
  }, [all, tab, q, centerId]);

  const centerOptions = useMemo(() => (centers ?? []).filter((c) => c.teachers?.length), [centers]);

  return (
    <>
      <header className={s.head}>
        <div>
          <h1 className={s.title}>Преподаватели</h1>
          <p className={s.subtitle}>
            {centers
              ? `${counts.all} ${plural(counts.all, 'преподаватель', 'преподавателя', 'преподавателей')} в ${centerOptions.length} ${plural(centerOptions.length, 'центре', 'центрах', 'центрах')}. Менять их можно на странице центра.`
              : 'Все преподаватели каталога'}
          </p>
        </div>
      </header>

      {error && (
        <p className={s.alert} role="alert">
          Не удалось загрузить данные: {error}
        </p>
      )}

      {centers && counts.placeholder > 0 && (
        <p className={s.alert} style={{ background: 'var(--color-warning-subtle)', color: 'var(--color-warning)', marginBottom: 14 }}>
          {counts.placeholder} {plural(counts.placeholder, 'карточка', 'карточки', 'карточек')} с именем-заглушкой «{PLACEHOLDER_NAME}» видны посетителям. Замените их на реальные данные центров или удалите.
        </p>
      )}

      <div className={s.toolbar}>
        <Tabs
          value={tab}
          onChange={setTab}
          label="Фильтр"
          items={[
            { value: 'all', label: 'Все', count: counts.all },
            { value: 'placeholder', label: 'Заглушки', count: counts.placeholder },
            { value: 'nophoto', label: 'Без фото', count: counts.nophoto },
          ]}
        />
      </div>
      <div className={s.toolbar}>
        <SearchField value={q} onChange={setQ} placeholder="Имя, должность или центр" />
        <select className={s.select} value={centerId} onChange={(e) => setCenterId(e.target.value)} aria-label="Центр">
          <option value="">Все центры</option>
          {centerOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.branch ? `${c.name}, ${c.branch}` : c.name}
            </option>
          ))}
        </select>
      </div>

      {!centers && !error && <SkeletonRows n={5} />}

      {centers && !visible.length && (
        <div className={s.tableWrap}>
          <EmptyState
            icon={GraduationCap}
            title={all.length ? 'Ничего не найдено' : 'Преподавателей пока нет'}
            text={all.length ? 'Измените поиск или фильтр.' : 'Добавьте их в редакторе центра, в блоке «Преподаватели».'}
          />
        </div>
      )}

      {centers && visible.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Преподаватель</th>
                <th>Что преподаёт</th>
                <th>Центр</th>
                <th>Фото</th>
                <th>Состояние</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t, i) => (
                <tr key={t.key} data-enter={i < 14 || undefined} style={{ ['--i' as string]: i }}>
                  <td>
                    <span className={s.cellMain}>
                      <span className={s.faceArch} aria-hidden="true">
                        {t.photo ? <img src={t.photo} alt="" loading="lazy" /> : <UserRound size={18} />}
                      </span>
                      <span className={s.cellName}>{t.name}</span>
                    </span>
                  </td>
                  <td>
                    <span className={s.cellName} style={{ fontWeight: 500 }}>
                      {t.role || '—'}
                    </span>
                    {t.note && <span className={s.cellSub}>{t.note}</span>}
                  </td>
                  <td>
                    <Link to={`/admin/centers/${t.centerId}`} className={s.cellName}>
                      {t.centerName}
                    </Link>
                    {!t.published && <span className={s.cellSub}>скрыт с сайта</span>}
                  </td>
                  <td className={s.muted}>{t.photo ? 'есть' : 'нет'}</td>
                  <td>{t.placeholder ? <Pill tone="warn">Заглушка</Pill> : <Pill tone="ok">Заполнен</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {centers && withoutTeachers.length > 0 && (
        <section className={s.panel} style={{ marginTop: 16 }}>
          <div className={s.panelHead}>
            <h2 className={s.panelTitle}>Центры без преподавателей</h2>
            <span className={s.statNote}>{withoutTeachers.length} на сайте</span>
          </div>
          <div className={s.chips}>
            {withoutTeachers.map((c) => (
              <Link key={c.id} to={`/admin/centers/${c.id}`} className={s.chip}>
                {c.branch ? `${c.name}, ${c.branch}` : c.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
