import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import s from './Chip.module.css';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** Dropdown chip: shows chevron and open state */
  dropdown?: boolean;
  open?: boolean;
  count?: number;
  icon?: ReactNode;
  size?: 'sm' | 'md';
  /** Floating over the map: elevated, no border */
  onMap?: boolean;
}

/** Toggle / dropdown chip used in filter bars, category pickers and map. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected, dropdown, open, count, icon, size = 'md', onMap, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(s.chip, size === 'sm' && s.sm, selected && s.selected, open && s.open, onMap && s.onMap, className)}
      aria-pressed={dropdown ? undefined : selected}
      aria-expanded={dropdown ? !!open : undefined}
      aria-haspopup={dropdown ? 'dialog' : undefined}
      {...rest}
    >
      {icon && <span className={s.icon} aria-hidden="true">{icon}</span>}
      <span>{children}</span>
      {!!count && <span className={s.count}>{count}</span>}
      {dropdown && (
        <span className={s.chevron} aria-hidden="true">
          <ChevronDown size={16} strokeWidth={2} />
        </span>
      )}
    </button>
  );
});

export interface TagProps {
  children: ReactNode;
  onRemove: () => void;
  removeLabel: string;
}

/** Active filter token with a remove affordance. Whole tag is the button. */
export function Tag({ children, onRemove, removeLabel }: TagProps) {
  return (
    <button type="button" className={s.tag} onClick={onRemove} aria-label={`${removeLabel}: ${String(children)}`}>
      <span>{children}</span>
      <span className={s.tagRemove} aria-hidden="true">
        <X size={13} strokeWidth={2.4} />
      </span>
    </button>
  );
}
