import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Heart } from 'lucide-react';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import { useFavorites } from '@/state/favorites';
import { useUi } from '@/state/ui';
import s from './CardActions.module.css';

interface Props {
  id: string;
  name: string;
  /** icon — compact heart; labeled — button with text (profile, preview) */
  variant?: 'icon' | 'labeled';
  className?: string;
}

export function FavoriteButton({ id, name, variant = 'icon', className }: Props) {
  const { has, toggle, add } = useFavorites();
  const { toast } = useUi();
  const navigate = useNavigate();
  const active = has(id);
  // the heart pops only right after the user saves — never on mount
  const [pulse, setPulse] = useState(false);
  const label = active ? `${t.center.unsave}: ${name}` : `${t.center.save}: ${name}`;

  return (
    <button
      type="button"
      className={cn(variant === 'icon' ? s.icon : s.labeled, s.favorite, active && s.active, pulse && s.pulse, className)}
      aria-pressed={active}
      aria-label={variant === 'icon' ? label : undefined}
      title={variant === 'icon' ? (active ? t.center.unsave : t.center.save) : undefined}
      onClick={(e) => {
        e.stopPropagation();
        const added = toggle(id);
        setPulse(!!added);
        toast(
          added ? `«${name}» ${t.saved.added}` : `«${name}» ${t.saved.removed}`,
          added ? { label: t.common.open, onClick: () => navigate('/favorites') } : { label: t.common.undo, onClick: () => add(id) },
        );
      }}
      onAnimationEnd={() => setPulse(false)}
    >
      <Heart size={variant === 'icon' ? 19 : 17} strokeWidth={2} aria-hidden="true" />
      {variant === 'labeled' && <span>{active ? t.center.saved : t.center.save}</span>}
    </button>
  );
}
