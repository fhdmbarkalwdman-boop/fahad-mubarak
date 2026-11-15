import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { AppText, Badge, Banner, Button, Card, EmptyView, ErrorView, Field, LoadingView, Screen, ToggleRow } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';
import type { SiteUpdate } from '../../lib/types';
import { must, useAsync } from '../../lib/useAsync';

type Draft = { id?: string; title: string; title_en: string; body: string; body_en: string; is_published: boolean };
const blank: Draft = { title: '', title_en: '', body: '', body_en: '', is_published: true };

export default function AdminUpdates() {
  const { t, colors, lang } = usePrefs();
  const q = useAsync(async () => must(await supabase.from('site_updates').select('*').order('created_at', { ascending: false })) as SiteUpdate[]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!draft) return;
    setError(null);
    if (draft.title.trim().length < 2) return setError(`${t('title')}: ${t('required')}`);
    setBusy(true);
    const row = { title: draft.title.trim(), title_en: draft.title_en.trim(), body: draft.body.trim(), body_en: draft.body_en.trim(), is_published: draft.is_published };
    const { error: e } = draft.id ? await supabase.from('site_updates').update(row).eq('id', draft.id) : await supabase.from('site_updates').insert(row);
    setBusy(false);
    if (e) return setError(t(errorKey(e)));
    setDraft(null);
    q.silentReload();
  };

  const remove = (id: string) =>
    Alert.alert(t('delete'), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        const { error: e } = await supabase.from('site_updates').delete().eq('id', id);
        if (e) Alert.alert(t('error'), t(errorKey(e)));
        setDraft(null);
        q.silentReload();
      } },
    ]);

  if (q.loading) return <LoadingView />;
  if (q.error) return <ErrorView error={q.error} onRetry={q.reload} />;

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Stack.Screen options={{ title: t('manageUpdates') }} />
      {draft ? (
        <Card style={{ gap: 12 }}>
          <Field label={t('title')} value={draft.title} onChangeText={(v) => setDraft({ ...draft, title: v })} maxLength={160} />
          <Field label={t('titleEn')} value={draft.title_en} onChangeText={(v) => setDraft({ ...draft, title_en: v })} optional maxLength={160} />
          <Field label={t('body')} value={draft.body} onChangeText={(v) => setDraft({ ...draft, body: v })} optional multiline maxLength={2000} />
          <Field label={t('bodyEn')} value={draft.body_en} onChangeText={(v) => setDraft({ ...draft, body_en: v })} optional multiline maxLength={2000} />
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
      {(q.data ?? []).length === 0 ? <EmptyView text={t('noUpdatesYet')} /> : null}
      {(q.data ?? []).map((u) => (
        <Card key={u.id} onPress={() => setDraft({ id: u.id, title: u.title, title_en: u.title_en, body: u.body, body_en: u.body_en, is_published: u.is_published })}>
          <Badge label={u.is_published ? t('published') : t('draft')} color={u.is_published ? colors.success : colors.textMuted} />
          <AppText weight="bold">{u.title}</AppText>
          <AppText muted size={12}>{formatDate(u.created_at, lang)}</AppText>
        </Card>
      ))}
    </Screen>
  );
}
