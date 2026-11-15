import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { RequestStatusBadge } from '../../components/StatusBadge';
import { AppText, Card, Chip, EmptyView, ErrorView, LoadingView } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';
import { REQUEST_STATUSES, type ProjectRequest, type RequestStatus } from '../../lib/types';
import { must, useAsync } from '../../lib/useAsync';

export default function AdminRequests() {
  const { t, colors, lang } = usePrefs();
  const [status, setStatus] = useState<RequestStatus | null>(null);
  const q = useAsync(async () => {
    let query = supabase.from('project_requests').select('*').order('created_at', { ascending: false }).limit(300);
    if (status) query = query.eq('status', status);
    return must(await query) as ProjectRequest[];
  }, [status]);

  return (
    <>
      <Stack.Screen options={{ title: t('manageRequests') }} />
      <FlatList
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        data={q.data ?? []}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label={t('all')} selected={!status} onPress={() => setStatus(null)} />
            {REQUEST_STATUSES.map((s) => <Chip key={s} label={t(`status_${s}`)} selected={status === s} onPress={() => setStatus(s)} />)}
          </ScrollView>
        }
        ListEmptyComponent={q.loading ? <LoadingView /> : q.error ? <ErrorView error={q.error} onRetry={q.reload} /> : <EmptyView text={t('emptyList')} />}
        renderItem={({ item: r }) => (
          <Card onPress={() => router.push(`/request/${r.id}`)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText weight="semibold" size={13} style={{ color: colors.accent }}>{r.request_number}</AppText>
              <RequestStatusBadge status={r.status} />
            </View>
            <AppText weight="bold" size={16}>{r.project_name}</AppText>
            <AppText muted size={12}>{r.contact_name} • {t(`type_${r.project_type}`)} • {formatDate(r.created_at, lang)}</AppText>
          </Card>
        )}
      />
    </>
  );
}
