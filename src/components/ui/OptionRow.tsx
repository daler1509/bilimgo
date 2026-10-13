import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import s from './OptionRow.module.css';

interface Props {
  label: string;
  hint?: string;
  count?: number;
  selected: boolean;
  onSelect: () => void;
  glyph?: ReactNode;
  /** false renders radio semantics (single choice) */
  multi?: boolean;
  /** Child of the previous parent row (a language under «Иностранные языки») */
  nested?: boolean;
  className?: string;
}

/** One selectable line — shared by search panels, filters and sort menus. */
export function OptionRow({ label, hint, count, selected, onSelect, glyph, multi = true, nested, className }: Props) {
  // the pop and the ring play when the row is chosen, not when a list opens with it already on
  const [chosen, setChosen] = useState(false);
  const was = useRef(selected);
  useEffect(() => {
    if (selected && !was.current) {
      setChosen(true);
      const id = window.setTimeout(() => setChosen(false), 560);
      was.current = selected;
      return () => window.clearTimeout(id);
    }
    was.current = selected;
    setChosen(false);
  }, [selected]);

  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      className={cn(s.row, selected && s.selected, chosen && s.chosen, nested && s.nested, className)}
      onClick={onSelect}
    >
      {glyph}
      <span className={s.main}>
        <span className={s.label}>{label}</span>
        {hint && <span className={s.hint}>{hint}</span>}
      </span>
      {count != null && <span className={s.count}>{count}</span>}
      <span className={cn(s.mark, !multi && s.radio)} aria-hidden="true">
        <Check size={13} strokeWidth={3} />
      </span>
    </button>
  );
}

export function OptionGroupTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <p className={s.groupTitle}>
      {children}
      {action}
    </p>
  );
}
