import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { AttachmentList } from '../../components/Attachments';
import { Composer, MessageBubble } from '../../components/Chat';
import { RequireAuth } from '../../components/RequireAuth';
import { RequestStatusBadge } from '../../components/StatusBadge';
import { AppText, Banner, Card, ChipGroup, ErrorView, LoadingView } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errorKey } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';
import { REQUEST_STATUSES, type Attachment, type ProjectRequest, type RequestMessage, type RequestStatus } from '../../lib/types';
import { uploadAttachment, type PickedFile } from '../../lib/upload';
import { must, useAsync } from '../../lib/useAsync';

function Detail({ id, created }: { id: string; created: boolean }) {
  const { t, colors, lang } = usePrefs();
  const { session, isOwner } = useAuth();
  const scroll = useRef<ScrollViewInstance>(null);

  const q = useAsync(async () => {
    const [req, msgs, atts, settings] = await Promise.all([
      supabase.from('project_requests').select('*').eq('id', id).single(),
      supabase.from('request_messages').select('*').eq('request_id', id).order('created_at'),
      supabase.from('attachments').select('*').eq('request_id', id).order('created_at'),
      supabase.from('admin_settings').select('max_attachment_mb').eq('id', 1).single(),
    ]);
    return {
      req: must(req) as ProjectRequest,
      msgs: must(msgs) as RequestMessage[],
      atts: must(atts) as Attachment[],
      maxMb: (must(settings) as { max_attachment_mb: number }).max_attachment_mb,
    };
  }, [id]);

  useEffect(() => {
    const ch = supabase
      .channel(`request:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'request_messages', filter: `request_id=eq.${id}` }, () => q.silentReload())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'project_requests', filter: `id=eq.${id}` }, () => q.silentReload())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (q.loading) return <LoadingView />;
  if (q.error || !q.data) return <ErrorView error={q.error} onRetry={q.reload} />;
  const { req, msgs, atts, maxMb } = q.data;
  const closed = req.status === 'rejected' || req.status === 'completed';
  const canWrite = isOwner || !closed;

  const setStatus = async (status: RequestStatus) => {
    if (status === req.status) return;
    const { error } = await supabase.from('project_requests').update({ status }).eq('id', id);
    if (error) Alert.alert(t('error'), t(errorKey(error)));
    else q.silentReload();
  };

  const send = async (text: string, files: PickedFile[]) => {
    try {
      for (const f of files) await uploadAttachment(session!.user.id, f, id);
      if (text) {
        const { error } = await supabase.from('request_messages').insert({ request_id: id, body: text });
        if (error) throw error;
      }
      await q.silentReload();
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 150);
      return true;
    } catch (e) {
      Alert.alert(t('error'), t(errorKey(e)));
      return false;
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        {created ? (
          <Card style={{ alignItems: 'center', gap: 6, borderColor: colors.success }}>
            <Ionicons name="checkmark-circle" size={44} color={colors.success} />
            <AppText weight="bold" size={17}>{t('requestSubmitted')}</AppText>
            <AppText muted>{t('requestNumber')}</AppText>
            <AppText weight="bold" size={22} style={{ color: colors.accent, letterSpacing: 1 }}>{req.request_number}</AppText>
          </Card>
        ) : null}

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText weight="semibold" style={{ color: colors.accent }}>{req.request_number}</AppText>
            <RequestStatusBadge status={req.status} />
          </View>
          <AppText weight="bold" size={18}>{req.project_name}</AppText>
          <AppText muted size={12}>{t('submittedOn', { date: formatDate(req.created_at, lang, true) })}</AppText>
          <AppText>{req.description}</AppText>
          <View style={{ gap: 4, marginTop: 4 }}>
            <AppText size={14}><AppText weight="semibold" size={14}>{t('projectType')}: </AppText>{t(`type_${req.project_type}`)}</AppText>
            {req.platforms.length ? (
              <AppText size={14}><AppText weight="semibold" size={14}>{t('targetPlatform')}: </AppText>{req.platforms.map((p) => t(`platform_${p}` as 'platform_web')).join('، ')}</AppText>
            ) : null}
            {req.budget ? <AppText size={14}><AppText weight="semibold" size={14}>{t('budget')}: </AppText>{req.budget}</AppText> : null}
            {req.timeline ? <AppText size={14}><AppText weight="semibold" size={14}>{t('timeline')}: </AppText>{req.timeline}</AppText> : null}
          </View>
          {isOwner ? (
            <View style={{ gap: 2, marginTop: 6, padding: 10, borderRadius: 10, backgroundColor: colors.surfaceAlt }}>
              <AppText weight="semibold" size={14}>{t('contactInfo')}</AppText>
              <AppText size={14}>{req.contact_name}</AppText>
              <AppText size={14} selectable>{req.contact_email}</AppText>
              {req.contact_phone ? <AppText size={14} selectable>{req.contact_phone}</AppText> : null}
            </View>
          ) : null}
        </Card>

        {isOwner ? (
          <Card>
            <ChipGroup<RequestStatus>
              label={t('changeStatus')}
              value={req.status}
              onChange={setStatus}
              options={REQUEST_STATUSES.map((s) => ({ value: s, label: t(`status_${s}`) }))}
            />
          </Card>
        ) : null}

        {atts.length ? (
          <Card>
            <AppText weight="bold" size={16}>{t('attachments')}</AppText>
            <AttachmentList items={atts} />
          </Card>
        ) : null}

        <AppText weight="bold" size={16}>{t('conversation')}</AppText>
        {msgs.map((m) =>
          m.kind === 'status' && m.new_status ? (
            <View key={m.id} style={{ alignItems: 'center', marginVertical: 2 }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: colors.surfaceAlt }}>
                <Ionicons name="git-commit-outline" size={14} color={colors.textMuted} />
                <AppText muted size={12}>
                  {t('statusChangedTo', { status: t(`status_${m.new_status}`) })} • {formatDate(m.created_at, lang, true)}
                </AppText>
              </View>
            </View>
          ) : (
            <MessageBubble
              key={m.id}
              mine={m.sender_id === session!.user.id}
              author={m.is_owner ? t('fahad') : m.sender_id === session!.user.id ? t('you') : req.contact_name}
              body={m.body}
              date={m.created_at}
            />
          ),
        )}
        {!canWrite ? <Banner text={t('requestClosedNote')} /> : null}
      </ScrollView>
      {canWrite ? <Composer onSend={send} withAttachments maxMb={maxMb} /> : null}
    </KeyboardAvoidingView>
  );
}

export default function RequestDetail() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const { t } = usePrefs();
  return (
    <>
      <Stack.Screen options={{ title: t('requestDetails') }} />
      <RequireAuth>
        <Detail id={id} created={created === '1'} />
      </RequireAuth>
    </>
  );
}
