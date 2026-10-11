import { useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { useAdminSession } from './session';
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password) return setError('Введите логин и пароль');
    setBusy(true);
    setError(await signIn(toEmail(login), password));
    setBusy(false);
  };

  return (
    <form className={s.login} onSubmit={submit} noValidate aria-labelledby="login-title">
      <Logo size={28} to="" />
      <h1 className={s.pageTitle} id="login-title">
        Вход в админку
      </h1>
      <label className={s.field}>
        <span className={s.label}>Логин</span>
        <input
          className={s.input}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />
      </label>
      <label className={s.field}>
        <span className={s.label}>Пароль</span>
        <input
          className={s.input}
          type="password"
          autoComplete="current-password"
          value={password}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? 'login-error' : undefined}
          onChange={(e) => setPassword(e.target.value)}
        />
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
  );
}
