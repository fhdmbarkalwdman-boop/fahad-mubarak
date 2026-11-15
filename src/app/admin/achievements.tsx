import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { AppText, Badge, Banner, Button, Card, EmptyView, ErrorView, Field, LoadingView, Screen, ToggleRow } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import { formatDate, isUrl } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';
import type { Achievement } from '../../lib/types';
import { must, useAsync } from '../../lib/useAsync';

type Draft = { id?: string; title: string; title_en: string; description: string; description_en: string; achieved_on: string; link: string; is_published: boolean; sort_order: string };
const blank: Draft = { title: '', title_en: '', description: '', description_en: '', achieved_on: '', link: '', is_published: true, sort_order: '0' };

export default function AdminAchievements() {
  const { t, colors, lang } = usePrefs();
  const q = useAsync(async () => must(await supabase.from('achievements').select('*').order('sort_order').order('created_at', { ascending: false })) as Achievement[]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!draft) return;
    setError(null);
    if (draft.title.trim().length < 2) return setError(`${t('title')}: ${t('required')}`);
    if (draft.achieved_on && !/^\d{4}-\d{2}-\d{2}$/.test(draft.achieved_on)) return setError(`${t('date')}: YYYY-MM-DD`);
    if (draft.link && !isUrl(draft.link)) return setError(`${t('link')}: https://`);
    setBusy(true);
    const row = {
      title: draft.title.trim(), title_en: draft.title_en.trim(), description: draft.description.trim(), description_en: draft.description_en.trim(),
      achieved_on: draft.achieved_on || null, link: draft.link.trim() || null, is_published: draft.is_published, sort_order: Number.parseInt(draft.sort_order, 10) || 0,
    };
    const { error: e } = draft.id ? await supabase.from('achievements').update(row).eq('id', draft.id) : await supabase.from('achievements').insert(row);
    setBusy(false);
    if (e) return setError(t(errorKey(e)));
    setDraft(null);
    q.silentReload();
  };

  const remove = (id: string) =>
    Alert.alert(t('delete'), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        const { error: e } = await supabase.from('achievements').delete().eq('id', id);
        if (e) Alert.alert(t('error'), t(errorKey(e)));
        setDraft(null);
        q.silentReload();
      } },
    ]);

  if (q.loading) return <LoadingView />;
  if (q.error) return <ErrorView error={q.error} onRetry={q.reload} />;

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Stack.Screen options={{ title: t('manageAchievements') }} />
      {draft ? (
        <Card style={{ gap: 12 }}>
          <Field label={t('title')} value={draft.title} onChangeText={(v) => setDraft({ ...draft, title: v })} maxLength={160} />
          <Field label={t('titleEn')} value={draft.title_en} onChangeText={(v) => setDraft({ ...draft, title_en: v })} optional maxLength={160} />
          <Field label={t('description')} value={draft.description} onChangeText={(v) => setDraft({ ...draft, description: v })} optional multiline maxLength={1000} />
          <Field label={t('descriptionEn')} value={draft.description_en} onChangeText={(v) => setDraft({ ...draft, description_en: v })} optional multiline maxLength={1000} />
          <Field label={t('date')} value={draft.achieved_on} onChangeText={(v) => setDraft({ ...draft, achieved_on: v })} optional placeholder="YYYY-MM-DD" />
          <Field label={t('link')} value={draft.link} onChangeText={(v) => setDraft({ ...draft, link: v })} optional autoCapitalize="none" placeholder="https://" />
          <Field label={t('sortOrder')} value={draft.sort_order} onChangeText={(v) => setDraft({ ...draft, sort_order: v })} keyboardType="number-pad" />
          <ToggleRow label={t('published')} value={draft.is_published} onChange={(v) => setDraft({ ...draft, is_published: v })} />
          {error ? <Banner tone="danger" text={error} /> : null}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button small title={t('save')} icon="checkmark" onPress={save} loading={busy} />
            <Button small variant="ghost" title={t('cancel')} onPress={() => setDraft(null)} />
            {draft.id ? <Button small variant="danger" title={t('delete')} icon="trash-outline" onPress={() => remove(draft.id!)} /> : null}
          </View>
        </Card>
      ) : (
        <Button title={t('add')} icon="add" variant="accent" onPress={() => setDraft(blank)} />
      )}
      {(q.data ?? []).length === 0 ? <EmptyView text={t('noAchievementsYet')} /> : null}
      {(q.data ?? []).map((a) => (
        <Card key={a.id} onPress={() => setDraft({ id: a.id, title: a.title, title_en: a.title_en, description: a.description, description_en: a.description_en, achieved_on: a.achieved_on ?? '', link: a.link ?? '', is_published: a.is_published, sort_order: String(a.sort_order) })}>
          <Badge label={a.is_published ? t('published') : t('draft')} color={a.is_published ? colors.success : colors.textMuted} />
          <AppText weight="bold">{a.title}</AppText>
          {a.achieved_on ? <AppText muted size={12}>{formatDate(a.achieved_on, lang)}</AppText> : null}
        </Card>
      ))}
    </Screen>
  );
}
