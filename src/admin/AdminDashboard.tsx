import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Building2, FilePlus2, PhoneIncoming, Plus, Sparkles, TrendingUp } from 'lucide-react';
import { CenterLogo } from '@/components/centers/CenterLogo';
import { ButtonLink } from '@/components/ui/Button';
import { useAdminData } from './data';
import { loadCenterRows, type CenterListRow } from './centerQuery';
import { completeness } from './completeness';
import { ago, dayKey, plural, prettyPhone } from './format';
import { useAdminSession } from './session';
import { errorText, supabase } from './supabaseClient';
import { EmptyState, Panel, Pill, Score, Stat } from './ui';
import type { SubmissionRow } from './centerDraft';
import s from './crm.module.css';

interface LeadLite {
  id: string;
  center_id: string;
  center_name: string;
  course: string | null;
  name: string | null;
  phone: string;
  status: 'new' | 'working' | 'done' | 'spam';
  created_at: string;
}

const DAYS = 14;
const WEEKDAY = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'Asia/Samarkand' });

function greeting() {
  const h = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Samarkand' }));
  return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
}

/** The morning view: what waits for a person, how requests flow, what to fill in next */
export function AdminDashboard() {
  const { counts } = useAdminData();
  const { email } = useAdminSession();
  const [leads, setLeads] = useState<LeadLite[] | null>(null);
  const [centers, setCenters] = useState<CenterListRow[] | null>(null);
  const [subs, setSubs] = useState<SubmissionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const since = new Date(Date.now() - 31 * 864e5).toISOString();
    Promise.all([
      supabase!
        .from('leads')
        .select('id,center_id,center_name,course,name,phone,status,created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1000),
      loadCenterRows(),
      supabase!.from('submissions').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(4),
    ])
      .then(([l, c, sub]) => {
        if (!alive) return;
        if (l.error) throw l.error;
        setLeads(l.data as LeadLite[]);
        setCenters(c);
        setSubs((sub.data as SubmissionRow[]) ?? []);
      })
      .catch((e) => alive && setError(errorText(e)));
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const real = (leads ?? []).filter((l) => l.status !== 'spam');
    const now = Date.now();
    const inRange = (from: number, to: number) => real.filter((l) => {
      const age = now - new Date(l.created_at).getTime();
      return age >= from * 864e5 && age < to * 864e5;
    }).length;
    const week = inRange(0, 7);
    const prev = inRange(7, 14);

    // bars: the last 14 calendar days in Samarkand
    const byDay = new Map<string, number>();
    for (const l of real) byDay.set(dayKey(l.created_at), (byDay.get(dayKey(l.created_at)) ?? 0) + 1);
    const days = Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(now - (DAYS - 1 - i) * 864e5);
      return { key: dayKey(d), label: i % 2 === (DAYS - 1) % 2 ? String(d.getDate()) : '', weekday: WEEKDAY.format(d), n: byDay.get(dayKey(d)) ?? 0 };
    });
    const max = Math.max(1, ...days.map((d) => d.n));

    const byCenter = new Map<string, { name: string; n: number }>();
    for (const l of real) {
      const e = byCenter.get(l.center_id) ?? { name: l.center_name, n: 0 };
      e.n += 1;
      byCenter.set(l.center_id, e);
    }
    const top = [...byCenter.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.n - a.n).slice(0, 5);

    const all = centers ?? [];
    const scored = all.map((c) => ({ c, ...completeness(c) }));
    const published = scored.filter((x) => x.c.published);
    const avg = published.length ? Math.round(published.reduce((sum, x) => sum + x.score, 0) / published.length) : 0;
    const todo = [...published].sort((a, b) => a.score - b.score).slice(0, 5);

    return { week, prev, days, max, top, recent: (leads ?? []).filter((l) => l.status !== 'spam').slice(0, 6), published: published.length, hidden: all.length - published.length, avg, todo };
  }, [leads, centers]);

  const login = (email ?? '').replace(/@admin\.bilimgo\.local$/, '');
  const delta = stats.week - stats.prev;
  const loading = !leads || !centers;

  return (
    <>
      <header className={s.head}>
        <div>
          <h1 className={s.title}>
            {greeting()}
            {login ? `, ${login}` : ''}
          </h1>
          <p className={s.subtitle}>
            {counts.newLeads > 0
              ? `${counts.newLeads} ${plural(counts.newLeads, 'новая заявка ждёт', 'новые заявки ждут', 'новых заявок ждут')} ответа`
              : 'Новых заявок нет: можно заняться каталогом'}
          </p>
        </div>
        <div className={s.headActions}>
          <ButtonLink to="/admin/centers/new" variant="primary" leading={<Plus size={18} />}>
            Добавить центр
          </ButtonLink>
        </div>
      </header>

      {error && (
        <p className={s.alert} role="alert">
          Не удалось загрузить данные: {error}
        </p>
      )}

      {counts.undelivered > 0 && (
        <Link to="/admin/settings" className={s.banner}>
          <AlertTriangle size={18} aria-hidden="true" />
          <span>
            {counts.undelivered} {plural(counts.undelivered, 'заявка не дошла', 'заявки не дошли', 'заявок не дошли')} в Telegram. Сами заявки сохранены, посмотрите состояние бота в настройках.
          </span>
        </Link>
      )}

      <div className={s.stats}>
        <Stat icon={PhoneIncoming} label="Новые заявки" value={counts.newLeads} note={counts.workingLeads ? `в работе: ${counts.workingLeads}` : 'ждут звонка'} to="/admin/leads" tone={counts.newLeads ? 'accent' : undefined} />
        <Stat
          icon={TrendingUp}
          label="Заявок за 7 дней"
          value={loading ? '—' : stats.week}
          note={loading ? undefined : delta === 0 ? 'столько же, как неделей ранее' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} к прошлой неделе`}
        />
        <Stat icon={FilePlus2} label="Новые центры на проверке" value={counts.pendingSubmissions} note="заявки от владельцев" to="/admin/submissions" tone={counts.pendingSubmissions ? 'accent' : undefined} />
        <Stat icon={Building2} label="Центров на сайте" value={loading ? '—' : stats.published} note={loading ? undefined : stats.hidden ? `скрыто: ${stats.hidden}` : 'все опубликованы'} to="/admin/centers" />
        <Stat icon={Sparkles} label="Заполненность профилей" value={loading ? '—' : `${stats.avg}%`} note="в среднем по центрам на сайте" />
      </div>

      <div className={s.grid2}>
        <Panel className={s.chartPanel} title="Заявки по дням" link={<span className={s.statNote}>последние {DAYS} дней</span>}>
          {loading ? (
            <div className={s.skeletonRow} style={{ height: 140, borderRadius: 12 }} />
          ) : (
            <div className={s.bars} role="img" aria-label={`Заявки по дням: ${stats.days.map((d) => d.n).join(', ')}`}>
              {stats.days.map((d, i) => (
                <div key={d.key} className={s.bar} data-today={i === DAYS - 1 || undefined} data-empty={d.n === 0 || undefined} title={`${d.weekday}, ${d.key}: ${d.n}`}>
                  <span className={s.barValue}>{d.n}</span>
                  <span className={s.barFill} style={{ height: `${Math.max(3, (d.n / stats.max) * 100)}%`, ['--i' as string]: i }} />
                  <span className={s.barDay}>{d.label || ' '}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Последние заявки" link={<Link to="/admin/leads" className={s.panelLink}>Все заявки</Link>}>
          {loading ? null : stats.recent.length ? (
            <div className={s.mini}>
              {stats.recent.map((l) => (
                <Link key={l.id} to={`/admin/leads?open=${l.id}`} className={s.miniRow}>
                  <span className={s.miniMain}>
                    <span className={s.miniTitle}>
                      {prettyPhone(l.phone)}
                      {l.name ? `, ${l.name}` : ''}
                    </span>
                    <span className={s.miniSub}>
                      {l.course ?? 'Консультация'} · {l.center_name}
                    </span>
                  </span>
                  <span className={s.miniEnd}>
                    {l.status === 'new' ? <Pill tone="new">Новая</Pill> : ago(l.created_at)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={PhoneIncoming} title="Заявок пока нет" text="Когда посетитель оставит номер на странице центра, заявка появится здесь и придёт в Telegram." />
          )}
        </Panel>
      </div>

      <div className={s.grid2}>
        <Panel title="Что заполнить в первую очередь" link={<Link to="/admin/centers?sort=score" className={s.panelLink}>Все центры</Link>}>
          {loading ? null : stats.todo.length ? (
            <div className={s.mini}>
              {stats.todo.map(({ c, score, missing }) => (
                <Link key={c.id} to={`/admin/centers/${c.id}`} className={s.miniRow}>
                  <CenterLogo center={{ name: c.name, logo: c.logo ?? undefined }} size={36} />
                  <span className={s.miniMain}>
                    <span className={s.miniTitle}>{c.branch ? `${c.name}, ${c.branch}` : c.name}</span>
                    <span className={s.miniSub}>Нет: {missing.slice(0, 3).map((m) => m.label.toLowerCase()).join(', ')}{missing.length > 3 ? ` и ещё ${missing.length - 3}` : ''}</span>
                  </span>
                  <Score value={score} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={Sparkles} title="Всё заполнено" text="Профили центров на сайте заполнены полностью." />
          )}
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title="Центры, о которых спрашивают" link={<span className={s.statNote}>за 30 дней</span>}>
            {loading ? null : stats.top.length ? (
              <div className={s.mini}>
                {stats.top.map((t) => (
                  <Link key={t.id} to={`/admin/leads?center=${encodeURIComponent(t.id)}`} className={s.miniRow}>
                    <span className={s.miniMain}>
                      <span className={s.miniTitle}>{t.name}</span>
                    </span>
                    <span className={s.miniEnd}>
                      {t.n} {plural(t.n, 'заявка', 'заявки', 'заявок')}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className={s.statNote}>Пока никто не оставлял заявок.</p>
            )}
          </Panel>

          {subs && subs.length > 0 && (
            <Panel title="Ждут проверки" link={<Link to="/admin/submissions" className={s.panelLink}>Все</Link>}>
              <div className={s.mini}>
                {subs.map((r) => (
                  <Link key={r.id} to={`/admin/submissions?open=${r.id}`} className={s.miniRow}>
                    <span className={s.miniMain}>
                      <span className={s.miniTitle}>{r.name}</span>
                      <span className={s.miniSub}>{r.address}</span>
                    </span>
                    <span className={s.miniEnd}>{ago(r.created_at)}</span>
                  </Link>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
