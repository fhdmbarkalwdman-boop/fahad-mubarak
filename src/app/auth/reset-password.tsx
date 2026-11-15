import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppText, Banner, Button, Field, LoadingView, Screen } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';

/**
 * Landing screen for the recovery deep link (fahdar://auth/reset-password).
 * Handles both PKCE (?code=) and implicit (#access_token=) links, then lets
 * the user choose a new password. Also used as the success screen.
 */
export default function ResetPassword() {
  const { t } = usePrefs();
  const params = useLocalSearchParams<{ code?: string; access_token?: string; refresh_token?: string; done?: string }>();
  const [stage, setStage] = useState<'loading' | 'form' | 'done' | 'error'>(params.done ? 'done' : 'loading');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.done) return;
    (async () => {
      try {
        if (params.code) {
          const { error: e } = await supabase.auth.exchangeCodeForSession(params.code);
          if (e) throw e;
        } else if (params.access_token && params.refresh_token) {
          const { error: e } = await supabase.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token });
          if (e) throw e;
        }
        const { data } = await supabase.auth.getSession();
        setStage(data.session ? 'form' : 'error');
      } catch (e) {
        setError(t(errorKey(e)));
        setStage('error');
      }
    })();
  }, [params.code, params.access_token, params.refresh_token, params.done, t]);

  const save = async () => {
    setError(null);
    if (password.length < 8) return setError(t('passwordTooShort'));
    setBusy(true);
    const { error: e } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e) return setError(t(errorKey(e)));
    setStage('done');
  };

  if (stage === 'loading') return <LoadingView />;
  return (
    <Screen>
      <Stack.Screen options={{ title: t('resetPassword') }} />
      {stage === 'done' ? (
        <>
          <Banner tone="success" text={t('resetDone')} />
          <Button title={t('tabHome')} onPress={() => router.replace('/')} />
        </>
      ) : stage === 'error' ? (
        <>
          <Banner tone="danger" text={error ?? t('errorGeneric')} />
          <Button title={t('resetPassword')} onPress={() => router.replace('/auth/forgot-password')} />
        </>
      ) : (
        <>
          <AppText weight="bold" size={20}>{t('newPassword')}</AppText>
          <Field label={t('newPassword')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
          {error ? <Banner tone="danger" text={error} /> : null}
          <Button title={t('save')} onPress={save} loading={busy} />
        </>
      )}
    </Screen>
  );
}
