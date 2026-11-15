import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { AttachmentList } from '../../components/Attachments';
import { Composer, MessageBubble } from '../../components/Chat';
import { RequireAuth } from '../../components/RequireAuth';
import { ConsultationStatusBadge } from '../../components/StatusBadge';
import { AppText, Banner, Button, Card, ErrorView, LoadingView } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errorKey } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';
import type { Attachment, Consultation, ConsultationMessage, Profile } from '../../lib/types';
import { uploadAttachment, type PickedFile } from '../../lib/upload';
import { must, useAsync } from '../../lib/useAsync';

function Chat({ id }: { id: string }) {
  const { t, colors, lang } = usePrefs();
  const { session, isOwner } = useAuth();
  const scroll = useRef<ScrollViewInstance>(null);

  const q = useAsync(async () => {
    const [c, msgs, atts, settings] = await Promise.all([
      supabase.from('consultations').select('*').eq('id', id).single(),
      supabase.from('consultation_messages').select('*').eq('consultation_id', id).order('created_at'),
      supabase.from('attachments').select('*').eq('consultation_id', id),
      supabase.from('admin_settings').select('max_attachment_mb').eq('id', 1).single(),
    ]);
    const consultation = must(c) as Consultation;
    let asker: Pick<Profile, 'full_name' | 'email'> | null = null;
    if (isOwner) {
      const { data } = await supabase.from('profiles').select('full_name,email').eq('id', consultation.user_id).maybeSingle();
      asker = data;
    }
    return {
      c: consultation,
      msgs: must(msgs) as ConsultationMessage[],
      atts: must(atts) as Attachment[],
      maxMb: (must(settings) as { max_attachment_mb: number }).max_attachment_mb,
      asker,
    };
  }, [id, isOwner]);

  useEffect(() => {
    const ch = supabase
      .channel(`consultation:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'consultation_messages', filter: `consultation_id=eq.${id}` }, () => q.silentReload())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'consultations', filter: `id=eq.${id}` }, () => q.silentReload())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (q.data) setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 100);
  }, [q.data?.msgs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.loading) return <LoadingView />;
  if (q.error || !q.data) return <ErrorView error={q.error} onRetry={q.reload} />;
  const { c, msgs, atts, maxMb, asker } = q.data;
  const uid = session!.user.id;
  const ownerView = isOwner && c.user_id !== uid;
  const remaining = Math.max(c.message_limit - c.user_message_count, 0);
  const closed = c.status === 'closed';
  const canSend = !closed && (ownerView || remaining > 0);

  const send = async (text: string, files: PickedFile[]) => {
    try {
      const ids: string[] = [];
      for (const f of files) ids.push((await uploadAttachment(uid, f)).id);
      const { error } = await supabase.rpc('send_consultation_message', { p_consultation_id: id, p_body: text, p_attachment_ids: ids });
      if (error) throw error;
      await q.silentReload();
      return true;
    } catch (e) {
      Alert.alert(t('error'), t(errorKey(e)));
      q.silentReload();
      return false;
    }
  };

  const close = () =>
    Alert.alert(t('closeConsultation'), t('closeConsultationConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirm'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('close_consultation', { p_consultation_id: id });
          if (error) Alert.alert(t('error'), t(errorKey(error)));
          q.silentReload();
        },
      },
    ]);

  const extend = async (by: number) => {
    const { error } = await supabase.from('consultations').update({ message_limit: Math.min(c.message_limit + by, 100) }).eq('id', id);
    if (error) Alert.alert(t('error'), t(errorKey(error)));
    q.silentReload();
  };

  const attsFor = (mid: string) => atts.filter((a) => a.consultation_message_id === mid);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 8 }} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText muted size={12}>{t(`spec_${c.specialty}`)} • {formatDate(c.created_at, lang)}</AppText>
            <ConsultationStatusBadge status={c.status} />
          </View>
          <AppText weight="bold" size={17}>{c.subject}</AppText>
          {asker ? <AppText muted size={13}>{asker.full_name} • {asker.email}</AppText> : null}
          <AppText muted size={12}>{t('messagesRemaining', { n: remaining, total: c.message_limit })}</AppText>
          {!closed ? (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {ownerView ? <Button small variant="secondary" icon="add-circle-outline" title={`${t('extendLimit')} +1`} onPress={() => extend(1)} /> : null}
              <Button small variant="ghost" icon="lock-closed-outline" title={t('closeConsultation')} onPress={close} />
            </View>
          ) : null}
        </Card>

        {msgs.map((m) => (
          <MessageBubble
            key={m.id}
            mine={m.sender_id === uid}
            author={m.is_owner ? t('fahad') : m.sender_id === uid ? t('you') : asker?.full_name || t('you')}
            body={m.body}
            date={m.created_at}
          >
            {attsFor(m.id).length ? <AttachmentList items={attsFor(m.id)} compact /> : null}
          </MessageBubble>
        ))}

        {closed ? <Banner text={t('consultationClosed')} icon="lock-closed" /> : null}
        {!closed && !ownerView && remaining <= 0 ? <Banner tone="warning" text={t('messageLimitReached')} /> : null}
      </ScrollView>
      {canSend ? <Composer onSend={send} withAttachments maxMb={maxMb} /> : null}
    </KeyboardAvoidingView>
  );
}

export default function ConsultationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = usePrefs();
  return (
    <>
      <Stack.Screen options={{ title: t('techConsult') }} />
      <RequireAuth>
        <Chat id={id} />
      </RequireAuth>
    </>
  );
}
