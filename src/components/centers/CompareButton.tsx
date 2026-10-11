import { useNavigate } from 'react-router';
import { Check, Plus } from 'lucide-react';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import { useCompare } from '@/state/compare';
import { useUi } from '@/state/ui';
import s from './CardActions.module.css';

interface Props {
  id: string;
  name: string;
  /** text — quiet inline toggle for cards; labeled — full button */
  variant?: 'text' | 'labeled';
  className?: string;
}

/** Secondary action: adds a place to the comparison table (max 4). */
export function CompareButton({ id, name, variant = 'text', className }: Props) {
  const { has, toggle, ids } = useCompare();
  const { toast } = useUi();
  const navigate = useNavigate();
  const active = has(id);

  return (
    <button
      type="button"
      className={cn(variant === 'text' ? s.text : s.labeled, s.compare, active && s.active, className)}
      aria-pressed={active}
      aria-label={active ? `${t.compare.remove}: ${name}` : `${t.compare.add}: ${name}`}
      onClick={(e) => {
        e.stopPropagation();
        const result = toggle(id);
        if (result === null) return toast(t.compare.full, { label: t.common.open, onClick: () => navigate('/compare') });
        if (result) {
          const count = ids.length + 1;
          toast(`«${name}» ${t.compare.toast}`, count >= 2 ? { label: t.compare.open, onClick: () => navigate('/compare') } : undefined);
        }
      }}
    >
      <span className={s.check} aria-hidden="true">
        {active ? <Check size={13} strokeWidth={2.6} /> : <Plus size={13} strokeWidth={2.4} />}
      </span>
      <span>{active ? t.compare.added : t.compare.add}</span>
    </button>
  );
}
