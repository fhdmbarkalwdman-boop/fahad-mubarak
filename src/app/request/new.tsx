import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { AttachmentPicker } from '../../components/Attachments';
import { RequireAuth } from '../../components/RequireAuth';
import { AppText, Banner, Button, Card, ChipGroup, ErrorView, Field, LoadingView, Screen } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errorKey } from '../../lib/errors';
import { isEmail } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { fetchSettings } from '../../lib/queries';
import { supabase } from '../../lib/supabase';
import { PLATFORMS, PROJECT_TYPES, type ProjectRequest, type ProjectType } from '../../lib/types';
import { uploadAttachment, type PickedFile } from '../../lib/upload';
import { useAsync } from '../../lib/useAsync';

function RequestForm() {
  const { t } = usePrefs();
  const { session, profile } = useAuth();
  const settings = useAsync(fetchSettings);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ProjectType | null>(null);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [budget, setBudget] = useState('');
  const [timeline, setTimeline] = useState('');
  const [contactName, setContactName] = useState(profile?.full_name ?? '');
  const [contactEmail, setContactEmail] = useState(session?.user.email ?? '');
  const [contactPhone, setContactPhone] = useState(profile?.phone ?? '');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (settings.loading) return <LoadingView />;
  if (settings.error || !settings.data) return <ErrorView error={settings.error} onRetry={settings.reload} />;
  if (!settings.data.requests_enabled) {
    return (
      <Screen>
        <Banner tone="warning" text={settings.data.requests_paused_message || t('requestsPaused')} />
      </Screen>
    );
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = t('required');
    if (description.trim().length < 20) e.description = t('ideaDescriptionHint');
    if (!type) e.type = t('required');
    if (contactName.trim().length < 2) e.contactName = t('nameRequired');
    if (!isEmail(contactEmail)) e.contactEmail = t('invalidEmail');
    if (contactPhone.trim() && !/^\+?[0-9 ()-]{6,20}$/.test(contactPhone.trim())) e.contactPhone = t('err_validation');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    setFormError(null);
    if (!validate()) return setFormError(t('err_validation'));
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('project_requests')
        .insert({
          user_id: session!.user.id,
          project_name: name.trim(),
          description: description.trim(),
          project_type: type,
          platforms,
          budget: budget.trim() || null,
          timeline: timeline.trim() || null,
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim(),
          contact_phone: contactPhone.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      const req = data as ProjectRequest;
      for (const f of files) await uploadAttachment(session!.user.id, f, req.id);
      router.replace({ pathname: '/request/[id]', params: { id: req.id, created: '1' } });
    } catch (e) {
      setFormError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Card style={{ gap: 14 }}>
          <Field label={t('projectName')} value={name} onChangeText={setName} maxLength={120} error={errors.name} />
          <Field label={t('ideaDescription')} value={description} onChangeText={setDescription} multiline maxLength={5000} hint={t('ideaDescriptionHint')} error={errors.description} />
          <View>
            <ChipGroup<ProjectType>
              label={t('projectType')}
              value={type}
              onChange={setType}
              options={PROJECT_TYPES.map((v) => ({ value: v, label: t(`type_${v}`) }))}
            />
            {errors.type ? <AppText size={12} style={{ color: '#D64545', marginTop: 4 }}>{errors.type}</AppText> : null}
          </View>
          <ChipGroup<string>
            label={t('targetPlatform')}
            value={platforms}
            onChange={(v) => setPlatforms((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
            options={PLATFORMS.map((v) => ({ value: v, label: t(`platform_${v}`) }))}
          />
          <Field label={t('budget')} value={budget} onChangeText={setBudget} optional maxLength={100} />
          <Field label={t('timeline')} value={timeline} onChangeText={setTimeline} optional maxLength={100} />
        </Card>

        <Card style={{ gap: 10 }}>
          <AppText weight="bold" size={16}>{t('attachments')} <AppText muted size={12}>({t('optional')})</AppText></AppText>
          <AttachmentPicker files={files} onChange={setFiles} maxMb={settings.data.max_attachment_mb} />
        </Card>

        <Card style={{ gap: 14 }}>
          <AppText weight="bold" size={16}>{t('contactInfo')}</AppText>
          <Field label={t('contactName')} value={contactName} onChangeText={setContactName} maxLength={80} error={errors.contactName} />
          <Field label={t('email')} value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" error={errors.contactEmail} />
          <Field label={t('phone')} value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" optional maxLength={20} error={errors.contactPhone} />
        </Card>

        {formError ? <Banner tone="danger" text={formError} /> : null}
        <Button title={t('submitRequest')} icon="send" variant="accent" onPress={submit} loading={busy} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

export default function NewRequest() {
  const { t } = usePrefs();
  return (
    <>
      <Stack.Screen options={{ title: t('newRequest') }} />
      <RequireAuth>
        <RequestForm />
      </RequireAuth>
    </>
  );
}
