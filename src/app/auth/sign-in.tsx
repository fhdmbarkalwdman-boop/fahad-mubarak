import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { LogoLockup } from '../../components/Logo';
import { AppText, Banner, Button, Field, Screen } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import { isEmail } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';

export default function SignIn() {
  const { t, colors } = usePrefs();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!isEmail(email)) return setError(t('invalidEmail'));
    if (!password) return setError(t('passwordTooShort'));
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (e) return setError(t(errorKey(e)));
    if (next && next.startsWith('/')) router.replace(next as never);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t('signIn') }} />
      <Screen>
        <View style={{ alignItems: 'center', marginVertical: 20 }}>
          <LogoLockup size={60} />
          <AppText muted style={{ marginTop: 12 }}>{t('tagline')}</AppText>
        </View>
        {next ? <Banner text={t('signInToContinue')} /> : null}
        <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
        <Field label={t('password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
        {error ? <Banner tone="danger" text={error} /> : null}
        <Button title={t('signIn')} onPress={submit} loading={busy} icon="log-in-outline" />
        <Pressable onPress={() => router.push('/auth/forgot-password')} style={{ alignSelf: 'center', padding: 6 }}>
          <AppText weight="semibold" style={{ color: colors.accent }}>{t('forgotPassword')}</AppText>
        </Pressable>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          <AppText muted>{t('noAccount')}</AppText>
          <Pressable onPress={() => router.replace({ pathname: '/auth/sign-up', params: next ? { next } : {} })}>
            <AppText weight="semibold" style={{ color: colors.accent }}>{t('signUp')}</AppText>
          </Pressable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
