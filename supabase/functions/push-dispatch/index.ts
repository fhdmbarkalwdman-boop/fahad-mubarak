// Sends an Expo push notification for one row of public.notifications.
// Invoked by the database (private.dispatch_push trigger via pg_net) with a
// shared secret header. Uses the service role server-side only.
import { json } from '../_shared/cors.ts';
import { rest } from '../_shared/admin.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown> | null;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return json({ error: 'unauthorized' }, 401);
  }

  let notificationId: string | undefined;
  try {
    ({ notification_id: notificationId } = await req.json());
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!notificationId || !/^[0-9a-f-]{36}$/i.test(notificationId)) {
    return json({ error: 'invalid_notification_id' }, 400);
  }

  try {
    const [n] = await rest<NotificationRow[]>(
      `notifications?id=eq.${notificationId}&select=id,user_id,title,body,type,data`,
    );
    if (!n) return json({ error: 'not_found' }, 404);

    const tokens = await rest<Array<{ token: string }>>(`push_tokens?user_id=eq.${n.user_id}&select=token`);
    if (!tokens.length) return json({ sent: 0 });

    const unread = await rest<Array<{ id: string }>>(
      `notifications?user_id=eq.${n.user_id}&read_at=is.null&select=id&limit=99`,
    );

    const messages = tokens.map(({ token }) => ({
      to: token,
      title: n.title,
      body: n.body,
      sound: 'default',
      badge: unread.length,
      channelId: 'default',
      data: { ...(n.data ?? {}), type: n.type, notification_id: n.id },
    }));

    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let expoStatus = 0;
    let removed = 0;
    try {
      const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(messages) });
      expoStatus = res.status;
      const payload = await res.json().catch(() => ({}));
      // Drop tokens Expo reports as no longer registered.
      const tickets: Array<{ status: string; details?: { error?: string } }> = payload?.data ?? [];
      const dead = tickets
        .map((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? tokens[i].token : null))
        .filter((t): t is string => !!t);
      if (dead.length) {
        const list = dead.map((t) => `"${t.replace(/"/g, '')}"`).join(',');
        await rest(`push_tokens?token=in.(${encodeURIComponent(list)})`, { method: 'DELETE' });
        removed = dead.length;
      }
    } catch (e) {
      return json({ sent: 0, attempted: messages.length, error: `expo_unreachable: ${(e as Error).message}` }, 502);
    }
    return json({ sent: messages.length, removed, expoStatus });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
