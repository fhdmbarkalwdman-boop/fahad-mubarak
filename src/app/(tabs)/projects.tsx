import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { ProjectCard } from '../../components/ProjectCard';
import { Chip, EmptyView, ErrorView, LoadingView } from '../../components/ui';
import { usePrefs } from '../../lib/prefs';
import { fetchPublishedProjects } from '../../lib/queries';
import { fonts, radius } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

export default function Projects() {
  const { t, colors, isRTL } = usePrefs();
  const q = useAsync(() => fetchPublishedProjects());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set((q.data ?? []).map((p) => p.category).filter(Boolean))).sort(),
    [q.data],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (q.data ?? []).filter((p) => {
      if (category && p.category !== category) return false;
      if (!needle) return true;
      return [p.title, p.title_en, p.summary, p.summary_en, p.description, p.description_en, p.category, ...p.technologies]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [q.data, query, category]);

  if (q.loading) return <LoadingView />;
  if (q.error && !q.data) return <ErrorView error={q.error} onRetry={q.reload} />;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      data={filtered}
      keyExtractor={(p) => p.id}
      refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.accent} />}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('searchProjects')}
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              style={{ flex: 1, height: 48, fontFamily: fonts.regular, fontSize: 15, color: colors.text, textAlign: isRTL ? 'right' : 'left' }}
            />
          </View>
          {categories.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Chip label={t('all')} selected={!category} onPress={() => setCategory(null)} />
              {categories.map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}
            </ScrollView>
          ) : null}
        </View>
      }
      renderItem={({ item }) => <ProjectCard project={item} />}
      ListEmptyComponent={<EmptyView icon="grid-outline" text={q.data?.length ? t('noResults') : t('noProjectsYet')} />}
    />
  );
}
