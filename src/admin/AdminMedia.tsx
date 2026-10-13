import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Copy, ExternalLink, ImagePlus, Images, Trash2 } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/Button';
import { useUi } from '@/state/ui';
import { loadCenterRows, type CenterListRow } from './centerQuery';
import { ago, copyText, plural } from './format';
import { uploadImage } from './media';
import { errorText, supabase } from './supabaseClient';
import { EmptyState, Pill, SkeletonRows, Tabs, useConfirm } from './ui';
import s from './crm.module.css';

const FOLDERS = ['photos', 'logos', 'teachers'] as const;
type Folder = (typeof FOLDERS)[number];
const FOLDER_LABEL: Record<Folder, string> = { photos: 'Фото', logos: 'Логотипы', teachers: 'Преподаватели' };

interface FileItem {
  folder: Folder;
  name: string;
  url: string;
  size: number;
  created: string;
}

const fileSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(b / 1024))} КБ`);

/** Every image the admins uploaded, where it is used, and what can be cleaned away */
export function AdminMedia() {
  const [files, setFiles] = useState<FileItem[] | null>(null);
  const [centers, setCenters] = useState<CenterListRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [folder, setFolder] = useState<Folder | 'all' | 'unused'>('all');
  const [busy, setBusy] = useState(false);
  const { toast } = useUi();
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      const bucket = supabase!.storage.from('media');
      const lists = await Promise.all(FOLDERS.map((f) => bucket.list(f, { limit: 500, sortBy: { column: 'created_at', order: 'desc' } })));
      const items: FileItem[] = [];
      lists.forEach((res, i) => {
        if (res.error) throw res.error;
        for (const f of res.data ?? []) {
          if (!f.id) continue; // a sub-folder placeholder
          const path = `${FOLDERS[i]}/${f.name}`;
          items.push({
            folder: FOLDERS[i]!,
            name: f.name,
            url: bucket.getPublicUrl(path).data.publicUrl,
            size: Number((f.metadata as { size?: number } | null)?.size ?? 0),
            created: f.created_at ?? f.updated_at ?? new Date().toISOString(),
          });
        }
      });
      items.sort((a, b) => b.created.localeCompare(a.created));
      setFiles(items);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    void load();
    loadCenterRows()
      .then(setCenters)
      .catch(() => {});
  }, [load]);

  /** file path → the centres that show it */
  const usage = useMemo(() => {
    const m = new Map<string, string[]>();
    const add = (url: string | null | undefined, who: string) => {
      const hit = url && /\/media\/([^?#]+)$/.exec(url);
      if (!hit) return;
      m.set(hit[1]!, [...(m.get(hit[1]!) ?? []), who]);
    };
    for (const c of centers) {
      const who = c.branch ? `${c.name}, ${c.branch}` : c.name;
      add(c.logo, who);
      for (const p of c.photos ?? []) add(p.src, who);
      for (const t of c.teachers ?? []) add(t.photo?.src, who);
    }
    return m;
  }, [centers]);

  const usedBy = (f: FileItem) => usage.get(`${f.folder}/${f.name}`) ?? [];

  const visible = useMemo(
    () => (files ?? []).filter((f) => (folder === 'all' ? true : folder === 'unused' ? usedBy(f).length === 0 : f.folder === folder)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files, folder, usage],
  );

  const unusedCount = (files ?? []).filter((f) => usedBy(f).length === 0).length;
  const totalSize = (files ?? []).reduce((sum, f) => sum + f.size, 0);

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!list.length) return;
    setBusy(true);
    try {
      for (const file of list) await uploadImage('photos', 'library', file);
      toast(list.length === 1 ? 'Файл загружен' : `Загружено файлов: ${list.length}`);
      await load();
    } catch (err) {
      toast(`Не удалось загрузить: ${errorText(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (f: FileItem) => {
    const ok = await confirm({
      title: 'Удалить файл?',
      text: `${f.name} не используется ни в одном центре. Файл удалится из хранилища навсегда.`,
      confirm: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    const { error: err } = await supabase!.storage.from('media').remove([`${f.folder}/${f.name}`]);
    if (err) return toast(`Не удалилось: ${errorText(err)}`);
    setFiles((list) => list?.filter((x) => x !== f) ?? null);
    toast('Файл удалён');
  };

  return (
    <>
      <header className={s.head}>
        <div>
          <h1 className={s.title}>Медиатека</h1>
          <p className={s.subtitle}>
            {files ? `${files.length} ${plural(files.length, 'файл', 'файла', 'файлов')}, ${fileSize(totalSize)} · не используется: ${unusedCount}` : 'Загруженные фото и логотипы'}
          </p>
        </div>
        <div className={s.headActions}>
          <input id="media-upload" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={upload} disabled={busy} />
          <label htmlFor="media-upload" className={buttonClass({ variant: 'primary' })} aria-disabled={busy || undefined} style={{ cursor: 'pointer' }}>
            <ImagePlus size={18} aria-hidden="true" />
            <span>{busy ? 'Загружаем…' : 'Загрузить'}</span>
          </label>
        </div>
      </header>

      <div className={s.toolbar}>
        <Tabs
          value={folder}
          onChange={setFolder}
          label="Раздел"
          items={[
            { value: 'all', label: 'Все', count: files?.length },
            ...FOLDERS.map((f) => ({ value: f, label: FOLDER_LABEL[f], count: files?.filter((x) => x.folder === f).length })),
            { value: 'unused' as const, label: 'Не используются', count: files ? unusedCount : undefined },
          ]}
        />
      </div>

      {error && (
        <p className={s.alert} role="alert">
          Не удалось открыть хранилище: {error}
        </p>
      )}
      {!files && !error && <SkeletonRows n={3} />}

      {files && !visible.length && (
        <div className={s.tableWrap}>
          <EmptyState icon={Images} title="Здесь пусто" text="Файлы появляются, когда вы загружаете фото и логотипы в редакторе центра или кнопкой «Загрузить»." />
        </div>
      )}

      {files && visible.length > 0 && (
        <div className={s.tiles}>
          {visible.map((f) => {
            const who = usedBy(f);
            return (
              <article key={`${f.folder}/${f.name}`} className={s.tile}>
                <div className={s.tileImg} data-folder={f.folder}>
                  <img src={f.url} alt="" loading="lazy" />
                </div>
                <div className={s.tileBody}>
                  <span className={s.tileName} title={f.name}>
                    {f.name}
                  </span>
                  <span className={s.cellSub}>
                    {FOLDER_LABEL[f.folder]} · {fileSize(f.size)} · {ago(f.created)}
                  </span>
                  {who.length ? (
                    <span className={s.cellSub} title={who.join(', ')}>
                      <Pill tone="ok" plain>
                        {who.length === 1 ? who[0] : `Используется в ${who.length}`}
                      </Pill>
                    </span>
                  ) : (
                    <span>
                      <Pill tone="warn" plain>
                        Не используется
                      </Pill>
                    </span>
                  )}
                  <div className={s.tileActions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      leading={<Copy size={15} />}
                      onClick={async () => toast((await copyText(f.url)) ? 'Ссылка скопирована' : 'Не удалось скопировать')}
                    >
                      Ссылка
                    </Button>
                    <a className={buttonClass({ variant: 'ghost', size: 'sm' })} href={f.url} target="_blank" rel="noopener noreferrer" aria-label="Открыть файл">
                      <ExternalLink size={15} aria-hidden="true" />
                    </a>
                    {!who.length && (
                      <Button variant="ghost" size="sm" aria-label="Удалить файл" leading={<Trash2 size={15} />} onClick={() => void remove(f)} />
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
