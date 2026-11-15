import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { AppText, Banner, Button, Card, ErrorView, Field, LoadingView, Screen } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import { isEmail, isUrl, splitList } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { fetchOwnerProfile } from '../../lib/queries';
import { supabase } from '../../lib/supabase';
import type { OwnerProfile, SocialLink } from '../../lib/types';
import { pickImages, publicImageUpload } from '../../lib/upload';
import { useAsync } from '../../lib/useAsync';

export default function OwnerProfileEditor() {
  const q = useAsync(fetchOwnerProfile, [], { refetchOnFocus: false });
  if (q.loading) return <LoadingView />;
  if (q.error || !q.data) return <ErrorView error={q.error} onRetry={q.reload} />;
  return <ProfileForm p={q.data} />;
}

function ProfileForm({ p }: { p: OwnerProfile }) {
  const { t, colors } = usePrefs();
  const [f, setF] = useState({
    full_name: p.full_name, full_name_en: p.full_name_en, headline: p.headline, headline_en: p.headline_en, bio: p.bio, bio_en: p.bio_en,
    interests: p.interests.join(', '), skills: p.skills.join(', '), programming_areas: p.programming_areas.join(', '),
    contact_email: p.contact_email ?? '', avatar_url: p.avatar_url as string | null,
  });
  const [links, setLinks] = useState<SocialLink[]>(p.social_links ?? []);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof f, v: string | null) => setF((s) => ({ ...s, [k]: v }));

  const changeAvatar = async () => {
    const [file] = await pickImages(false);
    if (!file) return;
    setUploading(true);
    try {
      set('avatar_url', await publicImageUpload('public-media', 'owner', file));
    } catch (e) {
      Alert.alert(t('error'), t(errorKey(e)));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setError(null);
    if (f.full_name.trim().length < 2) return setError(t('nameRequired'));
    if (f.contact_email.trim() && !isEmail(f.contact_email)) return setError(t('invalidEmail'));
    const cleanLinks = links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })).filter((l) => l.url);
    if (cleanLinks.some((l) => !isUrl(l.url))) return setError(`${t('socialLinks')}: https://`);
    setBusy(true);
    const { error: e } = await supabase.from('owner_profile').update({
      full_name: f.full_name.trim(), full_name_en: f.full_name_en.trim(), headline: f.headline.trim(), headline_en: f.headline_en.trim(),
      bio: f.bio.trim(), bio_en: f.bio_en.trim(), interests: splitList(f.interests), skills: splitList(f.skills),
      programming_areas: splitList(f.programming_areas), contact_email: f.contact_email.trim() || null,
      avatar_url: f.avatar_url, social_links: cleanLinks,
    }).eq('id', 1);
    setBusy(false);
    if (e) return setError(t(errorKey(e)));
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t('editOwnerProfile') }} />
      <Screen>
        <Card style={{ alignItems: 'center', gap: 10 }}>
          {f.avatar_url ? <Image source={{ uri: f.avatar_url }} style={{ width: 96, height: 96, borderRadius: 48 }} /> : <Ionicons name="person-circle-outline" size={96} color={colors.textMuted} />}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button small variant="secondary" icon="camera-outline" title={t('avatar')} onPress={changeAvatar} loading={uploading} />
            {f.avatar_url ? <Button small variant="ghost" title={t('removeImage')} onPress={() => set('avatar_url', null)} /> : null}
          </View>
        </Card>
        <Card style={{ gap: 12 }}>
          <Field label={t('fullName')} value={f.full_name} onChangeText={(v) => set('full_name', v)} maxLength={80} />
          <Field label={t('nameEn')} value={f.full_name_en} onChangeText={(v) => set('full_name_en', v)} maxLength={80} />
          <Field label={t('headline')} value={f.headline} onChangeText={(v) => set('headline', v)} optional maxLength={160} />
          <Field label={t('headlineEn')} value={f.headline_en} onChangeText={(v) => set('headline_en', v)} optional maxLength={160} />
          <Field label={t('bio')} value={f.bio} onChangeText={(v) => set('bio', v)} optional multiline maxLength={4000} />
          <Field label={t('bioEn')} value={f.bio_en} onChangeText={(v) => set('bio_en', v)} optional multiline maxLength={4000} />
        </Card>
        <Card style={{ gap: 12 }}>
          <Field label={t('interests')} value={f.interests} onChangeText={(v) => set('interests', v)} optional hint={t('techCommaHint')} />
          <Field label={t('skills')} value={f.skills} onChangeText={(v) => set('skills', v)} optional hint={t('techCommaHint')} />
          <Field label={t('programmingAreas')} value={f.programming_areas} onChangeText={(v) => set('programming_areas', v)} optional hint={t('techCommaHint')} />
          <Field label={t('contactEmail')} value={f.contact_email} onChangeText={(v) => set('contact_email', v)} optional autoCapitalize="none" keyboardType="email-address" />
        </Card>
        <Card style={{ gap: 10 }}>
          <AppText weight="bold">{t('socialLinks')}</AppText>
          {links.map((l, i) => (
            <View key={i} style={{ gap: 6, paddingBottom: 8, borderBottomWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field label={t('socialLabel')} value={l.label} onChangeText={(v) => setLinks(links.map((x, j) => (j === i ? { ...x, label: v } : x)))} maxLength={40} />
                </View>
                <Pressable onPress={() => setLinks(links.filter((_, j) => j !== i))} accessibilityLabel={t('delete')} style={{ paddingTop: 24 }}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
              <Field label={t('socialUrl')} value={l.url} onChangeText={(v) => setLinks(links.map((x, j) => (j === i ? { ...x, url: v } : x)))} autoCapitalize="none" keyboardType="url" />
            </View>
          ))}
          <Button small variant="secondary" icon="add" title={t('add')} onPress={() => setLinks([...links, { label: '', url: '' }])} style={{ alignSelf: 'flex-start' }} disabled={links.length >= 12} />
        </Card>
        {error ? <Banner tone="danger" text={error} /> : null}
        <Button title={t('save')} icon="checkmark" onPress={save} loading={busy} disabled={uploading} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
