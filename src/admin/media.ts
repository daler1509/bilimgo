import { supabase } from './supabaseClient';

/**
 * Images are resized in the browser before upload, so storage keeps small
 * files and the site never serves a 6 MB phone photo. WebP where the browser
 * can encode it, PNG otherwise.
 */
async function shrink(file: File, maxSide: number, quality: number) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось обработать изображение'))), 'image/webp', quality),
  );
  return { blob, width, height };
}

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function uploadImage(kind: 'logos' | 'photos', centerId: string, file: File) {
  if (!supabase) throw new Error('Supabase не настроен');
  if (!file.type.startsWith('image/')) throw new Error('Нужен файл изображения');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Файл больше 15 МБ');

  const { blob, width, height } = await shrink(file, kind === 'logos' ? 256 : 1600, kind === 'logos' ? 0.92 : 0.85);
  const type = blob.type === 'image/webp' ? 'image/webp' : 'image/png';
  const path = `${kind}/${centerId || 'new'}-${Date.now().toString(36)}.${type === 'image/webp' ? 'webp' : 'png'}`;

  const bucket = supabase.storage.from('media');
  const { error } = await bucket.upload(path, blob, { contentType: type, cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return { url: bucket.getPublicUrl(path).data.publicUrl, width, height };
}
