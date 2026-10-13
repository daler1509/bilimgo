import { cn } from '@/lib/cn';
import { useUi } from '@/state/ui';
import s from './Toaster.module.css';

export function Toaster() {
  const { toasts, dismissToast } = useUi();
  return (
    <div className={s.region} role="status" aria-live="polite">
      {toasts.map((m) => (
        <div key={m.id} className={cn(s.toast, m.leaving && s.leaving)}>
          <span className={s.text}>{m.text}</span>
          {m.action && (
            <button
              type="button"
              className={s.action}
              onClick={() => {
                m.action!.onClick();
                dismissToast(m.id);
              }}
            >
              {m.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
