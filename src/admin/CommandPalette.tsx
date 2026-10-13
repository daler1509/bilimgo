import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Building2, CornerDownLeft, FilePlus2, GraduationCap, Images, LayoutDashboard, PhoneIncoming, Search, Settings, type LucideIcon } from 'lucide-react';
import { normalize, prettyPhone } from './format';
import { supabase } from './supabaseClient';
import s from './crm.module.css';

interface Item {
  key: string;
  group: string;
  icon: LucideIcon;
  title: string;
  hint?: string;
  to: string;
}

const PAGES: Item[] = [
  { key: 'p-dash', group: 'Разделы', icon: LayoutDashboard, title: 'Дашборд', to: '/admin' },
  { key: 'p-leads', group: 'Разделы', icon: PhoneIncoming, title: 'Заявки на курсы', to: '/admin/leads' },
  { key: 'p-subs', group: 'Разделы', icon: FilePlus2, title: 'Новые центры', to: '/admin/submissions' },
  { key: 'p-centers', group: 'Разделы', icon: Building2, title: 'Центры', to: '/admin/centers' },
  { key: 'p-new', group: 'Разделы', icon: Building2, title: 'Добавить центр', to: '/admin/centers/new' },
  { key: 'p-teachers', group: 'Разделы', icon: GraduationCap, title: 'Преподаватели', to: '/admin/teachers' },
  { key: 'p-media', group: 'Разделы', icon: Images, title: 'Медиатека', to: '/admin/media' },
  { key: 'p-settings', group: 'Разделы', icon: Settings, title: 'Настройки', to: '/admin/settings' },
];

interface CenterHit {
  id: string;
  name: string;
  brand: string | null;
  branch: string | null;
  published: boolean;
}

interface LeadHit {
  id: string;
  phone: string;
  name: string | null;
  center_name: string;
}

/** Everything reachable from the keyboard: sections, centres by name, requests by phone or name */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [centers, setCenters] = useState<CenterHit[] | null>(null);
  const [leads, setLeads] = useState<LeadHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setActive(0);
    window.setTimeout(() => inputRef.current?.focus(), 30);
    if (!centers && supabase) {
      supabase
        .from('centers')
        .select('id,name,brand,branch,published')
        .order('name')
        .then(({ data }) => setCenters((data as CenterHit[]) ?? []));
    }
  }, [open, centers]);

  // requests are searched on the server: there can be many
  useEffect(() => {
    const term = q.trim().replace(/[,()%*\\]/g, ' ').trim();
    if (!open || term.length < 3 || !supabase) {
      setLeads([]);
      return;
    }
    const digits = term.replace(/\D/g, '');
    const filter = [digits.length >= 3 ? `phone.ilike.%${digits}%` : null, `name.ilike.%${term}%`].filter(Boolean).join(',');
    const id = window.setTimeout(() => {
      supabase!
        .from('leads')
        .select('id,phone,name,center_name')
        .or(filter)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) => setLeads((data as LeadHit[]) ?? []));
    }, 180);
    return () => window.clearTimeout(id);
  }, [q, open]);

  const items = useMemo<Item[]>(() => {
    const needle = normalize(q);
    const pages = PAGES.filter((p) => !needle || normalize(p.title).includes(needle));
    const hits: Item[] = [];
    if (needle) {
      for (const c of centers ?? []) {
        if (normalize(`${c.name} ${c.brand ?? ''} ${c.branch ?? ''} ${c.id}`).includes(needle)) {
          hits.push({
            key: `c-${c.id}`,
            group: 'Центры',
            icon: Building2,
            title: c.branch ? `${c.name}, ${c.branch}` : c.name,
            hint: c.published ? 'На сайте' : 'Скрыт',
            to: `/admin/centers/${c.id}`,
          });
        }
        if (hits.length >= 6) break;
      }
    }
    const leadItems: Item[] = leads.map((l) => ({
      key: `l-${l.id}`,
      group: 'Заявки',
      icon: PhoneIncoming,
      title: `${prettyPhone(l.phone)}${l.name ? `, ${l.name}` : ''}`,
      hint: l.center_name,
      to: `/admin/leads?open=${l.id}`,
    }));
    return [...hits, ...leadItems, ...pages];
  }, [q, centers, leads]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const go = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  };

  let lastGroup = '';
  return (
    <div className={s.paletteOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={s.palette}
        role="dialog"
        aria-modal="true"
        aria-label="Поиск по админке"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(items.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            go(items[active]);
          }
        }}
      >
        <div className={s.paletteInput}>
          <Search size={18} aria-hidden="true" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Центр, телефон заявки или раздел" aria-label="Поиск" />
          <span className={s.kbd}>Esc</span>
        </div>
        <div className={s.paletteList} ref={listRef}>
          {!items.length && <p className={s.paletteGroup}>Ничего не найдено</p>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? <p className={s.paletteGroup}>{it.group}</p> : null;
            lastGroup = it.group;
            return (
              <div key={it.key}>
                {header}
                <button type="button" className={s.paletteItem} data-active={i === active || undefined} onMouseMove={() => setActive(i)} onClick={() => go(it)}>
                  <it.icon size={18} aria-hidden="true" />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {it.title}
                    {it.hint && <span className={s.paletteHint}>{it.hint}</span>}
                  </span>
                  {i === active && <CornerDownLeft size={15} aria-hidden="true" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
