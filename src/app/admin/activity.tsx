import { Stack } from 'expo-router';
import { FlatList, RefreshControl } from 'react-native';
import { AppText, Card, EmptyView, ErrorView, LoadingView } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';
import type { ActivityLog } from '../../lib/types';
import { must, useAsync } from '../../lib/useAsync';

function describe(details: Record<string, unknown>): string {
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' • ');
}

export default function Activity() {
  const { t, colors, lang } = usePrefs();
  const q = useAsync(async () => must(await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(300)) as ActivityLog[]);
  return (
    <>
      <Stack.Screen options={{ title: t('activityLog') }} />
      <FlatList
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        data={q.data ?? []}
        keyExtractor={(a) => String(a.id)}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.accent} />}
        ListEmptyComponent={q.loading ? <LoadingView /> : q.error ? <ErrorView error={q.error} onRetry={q.reload} /> : <EmptyView text={t('noActivity')} />}
        renderItem={({ item: a }) => (
          <Card style={{ gap: 2, padding: 12 }}>
            <AppText weight="semibold" size={14} style={{ color: colors.accent }}>{a.action}</AppText>
            {Object.keys(a.details ?? {}).length ? <AppText size={13}>{describe(a.details)}</AppText> : null}
            <AppText muted size={11}>{formatDate(a.created_at, lang, true)}</AppText>
          </Card>
        )}
      />
    </>
  );
}
