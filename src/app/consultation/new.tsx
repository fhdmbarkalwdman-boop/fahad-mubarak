import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { AttachmentPicker } from '../../components/Attachments';
import { QuotaCard } from '../../components/QuotaCard';
import { RequireAuth } from '../../components/RequireAuth';
import { AppText, Banner, Button, Card, ChipGroup, ErrorView, Field, LoadingView, Screen } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errorKey } from '../../lib/errors';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';
import { SPECIALTIES, type AdminSettings, type Quota, type Specialty } from '../../lib/types';
import { uploadAttachment, type PickedFile } from '../../lib/upload';
import { must, useAsync } from '../../lib/useAsync';

function NewConsultationForm() {
  const { t } = usePrefs();
  const { session } = useAuth();
  const q = useAsync(async () => {
    const [quota, settings] = await Promise.all([
      supabase.rpc('my_consultation_quota'),
      supabase.from('admin_settings').select('*').eq('id', 1).single(),
    ]);
    return { quota: (must(quota) as Quota[])[0], settings: must(settings) as AdminSettings };
  });
  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (q.loading) return <LoadingView />;
  if (q.error || !q.data) return <ErrorView error={q.error} onRetry={q.reload} />;
  const { quota, settings } = q.data;

  const submit = async () => {
    setError(null);
    if (!specialty) return setError(`${t('specialty')}: ${t('required')}`);
    if (subject.trim().length < 3) return setError(t('err_INVALID_SUBJECT'));
    if (body.trim().length < 10) return setError(t('err_INVALID_BODY'));
    setBusy(true);
    try {
      const ids: string[] = [];
      for (const f of files) ids.push((await uploadAttachment(session!.user.id, f)).id);
      const { data, error: e } = await supabase.rpc('start_consultation', {
        p_specialty: specialty,
        p_subject: subject.trim(),
        p_body: body.trim(),
        p_attachment_ids: ids,
      });
      if (e) throw e;
      router.replace(`/consultation/${data as string}`);
    } catch (e) {
      setError(t(errorKey(e)));
      q.silentReload();
    } finally {
      setBusy(false);
    }
  };

  const blocked = !quota.enabled || quota.remaining <= 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <QuotaCard quota={quota} />
        {!quota.enabled ? <Banner tone="warning" text={t('consultationsPaused')} /> : null}
        {quota.enabled && quota.remaining <= 0 ? <Banner tone="warning" text={t('quotaExhausted')} /> : null}
        <Card style={{ gap: 14 }}>
          <ChipGroup<Specialty>
            label={t('specialty')}
            value={specialty}
            onChange={setSpecialty}
            options={SPECIALTIES.map((s) => ({ value: s, label: t(`spec_${s}`) }))}
          />
          <Field label={t('subject')} value={subject} onChangeText={setSubject} maxLength={150} />
          <Field label={t('yourQuestion')} value={body} onChangeText={setBody} multiline maxLength={4000} />
          <AppText muted size={12}>{t('messagesRemaining', { n: settings.messages_per_consultation, total: settings.messages_per_consultation })}</AppText>
          <AttachmentPicker files={files} onChange={setFiles} maxMb={settings.max_attachment_mb} />
        </Card>
        {error ? <Banner tone="danger" text={error} /> : null}
        <Button title={t('startConsultation')} icon="send" variant="accent" onPress={submit} loading={busy} disabled={blocked} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

export default function NewConsultation() {
  const { t } = usePrefs();
  return (
    <>
      <Stack.Screen options={{ title: t('newConsultation') }} />
      <RequireAuth>
        <NewConsultationForm />
      </RequireAuth>
    </>
  );
}
