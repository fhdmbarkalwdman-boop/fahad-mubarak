import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { PortfolioStatusBadge } from '../../components/StatusBadge';
import { AppText, Button, Card, ErrorView, FadeIn, LoadingView, Screen, Tags } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';
import type { Project } from '../../lib/types';
import { must, useAsync } from '../../lib/useAsync';

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, pick, colors, lang } = usePrefs();
  const { width } = useWindowDimensions();
  const q = useAsync(async () => must(await supabase.from('projects').select('*').eq('id', id).single()) as Project, [id]);

  if (q.loading) return <LoadingView />;
  if (q.error || !q.data) return <ErrorView error={q.error} onRetry={q.reload} />;
  const p = q.data;
  const description = pick(p.description, p.description_en);
  const idea = pick(p.idea, p.idea_en);

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: pick(p.title, p.title_en) }} />
      {p.cover_url ? (
        <Image source={{ uri: p.cover_url }} style={{ width: '100%', height: 240 }} contentFit="cover" transition={300} />
      ) : (
        <LinearGradient colors={[colors.heroFrom, colors.heroTo]} style={{ height: 180, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="code-slash" size={48} color="#ffffff55" />
        </LinearGradient>
      )}
      <View style={{ padding: 16, gap: 16 }}>
        <FadeIn style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <PortfolioStatusBadge status={p.status} />
            {p.category ? <AppText muted size={13}>{p.category}</AppText> : null}
            <AppText muted size={13}>• {formatDate(p.created_at, lang)}</AppText>
          </View>
          <AppText weight="bold" size={24} style={{ lineHeight: 36 }}>{pick(p.title, p.title_en)}</AppText>
          {pick(p.summary, p.summary_en) ? <AppText muted>{pick(p.summary, p.summary_en)}</AppText> : null}
        </FadeIn>

        {p.link ? <Button title={t('visitProject')} icon="open-outline" variant="accent" onPress={() => WebBrowser.openBrowserAsync(p.link!)} /> : null}

        {idea ? (
          <Card>
            <AppText weight="bold" size={16}>{t('projectIdea')}</AppText>
            <AppText>{idea}</AppText>
          </Card>
        ) : null}
        {description ? (
          <Card>
            <AppText weight="bold" size={16}>{t('projectDescription')}</AppText>
            <AppText>{description}</AppText>
          </Card>
        ) : null}
        {p.technologies.length ? (
          <Card>
            <AppText weight="bold" size={16}>{t('technologies')}</AppText>
            <Tags items={p.technologies} />
          </Card>
        ) : null}
        {p.gallery.length ? (
          <View style={{ gap: 10 }}>
            <AppText weight="bold" size={16}>{t('gallery')}</AppText>
            <ScrollView horizontal pagingEnabled={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {p.gallery.map((uri) => (
                <Image key={uri} source={{ uri }} style={{ width: width * 0.75, height: width * 0.5, borderRadius: 16 }} contentFit="cover" transition={250} />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
