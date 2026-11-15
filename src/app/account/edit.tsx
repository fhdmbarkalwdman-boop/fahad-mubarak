import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { RequireAuth } from '../../components/RequireAuth';
import { Avatar, Banner, Button, Field, Screen } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errorKey } from '../../lib/errors';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';
import { pickImages, publicImageUpload } from '../../lib/upload';

function EditProfileForm() {
  const { t } = usePrefs();
  const { profile, session, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar_url ?? null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uid = session!.user.id;

  const changeAvatar = async () => {
    const [file] = await pickImages(false);
    if (!file) return;
    setUploading(true);
    try {
      setAvatar(await publicImageUpload('avatars', uid, file));
    } catch (e) {
      Alert.alert(t('error'), t(errorKey(e)));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setError(null);
    if (name.trim().length < 2) return setError(t('nameRequired'));
    setBusy(true);
    const { error: e } = await supabase
      .from('profiles')
      .update({ full_name: name.trim(), phone: phone.trim() || null, avatar_url: avatar })
      .eq('id', uid);
    setBusy(false);
    if (e) return setError(t(errorKey(e)));
    await refreshProfile();
    router.back();
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 10 }}>
        {avatar ? <Image source={{ uri: avatar }} style={{ width: 96, height: 96, borderRadius: 48 }} /> : <Avatar name={name || '?'} size={96} />}
        <Button small variant="secondary" icon="camera-outline" title={t('changeAvatar')} onPress={changeAvatar} loading={uploading} />
      </View>
      <Field label={t('fullName')} value={name} onChangeText={setName} maxLength={80} />
      <Field label={t('email')} value={session?.user.email ?? ''} editable={false} />
      <Field label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" optional maxLength={20} />
      {error ? <Banner tone="danger" text={error} /> : null}
      <Button title={t('save')} onPress={save} loading={busy} icon="checkmark" />
    </Screen>
  );
}

export default function EditProfile() {
  const { t } = usePrefs();
  return (
    <>
      <Stack.Screen options={{ title: t('editProfile') }} />
      <RequireAuth>
        <EditProfileForm />
      </RequireAuth>
    </>
  );
}
