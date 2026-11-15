import { router, Stack } from 'expo-router';
import { FlatList, RefreshControl, View } from 'react-native';
import { QuotaCard } from '../components/QuotaCard';
import { RequireAuth } from '../components/RequireAuth';
import { ConsultationStatusBadge } from '../components/StatusBadge';
import { AppText, Button, Card, EmptyView, ErrorView, LoadingView } from '../components/ui';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { supabase } from '../lib/supabase';
import type { Consultation, Quota } from '../lib/types';
import { must, useAsync } from '../lib/useAsync';

function MyConsultations() {
  const { t, colors, lang } = usePrefs();
  const { session } = useAuth();
  const q = useAsync(async () => {
    const [list, quota] = await Promise.all([
      supabase.from('consultations').select('*').eq('user_id', session!.user.id).order('updated_at', { ascending: false }),
      supabase.rpc('my_consultation_quota'),
    ]);
    return { list: must(list) as Consultation[], quota: (must(quota) as Quota[])[0] };
  });
  if (q.loading) return <LoadingView />;
  if (q.error && !q.data) return <ErrorView error={q.error} onRetry={q.reload} />;
  const { list, quota } = q.data!;
  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={list}
      keyExtractor={(c) => c.id}
      refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.accent} />}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <QuotaCard quota={quota} />
          <Button
            title={t('newConsultation')}
            icon="add"
            variant="accent"
            disabled={quota.remaining <= 0 || !quota.enabled}
            onPress={() => router.push('/consultation/new')}
          />
        </View>
      }
      ListEmptyComponent={<EmptyView icon="chatbubbles-outline" text={t('noConsultations')} />}
      renderItem={({ item: c }) => (
        <Card onPress={() => router.push(`/consultation/${c.id}`)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText muted size={12}>{t(`spec_${c.specialty}`)}</AppText>
            <ConsultationStatusBadge status={c.status} />
          </View>
          <AppText weight="bold" size={16}>{c.subject}</AppText>
          <AppText muted size={12}>{formatDate(c.updated_at, lang, true)}</AppText>
        </Card>
      )}
    />
  );
}

export default function Consultations() {
  const { t } = usePrefs();
  return (
    <>
      <Stack.Screen options={{ title: t('myConsultations') }} />
      <RequireAuth>
        <MyConsultations />
      </RequireAuth>
    </>
  );
}
