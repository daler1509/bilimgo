import { ButtonLink } from '@/components/ui/Button';
import { t } from '@/i18n';
import s from './PartnerCta.module.css';

/** A quiet invitation for centres before the footer. */
export function PartnerCta() {
  return (
    <section className={s.section} aria-labelledby="partner-title">
      <div className="container">
        <div className={s.box}>
          <div>
            <h2 className={s.title} id="partner-title">
              {t.home.partnerTitle}
            </h2>
            <p className={s.text}>{t.home.partnerText}</p>
          </div>
          <ButtonLink to="/add-center" variant="primary" size="lg" className={s.button}>
            {t.home.partnerCta}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
