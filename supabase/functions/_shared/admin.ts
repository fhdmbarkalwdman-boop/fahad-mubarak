// Minimal, dependency-free server-side Supabase client for Edge Functions.
// The service role key is read from the function environment only.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const serviceHeaders = (extra: Record<string, string> = {}) => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  ...extra,
});

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}${path}`, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

/** PostgREST select with a raw query string, e.g. "notifications?id=eq.X&select=*" */
export const rest = <T>(query: string, init: RequestInit = {}) =>
  call<T>(`/rest/v1/${query}`, { ...init, headers: serviceHeaders(init.headers as Record<string, string>) });

/** Resolve the user behind an access token (validates it with the Auth server). */
export async function getUserFromJwt(jwt: string): Promise<{ id: string; email?: string } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ? user : null;
}

export const deleteAuthUser = (id: string) =>
  call(`/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: serviceHeaders() });

export const listFolder = (bucket: string, prefix: string) =>
  call<Array<{ name: string; id: string | null }>>(`/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ prefix, limit: 100, offset: 0 }),
  });

export const removeObjects = (bucket: string, prefixes: string[]) =>
  call(`/storage/v1/object/${bucket}`, {
    method: 'DELETE',
    headers: serviceHeaders(),
    body: JSON.stringify({ prefixes }),
  });
