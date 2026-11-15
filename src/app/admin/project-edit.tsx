import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { AppText, Banner, Button, Card, ChipGroup, ErrorView, Field, LoadingView, Screen, ToggleRow } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import { isUrl, splitList } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';
import { PORTFOLIO_STATUSES, type PortfolioStatus, type Project } from '../../lib/types';
import { pickImages, publicImageUpload } from '../../lib/upload';
import { must, useAsync } from '../../lib/useAsync';

type Form = {
  title: string; title_en: string; summary: string; summary_en: string;
  description: string; description_en: string; idea: string; idea_en: string;
  category: string; technologies: string; status: PortfolioStatus; link: string;
  cover_url: string | null; gallery: string[]; is_published: boolean; is_featured: boolean; sort_order: string;
};

const empty: Form = {
  title: '', title_en: '', summary: '', summary_en: '', description: '', description_en: '', idea: '', idea_en: '',
  category: '', technologies: '', status: 'completed', link: '', cover_url: null, gallery: [], is_published: false, is_featured: false, sort_order: '0',
};

const toForm = (p: Project): Form => ({ ...p, technologies: p.technologies.join(', '), link: p.link ?? '', sort_order: String(p.sort_order) });

export default function ProjectEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useAsync(async () => (id ? (must(await supabase.from('projects').select('*').eq('id', id).single()) as Project) : null), [id], { refetchOnFocus: false });
  if (q.loading) return <LoadingView />;
  if (q.error) return <ErrorView error={q.error} onRetry={q.reload} />;
  return <ProjectForm key={id ?? 'new'} id={id} initial={q.data ? toForm(q.data) : empty} />;
}

function ProjectForm({ id, initial }: { id?: string; initial: Form }) {
  const { t, colors } = usePrefs();
  const [f, setF] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  const upload = async (target: 'cover' | 'gallery') => {
    const files = await pickImages(target === 'gallery');
    if (!files.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) urls.push(await publicImageUpload('public-media', 'projects', file));
      if (target === 'cover') set('cover_url', urls[0]);
      else set('gallery', [...f.gallery, ...urls].slice(0, 12));
    } catch (e) {
      Alert.alert(t('error'), t(errorKey(e)));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setError(null);
    if (f.title.trim().length < 2) return setError(`${t('title')}: ${t('required')}`);
    if (f.link.trim() && !isUrl(f.link)) return setError(`${t('link')}: https://`);
    setBusy(true);
    const row = {
      title: f.title.trim(), title_en: f.title_en.trim(), summary: f.summary.trim(), summary_en: f.summary_en.trim(),
      description: f.description.trim(), description_en: f.description_en.trim(), idea: f.idea.trim(), idea_en: f.idea_en.trim(),
      category: f.category.trim(), technologies: splitList(f.technologies), status: f.status, link: f.link.trim() || null,
      cover_url: f.cover_url, gallery: f.gallery, is_published: f.is_published, is_featured: f.is_featured,
      sort_order: Number.parseInt(f.sort_order, 10) || 0,
    };
    const { error: e } = id ? await supabase.from('projects').update(row).eq('id', id) : await supabase.from('projects').insert(row);
    setBusy(false);
    if (e) return setError(t(errorKey(e)));
    router.back();
  };

  const remove = () =>
    Alert.alert(t('delete'), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          const { error: e } = await supabase.from('projects').delete().eq('id', id!);
          if (e) Alert.alert(t('error'), t(errorKey(e)));
          else router.back();
        },
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: id ? t('edit') : t('newProject') }} />
      <Screen>
        <Card style={{ gap: 12 }}>
          <AppText weight="bold">{t('coverImage')}</AppText>
          {f.cover_url ? <Image source={{ uri: f.cover_url }} style={{ width: '100%', height: 160, borderRadius: 12 }} contentFit="cover" /> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button small variant="secondary" icon="image-outline" title={t('coverImage')} onPress={() => upload('cover')} loading={uploading} />
            {f.cover_url ? <Button small variant="ghost" title={t('removeImage')} onPress={() => set('cover_url', null)} /> : null}
          </View>
        </Card>

        <Card style={{ gap: 12 }}>
          <Field label={t('title')} value={f.title} onChangeText={(v) => set('title', v)} maxLength={120} />
          <Field label={t('titleEn')} value={f.title_en} onChangeText={(v) => set('title_en', v)} optional maxLength={120} />
          <Field label={t('summary')} value={f.summary} onChangeText={(v) => set('summary', v)} optional maxLength={300} />
          <Field label={t('summaryEn')} value={f.summary_en} onChangeText={(v) => set('summary_en', v)} optional maxLength={300} />
          <Field label={t('idea')} value={f.idea} onChangeText={(v) => set('idea', v)} optional multiline maxLength={3000} />
          <Field label={t('ideaEn')} value={f.idea_en} onChangeText={(v) => set('idea_en', v)} optional multiline maxLength={3000} />
          <Field label={t('description')} value={f.description} onChangeText={(v) => set('description', v)} optional multiline maxLength={8000} />
          <Field label={t('descriptionEn')} value={f.description_en} onChangeText={(v) => set('description_en', v)} optional multiline maxLength={8000} />
          <Field label={t('category')} value={f.category} onChangeText={(v) => set('category', v)} optional maxLength={60} />
          <Field label={t('technologies')} value={f.technologies} onChangeText={(v) => set('technologies', v)} optional hint={t('techCommaHint')} />
          <ChipGroup<PortfolioStatus> label={t('status')} value={f.status} onChange={(v) => set('status', v)} options={PORTFOLIO_STATUSES.map((s) => ({ value: s, label: t(`pstatus_${s}`) }))} />
          <Field label={t('link')} value={f.link} onChangeText={(v) => set('link', v)} optional autoCapitalize="none" keyboardType="url" placeholder="https://" />
          <Field label={t('sortOrder')} value={f.sort_order} onChangeText={(v) => set('sort_order', v)} keyboardType="number-pad" />
        </Card>

        <Card style={{ gap: 10 }}>
          <AppText weight="bold">{t('galleryImages')}</AppText>
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
            {f.gallery.map((uri) => (
              <View key={uri}>
                <Image source={{ uri }} style={{ width: 110, height: 80, borderRadius: 10 }} contentFit="cover" />
                <Pressable onPress={() => set('gallery', f.gallery.filter((g) => g !== uri))} style={{ position: 'absolute', top: 4, end: 4 }} accessibilityLabel={t('removeImage')}>
                  <Ionicons name="close-circle" size={22} color="#fff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
          <Button small variant="secondary" icon="images-outline" title={t('add')} onPress={() => upload('gallery')} loading={uploading} style={{ alignSelf: 'flex-start' }} />
        </Card>

        <Card>
          <ToggleRow label={t('published')} hint={t('visibleToPublic')} value={f.is_published} onChange={(v) => set('is_published', v)} />
          <ToggleRow label={t('featuredToggle')} value={f.is_featured} onChange={(v) => set('is_featured', v)} />
        </Card>

        {error ? <Banner tone="danger" text={error} /> : null}
        <Button title={t('save')} icon="checkmark" onPress={save} loading={busy} disabled={uploading} />
        {id ? <Button title={t('delete')} icon="trash-outline" variant="ghost" onPress={remove} style={{ borderColor: colors.danger }} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
