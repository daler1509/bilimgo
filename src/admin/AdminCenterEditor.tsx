import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Check, ExternalLink, ImagePlus, Plus, Save, Trash2, Upload, UserRound, X } from 'lucide-react';
import { CenterLogo } from '@/components/centers/CenterLogo';
import { MapView } from '@/components/map/MapView';
import type { MapViewHandle } from '@/components/map/types';
import { Button } from '@/components/ui/Button';
import { CATEGORY_TREE } from '@/data/categories';
import { districtFor } from '@/data/districts';
import type { AgeGroup, CategoryId, CenterFeature, CenterKind, LearningFormat, Locale, TeachingLanguage } from '@/data/types';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ru } from '@/i18n/ru';
import { cn } from '@/lib/cn';
import { formatOpeningHours, parseOpeningHours } from '@/lib/openingHours';
import { isInCity } from '@/map/mapConfig';
import { fromRow, toRow, type CenterRow } from '@/services/centerRow';
import { invalidateCenters } from '@/services/centersRepository';
import { useUi } from '@/state/ui';
import {
  draftFromRecord,
  draftFromSubmission,
  emptyDraft,
  emptyLang,
  TEXT_LOCALES,
  type LangText,
  parseCoords,
  parseYandexId,
  slugify,
  toRecord,
  withParents,
  type Draft,
  type DraftErrors,
  type PricePer,
  type SubmissionRow,
} from './centerDraft';
import { uploadImage } from './media';
import { CHECKS, completeness, type Completable } from './completeness';
import { errorText, supabase } from './supabaseClient';
import { PageHeader, Pill, Score, Switch } from './ui';
import crm from './crm.module.css';
import s from './admin.module.css';

const fieldId = (key: string) => `f-${key.replace(/\./g, '-')}`;

const PER_LABEL: Record<PricePer, string> = { month: 'в месяц', course: 'за курс', lesson: 'за занятие' };

// the admin area is in Russian whatever language the public site is set to
const AGE_LABEL = ru.labels.age;
const AGE_HINT = ru.labels.ageHint;
const FEATURE_LABEL = ru.labels.feature;
const FORMAT_LABEL = ru.labels.format;
const KIND_LABEL = ru.labels.kind;
const LANGUAGE_LABEL = ru.labels.language;
const TEXT_LANG_NAME: Record<Locale, string> = { ru: 'по-русски', uz: 'по-узбекски', en: 'по-английски' };

/* ---------- small field components ---------- */

interface TextProps {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: ReactNode;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  inputMode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'url';
  required?: boolean;
  className?: string;
}

function Text({ name, label, value, onChange, error, hint, rows, placeholder, disabled, type, inputMode, required, className }: TextProps) {
  const id = fieldId(name);
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    className: s.input,
    value,
    disabled,
    placeholder,
    required,
    'aria-invalid': !!error || undefined,
    'aria-describedby': describedBy,
  };
  return (
    <div className={cn(s.field, className)}>
      <label htmlFor={id} className={s.label}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {hint && (
        <span className={s.hint} id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {rows ? (
        <textarea rows={rows} {...common} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type ?? 'text'} inputMode={inputMode} {...common} onChange={(e) => onChange(e.target.value)} />
      )}
      {error && (
        <span className={s.error} id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
  nested?: boolean;
}

function Checks<T extends string>({ legend, options, selected, onToggle }: { legend: string; options: Option<T>[]; selected: T[]; onToggle: (v: T) => void }) {
  return (
    <fieldset className={s.field}>
      <legend className={s.label}>{legend}</legend>
      <div className={s.checks}>
        {options.map((o) => (
          <label key={o.value} className={cn(s.check, o.nested && s.checkNested)}>
            <input type="checkbox" checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
            {o.label}
            {o.hint && <span className={s.hint}>{o.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Section({ title, lead, children, anchor }: { title: string; lead?: string; children: ReactNode; anchor: string }) {
  const id = useId();
  return (
    <section className={s.section} aria-labelledby={id} id={`sec-${anchor}`}>
      <h2 className={s.sectionTitle} id={id}>
        {title}
      </h2>
      {lead && <p className={s.sectionLead}>{lead}</p>}
      {children}
    </section>
  );
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const keysOf = <T extends string>(rec: Record<T, string>) => Object.keys(rec) as T[];

const SECTIONS: [string, string][] = [
  ['main', 'Основное'],
  ['where', 'Где'],
  ['cats', 'Направления'],
  ['contacts', 'Контакты и часы'],
  ['about', 'Описание и курсы'],
  ['audience', 'Для кого и занятия'],
  ['photos', 'Логотип и фото'],
  ['teachers', 'Преподаватели'],
  ['price', 'Цена и рейтинг'],
  ['sources', 'Источники'],
];

/** The draft in the shape the completeness checks read, so the score updates as you type */
function draftToCompletable(d: Draft): Completable {
  const lines = (v: string) => v.split('\n').map((x) => x.trim()).filter(Boolean);
  const some = <T,>(v: T[]) => (v.length ? v : null);
  return {
    logo: d.logo.trim() || null,
    photos: some(d.photos),
    address: d.address.ru.trim() || null,
    phones: some(lines(d.phones)),
    opening_hours: d.openingHours.trim() || null,
    website: d.website.trim() || null,
    telegram: d.telegram.trim() || null,
    instagram: d.instagram.trim() || null,
    summary: d.summary.ru.trim() || null,
    about: some(d.about.ru.trim() ? [d.about.ru] : []),
    programs: some(d.programs.filter((p) => p.title.ru.trim())),
    ages: some(d.ages),
    formats: some(d.formats),
    teaching: some(d.teaching),
    lessons: some(lines(d.lessons.ru)),
    teachers: some(d.teachers.filter((t) => t.name.trim())),
  };
}

/* ---------- editor ---------- */

export function AdminCenterEditor() {
  const { id } = useParams();
  const isNew = !id;
  const [params] = useSearchParams();
  const fromId = params.get('from');
  const copyId = params.get('copy');
  const navigate = useNavigate();
  const { toast } = useUi();
  const wide = useMediaQuery('(min-width: 1100px)');

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState('');
  const [submission, setSubmission] = useState<SubmissionRow | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | 'upload' | null>(null);
  /** Which language the text fields below show (address and texts); names and contacts are shared */
  const [textLang, setTextLang] = useState<Locale>('ru');
  const idTouched = useRef(!isNew);

  /* load */
  useEffect(() => {
    let alive = true;
    setLoadError(null);
    setErrors({});
    (async () => {
      let next = emptyDraft();
      if (id) {
        const { data, error } = await supabase!.from('centers').select('*').eq('id', id).maybeSingle();
        if (!alive) return;
        if (error) return setLoadError(errorText(error));
        if (!data) return setLoadError('Такого центра нет в базе');
        next = draftFromRecord(fromRow(data as CenterRow), (data as CenterRow).published);
        idTouched.current = true;
      } else if (copyId) {
        // a new branch «по образцу»: everything copied, the address of the page and the visibility are fresh
        const { data } = await supabase!.from('centers').select('*').eq('id', copyId).maybeSingle();
        if (!alive) return;
        if (data) {
          next = draftFromRecord(fromRow(data as CenterRow), false);
          next.id = '';
          next.branch = '';
          next.yandexId = '';
          next.coords = '';
          next.yandexRatings = '';
        }
      } else if (fromId) {
        const { data } = await supabase!.from('submissions').select('*').eq('id', fromId).maybeSingle();
        if (!alive) return;
        if (data) {
          setSubmission(data as SubmissionRow);
          next = draftFromSubmission(data as SubmissionRow);
        }
      }
      setDraft(next);
      setSaved(JSON.stringify(next));
    })();
    return () => {
      alive = false;
    };
  }, [id, fromId, copyId]);

  /* unsaved changes */
  const dirty = !!draft && JSON.stringify(draft) !== saved;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirtyRef.current && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('Есть несохранённые изменения. Уйти без сохранения?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /* point preview */
  const location = useMemo(() => (draft ? parseCoords(draft.coords) : null), [draft]);
  const mapRef = useRef<MapViewHandle>(null);
  const pointKey = location ? `${location.lat},${location.lng}` : '';
  useEffect(() => {
    if (location) mapRef.current?.flyTo(location, 16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointKey]);

  if (loadError)
    return (
      <section className={s.notice}>
        <h1 className={s.pageTitle}>Не удалось открыть</h1>
        <p>{loadError}</p>
        <Link to="/admin/centers" className={s.barLink}>
          <ArrowLeft size={16} aria-hidden="true" /> К списку центров
        </Link>
      </section>
    );
  if (!draft) return <div className="route-loading" aria-busy="true" />;

  /* updates */
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => d && { ...d, [key]: value });
    setErrors((e) => {
      const stale = Object.keys(e).filter((k) => k === key || k.startsWith(`${String(key)}.`));
      if (!stale.length) return e;
      const next = { ...e };
      stale.forEach((k) => delete next[k]);
      return next;
    });
  };

  const setName = (v: string) => {
    set('name', v);
    if (isNew && !idTouched.current) set('id', slugify(v));
  };

  const toggleCategory = (cid: CategoryId) => {
    const children = CATEGORY_TREE.filter((c) => c.parent === cid).map((c) => c.id);
    let next: CategoryId[];
    if (draft.categories.includes(cid)) next = draft.categories.filter((c) => c !== cid && !children.includes(c));
    else next = withParents([...draft.categories, cid]);
    set('categories', next);
    if (!next.includes(draft.primary as CategoryId)) set('primary', next[0] ?? '');
    else if (!draft.primary && next.length) set('primary', next[0]!);
  };

  const upload = async (kind: 'logos' | 'photos', e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy('upload');
    try {
      if (kind === 'logos') {
        const { url } = await uploadImage('logos', draft.id, files[0]!);
        set('logo', url);
      } else {
        const added = [];
        for (const file of files) {
          const { url, width, height } = await uploadImage('photos', draft.id, file);
          added.push({ src: url, width, height, alt: emptyLang(), credit: '', license: '', sourceUrl: '', view: 'interior' as const });
        }
        set('photos', [...draft.photos, ...added]);
        toast('Фото загружено — заполните автора, лицензию и источник');
      }
    } catch (err) {
      toast(`Не удалось загрузить: ${errorText(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const { record, errors: found } = toRecord(draft, isNew);
    setErrors(found);
    if (!record) {
      const first = Object.keys(found)[0];
      toast(`Проверьте поля: ${Object.keys(found).length}`);
      if (first) document.getElementById(fieldId(first))?.focus();
      return;
    }
    setBusy('save');
    const row = toRow(record, draft.published);
    const { data, error } = isNew
      ? await supabase!.from('centers').insert(row).select('id')
      : await supabase!.from('centers').update(row).eq('id', record.id).select('id');
    if (error || !data?.length) {
      setBusy(null);
      if (error?.code === '23505') {
        setErrors({ id: 'Такой адрес страницы уже занят' });
        document.getElementById(fieldId('id'))?.focus();
        return;
      }
      toast(`Не сохранилось: ${error ? errorText(error) : 'нет прав на изменение'}`);
      return;
    }
    if (isNew && submission) {
      await supabase!
        .from('submissions')
        .update({ status: 'approved', center_id: record.id, reviewed_at: new Date().toISOString() })
        .eq('id', submission.id);
    }
    invalidateCenters();
    const next = draftFromRecord(record, draft.published);
    dirtyRef.current = false;
    setDraft(next);
    setSaved(JSON.stringify(next));
    setBusy(null);
    toast(isNew ? 'Центр создан' : 'Сохранено');
    if (isNew) navigate(`/admin/centers/${record.id}`, { replace: true });
  };

  const remove = async () => {
    if (!window.confirm(`Удалить «${draft.name}» навсегда? Чтобы только убрать с сайта, снимите «Показывать на сайте».`)) return;
    setBusy('delete');
    const { error } = await supabase!.from('centers').delete().eq('id', draft.id);
    setBusy(null);
    if (error) return toast(`Не удалилось: ${errorText(error)}`);
    invalidateCenters();
    dirtyRef.current = false;
    toast('Центр удалён');
    navigate('/admin/centers', { replace: true });
  };

  const err = (key: string) => errors[key];
  const yandexId = parseYandexId(draft.yandexId);
  const hoursPreview = draft.openingHours.trim() && parseOpeningHours(draft.openingHours) ? formatOpeningHours(draft.openingHours) : null;
  const errorCount = Object.keys(errors).length;
  const fill = completeness(draftToCompletable(draft));
  const jump = (section: string) => {
    const el = document.getElementById(`sec-${section}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const categoryOptions: Option<CategoryId>[] = CATEGORY_TREE.map((c) => ({ value: c.id, label: ru.categories[c.id].label, nested: !!c.parent }));

  return (
    <form
      className={s.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <PageHeader
        back={{ to: '/admin/centers', label: 'Центры' }}
        title={isNew ? (copyId ? 'Новый филиал' : 'Новый центр') : draft.name || 'Без названия'}
        subtitle={isNew ? (copyId ? 'Скопированы описание, направления и контакты: проверьте адрес, координаты и карточку на Яндекс Картах.' : undefined) : `/centers/${draft.id}`}
        actions={
          <div className={s.segmented} role="group" aria-label="Язык текстов">
            {TEXT_LOCALES.map((l) => (
              <button key={l} type="button" className={s.segment} aria-pressed={textLang === l} onClick={() => setTextLang(l)}>
                Тексты {l.toUpperCase()}
              </button>
            ))}
          </div>
        }
      />

      {submission && (
        <p className={s.fromSubmission}>
          <b>Из заявки</b> от {new Date(submission.created_at).toLocaleDateString('ru-RU')}. Контакт: {submission.contact}
          {submission.links ? `\nСсылки: ${submission.links}` : ''}
          {submission.directions ? `\nНаправления: ${submission.directions}` : ''}
          {'\n'}Сверьте факты с карточкой на Яндекс Картах и официальными страницами, прежде чем публиковать.
        </p>
      )}

      <div className={crm.editorGrid}>
        <div className={crm.editorMain}>
      <Section anchor="main" title="Основное">
        <div className={s.grid}>
          <Text name="name" label="Название" value={draft.name} onChange={setName} error={err('name')} required />
          <Text
            name="id"
            label="Адрес страницы"
            value={draft.id}
            onChange={(v) => {
              idTouched.current = true;
              set('id', v.toLowerCase());
            }}
            error={err('id')}
            disabled={!isNew}
            hint={isNew ? `/centers/${draft.id || '…'} — после создания не меняется` : 'Не меняется: на него ссылаются избранное и сравнение'}
            required={isNew}
          />
          <div className={s.field}>
            <label htmlFor={fieldId('kind')} className={s.label}>
              Тип <span aria-hidden="true">*</span>
            </label>
            <select
              id={fieldId('kind')}
              className={s.input}
              value={draft.kind}
              aria-invalid={!!err('kind') || undefined}
              aria-describedby={err('kind') ? `${fieldId('kind')}-error` : undefined}
              onChange={(e) => set('kind', e.target.value as CenterKind)}
            >
              <option value="">Выберите…</option>
              {keysOf(KIND_LABEL).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            {err('kind') && (
              <span className={s.error} id={`${fieldId('kind')}-error`}>
                {err('kind')}
              </span>
            )}
          </div>
          <Text name="altName" label="Другое название" value={draft.altName} onChange={(v) => set('altName', v)} hint="Как ещё называют центр" />
          <Text name="brand" label="Сеть" value={draft.brand} onChange={(v) => set('brand', v)} hint="Одинаковое у всех филиалов" />
          <Text name="branch" label="Филиал" value={draft.branch} onChange={(v) => set('branch', v)} hint="Как центр сам называет филиал" />
          <Text
            name="summary"
            label={`Коротко, ${TEXT_LANG_NAME[textLang]}`}
            value={draft.summary[textLang]}
            onChange={(v) => set('summary', { ...draft.summary, [textLang]: v })}
            error={err('summary')}
            rows={2}
            className={s.span2}
            hint="Одно предложение для карточек"
          />
        </div>
      </Section>

      <Section anchor="where" title="Где" lead="Базовые факты — из карточки организации на Яндекс Картах.">
        <div className={s.grid}>
          <Text
            name="yandexId"
            label="Карточка на Яндекс Картах"
            value={draft.yandexId}
            onChange={(v) => set('yandexId', v)}
            error={err('yandexId')}
            hint={
              /^\d+$/.test(yandexId) ? (
                <a className={s.barLink} href={`https://yandex.uz/maps/org/${yandexId}/`} target="_blank" rel="noopener noreferrer">
                  Открыть карточку <ExternalLink size={12} aria-hidden="true" />
                </a>
              ) : (
                'Ссылка на карточку или номер организации'
              )
            }
            required
          />
          <Text
            name="coords"
            label="Координаты"
            value={draft.coords}
            onChange={(v) => set('coords', v)}
            error={err('coords')}
            placeholder="39.654727, 66.975693"
            hint={
              location && isInCity(location)
                ? `Район: ${ru.districts[districtFor(location)].label}`
                : 'В Яндекс Картах кликните по точке и скопируйте координаты'
            }
            required
          />
          <Text
            name="yandexRatings"
            label="Оценок на Яндекс Картах"
            value={draft.yandexRatings}
            onChange={(v) => set('yandexRatings', v)}
            error={err('yandexRatings')}
            inputMode="numeric"
            hint="Число под звёздами в карточке. На сайте не показывается — задаёт порядок «По популярности»"
          />
          <Text
            name="address"
            label={`Адрес, ${TEXT_LANG_NAME[textLang]}`}
            value={draft.address[textLang]}
            onChange={(v) => set('address', { ...draft.address, [textLang]: v })}
            hint={textLang === 'ru' ? 'Как в карточке на Яндекс Картах' : 'Улица латиницей: Gagarin koʻchasi, 86 / Gagarin St, 86'}
          />
          <div className={cn(s.mapBox, s.span2)}>
            {location && isInCity(location) ? (
              <MapView
                ref={mapRef}
                markers={[{ id: 'point', location, label: draft.name || 'Центр' }]}
                initialView={{ center: location, zoom: 16 }}
                gestures="cooperative"
                controls={{ zoom: true }}
                ariaLabel="Точка на карте"
              />
            ) : (
              <p className={s.empty}>Здесь появится точка, когда координаты будут в пределах Самарканда</p>
            )}
          </div>
        </div>
      </Section>

      <Section anchor="cats" title="Направления" lead="Первым идёт основное: по нему выбирается значок и порядок в поиске.">
        <Checks legend="Что преподают" options={categoryOptions} selected={draft.categories} onToggle={toggleCategory} />
        {draft.categories.length > 1 && (
          <div className={cn(s.field, s.narrow)}>
            <label htmlFor={fieldId('primary')} className={s.label}>
              Основное направление
            </label>
            <select id={fieldId('primary')} className={s.input} value={draft.primary} onChange={(e) => set('primary', e.target.value as CategoryId)}>
              {draft.categories.map((c) => (
                <option key={c} value={c}>
                  {ru.categories[c].label}
                </option>
              ))}
            </select>
          </div>
        )}
      </Section>

      <Section anchor="contacts" title="Контакты и часы">
        <div className={s.grid}>
          <Text name="phones" label="Телефоны" value={draft.phones} onChange={(v) => set('phones', v)} error={err('phones')} rows={2} hint="Один номер на строку" />
          <Text
            name="openingHours"
            label="Часы работы"
            value={draft.openingHours}
            onChange={(v) => set('openingHours', v)}
            error={err('openingHours')}
            placeholder="Mo-Sa 09:00-19:00; Su off"
            hint={hoursPreview ? `На сайте: ${hoursPreview}` : 'Формат OpenStreetMap'}
          />
          <Text name="website" label="Сайт" value={draft.website} onChange={(v) => set('website', v)} error={err('website')} inputMode="url" placeholder="https://" />
          <Text name="telegram" label="Telegram" value={draft.telegram} onChange={(v) => set('telegram', v)} placeholder="@channel или ссылка" />
          <Text name="instagram" label="Instagram" value={draft.instagram} onChange={(v) => set('instagram', v)} placeholder="@account или ссылка" />
        </div>
      </Section>

      <Section anchor="about" title="Описание" lead="Своими словами по официальным страницам центра — без копирования.">
        <Text
          name="about"
          label={`О центре, ${TEXT_LANG_NAME[textLang]}`}
          value={draft.about[textLang]}
          onChange={(v) => set('about', { ...draft.about, [textLang]: v })}
          error={err('about')}
          rows={5}
          hint="Абзацы разделяйте пустой строкой; в переводах держите тот же порядок абзацев"
        />
        <div className={s.field}>
          <span className={s.label}>Программы и курсы</span>
          <div className={s.repeat}>
            {draft.programs.map((p, i) => (
              <div key={i} className={s.repeatRow}>
                <Text
                  name={`programs.${i}.title`}
                  label={`Программа ${i + 1}, ${TEXT_LANG_NAME[textLang]}`}
                  value={p.title[textLang]}
                  error={err(`programs.${i}.title`)}
                  onChange={(v) => set('programs', draft.programs.map((x, j) => (j === i ? { ...x, title: { ...x.title, [textLang]: v } } : x)))}
                />
                <Text
                  name={`programs.${i}.note`}
                  label="Уточнение"
                  value={p.note[textLang]}
                  onChange={(v) => set('programs', draft.programs.map((x, j) => (j === i ? { ...x, note: { ...x.note, [textLang]: v } } : x)))}
                />
                <RemoveButton label={`Убрать программу ${i + 1}`} onClick={() => set('programs', draft.programs.filter((_, j) => j !== i))} />
              </div>
            ))}
            <AddButton onClick={() => set('programs', [...draft.programs, { title: emptyLang(), note: emptyLang() }])}>Добавить программу</AddButton>
          </div>
        </div>
      </Section>

      <Section anchor="audience" title="Для кого и формат" lead="Отмечайте только то, что указано в источниках. Неизвестное оставьте пустым.">
        <Checks
          legend="Возраст"
          options={keysOf(AGE_LABEL).map((a) => ({ value: a, label: AGE_LABEL[a], hint: AGE_HINT[a] }))}
          selected={draft.ages}
          onToggle={(v: AgeGroup) => set('ages', toggle(draft.ages, v))}
        />
        <Text
          name="audienceNote"
          label={`Уточнение, ${TEXT_LANG_NAME[textLang]}`}
          value={draft.audienceNote[textLang]}
          onChange={(v) => set('audienceNote', { ...draft.audienceNote, [textLang]: v })}
          error={err('audienceNote')}
          hint="Например: школьники 5–11 классов"
        />
        <Text
          name="lessons"
          label={`Как проходят занятия, ${TEXT_LANG_NAME[textLang]}`}
          value={draft.lessons[textLang]}
          onChange={(v) => set('lessons', { ...draft.lessons, [textLang]: v })}
          error={err('lessons')}
          rows={5}
          hint="Один факт на строку: сколько раз в неделю, сколько длится урок, размер группы, тест уровня. Только из источников; в переводах держите тот же порядок строк"
        />
        <Checks
          legend="Формат"
          options={keysOf(FORMAT_LABEL).map((f) => ({ value: f, label: FORMAT_LABEL[f] }))}
          selected={draft.formats}
          onToggle={(v: LearningFormat) => set('formats', toggle(draft.formats, v))}
        />
        <Checks
          legend="Язык обучения"
          options={keysOf(LANGUAGE_LABEL).map((l) => ({ value: l, label: LANGUAGE_LABEL[l] }))}
          selected={draft.teaching}
          onToggle={(v: TeachingLanguage) => set('teaching', toggle(draft.teaching, v))}
        />
        <Checks
          legend="Особенности"
          options={keysOf(FEATURE_LABEL).map((f) => ({ value: f, label: FEATURE_LABEL[f] }))}
          selected={draft.features}
          onToggle={(v: CenterFeature) => set('features', toggle(draft.features, v))}
        />
      </Section>

      <Section anchor="photos" title="Логотип и фото" lead="Только знак самого центра и фото, которые можно использовать законно: от центра или по свободной лицензии.">
        <div className={s.logoRow}>
          <CenterLogo center={{ name: draft.name || '?', logo: draft.logo || undefined }} size={64} />
          <FileButton accept="image/png,image/jpeg,image/webp" disabled={busy === 'upload'} onChange={(e) => upload('logos', e)}>
            {draft.logo ? 'Заменить логотип' : 'Загрузить логотип'}
          </FileButton>
          {draft.logo && (
            <Button variant="ghost" size="sm" leading={<X size={16} />} onClick={() => set('logo', '')}>
              Убрать
            </Button>
          )}
        </div>
        <Text name="logo" label="Ссылка на логотип" value={draft.logo} onChange={(v) => set('logo', v)} error={err('logo')} hint="Заполняется при загрузке" />

        {draft.photos.length > 0 && (
          <div className={s.photos}>
            {draft.photos.map((p, i) => {
              const patch = (k: 'credit' | 'license' | 'sourceUrl', v: string) =>
                set('photos', draft.photos.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
              const patchAlt = (v: string) => set('photos', draft.photos.map((x, j) => (j === i ? { ...x, alt: { ...x.alt, [textLang]: v } as LangText } : x)));
              return (
                <div key={p.src} className={s.photo}>
                  <img src={p.src} alt="" width={p.width} height={p.height} loading="lazy" />
                  <Text name={`photos.${i}.alt`} label={`Что на фото, ${TEXT_LANG_NAME[textLang]}`} value={p.alt[textLang]} error={err(`photos.${i}.alt`)} onChange={patchAlt} />
                  <label className={s.switch}>
                    <input
                      type="checkbox"
                      checked={p.view === 'exterior'}
                      onChange={(e) => set('photos', draft.photos.map((x, j) => (j === i ? { ...x, view: e.target.checked ? 'exterior' : 'interior' } : x)))}
                    />
                    Здание снаружи (для карусели на главной)
                  </label>
                  <Text name={`photos.${i}.credit`} label="Автор" value={p.credit} error={err(`photos.${i}.credit`)} onChange={(v) => patch('credit', v)} />
                  <Text
                    name={`photos.${i}.license`}
                    label="Лицензия"
                    value={p.license}
                    error={err(`photos.${i}.license`)}
                    placeholder="CC BY-SA 4.0 или «С разрешения центра»"
                    onChange={(v) => patch('license', v)}
                  />
                  <Text
                    name={`photos.${i}.sourceUrl`}
                    label="Источник"
                    value={p.sourceUrl}
                    error={err(`photos.${i}.sourceUrl`)}
                    placeholder="https://"
                    onChange={(v) => patch('sourceUrl', v)}
                  />
                  <Button variant="ghost" size="sm" leading={<Trash2 size={16} />} onClick={() => set('photos', draft.photos.filter((_, j) => j !== i))}>
                    Убрать фото
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <div>
          <FileButton accept="image/png,image/jpeg,image/webp" multiple disabled={busy === 'upload'} icon={<ImagePlus size={18} />} onChange={(e) => upload('photos', e)}>
            Добавить фото
          </FileButton>
        </div>
      </Section>

      <Section
        anchor="teachers"
        title="Преподаватели"
        lead="Только те, кого центр сам называет на сайте или в канале. Фото человека — с его согласия или из официальных страниц центра. Без добавленных преподавателей на сайте показывается пустой раздел."
      >
        <div className={s.teachers}>
          {draft.teachers.map((x, i) => {
            const patch = (next: Partial<typeof x>) => set('teachers', draft.teachers.map((y, j) => (j === i ? { ...y, ...next } : y)));
            const patchPhoto = (k: 'credit' | 'sourceUrl', v: string) => x.photo && patch({ photo: { ...x.photo, [k]: v } });
            const uploadFace = async (e: ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setBusy('upload');
              try {
                const { url, width, height } = await uploadImage('teachers', draft.id, file);
                patch({ photo: { src: url, width, height, credit: x.photo?.credit ?? '', sourceUrl: x.photo?.sourceUrl ?? '' } });
                toast('Фото загружено — укажите, чьё оно и откуда');
              } catch (err2) {
                toast(`Не удалось загрузить: ${errorText(err2)}`);
              } finally {
                setBusy(null);
              }
            };
            return (
              <div key={i} className={s.teacher}>
                <div className={s.teacherFace}>
                  {x.photo ? <img src={x.photo.src} alt="" width={x.photo.width} height={x.photo.height} /> : <UserRound size={28} aria-hidden="true" />}
                </div>
                <div className={s.teacherFields}>
                  <Text name={`teachers.${i}.name`} label={`Преподаватель ${i + 1}: имя`} value={x.name} error={err(`teachers.${i}.name`)} onChange={(v) => patch({ name: v })} />
                  <Text
                    name={`teachers.${i}.role`}
                    label={`Что преподаёт, ${TEXT_LANG_NAME[textLang]}`}
                    value={x.role[textLang]}
                    error={err(`teachers.${i}.role`)}
                    placeholder="Преподаватель английского"
                    onChange={(v) => patch({ role: { ...x.role, [textLang]: v } as LangText })}
                  />
                  <Text
                    name={`teachers.${i}.note`}
                    label={`Строка о преподавателе, ${TEXT_LANG_NAME[textLang]}`}
                    value={x.note[textLang]}
                    error={err(`teachers.${i}.note`)}
                    hint="Только из источников: уровень, экзамены, языки"
                    onChange={(v) => patch({ note: { ...x.note, [textLang]: v } as LangText })}
                  />
                  <div className={s.teacherPhoto}>
                    <FileButton accept="image/png,image/jpeg,image/webp" disabled={busy === 'upload'} icon={<ImagePlus size={18} />} onChange={uploadFace}>
                      {x.photo ? 'Заменить фото' : 'Загрузить фото'}
                    </FileButton>
                    {x.photo && (
                      <Button variant="ghost" size="sm" leading={<X size={16} />} onClick={() => patch({ photo: null })}>
                        Убрать фото
                      </Button>
                    )}
                  </div>
                  {x.photo && (
                    <div className={s.grid}>
                      <Text name={`teachers.${i}.credit`} label="Чьё фото" value={x.photo.credit} error={err(`teachers.${i}.credit`)} placeholder="Центр, автор" onChange={(v) => patchPhoto('credit', v)} />
                      <Text
                        name={`teachers.${i}.sourceUrl`}
                        label="Откуда фото"
                        value={x.photo.sourceUrl}
                        error={err(`teachers.${i}.sourceUrl`)}
                        placeholder="https://"
                        onChange={(v) => patchPhoto('sourceUrl', v)}
                      />
                    </div>
                  )}
                </div>
                <RemoveButton label={`Убрать преподавателя ${i + 1}`} onClick={() => set('teachers', draft.teachers.filter((_, j) => j !== i))} />
              </div>
            );
          })}
          <AddButton onClick={() => set('teachers', [...draft.teachers, { name: '', role: emptyLang(), note: emptyLang(), photo: null }])}>Добавить преподавателя</AddButton>
        </div>
      </Section>

      <Section anchor="price" title="Цена и рейтинг" lead="Только опубликованные самим центром или названным источником. Без ссылки на источник сайт их не покажет.">
        <label className={s.switch}>
          <input
            type="checkbox"
            checked={!!draft.price}
            onChange={(e) => set('price', e.target.checked ? { amount: '', per: 'month', label: '', url: '' } : null)}
          />
          Есть опубликованная цена
        </label>
        {draft.price && (
          <div className={s.grid}>
            <Text
              name="price.amount"
              label="Цена от, сум"
              value={draft.price.amount}
              inputMode="numeric"
              error={err('price.amount')}
              onChange={(v) => set('price', { ...draft.price!, amount: v })}
            />
            <div className={s.field}>
              <label htmlFor={fieldId('price.per')} className={s.label}>
                За что
              </label>
              <select id={fieldId('price.per')} className={s.input} value={draft.price.per} onChange={(e) => set('price', { ...draft.price!, per: e.target.value as PricePer })}>
                {keysOf(PER_LABEL).map((p) => (
                  <option key={p} value={p}>
                    {PER_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <Text name="price.label" label="Где опубликована" value={draft.price.label} error={err('price.label')} onChange={(v) => set('price', { ...draft.price!, label: v })} />
            <Text name="price.url" label="Ссылка" value={draft.price.url} error={err('price.url')} placeholder="https://" onChange={(v) => set('price', { ...draft.price!, url: v })} />
          </div>
        )}
        <label className={s.switch}>
          <input
            type="checkbox"
            checked={!!draft.rating}
            onChange={(e) => set('rating', e.target.checked ? { value: '', count: '', label: '', url: '' } : null)}
          />
          Есть рейтинг из источника
        </label>
        {draft.rating && (
          <div className={s.grid}>
            <Text
              name="rating.value"
              label="Оценка"
              value={draft.rating.value}
              inputMode="decimal"
              placeholder="4.8"
              error={err('rating.value')}
              onChange={(v) => set('rating', { ...draft.rating!, value: v })}
            />
            <Text
              name="rating.count"
              label="Число оценок"
              value={draft.rating.count}
              inputMode="numeric"
              error={err('rating.count')}
              onChange={(v) => set('rating', { ...draft.rating!, count: v })}
            />
            <Text name="rating.label" label="Источник" value={draft.rating.label} placeholder="Яндекс Карты" error={err('rating.label')} onChange={(v) => set('rating', { ...draft.rating!, label: v })} />
            <Text name="rating.url" label="Ссылка" value={draft.rating.url} error={err('rating.url')} placeholder="https://" onChange={(v) => set('rating', { ...draft.rating!, url: v })} />
          </div>
        )}
      </Section>

      <Section anchor="sources" title="Источники" lead="Официальные сайты и Telegram-каналы, откуда взяты направления и описание. Показываются в профиле.">
        <div className={s.repeat}>
          {draft.sources.map((src, i) => (
            <div key={i} className={s.repeatRow}>
              <Text
                name={`sources.${i}.label`}
                label="Подпись"
                value={src.label}
                error={err(`sources.${i}.label`)}
                placeholder="Официальный сайт"
                onChange={(v) => set('sources', draft.sources.map((x, j) => (j === i ? { ...x, label: v } : x)))}
              />
              <Text
                name={`sources.${i}.url`}
                label="Ссылка"
                value={src.url}
                error={err(`sources.${i}.url`)}
                placeholder="https://"
                onChange={(v) => set('sources', draft.sources.map((x, j) => (j === i ? { ...x, url: v } : x)))}
              />
              <RemoveButton label={`Убрать источник ${i + 1}`} onClick={() => set('sources', draft.sources.filter((_, j) => j !== i))} />
            </div>
          ))}
          <AddButton onClick={() => set('sources', [...draft.sources, { label: '', url: '' }])}>Добавить источник</AddButton>
        </div>
      </Section>

        </div>

        <aside className={crm.editorRail} aria-label="Публикация и заполненность">
          <section className={crm.railCard}>
            <div className={crm.railRow}>
              <span>
                <span className={crm.railTitle}>Показывать на сайте</span>
                <span className={crm.railNote}>{draft.published ? 'Центр виден посетителям' : 'Скрыт: только в админке'}</span>
              </span>
              <Switch checked={draft.published} onChange={(v) => set('published', v)} label="Показывать на сайте" />
            </div>
            <Button type="submit" variant="primary" size="lg" block leading={<Save size={18} />} loading={busy === 'save'} disabled={busy === 'upload'}>
              {isNew ? 'Создать центр' : 'Сохранить'}
            </Button>
            <p className={crm.railHint} role="status">
              {errorCount > 0 ? <span className={s.error}>Проверьте поля: {errorCount}</span> : dirty ? 'Есть несохранённые изменения' : isNew ? 'Центр появится после сохранения' : 'Все изменения сохранены'}
            </p>
            {!isNew && (
              <div className={crm.railLinks}>
                {draft.published && (
                  <a className={s.barLink} href={`/centers/${draft.id}`} target="_blank" rel="noopener noreferrer">
                    Открыть на сайте <ExternalLink size={14} aria-hidden="true" />
                  </a>
                )}
                <button type="button" className={crm.railDanger} onClick={() => void remove()} disabled={busy === 'delete'}>
                  <Trash2 size={15} aria-hidden="true" /> Удалить центр
                </button>
              </div>
            )}
          </section>

          <details className={crm.railCard} open={wide || undefined}>
            <summary className={crm.railSummary}>
              <span className={crm.railTitle}>Заполненность</span>
              <Score value={fill.score} />
            </summary>
            <ul className={crm.checklist}>
              {CHECKS.map((c) => {
                const done = fill.done.some((d) => d.key === c.key);
                return (
                  <li key={c.key}>
                    <button type="button" className={crm.checkItem} data-done={done || undefined} onClick={() => jump(c.section)}>
                      <span className={crm.checkMark} aria-hidden="true">
                        {done && <Check size={12} strokeWidth={3} />}
                      </span>
                      {c.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>

          <nav className={`${crm.railCard} ${crm.railNavCard}`} aria-label="Разделы формы">
            <span className={crm.railTitle}>Разделы</span>
            <ul className={crm.railNav}>
              {SECTIONS.map(([key, label]) => (
                <li key={key}>
                  <button type="button" onClick={() => jump(key)}>
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>

      {/* phones: the save button stays in reach */}
      <div className={crm.mobileSave}>
        <label className={crm.mobileSwitch}>
          <Switch checked={draft.published} onChange={(v) => set('published', v)} label="Показывать на сайте" />
          <span>На сайте</span>
        </label>
        {dirty && <Pill tone="warn" plain>Не сохранено</Pill>}
        <Button type="submit" variant="primary" leading={<Save size={18} />} loading={busy === 'save'} disabled={busy === 'upload'} style={{ marginLeft: 'auto' }}>
          {isNew ? 'Создать' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <div>
      <Button variant="secondary" size="sm" leading={<Plus size={16} />} onClick={onClick}>
        {children}
      </Button>
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" aria-label={label} title={label} onClick={onClick} className={s.removeButton}>
      <X size={16} />
    </Button>
  );
}

/** A real file input behind a button-looking label — keyboard and screen readers get the input */
function FileButton({
  accept,
  multiple,
  disabled,
  icon = <Upload size={18} />,
  onChange,
  children,
}: {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <>
      <input id={id} type="file" accept={accept} multiple={multiple} disabled={disabled} className="sr-only" onChange={onChange} />
      <label htmlFor={id} className={s.fileButton} aria-disabled={disabled || undefined}>
        {icon}
        {disabled ? 'Загружаем…' : children}
      </label>
    </>
  );
}
