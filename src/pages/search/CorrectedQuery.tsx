import { fill, t } from '@/i18n';
import s from './search.module.css';

/** «шудеы» found nothing, «ielts» did: say so and offer to keep the fixed query */
export function CorrectedQuery({ query, onApply }: { query: string; onApply: () => void }) {
  const [before, after = ''] = t.corrected.text.split('{q}');
  return (
    <p className={s.corrected} role="status">
      <span>
        {before}
        <b>{query}</b>
        {after}
      </span>
      <button type="button" className={s.correctedAction} onClick={onApply}>
        {fill(t.corrected.keep, { q: query })}
      </button>
    </p>
  );
}
