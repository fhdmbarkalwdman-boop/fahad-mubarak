import type { Lang } from './strings';

export function formatDate(iso: string | null | undefined, lang: Lang, withTime = false): string {
  if (!iso) return '';
  const d = new Date(iso);
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(d);
  } catch {
    return d.toISOString().slice(0, withTime ? 16 : 10).replace('T', ' ');
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
export const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

export const splitList = (s: string) =>
  s.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean);
