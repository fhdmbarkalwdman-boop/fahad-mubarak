import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { ConsultationStatusBadge } from '../../components/StatusBadge';
import { AppText, Card, Chip, EmptyView, ErrorView, LoadingView } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';
import type { Consultation, ConsultationStatus } from '../../lib/types';
import { must, useAsync } from '../../lib/useAsync';

const STATUSES: ConsultationStatus[] = ['open', 'answered', 'closed'];

export default function AdminConsultations() {
  const { t, colors, lang } = usePrefs();
  const [status, setStatus] = useState<ConsultationStatus | null>('open');
  const q = useAsync(async () => {
    let query = supabase.from('consultations').select('*').order('updated_at', { ascending: false }).limit(300);
    if (status) query = query.eq('status', status);
    return must(await query) as Consultation[];
  }, [status]);

  return (
    <>
      <Stack.Screen options={{ title: t('manageConsultations') }} />
      <FlatList
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        data={q.data ?? []}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label={t('all')} selected={!status} onPress={() => setStatus(null)} />
            {STATUSES.map((s) => <Chip key={s} label={t(`cstatus_${s}`)} selected={status === s} onPress={() => setStatus(s)} />)}
          </ScrollView>
        }
        ListEmptyComponent={q.loading ? <LoadingView /> : q.error ? <ErrorView error={q.error} onRetry={q.reload} /> : <EmptyView text={t('emptyList')} />}
        renderItem={({ item: c }) => (
          <Card onPress={() => router.push(`/consultation/${c.id}`)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText muted size={12}>{t(`spec_${c.specialty}`)}</AppText>
              <ConsultationStatusBadge status={c.status} />
            </View>
            <AppText weight="bold" size={16}>{c.subject}</AppText>
            <AppText muted size={12}>
              {formatDate(c.updated_at, lang, true)} • {t('messagesRemaining', { n: Math.max(c.message_limit - c.user_message_count, 0), total: c.message_limit })}
            </AppText>
          </Card>
        )}
      />
    </>
  );
}
