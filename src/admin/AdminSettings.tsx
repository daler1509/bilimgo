import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, LogOut, TriangleAlert } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/Settings';
import { Button } from '@/components/ui/Button';
import { SUPABASE } from '@/config/supabase';
import { useAdminData } from './data';
import { ago } from './format';
import { useAdminSession } from './session';
import { supabase } from './supabaseClient';
import { Panel, Pill } from './ui';
import s from './crm.module.css';

const SHORTCUTS: [string, string][] = [
  ['⌘ K  или  Ctrl K', 'Поиск по центрам, заявкам и разделам'],
  ['↑ ↓  Enter', 'Выбор в поиске'],
  ['Esc', 'Закрыть окно или панель'],
];

/** Health of the connections the admin depends on, the account, and the cheat sheet */
export function AdminSettings() {
  const { email, signOut } = useAdminSession();
  const { counts } = useAdminData();
  const [lastSent, setLastSent] = useState<string | null | undefined>(undefined);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      supabase!.from('leads').select('notified_at').not('notified_at', 'is', null).order('notified_at', { ascending: false }).limit(1),
      supabase!.from('leads').select('id', { count: 'exact', head: true }),
    ]).then(([last, all]) => {
      if (!alive) return;
      setLastSent((last.data?.[0] as { notified_at: string } | undefined)?.notified_at ?? null);
      setTotal(all.count ?? 0);
    });
    return () => {
      alive = false;
    };
  }, []);

  const host = SUPABASE ? new URL(SUPABASE.url).host : '—';
  const captcha = !!import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const botOk = counts.undelivered === 0;
  const login = (email ?? '').replace(/@admin\.bilimgo\.local$/, '');

  return (
    <>
      <header className={s.head}>
        <div>
          <h1 className={s.title}>Настройки</h1>
          <p className={s.subtitle}>Состояние подключений и ваш аккаунт</p>
        </div>
      </header>

      <div className={s.grid2}>
        <Panel title="Подключения">
          <div className={s.setting}>
            <div className={s.settingText}>
              <p className={s.settingTitle}>База данных</p>
              <p className={s.settingNote}>Supabase, {host}</p>
            </div>
            <Pill tone="ok">Работает</Pill>
          </div>
          <div className={s.setting}>
            <div className={s.settingText}>
              <p className={s.settingTitle}>Telegram-бот для заявок</p>
              <p className={s.settingNote}>
                {lastSent === undefined
                  ? 'Проверяем…'
                  : lastSent
                    ? `Последняя заявка доставлена ${ago(lastSent)}`
                    : total
                      ? 'Заявки есть, но в Telegram пока ничего не уходило'
                      : 'Заявок ещё не было'}
                {counts.undelivered > 0 ? `. Не дошли: ${counts.undelivered}` : ''}
              </p>
            </div>
            {botOk ? <Pill tone="ok">Всё доставлено</Pill> : <Pill tone="warn">Есть недоставленные</Pill>}
          </div>
          <div className={s.setting}>
            <div className={s.settingText}>
              <p className={s.settingTitle}>Защита форм (капча)</p>
              <p className={s.settingNote}>{captcha ? 'Cloudflare Turnstile включён на формах сайта' : 'Не включена: формы защищены только ограничением частоты'}</p>
            </div>
            {captcha ? <Pill tone="ok">Включена</Pill> : <Pill tone="neutral">Выключена</Pill>}
          </div>
          {!botOk && (
            <p className={s.alert} style={{ background: 'var(--color-warning-subtle)', color: 'var(--color-warning)', marginTop: 12, display: 'flex', gap: 10 }}>
              <TriangleAlert size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span>
                Часть заявок не ушла в Telegram. Откройте бота и нажмите Start, проверьте секрет TELEGRAM_BOT_TOKEN в Edge Functions. Сами заявки при этом сохранены и видны в разделе «Заявки на курсы».
              </span>
            </p>
          )}
          {botOk && (
            <p className={s.saveHint} style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <CheckCircle2 size={15} aria-hidden="true" /> Проблем с доставкой нет
            </p>
          )}
        </Panel>

        <Panel title="Аккаунт">
          <div className={s.setting}>
            <div className={s.settingText}>
              <p className={s.settingTitle}>{login}</p>
              <p className={s.settingNote}>Администратор</p>
            </div>
            <Button variant="secondary" leading={<LogOut size={16} />} onClick={signOut}>
              Выйти
            </Button>
          </div>
          <div className={s.setting}>
            <div className={s.settingText}>
              <p className={s.settingTitle}>Тема оформления</p>
              <p className={s.settingNote}>Совпадает с темой сайта</p>
            </div>
            <ThemeToggle />
          </div>
          <div className={s.setting}>
            <div className={s.settingText}>
              <p className={s.settingTitle}>Публичный сайт</p>
              <p className={s.settingNote}>Откроется в новой вкладке</p>
            </div>
            <Button variant="secondary" leading={<ExternalLink size={16} />} onClick={() => window.open('/', '_blank', 'noopener')}>
              Открыть
            </Button>
          </div>
        </Panel>
      </div>

      <div className={s.grid2}>
        <Panel title="Горячие клавиши">
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys} className={s.setting}>
              <span className={s.kbd} style={{ minWidth: 120, textAlign: 'center' }}>
                {keys}
              </span>
              <p className={s.settingNote} style={{ color: 'var(--color-text-secondary)' }}>
                {what}
              </p>
            </div>
          ))}
        </Panel>
        <Panel title="Как устроено">
          <p className={s.confirmText}>
            Центры, преподаватели и описание правятся в разделе «Центры»: изменения сразу попадают на сайт, если центр включён. Заявки приходят в раздел «Заявки на курсы» и в Telegram.
            Администраторов добавляют в Supabase, пользователей через форму нельзя завести.
          </p>
        </Panel>
      </div>
    </>
  );
}
