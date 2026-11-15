import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { AppText, Button, Card, EmptyView, ErrorView, LoadingView } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import { formatBytes, formatDate } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';
import type { Attachment } from '../../lib/types';
import { signedUrl } from '../../lib/upload';
import { must, useAsync } from '../../lib/useAsync';

type Row = Attachment & { profiles: { full_name: string; email: string | null } | null };

export default function AdminAttachments() {
  const { t, colors, lang } = usePrefs();
  const q = useAsync(async () =>
    must(await supabase.from('attachments').select('*, profiles:uploaded_by(full_name,email)').order('created_at', { ascending: false }).limit(300)) as Row[],
  );

  const open = async (a: Attachment) => {
    try {
      await WebBrowser.openBrowserAsync(await signedUrl(a.path));
    } catch (e) {
      Alert.alert(t('error'), t(errorKey(e)));
    }
  };

  const remove = (a: Attachment) =>
    Alert.alert(t('delete'), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          const { error: se } = await supabase.storage.from('attachments').remove([a.path]);
          const { error } = await supabase.from('attachments').delete().eq('id', a.id);
          if (se || error) Alert.alert(t('error'), t(errorKey(se ?? error)));
          q.silentReload();
        },
      },
    ]);

  const total = (q.data ?? []).reduce((s, a) => s + a.size_bytes, 0);

  return (
    <>
      <Stack.Screen options={{ title: t('manageAttachments') }} />
      <FlatList
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        data={q.data ?? []}
        keyExtractor={(a) => a.id}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.accent} />}
        ListHeaderComponent={q.data ? <AppText muted>{t("storageTotal", { size: formatBytes(total) })}</AppText> : undefined}
        ListEmptyComponent={q.loading ? <LoadingView /> : q.error ? <ErrorView error={q.error} onRetry={q.reload} /> : <EmptyView text={t('emptyList')} />}
        renderItem={({ item: a }) => (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={a.mime_type.startsWith('image/') ? 'image' : 'document-attach'} size={22} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <AppText weight="semibold" numberOfLines={1}>{a.file_name}</AppText>
                <AppText muted size={12}>
                  {formatBytes(a.size_bytes)} • {formatDate(a.created_at, lang)} • {a.profiles?.full_name || a.profiles?.email || '—'}
                </AppText>
                <AppText muted size={12}>
                  {a.request_id ? t('linkedRequest') : a.consultation_id ? t('linkedConsultation') : t('unlinked')}
                </AppText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button small variant="secondary" icon="open-outline" title={t('open')} onPress={() => open(a)} />
              {a.request_id ? <Button small variant="ghost" title={t('linkedRequest')} onPress={() => router.push(`/request/${a.request_id}`)} /> : null}
              {a.consultation_id ? <Button small variant="ghost" title={t('linkedConsultation')} onPress={() => router.push(`/consultation/${a.consultation_id}`)} /> : null}
              <Button small variant="danger" icon="trash-outline" title={t('delete')} onPress={() => remove(a)} />
            </View>
          </Card>
        )}
      />
    </>
  );
}
