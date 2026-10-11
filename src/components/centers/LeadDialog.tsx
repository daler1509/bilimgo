import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Check, ChevronDown, Phone, PhoneOff } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Turnstile, TURNSTILE_SITE_KEY } from '@/components/ui/Turnstile';
import type { Center } from '@/data/types';
import { fill, locale, t } from '@/i18n';
import { formatPhoneDigits, leadsMode, phoneDigits, sendLead } from '@/services/leads';
import { telHref } from './centerText';
import s from './LeadDialog.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  center: Center;
  /** what the visitor can choose from: the centre's courses or, without them, its directions */
  courses: string[];
  /** the course the dialog was opened for; null = not chosen yet */
  course: string | null;
}

type Status = { kind: 'form'; error?: string } | { kind: 'sending' } | { kind: 'sent'; phone: string } | { kind: 'off' };

/**
 * Course request: phone and course, name and comment optional.
 * Where it goes is decided in services/leads.ts; until something is
 * connected the dialog says so and offers the centre's own number.
 */
export function LeadDialog({ open, onClose, center: c, courses, course }: Props) {
  const formId = useId();
  const ids = { course: useId(), phone: useId(), phoneHint: useId(), phoneError: useId(), name: useId(), comment: useId() };
  const phoneRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(course ?? '');
  const [digits, setDigits] = useState('');
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [trap, setTrap] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaRound, setCaptchaRound] = useState(0);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'form' });

  // a fresh form for every opening; the old one stays while the dialog fades out
  useEffect(() => {
    if (!open) return;
    setSelected(course ?? '');
    setPhoneError(null);
    setStatus((prev) => (prev.kind === 'sending' ? prev : { kind: 'form' }));
  }, [open, course]);

  const centerPhone = c.phones?.[0];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (status.kind === 'sending') return;
    if (digits.length !== 9) {
      setPhoneError(digits.length ? t.lead.phoneInvalid : t.lead.required);
      phoneRef.current?.focus();
      return;
    }
    const phone = `+998${digits}`;
    // bots fill every field; people never see this one
    if (trap) return setStatus({ kind: 'sent', phone });
    if (leadsMode === 'off') return setStatus({ kind: 'off' });
    if (TURNSTILE_SITE_KEY && leadsMode === 'supabase' && !captcha) return setStatus({ kind: 'form', error: t.common.captchaRequired });
    setStatus({ kind: 'sending' });
    try {
      await sendLead({
        centerId: c.id,
        centerName: c.branch ? `${c.name} (${c.branch})` : c.name,
        course: selected || null,
        name,
        phone,
        comment,
        locale,
        page: window.location.origin + window.location.pathname,
      }, captcha);
      setStatus({ kind: 'sent', phone });
      setComment('');
    } catch (err) {
      // a token works once: ask Turnstile for a fresh one after any failure
      setCaptcha(null);
      setCaptchaRound((n) => n + 1);
      const reason = err instanceof Error ? err.message : '';
      setStatus({ kind: 'form', error: reason === 'throttled' ? t.lead.throttled : reason === 'captcha' ? t.common.captchaFailed : t.lead.network });
    }
  };

  const result = status.kind === 'sent' || status.kind === 'off';

  const footer = result ? (
    status.kind === 'off' && centerPhone ? (
      <a className={buttonClass({ variant: 'primary', size: 'lg', block: true })} href={telHref(centerPhone)}>
        <Phone size={17} aria-hidden="true" />
        <span>{t.lead.callCenter}</span>
      </a>
    ) : (
      <Button variant="secondary" size="lg" block onClick={onClose}>
        {t.lead.done}
      </Button>
    )
  ) : (
    <Button type="submit" form={formId} variant="primary" size="lg" block loading={status.kind === 'sending'}>
      {t.lead.submit}
    </Button>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.lead.title}
      description={c.branch ? `${c.name}, ${fill(t.center.branch, { name: c.branch })}` : c.name}
      footer={footer}
      width={480}
    >
      {status.kind === 'sent' && (
        <div className={s.result} role="status">
          <span className={s.resultIcon} data-tone="success" aria-hidden="true">
            <Check size={22} strokeWidth={2.5} />
          </span>
          <p className={s.resultTitle}>{t.lead.sent}</p>
          <p className={s.resultText}>{fill(t.lead.sentText, { phone: `+998 ${formatPhoneDigits(status.phone.slice(4))}` })}</p>
        </div>
      )}

      {status.kind === 'off' && (
        <div className={s.result} role="status">
          <span className={s.resultIcon} aria-hidden="true">
            <PhoneOff size={20} />
          </span>
          <p className={s.resultTitle}>{t.lead.offTitle}</p>
          <p className={s.resultText}>{t.lead.offText}</p>
          {centerPhone && <p className={s.resultPhone}>{centerPhone}</p>}
        </div>
      )}

      {!result && (
        <form id={formId} className={s.form} onSubmit={submit} noValidate>
          <div className={s.field}>
            <label className={s.label} htmlFor={ids.course}>
              {t.lead.course}
            </label>
            <div className={s.select}>
              <select id={ids.course} className={s.input} value={selected} onChange={(e) => setSelected(e.target.value)}>
                {courses.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
                <option value="">{t.lead.courseAny}</option>
              </select>
              <ChevronDown size={16} className={s.chevron} aria-hidden="true" />
            </div>
          </div>

          <div className={s.field}>
            <label className={s.label} htmlFor={ids.phone}>
              {t.lead.phone}
            </label>
            <div className={s.phone} data-invalid={!!phoneError || undefined}>
              <span className={s.prefix} aria-hidden="true">
                +998
              </span>
              <input
                ref={phoneRef}
                id={ids.phone}
                className={s.phoneInput}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="90 123 45 67"
                value={formatPhoneDigits(digits)}
                onChange={(e) => {
                  setDigits(phoneDigits(e.target.value));
                  setPhoneError(null);
                }}
                aria-invalid={!!phoneError}
                aria-describedby={phoneError ? ids.phoneError : ids.phoneHint}
                required
              />
            </div>
            {phoneError ? (
              <p id={ids.phoneError} className={s.error}>
                {phoneError}
              </p>
            ) : (
              <p id={ids.phoneHint} className={s.hint}>
                {t.lead.phoneHint}
              </p>
            )}
          </div>

          <div className={s.field}>
            <label className={s.label} htmlFor={ids.name}>
              {t.lead.name} <span className={s.optional}>{t.lead.optional}</span>
            </label>
            <input id={ids.name} className={s.input} autoComplete="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className={s.field}>
            <label className={s.label} htmlFor={ids.comment}>
              {t.lead.comment} <span className={s.optional}>{t.lead.optional}</span>
            </label>
            <textarea
              id={ids.comment}
              className={s.input}
              rows={2}
              maxLength={500}
              placeholder={t.lead.commentHint}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <Turnstile onToken={setCaptcha} resetKey={captchaRound} />

          <div className={s.trap} aria-hidden="true">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
            </label>
          </div>

          {status.kind === 'form' && status.error && (
            <p className={s.formError} role="alert">
              {status.error}
            </p>
          )}

          <p className={s.consent}>{t.lead.consent}</p>
        </form>
      )}
    </Dialog>
  );
}
