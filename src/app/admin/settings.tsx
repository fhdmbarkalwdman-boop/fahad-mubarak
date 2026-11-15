import { Stack } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Card, ErrorView, Field, LoadingView, Screen, ToggleRow } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import { usePrefs } from '../../lib/prefs';
import { fetchSettings } from '../../lib/queries';
import { supabase } from '../../lib/supabase';
import type { AdminSettings as Settings } from '../../lib/types';
import { useAsync } from '../../lib/useAsync';

export default function AdminSettings() {
  const q = useAsync(fetchSettings, [], { refetchOnFocus: false });
  if (q.loading) return <LoadingView />;
  if (q.error || !q.data) return <ErrorView error={q.error} onRetry={q.reload} />;
  return <SettingsForm s={q.data} />;
}

function SettingsForm({ s }: { s: Settings }) {
  const { t } = usePrefs();
  const [requestsEnabled, setRequestsEnabled] = useState(s.requests_enabled);
  const [pausedMessage, setPausedMessage] = useState(s.requests_paused_message);
  const [consultationsEnabled, setConsultationsEnabled] = useState(s.consultations_enabled);
  const [perMonth, setPerMonth] = useState(String(s.consultations_per_month));
  const [perConsultation, setPerConsultation] = useState(String(s.messages_per_consultation));
  const [maxOpen, setMaxOpen] = useState(String(s.max_open_requests));
  const [maxMb, setMaxMb] = useState(String(s.max_attachment_mb));
  const [tz, setTz] = useState(s.quota_timezone);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN);

  const save = async () => {
    setMsg(null);
    const values = { pm: int(perMonth), pc: int(perConsultation), mo: int(maxOpen), mb: int(maxMb) };
    if (Object.values(values).some(Number.isNaN)) return setMsg({ tone: 'danger', text: t('err_validation') });
    setBusy(true);
    const { error } = await supabase.from('admin_settings').update({
      requests_enabled: requestsEnabled,
      requests_paused_message: pausedMessage.trim(),
      consultations_enabled: consultationsEnabled,
      consultations_per_month: values.pm,
      messages_per_consultation: values.pc,
      max_open_requests: values.mo,
      max_attachment_mb: values.mb,
      quota_timezone: tz.trim(),
    }).eq('id', 1);
    setBusy(false);
    setMsg(error ? { tone: 'danger', text: t(errorKey(error)) } : { tone: 'success', text: t('saved') });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('usageControl') }} />
      <Card style={{ gap: 12 }}>
        <ToggleRow label={t('acceptingRequests')} value={requestsEnabled} onChange={setRequestsEnabled} />
        <Field label={t('pausedMessage')} value={pausedMessage} onChangeText={setPausedMessage} optional maxLength={300} />
        <Field label={t('maxOpenRequests')} value={maxOpen} onChangeText={setMaxOpen} keyboardType="number-pad" hint="1 – 100" />
      </Card>
      <Card style={{ gap: 12 }}>
        <ToggleRow label={t('consultationsEnabled')} value={consultationsEnabled} onChange={setConsultationsEnabled} />
        <Field label={t('consultationsPerMonth')} value={perMonth} onChangeText={setPerMonth} keyboardType="number-pad" hint="0 – 100" />
        <Field label={t('messagesPerConsultation')} value={perConsultation} onChangeText={setPerConsultation} keyboardType="number-pad" hint="1 – 100" />
        <Field label={t('quotaTimezone')} value={tz} onChangeText={setTz} autoCapitalize="none" hint="Asia/Riyadh, UTC, Asia/Dubai…" />
      </Card>
      <Card>
        <Field label={t('maxAttachmentMb')} value={maxMb} onChangeText={setMaxMb} keyboardType="number-pad" hint="1 – 50" />
      </Card>
      {msg ? <Banner tone={msg.tone} text={msg.text} /> : null}
      <Button title={t('save')} icon="checkmark" onPress={save} loading={busy} />
    </Screen>
  );
}
