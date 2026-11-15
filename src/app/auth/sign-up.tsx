import * as Linking from 'expo-linking';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { LogoLockup } from '../../components/Logo';
import { AppText, Banner, Button, Field, Screen } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import { isEmail } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';

export default function SignUp() {
  const { t, colors, lang } = usePrefs();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) return setError(t('nameRequired'));
    if (!isEmail(email)) return setError(t('invalidEmail'));
    if (password.length < 8) return setError(t('passwordTooShort'));
    if (password !== confirm) return setError(t('passwordsMismatch'));
    setBusy(true);
    const { data, error: e } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim(), locale: lang }, emailRedirectTo: Linking.createURL('/auth/sign-in') },
    });
    setBusy(false);
    if (e) return setError(t(errorKey(e)));
    if (data.session) {
      if (next && next.startsWith('/')) router.replace(next as never);
      else router.replace('/');
    } else {
      setDone(true);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t('signUp') }} />
      <Screen>
        <View style={{ alignItems: 'center', marginVertical: 12 }}>
          <LogoLockup size={52} />
        </View>
        {done ? (
          <>
            <Banner tone="success" text={t('checkEmailConfirm')} />
            <Button title={t('signIn')} onPress={() => router.replace('/auth/sign-in')} />
          </>
        ) : (
          <>
            <Field label={t('fullName')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" maxLength={80} />
            <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Field label={t('password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint={t('passwordTooShort')} />
            <Field label={t('confirmPassword')} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
            {error ? <Banner tone="danger" text={error} /> : null}
            <Button title={t('signUp')} onPress={submit} loading={busy} icon="person-add-outline" />
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
              <AppText muted>{t('haveAccount')}</AppText>
              <Pressable onPress={() => router.replace('/auth/sign-in')}>
                <AppText weight="semibold" style={{ color: colors.accent }}>{t('signIn')}</AppText>
              </Pressable>
            </View>
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
