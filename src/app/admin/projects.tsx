import { router, Stack } from 'expo-router';
import { FlatList, RefreshControl, View } from 'react-native';
import { PortfolioStatusBadge } from '../../components/StatusBadge';
import { AppText, Badge, Button, Card, EmptyView, ErrorView, LoadingView } from '../../components/ui';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';
import type { Project } from '../../lib/types';
import { must, useAsync } from '../../lib/useAsync';

export default function AdminProjects() {
  const { t, colors } = usePrefs();
  const q = useAsync(async () =>
    must(await supabase.from('projects').select('*').order('sort_order').order('created_at', { ascending: false })) as Project[],
  );
  return (
    <>
      <Stack.Screen options={{ title: t('manageProjects') }} />
      <FlatList
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        data={q.data ?? []}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.accent} />}
        ListHeaderComponent={<Button title={t('newProject')} icon="add" variant="accent" onPress={() => router.push('/admin/project-edit')} />}
        ListEmptyComponent={q.loading ? <LoadingView /> : q.error ? <ErrorView error={q.error} onRetry={q.reload} /> : <EmptyView text={t('noProjectsYet')} />}
        renderItem={({ item: p }) => (
          <Card onPress={() => router.push({ pathname: '/admin/project-edit', params: { id: p.id } })}>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Badge label={p.is_published ? t('published') : t('draft')} color={p.is_published ? colors.success : colors.textMuted} />
              <PortfolioStatusBadge status={p.status} />
              {p.is_featured ? <Badge label={t('featured')} color={colors.warning} /> : null}
            </View>
            <AppText weight="bold" size={16}>{p.title}</AppText>
            {p.category ? <AppText muted size={12}>{p.category}</AppText> : null}
          </Card>
        )}
      />
    </>
  );
}
