import * as Linking from 'expo-linking';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { AppText, Banner, Button, Field, Screen } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import { isEmail } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';

/**
 * Two-step recovery that works without deep-link setup:
 * 1) email a recovery message (contains a 6-digit {{ .Token }} and a link)
 * 2) verify the code, then set a new password.
 */
export default function ForgotPassword() {
  const { t } = usePrefs();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setError(null);
    if (!isEmail(email)) return setError(t('invalidEmail'));
    setBusy(true);
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('/auth/reset-password'),
    });
    setBusy(false);
    if (e) return setError(t(errorKey(e)));
    setStep('code');
  };

  const verify = async () => {
    setError(null);
    if (password.length < 8) return setError(t('passwordTooShort'));
    setBusy(true);
    const { error: e } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
    if (e) {
      setBusy(false);
      return setError(t(errorKey(e)));
    }
    const { error: e2 } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e2) return setError(t(errorKey(e2)));
    router.replace({ pathname: '/auth/reset-password', params: { done: '1' } });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t('resetPassword') }} />
      <Screen>
        <AppText weight="bold" size={20}>{t('resetPassword')}</AppText>
        {step === 'email' ? (
          <>
            <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            {error ? <Banner tone="danger" text={error} /> : null}
            <Button title={t('resetSend')} onPress={send} loading={busy} icon="mail-outline" />
          </>
        ) : (
          <>
            <Banner tone="success" text={t('resetSent')} />
            <Field label={t('resetCode')} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={10} autoComplete="one-time-code" textContentType="oneTimeCode" />
            <Field label={t('newPassword')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
            {error ? <Banner tone="danger" text={error} /> : null}
            <Button title={t('confirm')} onPress={verify} loading={busy} icon="key-outline" />
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
