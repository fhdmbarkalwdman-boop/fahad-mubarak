import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { AppText, Banner, Button, Card, ChipGroup, Field, Screen } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errorKey } from '../../lib/errors';
import { usePrefs, type ThemePref } from '../../lib/prefs';
import { registerForPush, unregisterPush, type PushResult } from '../../lib/push';
import type { Lang } from '../../lib/strings';
import { supabase } from '../../lib/supabase';

export default function Settings() {
  const { t, lang, setLang, themePref, setThemePref } = usePrefs();
  const { session, isOwner, signOut } = useAuth();
  const [push, setPush] = useState<PushResult | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const changeLang = async (next: Lang) => {
    if (next === lang) return;
    if (session) await supabase.from('profiles').update({ locale: next }).eq('id', session.user.id);
    Alert.alert(t('language'), t('languageRestart'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), onPress: () => setLang(next) },
    ]);
  };

  const enablePush = async () => {
    setPushBusy(true);
    setPush(await registerForPush(true));
    setPushBusy(false);
  };

  const deleteAccount = async () => {
    setDeleting(true);
    const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
    setDeleting(false);
    if (error) {
      let msg = t(errorKey(error));
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.error) msg = t(errorKey(body.error));
      } catch {
        // keep generic message
      }
      return Alert.alert(t('error'), msg);
    }
    await unregisterPush().catch(() => undefined);
    await signOut();
    Alert.alert(t('accountDeleted'));
    router.replace('/');
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('settings') }} />
      <Card style={{ gap: 14 }}>
        <ChipGroup<Lang>
          label={t('language')}
          value={lang}
          onChange={changeLang}
          options={[{ value: 'ar', label: t('arabic') }, { value: 'en', label: t('english') }]}
        />
        <ChipGroup<ThemePref>
          label={t('appearance')}
          value={themePref}
          onChange={setThemePref}
          options={[
            { value: 'system', label: t('themeSystem') },
            { value: 'light', label: t('themeLight') },
            { value: 'dark', label: t('themeDark') },
          ]}
        />
      </Card>

      {session ? (
        <Card>
          <AppText weight="bold" size={16}>{t('pushNotifications')}</AppText>
          {push === 'enabled' ? <Banner tone="success" text={t('pushEnabled')} /> : null}
          {push === 'denied' ? <Banner tone="warning" text={t('pushDenied')} /> : null}
          {push === 'unavailable' ? <Banner text={t('pushUnavailable')} /> : null}
          {push === 'error' ? <Banner tone="danger" text={t('errorGeneric')} /> : null}
          <Button title={t('enablePush')} icon="notifications-outline" variant="secondary" onPress={enablePush} loading={pushBusy} />
        </Card>
      ) : null}

      {session && !isOwner ? (
        <Card>
          <AppText weight="bold" size={16} style={{ color: '#D64545' }}>{t('deleteAccount')}</AppText>
          <AppText muted size={14}>{t('deleteAccountWarn')}</AppText>
          <Field label={t('deleteAccountConfirm')} value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" />
          <Button title={t('deleteAccount')} variant="danger" icon="trash-outline" disabled={confirmText !== 'DELETE'} loading={deleting} onPress={deleteAccount} />
        </Card>
      ) : null}
      {isOwner ? <Banner text={t('ownerCannotDelete')} /> : null}

      <View style={{ alignItems: 'center' }}>
        <AppText muted size={12}>FAHDAR • {t('version')} {Constants.expoConfig?.version ?? '1.0.0'}</AppText>
      </View>
    </Screen>
  );
}
