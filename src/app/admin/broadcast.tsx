import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Card, ChipGroup, Field, Screen } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';

export default function Broadcast() {
  const { t } = usePrefs();
  const params = useLocalSearchParams<{ userId?: string; name?: string }>();
  const [target, setTarget] = useState<'all' | 'one'>(params.userId ? 'one' : 'all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const send = async () => {
    setMsg(null);
    if (title.trim().length < 2) return setMsg({ tone: 'danger', text: `${t('title')}: ${t('required')}` });
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_broadcast', {
      p_title: title.trim(),
      p_body: body.trim(),
      p_user_id: target === 'one' ? params.userId ?? null : null,
    });
    setBusy(false);
    if (error) return setMsg({ tone: 'danger', text: t(errorKey(error)) });
    setMsg({ tone: 'success', text: t('notificationSent', { n: data as number }) });
    setTitle('');
    setBody('');
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('sendNotification') }} />
      <Card style={{ gap: 12 }}>
        <ChipGroup<'all' | 'one'>
          label={t('recipients')}
          value={target}
          onChange={setTarget}
          options={[
            { value: 'all', label: t('allUsers') },
            ...(params.userId ? [{ value: 'one' as const, label: params.name || t('singleUser') }] : []),
          ]}
        />
        <Field label={t('title')} value={title} onChangeText={setTitle} maxLength={160} />
        <Field label={t('body')} value={body} onChangeText={setBody} multiline optional maxLength={1000} />
      </Card>
      {msg ? <Banner tone={msg.tone} text={msg.text} /> : null}
      <Button title={t('send')} icon="send" variant="accent" onPress={send} loading={busy} />
    </Screen>
  );
}
