import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { RequireAuth } from '../components/RequireAuth';
import { AppText, Button, EmptyView, ErrorView, LoadingView } from '../components/ui';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { routeForNotification } from '../lib/push';
import { supabase } from '../lib/supabase';
import type { AppNotification } from '../lib/types';
import { must, useAsync } from '../lib/useAsync';

function List() {
  const { t, colors, lang } = usePrefs();
  const { session } = useAuth();
  const uid = session!.user.id;
  const q = useAsync(async () =>
    must(await supabase.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(200)) as AppNotification[],
  );

  // live updates
  useEffect(() => {
    const ch = supabase
      .channel(`notifications:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, (payload) => {
        q.setData((prev) => [payload.new as AppNotification, ...(prev ?? [])]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    const now = new Date().toISOString();
    q.setData((prev) => (prev ?? []).map((n) => (ids.includes(n.id) ? { ...n, read_at: now } : n)));
    await supabase.from('notifications').update({ read_at: now }).in('id', ids);
  };

  if (q.loading) return <LoadingView />;
  if (q.error && !q.data) return <ErrorView error={q.error} onRetry={q.reload} />;
  const unread = (q.data ?? []).filter((n) => !n.read_at).map((n) => n.id);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={q.data}
      keyExtractor={(n) => n.id}
      refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.accent} />}
      ListHeaderComponent={unread.length ? <Button small variant="secondary" icon="checkmark-done" title={t('markAllRead')} onPress={() => markRead(unread)} style={{ alignSelf: 'flex-start' }} /> : undefined}
      ListEmptyComponent={<EmptyView icon="notifications-off-outline" text={t('noNotifications')} />}
      renderItem={({ item: n }) => (
        <Pressable
          onPress={() => {
            markRead(n.read_at ? [] : [n.id]);
            const to = routeForNotification(n.data);
            if (to !== '/notifications') router.push(to as never);
          }}
          style={({ pressed }) => ({
            flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16,
            backgroundColor: n.read_at ? colors.surface : colors.accentSoft,
            borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1,
          })}
        >
          <Ionicons name={n.type === 'broadcast' ? 'megaphone-outline' : n.type.includes('consultation') ? 'chatbubbles-outline' : 'rocket-outline'} size={22} color={colors.accent} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText weight={n.read_at ? 'medium' : 'bold'}>{n.title}</AppText>
            {n.body ? <AppText muted size={14}>{n.body}</AppText> : null}
            <AppText muted size={11}>{formatDate(n.created_at, lang, true)}</AppText>
          </View>
          {!n.read_at ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent, marginTop: 6 }} /> : null}
        </Pressable>
      )}
    />
  );
}

export default function Notifications() {
  const { t } = usePrefs();
  return (
    <>
      <Stack.Screen options={{ title: t('notifications') }} />
      <RequireAuth>
        <List />
      </RequireAuth>
    </>
  );
}
