import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { useAdminSession } from './session';
import crm from './crm.module.css';
import s from './admin.module.css';

/**
 * Supabase signs people in by e-mail, so a plain login such as «daler» is
 * stored as daler@admin.bilimgo.local. An address with «@» is used as typed.
 */
const LOGIN_DOMAIN = 'admin.bilimgo.local';
const toEmail = (login: string) => {
  const v = login.trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${LOGIN_DOMAIN}`;
};

/** Sign-in only: admin accounts are created in the Supabase dashboard, never here. */
export function AdminLogin() {
  const { signIn } = useAdminSession();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password) return setError('Введите логин и пароль');
    setBusy(true);
    setError(await signIn(toEmail(login), password));
    setBusy(false);
  };

  return (
    <div className={crm.loginPage}>
      <div className={crm.loginPattern} aria-hidden="true" />
      <form className={crm.loginCard} onSubmit={submit} noValidate aria-labelledby="login-title">
        <Logo size={30} to="" />
        <div>
          <h1 className={crm.loginTitle} id="login-title">
            Вход в админку
          </h1>
          <p className={crm.subtitle}>Каталог, заявки и преподаватели в одном месте</p>
        </div>
        <label className={s.field}>
          <span className={s.label}>Логин</span>
          <input
            className={s.input}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
        </label>
        <label className={s.field}>
          <span className={s.label}>Пароль</span>
          <span className={crm.passwordWrap}>
            <input
              className={s.input}
              type={shown ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? 'login-error' : undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className={crm.passwordToggle} onClick={() => setShown((v) => !v)} aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'}>
              {shown ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        {error && (
          <p className={s.error} id="login-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" block loading={busy} leading={<LogIn size={18} />}>
          Войти
        </Button>
      </form>
    </div>
  );
}
