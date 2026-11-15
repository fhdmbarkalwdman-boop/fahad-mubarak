import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, TextInput, View } from 'react-native';
import { AppText, Avatar, Badge, Button, Card, EmptyView, ErrorView, LoadingView } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';
import { fonts, radius } from '../../lib/theme';
import type { Profile } from '../../lib/types';
import { must, useAsync } from '../../lib/useAsync';

function UserCard({ u }: { u: Profile }) {
  const { t, colors, lang, isRTL } = usePrefs();
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const grant = async () => {
    const n = Number(extra);
    if (!Number.isInteger(n) || n < 0 || n > 100) return Alert.alert(t('err_validation'));
    setBusy(true);
    const { error } = await supabase.rpc('admin_grant_extra_consultations', { p_user_id: u.id, p_extra: n, p_note: '' });
    setBusy(false);
    if (error) Alert.alert(t('error'), t(errorKey(error)));
    else {
      setExtra('');
      Alert.alert(t('extraGranted'));
    }
  };
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Avatar name={u.full_name || u.email || '?'} />
        <View style={{ flex: 1 }}>
          <AppText weight="bold">{u.full_name || '—'}</AppText>
          <AppText muted size={13} selectable>{u.email}</AppText>
          <AppText muted size={12}>{t('joined', { date: formatDate(u.created_at, lang) })}</AppText>
        </View>
        {u.role === 'owner' ? <Badge label="owner" color={colors.accent} /> : null}
      </View>
      {u.role !== 'owner' ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextInput
            value={extra}
            onChangeText={setExtra}
            keyboardType="number-pad"
            placeholder="+0"
            placeholderTextColor={colors.textMuted}
            style={{ width: 64, height: 38, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, color: colors.text, fontFamily: fonts.regular, textAlign: isRTL ? 'right' : 'left', paddingHorizontal: 10 }}
          />
          <Button small variant="secondary" title={t('grantExtra')} onPress={grant} loading={busy} disabled={!extra} />
          <Button small variant="ghost" icon="notifications-outline" title={t('sendNotification')} onPress={() => router.push({ pathname: '/admin/broadcast', params: { userId: u.id, name: u.full_name || u.email || '' } })} />
        </View>
      ) : null}
    </Card>
  );
}

export default function AdminUsers() {
  const { t, colors, isRTL } = usePrefs();
  const [search, setSearch] = useState('');
  const q = useAsync(async () => must(await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(500)) as Profile[]);
  const list = (q.data ?? []).filter((u) => `${u.full_name} ${u.email}`.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <>
      <Stack.Screen options={{ title: t('users') }} />
      <FlatList
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        data={list}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('search')}
            placeholderTextColor={colors.textMuted}
            style={{ height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontFamily: fonts.regular, paddingHorizontal: 14, textAlign: isRTL ? 'right' : 'left' }}
          />
        }
        ListEmptyComponent={q.loading ? <LoadingView /> : q.error ? <ErrorView error={q.error} onRetry={q.reload} /> : <EmptyView text={t('emptyList')} />}
        renderItem={({ item }) => <UserCard u={item} />}
      />
    </>
  );
}
