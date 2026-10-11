import type { ReactNode } from 'react';
import s from './Sections.module.css';

export function SectionHeader({ title, lead, action, id }: { title: string; lead?: string; action?: ReactNode; id?: string }) {
  return (
    <div className={s.header}>
      <div className={s.headings}>
        <h2 className={s.title} id={id}>
          {title}
        </h2>
        {lead && <p className={s.lead}>{lead}</p>}
      </div>
      {action && <div className={s.headerAction}>{action}</div>}
    </div>
  );
}
