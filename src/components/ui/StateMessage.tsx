import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import s from './StateMessage.module.css';

interface Props {
  icon: ReactNode;
  title: string;
  text?: string;
  actions?: ReactNode;
  tone?: 'neutral' | 'error';
}

/** Calm empty / error state: what happened, why, and what to do next. */
export function StateMessage({ icon, title, text, actions, tone = 'neutral' }: Props) {
  return (
    <div className={cn(s.root, tone === 'error' && s.error)} role={tone === 'error' ? 'alert' : 'status'}>
      <div className={s.art} aria-hidden="true">
        {icon}
      </div>
      <p className={s.title}>{title}</p>
      {text && <p className={s.text}>{text}</p>}
      {actions && <div className={s.actions}>{actions}</div>}
    </div>
  );
}
