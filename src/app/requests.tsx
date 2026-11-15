import { router, Stack } from 'expo-router';
import { FlatList, RefreshControl, View } from 'react-native';
import { RequireAuth } from '../components/RequireAuth';
import { RequestStatusBadge } from '../components/StatusBadge';
import { AppText, Button, Card, EmptyView, ErrorView, LoadingView } from '../components/ui';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { supabase } from '../lib/supabase';
import type { ProjectRequest } from '../lib/types';
import { must, useAsync } from '../lib/useAsync';

function MyRequests() {
  const { t, colors, lang } = usePrefs();
  const { session } = useAuth();
  const q = useAsync(async () =>
    must(await supabase.from('project_requests').select('*').eq('user_id', session!.user.id).order('created_at', { ascending: false })) as ProjectRequest[],
  );
  if (q.loading) return <LoadingView />;
  if (q.error && !q.data) return <ErrorView error={q.error} onRetry={q.reload} />;
  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={q.data}
      keyExtractor={(r) => r.id}
      refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.accent} />}
      ListHeaderComponent={<Button title={t('newRequest')} icon="add" variant="accent" onPress={() => router.push('/request/new')} />}
      ListEmptyComponent={<EmptyView icon="rocket-outline" text={t('noRequests')} />}
      renderItem={({ item: r }) => (
        <Card onPress={() => router.push(`/request/${r.id}`)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText weight="semibold" size={13} style={{ color: colors.accent }}>{r.request_number}</AppText>
            <RequestStatusBadge status={r.status} />
          </View>
          <AppText weight="bold" size={16}>{r.project_name}</AppText>
          <AppText muted size={12}>{t(`type_${r.project_type}`)} • {formatDate(r.created_at, lang)}</AppText>
        </Card>
      )}
    />
  );
}

export default function Requests() {
  const { t } = usePrefs();
  return (
    <>
      <Stack.Screen options={{ title: t('myRequests') }} />
      <RequireAuth>
        <MyRequests />
      </RequireAuth>
    </>
  );
}
