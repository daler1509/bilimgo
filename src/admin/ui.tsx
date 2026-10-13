import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Search, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/cn';
import { scoreTone } from './completeness';
import s from './crm.module.css';

/* ---------- page frame ---------- */

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <header className={s.head}>
      <div>
        {back && (
          <Link to={back.to} className={s.back}>
            <ArrowLeft size={16} aria-hidden="true" />
            {back.label}
          </Link>
        )}
        <h1 className={s.title}>{title}</h1>
        {subtitle && <p className={s.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={s.headActions}>{actions}</div>}
    </header>
  );
}

export function Panel({ title, link, children, className }: { title?: ReactNode; link?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn(s.panel, className)}>
      {(title || link) && (
        <div className={s.panelHead}>
          {title && <h2 className={s.panelTitle}>{title}</h2>}
          {link}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------- stat card ---------- */

export function Stat({
  icon: Icon,
  label,
  value,
  note,
  to,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  to?: string;
  tone?: 'warn' | 'accent';
}) {
  const body = (
    <>
      <span className={s.statLabel}>
        <span className={s.statIcon} data-tone={tone}>
          <Icon size={16} aria-hidden="true" />
        </span>
        {label}
      </span>
      <span className={s.statValue}>{value}</span>
      {note && <span className={s.statNote}>{note}</span>}
    </>
  );
  return to ? (
    <Link to={to} className={s.stat}>
      {body}
    </Link>
  ) : (
    <div className={s.stat}>{body}</div>
  );
}

/* ---------- small pieces ---------- */

export type PillTone = 'neutral' | 'new' | 'info' | 'ok' | 'warn' | 'bad';

export function Pill({ tone = 'neutral', plain, children }: { tone?: PillTone; plain?: boolean; children: ReactNode }) {
  return (
    <span className={s.pill} data-tone={tone} data-plain={plain || undefined}>
      {children}
    </span>
  );
}

export function Score({ value }: { value: number }) {
  return (
    <span className={s.score} title={`Заполнено на ${value}%`}>
      <span className={s.scoreTrack} aria-hidden="true">
        <span className={s.scoreFill} data-tone={scoreTone(value)} style={{ width: `${value}%` }} />
      </span>
      <span className={s.scoreText}>{value}%</span>
    </span>
  );
}

export function Switch({ checked, onChange, label, busy }: { checked: boolean; onChange: (next: boolean) => void; label: string; busy?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={busy}
      className={s.switch}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
    />
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div className={s.tabs} role="tablist" aria-label={label}>
      {items.map((it) => (
        <button key={it.value} type="button" role="tab" aria-selected={value === it.value} className={s.tab} onClick={() => onChange(it.value)}>
          {it.label}
          {it.count != null && <span className={s.tabCount}>{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className={s.field}>
      <Search size={16} aria-hidden="true" />
      <span className="sr-only">{placeholder}</span>
      <input className={s.input} type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className={s.empty}>
      <span className={s.emptyIcon}>
        <Icon size={24} aria-hidden="true" />
      </span>
      <h2 className={s.emptyTitle}>{title}</h2>
      {text && <p className={s.emptyText}>{text}</p>}
      {action}
    </div>
  );
}

export function SkeletonRows({ n = 6 }: { n?: number }) {
  return (
    <div className={s.tableWrap} aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={s.skeletonRow} style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

/* ---------- side drawer ---------- */

export function Drawer({ open, onClose, title, description, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} variant="side" width={460} footer={footer}>
      {children}
    </Dialog>
  );
}

/* ---------- confirmation ---------- */

interface ConfirmOptions {
  title: string;
  text: string;
  confirm: string;
  danger?: boolean;
}

type Ask = (options: ConfirmOptions) => Promise<boolean>;
const ConfirmCtx = createContext<Ask | null>(null);

/** A calm in-page confirmation instead of the browser's alert; resolves to the answer */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const ask = useCallback<Ask>((options) => {
    setState(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (answer: boolean) => {
    resolver.current?.(answer);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Dialog
        open={!!state}
        onClose={() => settle(false)}
        title={state?.title ?? ''}
        variant="modal"
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => settle(false)}>
              Отмена
            </Button>
            <Button variant={state?.danger ? 'dark' : 'primary'} onClick={() => settle(true)} style={{ marginLeft: 'auto' }}>
              {state?.confirm}
            </Button>
          </>
        }
      >
        <p className={s.confirmText}>{state?.text}</p>
      </Dialog>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm(): Ask {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
