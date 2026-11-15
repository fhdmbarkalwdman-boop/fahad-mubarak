// Permanently deletes the calling user's account and their files.
// The caller is identified from their JWT; the service role never leaves the server.
import { corsHeaders, json } from '../_shared/cors.ts';
import { deleteAuthUser, getUserFromJwt, listFolder, removeObjects, rest } from '../_shared/admin.ts';

const BUCKETS = ['attachments', 'avatars'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const user = jwt ? await getUserFromJwt(jwt) : null;
  if (!user) return json({ error: 'unauthorized' }, 401);

  const { confirm } = await req.json().catch(() => ({ confirm: null }));
  if (confirm !== 'DELETE') return json({ error: 'confirmation_required' }, 400);

  try {
    const [profile] = await rest<Array<{ role: string }>>(`profiles?id=eq.${user.id}&select=role`);
    if (profile?.role === 'owner') {
      // Prevent locking the owner out of their own app by accident.
      return json({ error: 'OWNER_ACCOUNT_PROTECTED' }, 403);
    }

    for (const bucket of BUCKETS) {
      for (let guard = 0; guard < 50; guard++) {
        const files = await listFolder(bucket, user.id);
        if (!files.length) break;
        await removeObjects(bucket, files.map((f) => `${user.id}/${f.name}`));
        if (files.length < 100) break;
      }
    }

    await deleteAuthUser(user.id);
    return json({ deleted: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
