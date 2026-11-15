// Integration tests against a running Supabase stack (local: `supabase start`).
// Run: npm run test:db
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, DB_URL (defaults = local CLI stack)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

import { createRequire } from 'node:module';
const localEnv = createRequire(import.meta.url)('./local-env.cjs');
const { url: URL, anonKey: ANON, serviceKey: SERVICE, dbUrl: DB_URL } = localEnv();

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const anon = () => createClient(URL, ANON, { auth: { persistSession: false } });
const sql = (q) => execFileSync('psql', [DB_URL, '-tAc', q], { encoding: 'utf8' }).trim();
const stamp = Date.now();

async function makeUser(tag, locale = 'ar') {
  const email = `${tag}-${stamp}@fahdar.test`;
  const password = 'Test-password-123';
  const { error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: tag, locale },
  });
  if (error) throw error;
  const client = anon();
  const { data, error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { client, id: data.user.id, email };
}

const errCode = (e) => e?.message ?? '';

let owner, alice, bob;

test('setup users and owner promotion is SQL-only', async () => {
  owner = await makeUser('owner');
  alice = await makeUser('alice');
  bob = await makeUser('bob', 'en');
  sql(`select private.promote_to_owner('${owner.email}')`);
  const { data } = await owner.client.rpc('is_owner');
  assert.equal(data, true);
  const { data: a } = await alice.client.rpc('is_owner');
  assert.equal(a, false);
});

test('user cannot escalate to owner', async () => {
  const { error } = await alice.client.from('profiles').update({ role: 'owner' }).eq('id', alice.id);
  assert.ok(error, 'role update must fail');
  const { error: e2 } = await alice.client.rpc('promote_to_owner', { p_email: alice.email });
  assert.ok(e2, 'private function must not be reachable');
  const { data } = await alice.client.rpc('is_owner');
  assert.equal(data, false);
  const { error: e3 } = await alice.client.from('profiles').update({ full_name: 'Alice A' }).eq('id', alice.id);
  assert.equal(e3, null);
});

test('profiles are isolated', async () => {
  const { data } = await alice.client.from('profiles').select('id');
  assert.deepEqual(data.map((r) => r.id), [alice.id]);
  const { data: all } = await owner.client.from('profiles').select('id');
  assert.ok(all.length >= 3);
});

test('anon can read public content but not private tables', async () => {
  const c = anon();
  const { error: e1 } = await c.from('owner_profile').select('*').single();
  assert.equal(e1, null);
  const { data: reqs, error: e2 } = await c.from('project_requests').select('*');
  assert.ok(e2 || reqs.length === 0);
  const { error: e3 } = await c.from('projects').insert({ title: 'x hack' });
  assert.ok(e3);
});

test('owner manages projects; drafts hidden from public', async () => {
  const { data: p, error } = await owner.client.from('projects')
    .insert({ title: 'مشروع اختبار', is_published: false, technologies: ['Expo'] }).select().single();
  assert.equal(error, null);
  const { data: pub } = await anon().from('projects').select('id').eq('id', p.id);
  assert.equal(pub.length, 0);
  await owner.client.from('projects').update({ is_published: true }).eq('id', p.id);
  const { data: pub2 } = await anon().from('projects').select('id').eq('id', p.id);
  assert.equal(pub2.length, 1);
  const { error: e2 } = await alice.client.from('projects').update({ title: 'hacked' }).eq('id', p.id).select();
  const { data: still } = await anon().from('projects').select('title').eq('id', p.id).single();
  assert.equal(still.title, 'مشروع اختبار', String(e2));
  await owner.client.from('projects').delete().eq('id', p.id);
});

let requestId;
test('project request: number, forced status, notifications', async () => {
  const { data, error } = await alice.client.from('project_requests').insert({
    user_id: alice.id, project_name: 'تطبيق متجر', description: 'وصف تفصيلي للفكرة يتجاوز عشرين حرفاً.',
    project_type: 'mobile_app', platforms: ['android', 'ios'], contact_name: 'Alice', contact_email: 'a@example.com',
  }).select().single();
  assert.equal(error, null, error?.message);
  assert.match(data.request_number, /^FHD-\d{2}-\d{5}$/);
  assert.equal(data.status, 'new');
  requestId = data.id;
  const { data: n } = await alice.client.from('notifications').select('type').eq('type', 'request_received');
  assert.equal(n.length, 1);
  const { data: on } = await owner.client.from('notifications').select('type').eq('type', 'owner_new_request');
  assert.ok(on.length >= 1);
});

test('user cannot spoof status / user_id or read others requests', async () => {
  const { error } = await alice.client.from('project_requests').insert({
    user_id: bob.id, project_name: 'spoof', description: 'spoofing someone else request here',
    project_type: 'website', contact_name: 'Al', contact_email: 'a@example.com',
  });
  assert.ok(error);
  const { data } = await bob.client.from('project_requests').select('id').eq('id', requestId);
  assert.equal(data.length, 0);
  await alice.client.from('project_requests').update({ status: 'accepted' }).eq('id', requestId);
  const { data: r } = await alice.client.from('project_requests').select('status').eq('id', requestId).single();
  assert.equal(r.status, 'new');
});

test('owner changes status → timeline + localized notification', async () => {
  const { error } = await owner.client.from('project_requests').update({ status: 'needs_info' }).eq('id', requestId);
  assert.equal(error, null);
  const { data: tl } = await alice.client.from('request_messages').select('kind,new_status').eq('request_id', requestId);
  assert.ok(tl.some((m) => m.kind === 'status' && m.new_status === 'needs_info'));
  const { data: n } = await alice.client.from('notifications').select('title').eq('type', 'request_needs_info');
  assert.equal(n[0].title, 'مطلوب معلومات إضافية');
  const { error: e2 } = await alice.client.from('request_messages').insert({ request_id: requestId, body: 'هذه المعلومات' });
  assert.equal(e2, null);
  const { error: e3 } = await bob.client.from('request_messages').insert({ request_id: requestId, body: 'intrude' });
  assert.ok(e3);
  const { error: e4 } = await alice.client.from('request_messages')
    .insert({ request_id: requestId, body: 'fake', kind: 'status', new_status: 'accepted' });
  const { data: tl2 } = await alice.client.from('request_messages').select('kind,new_status').eq('request_id', requestId);
  assert.ok(!tl2.some((m) => m.new_status === 'accepted'), String(e4));
});

test('requests can be paused by owner only', async () => {
  const { error: ue } = await alice.client.from('admin_settings').update({ requests_enabled: false }).eq('id', 1).select();
  const { data: s1 } = await anon().from('admin_settings').select('requests_enabled').single();
  assert.equal(s1.requests_enabled, true, String(ue));
  await owner.client.from('admin_settings').update({ requests_enabled: false }).eq('id', 1);
  const { error } = await bob.client.from('project_requests').insert({
    user_id: bob.id, project_name: 'Site', description: 'a website description long enough',
    project_type: 'website', contact_name: 'Bob', contact_email: 'b@example.com',
  });
  assert.match(errCode(error), /REQUESTS_PAUSED/);
  await owner.client.from('admin_settings').update({ requests_enabled: true }).eq('id', 1);
});

let consultationId;
test('consultation quota: 2 per month, enforced server-side even in parallel', async () => {
  const { data: q } = await bob.client.rpc('my_consultation_quota');
  assert.equal(q[0].remaining, 2);
  const calls = Array.from({ length: 4 }, (_, i) => bob.client.rpc('start_consultation', {
    p_specialty: 'ai', p_subject: `سؤال ${i}`, p_body: 'نص الاستشارة التفصيلي هنا',
  }));
  const results = await Promise.all(calls);
  const ok = results.filter((r) => !r.error);
  const limited = results.filter((r) => /MONTHLY_LIMIT_REACHED/.test(errCode(r.error)));
  assert.equal(ok.length, 2);
  assert.equal(limited.length, 2);
  consultationId = ok[0].data;
  const { data: q2 } = await bob.client.rpc('my_consultation_quota');
  assert.equal(q2[0].remaining, 0);
});

test('direct table writes to consultations are impossible', async () => {
  const { error } = await bob.client.from('consultations').insert({ user_id: bob.id, specialty: 'ai', subject: 'hack', message_limit: 99 });
  assert.ok(error);
  const { error: e2 } = await bob.client.from('consultation_messages').insert({ consultation_id: consultationId, body: 'x' });
  assert.ok(e2);
  await bob.client.from('consultations').update({ user_message_count: 0, message_limit: 99 }).eq('id', consultationId);
  const { data } = await bob.client.from('consultations').select('user_message_count,message_limit').eq('id', consultationId).single();
  assert.deepEqual(data, { user_message_count: 1, message_limit: 5 });
});

test('5 user messages per consultation (first message counts)', async () => {
  for (let i = 0; i < 4; i++) {
    const { error } = await bob.client.rpc('send_consultation_message', { p_consultation_id: consultationId, p_body: `m${i}` });
    assert.equal(error, null, error?.message);
  }
  const { error } = await bob.client.rpc('send_consultation_message', { p_consultation_id: consultationId, p_body: 'sixth' });
  assert.match(errCode(error), /MESSAGE_LIMIT_REACHED/);
  // owner replies are unlimited and mark it answered + notify (English user)
  const { error: oe } = await owner.client.rpc('send_consultation_message', { p_consultation_id: consultationId, p_body: 'Owner reply' });
  assert.equal(oe, null);
  const { data: c } = await bob.client.from('consultations').select('status').eq('id', consultationId).single();
  assert.equal(c.status, 'answered');
  const { data: n } = await bob.client.from('notifications').select('title').eq('type', 'consultation_reply');
  assert.equal(n[0].title, 'New reply to your consultation');
  // other users cannot read or post
  const { data: other } = await alice.client.from('consultation_messages').select('id').eq('consultation_id', consultationId);
  assert.equal(other.length, 0);
  const { error: ae } = await alice.client.rpc('send_consultation_message', { p_consultation_id: consultationId, p_body: 'x' });
  assert.match(errCode(ae), /NOT_FOUND/);
});

test('owner can extend limits; close blocks further messages', async () => {
  await owner.client.from('consultations').update({ message_limit: 6 }).eq('id', consultationId);
  const { error } = await bob.client.rpc('send_consultation_message', { p_consultation_id: consultationId, p_body: 'sixth ok' });
  assert.equal(error, null);
  await owner.client.rpc('admin_grant_extra_consultations', { p_user_id: bob.id, p_extra: 1 });
  const { data: q } = await bob.client.rpc('my_consultation_quota');
  assert.equal(q[0].remaining, 1);
  const { error: ce } = await owner.client.rpc('close_consultation', { p_consultation_id: consultationId });
  assert.equal(ce, null);
  const { error: e2 } = await bob.client.rpc('send_consultation_message', { p_consultation_id: consultationId, p_body: 'after close' });
  assert.match(errCode(e2), /CONSULTATION_CLOSED/);
  const { data: n } = await bob.client.from('notifications').select('id').eq('type', 'consultation_closed');
  assert.equal(n.length, 1);
});

test('attachments: upload to own folder, isolation, link via RPC', async () => {
  const body = new Blob(['hello fahdar'], { type: 'text/plain' });
  const badPath = `${alice.id}/evil.txt`;
  const { error: be } = await bob.client.storage.from('attachments').upload(badPath, body, { contentType: 'text/plain' });
  assert.ok(be, 'cannot upload into another user folder');

  const path = `${bob.id}/${crypto.randomUUID()}.txt`;
  const { error: ue } = await bob.client.storage.from('attachments').upload(path, body, { contentType: 'text/plain' });
  assert.equal(ue, null, ue?.message);
  const { data: att, error: ie } = await bob.client.from('attachments')
    .insert({ path, file_name: 'note.txt', mime_type: 'text/plain', size_bytes: 12 }).select().single();
  assert.equal(ie, null, ie?.message);

  const { error: pe } = await bob.client.from('attachments')
    .insert({ path: `${alice.id}/x.txt`, file_name: 'x', mime_type: 'text/plain', size_bytes: 1 });
  assert.ok(pe, 'path must live in own folder');
  const { error: me } = await bob.client.from('attachments')
    .insert({ path: `${bob.id}/x.exe`, file_name: 'x.exe', mime_type: 'application/x-msdownload', size_bytes: 1 });
  assert.match(errCode(me), /FILE_TYPE_NOT_ALLOWED/);

  const { data: cid, error: se } = await bob.client.rpc('start_consultation', {
    p_specialty: 'databases', p_subject: 'مرفق', p_body: 'استشارة مع مرفق للاختبار', p_attachment_ids: [att.id],
  });
  assert.equal(se, null, se?.message);
  const { data: linked } = await owner.client.from('attachments').select('consultation_id').eq('id', att.id).single();
  assert.equal(linked.consultation_id, cid);

  const { error: ae } = await alice.client.storage.from('attachments').download(path);
  assert.ok(ae, 'other users cannot download');
  const { data: od, error: oe } = await owner.client.storage.from('attachments').download(path);
  assert.equal(oe, null);
  assert.equal(await od.text(), 'hello fahdar');
});

test('admin RPCs are owner-only', async () => {
  const { error } = await alice.client.rpc('admin_dashboard_stats');
  assert.match(errCode(error), /FORBIDDEN/);
  const { error: be } = await alice.client.rpc('admin_broadcast', { p_title: 'spam', p_body: 'x' });
  assert.match(errCode(be), /FORBIDDEN/);
  const { data, error: oe } = await owner.client.rpc('admin_dashboard_stats');
  assert.equal(oe, null);
  assert.ok(data.requests_total >= 1);
  const { data: n } = await owner.client.rpc('admin_broadcast', { p_title: 'إعلان', p_body: 'مرحباً', p_user_id: alice.id });
  assert.equal(n, 1);
  const { data: logs } = await owner.client.from('activity_logs').select('action').limit(50);
  assert.ok(logs.some((l) => l.action === 'notification.broadcast'));
  const { data: ul } = await alice.client.from('activity_logs').select('id');
  assert.equal(ul.length, 0);
});

test('notifications: user marks read, cannot forge', async () => {
  const { data } = await alice.client.from('notifications').select('id').is('read_at', null);
  assert.ok(data.length > 0);
  const { error } = await alice.client.from('notifications').update({ read_at: new Date().toISOString() }).in('id', data.map((d) => d.id));
  assert.equal(error, null);
  const { error: fe } = await alice.client.from('notifications').insert({ user_id: bob.id, type: 'x', title: 'fake' });
  assert.ok(fe);
  const { error: pe } = await alice.client.rpc('register_push_token', { p_token: 'ExponentPushToken[test-token-1]', p_platform: 'android' });
  assert.equal(pe, null);
});

test('edge: push-dispatch rejects missing secret and is triggered by DB', async () => {
  const res = await fetch(`${URL}/functions/v1/push-dispatch`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notification_id: 'x' }),
  });
  assert.equal(res.status, 401);
  // configure the DB → function hook (from inside docker network the host is "kong")
  sql(`insert into private.app_config values ('push_function_url','http://kong:8000/functions/v1/push-dispatch'),('push_webhook_secret','local-test-secret') on conflict (key) do update set value = excluded.value`);
  const { data: n } = await owner.client.rpc('admin_broadcast', { p_title: 'Push test', p_body: 'hi', p_user_id: alice.id });
  assert.equal(n, 1);
  // wait for pg_net to deliver and record the response
  let row = '';
  for (let i = 0; i < 30 && !row; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    row = sql(`select status_code || ' ' || coalesce(content,'') from net._http_response order by id desc limit 1`);
  }
  assert.ok(row, 'pg_net should have called the function');
  // Either Expo accepted it, or (offline sandbox) the function got as far as calling Expo for 1 token.
  assert.match(row, /"sent":1|"attempted":1,"error":"expo_unreachable/, row);
  sql(`delete from private.app_config`);
});

test('edge: delete-account removes user + files; owner protected', async () => {
  const victim = await makeUser('victim');
  const path = `${victim.id}/${crypto.randomUUID()}.txt`;
  await victim.client.storage.from('attachments').upload(path, new Blob(['x'], { type: 'text/plain' }), { contentType: 'text/plain' });
  const { error: noConfirm } = await victim.client.functions.invoke('delete-account', { body: {} });
  assert.ok(noConfirm);
  const { data, error } = await victim.client.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
  assert.equal(error, null, error?.message);
  assert.equal(data.deleted, true);
  assert.equal(sql(`select count(*) from public.profiles where id = '${victim.id}'`), '0');
  assert.equal(sql(`select count(*) from storage.objects where name like '${victim.id}/%'`), '0');
  const { error: oe } = await owner.client.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
  assert.ok(oe, 'owner account is protected');
});
