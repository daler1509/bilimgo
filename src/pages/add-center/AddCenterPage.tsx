import { useId, useState, type FormEvent } from 'react';
import { Check, Copy, Mail, Send } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { RevealText } from '@/components/motion/RevealText';
import { Button } from '@/components/ui/Button';
import { Turnstile } from '@/components/ui/Turnstile';
import { SITE } from '@/config/site';
import { fill, t } from '@/i18n';
import { captchaEnabled } from '@/services/protectedForms';
import { sendSubmission, submissionsEnabled } from '@/services/submissions';
import { useUi } from '@/state/ui';
import lists from '../favorites/lists.module.css';
import s from './addCenter.module.css';

interface Field {
  key: 'name' | 'address' | 'phone' | 'links' | 'directions' | 'contact';
  label: string;
  hint?: string;
  required?: boolean;
  multiline?: boolean;
  type?: string;
  autoComplete?: string;
}

/** Built per render: the labels follow the interface language */
const fields = (): Field[] => {
  const f = t.addCenter.fields;
  return [
    { key: 'name', label: f.name, required: true, autoComplete: 'organization' },
    { key: 'address', label: f.address, hint: f.addressHint, required: true, autoComplete: 'street-address' },
    { key: 'phone', label: f.phone, required: true, type: 'tel', autoComplete: 'tel' },
    { key: 'links', label: f.links, hint: f.linksHint },
    { key: 'directions', label: f.directions, hint: f.directionsHint, multiline: true },
    { key: 'contact', label: f.contact, required: true, autoComplete: 'name' },
  ];
};

type Values = Record<Field['key'], string>;
const EMPTY: Values = { name: '', address: '', phone: '', links: '', directions: '', contact: '' };

/** How an application leaves the site: moderation queue, e-mail, or clipboard */
const MODE = submissionsEnabled ? 'queue' : SITE.partnerEmail ? 'mail' : 'copy';

/**
 * Application to add a centre. With Supabase configured it lands in the
 * moderation queue (/admin/submissions); otherwise the form composes a
 * message for e-mail or copies it. Nothing is published without checking
 * the facts first.
 */
export function AddCenterPage() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field['key'], string>>>({});
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  /** Honeypot: people never see this field, simple bots fill it in */
  const [trap, setTrap] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaRound, setCaptchaRound] = useState(0);
  const { toast } = useUi();
  const formId = useId();
  const FIELDS = fields();

  const message = () =>
    FIELDS.map((f) => `${f.label}: ${values[f.key].trim() || '—'}`).join('\n');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    for (const f of FIELDS) if (f.required && !values[f.key].trim()) next[f.key] = t.addCenter.required;
    if (values.phone && !/^[+\d\s()-]{7,}$/.test(values.phone.trim())) next.phone = t.addCenter.phoneInvalid;
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`${formId}-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    if (MODE === 'queue') {
      if (trap) return setDone(true);
      if (captchaEnabled && !captcha) return toast(t.common.captchaRequired);
      setSending(true);
      try {
        await sendSubmission(values, captcha);
        setValues(EMPTY);
        setDone(true);
      } catch (err) {
        // a token works once: ask Turnstile for a fresh one after any failure
        setCaptcha(null);
        setCaptchaRound((n) => n + 1);
        const reason = (err as Error).message;
        toast(reason === 'throttled' ? t.addCenter.throttled : reason === 'captcha' ? t.common.captchaFailed : t.addCenter.network);
      } finally {
        setSending(false);
      }
      return;
    }
    if (MODE === 'mail') {
      const subject = encodeURIComponent(fill(t.addCenter.mailSubject, { name: values.name.trim() }));
      window.location.href = `mailto:${SITE.partnerEmail}?subject=${subject}&body=${encodeURIComponent(message())}`;
      setDone(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(message());
      toast(t.addCenter.copied);
      setDone(true);
    } catch {
      toast(t.addCenter.copyFailed);
    }
  };

  return (
    <div className={lists.page}>
      <div className="container">
        <div className={s.layout}>
          <header className={s.intro}>
            <RevealText as="h1" className={lists.title}>
              {t.addCenter.title}
            </RevealText>
            <p className={lists.lead}>{t.addCenter.lead}</p>
            <ol className={s.steps}>
              {t.addCenter.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </header>

          <form className={s.form} onSubmit={submit} noValidate aria-labelledby={`${formId}-legend`}>
            <p className={s.legend} id={`${formId}-legend`}>
              {t.addCenter.legend}
            </p>
            {FIELDS.map((f) => {
              const id = `${formId}-${f.key}`;
              const err = errors[f.key];
              const Tag = f.multiline ? 'textarea' : 'input';
              return (
                <div key={f.key} className={s.field}>
                  <label htmlFor={id} className={s.label}>
                    {f.label}
                    {f.required && <span aria-hidden="true"> *</span>}
                  </label>
                  {f.hint && (
                    <span className={s.hint} id={`${id}-hint`}>
                      {f.hint}
                    </span>
                  )}
                  <Tag
                    id={id}
                    className={s.input}
                    value={values[f.key]}
                    type={f.multiline ? undefined : (f.type ?? 'text')}
                    rows={f.multiline ? 3 : undefined}
                    autoComplete={f.autoComplete}
                    required={f.required}
                    aria-invalid={!!err || undefined}
                    aria-describedby={[f.hint && `${id}-hint`, err && `${id}-error`].filter(Boolean).join(' ') || undefined}
                    onChange={(e) => {
                      setValues((v) => ({ ...v, [f.key]: e.target.value }));
                      if (err) setErrors((x) => ({ ...x, [f.key]: undefined }));
                    }}
                  />
                  {err && (
                    <span className={s.error} id={`${id}-error`}>
                      {err}
                    </span>
                  )}
                </div>
              );
            })}

            {MODE === 'queue' && <Turnstile onToken={setCaptcha} resetKey={captchaRound} />}

            <div className={s.trap} aria-hidden="true">
              <label>
                {t.addCenter.trap}
                <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              loading={sending}
              leading={MODE === 'queue' ? <Send size={18} /> : MODE === 'mail' ? <Mail size={18} /> : <Copy size={18} />}
            >
              {MODE === 'copy' ? t.addCenter.copy : t.addCenter.send}
            </Button>
            {MODE === 'copy' && (
              <p className={s.note}>{t.addCenter.copyNote}</p>
            )}
            {done && (
              <p className={s.success} role="status">
                <Check size={16} aria-hidden="true" />
                {MODE === 'queue' ? t.addCenter.doneQueue : MODE === 'mail' ? t.addCenter.doneMail : t.addCenter.doneCopy}
              </p>
            )}
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
}
