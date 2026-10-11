import { SearchX } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { StateMessage } from '@/components/ui/StateMessage';
import { t } from '@/i18n';

export function NotFoundPage() {
  return (
    <div className="container" style={{ paddingBlock: 'clamp(64px, 12vh, 140px)' }}>
      <StateMessage
        icon={<SearchX size={26} />}
        title={t.notFound.title}
        text={t.notFound.text}
        actions={
          <>
            <ButtonLink to="/" variant="secondary">
              {t.notFound.home}
            </ButtonLink>
            <ButtonLink to="/search" variant="primary">
              {t.notFound.search}
            </ButtonLink>
          </>
        }
      />
    </div>
  );
}
