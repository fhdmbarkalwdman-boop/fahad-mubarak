import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { LogoMark } from '../../components/Logo';
import { AppText, Avatar, Button, Card, Divider, ListRow, Screen } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { formatDate } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { unregisterPush } from '../../lib/push';
import { unreadCount } from '../../lib/queries';

function PrefsCard() {
  const { t, lang, themePref } = usePrefs();
  return (
    <Card style={{ paddingVertical: 4 }}>
      <ListRow icon="language-outline" label={t('language')} value={lang === 'ar' ? t('arabic') : t('english')} onPress={() => router.push('/account/settings')} />
      <Divider />
      <ListRow
        icon="contrast-outline"
        label={t('appearance')}
        value={themePref === 'system' ? t('themeSystem') : themePref === 'dark' ? t('themeDark') : t('themeLight')}
        onPress={() => router.push('/account/settings')}
      />
    </Card>
  );
}

export default function Account() {
  const { t, lang } = usePrefs();
  const { session, profile, isOwner, signOut } = useAuth();
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);

  const uid = session?.user.id;
  useFocusEffect(
    useCallback(() => {
      if (uid) unreadCount(uid).then(setUnread).catch(() => undefined);
    }, [uid]),
  );

  if (!session) {
    return (
      <Screen>
        <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
          <LogoMark size={72} />
          <AppText weight="bold" size={20}>{t('guestTitle')}</AppText>
          <AppText muted style={{ textAlign: 'center' }}>{t('guestBody')}</AppText>
          <Button title={t('signIn')} icon="log-in-outline" onPress={() => router.push('/auth/sign-in')} style={{ alignSelf: 'stretch' }} />
          <Button title={t('signUp')} variant="secondary" icon="person-add-outline" onPress={() => router.push('/auth/sign-up')} style={{ alignSelf: 'stretch' }} />
        </Card>
        <PrefsCard />
      </Screen>
    );
  }

  const displayName = profile?.full_name || session.user.email || '';

  return (
    <Screen>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }} onPress={() => router.push('/account/edit')}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={{ width: 56, height: 56, borderRadius: 28 }} />
        ) : (
          <Avatar name={displayName} size={56} />
        )}
        <View style={{ flex: 1 }}>
          <AppText weight="bold" size={17} numberOfLines={1}>{displayName}</AppText>
          <AppText muted size={13} numberOfLines={1}>{session.user.email}</AppText>
          {profile ? <AppText muted size={12}>{t('memberSince', { date: formatDate(profile.created_at, lang) })}</AppText> : null}
        </View>
      </Card>

      {isOwner ? (
        <Button title={t('adminPanel')} icon="speedometer-outline" variant="accent" onPress={() => router.push('/admin')} />
      ) : null}

      <Card style={{ paddingVertical: 4 }}>
        <ListRow icon="rocket-outline" label={t('myRequests')} onPress={() => router.push('/requests')} />
        <Divider />
        <ListRow icon="chatbubbles-outline" label={t('myConsultations')} onPress={() => router.push('/consultations')} />
        <Divider />
        <ListRow icon="notifications-outline" label={t('notifications')} badge={unread} onPress={() => router.push('/notifications')} />
      </Card>

      <Card style={{ paddingVertical: 4 }}>
        <ListRow icon="create-outline" label={t('editProfile')} onPress={() => router.push('/account/edit')} />
        <Divider />
        <ListRow icon="settings-outline" label={t('settings')} onPress={() => router.push('/account/settings')} />
      </Card>

      <Button
        title={t('signOut')}
        variant="ghost"
        icon="log-out-outline"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          await unregisterPush().catch(() => undefined);
          await signOut();
          setBusy(false);
        }}
      />
    </Screen>
  );
}
