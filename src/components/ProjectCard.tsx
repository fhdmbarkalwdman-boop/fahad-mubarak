import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { View } from 'react-native';
import { usePrefs } from '../lib/prefs';
import type { Project } from '../lib/types';
import { PortfolioStatusBadge } from './StatusBadge';
import { AppText, Card } from './ui';

function Cover({ uri, height }: { uri: string | null; height: number }) {
  const { colors } = usePrefs();
  if (uri) return <Image source={{ uri }} style={{ width: '100%', height }} contentFit="cover" transition={250} />;
  return (
    <LinearGradient colors={[colors.heroFrom, colors.heroTo]} style={{ height, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="code-slash" size={36} color="#ffffff66" />
    </LinearGradient>
  );
}

export function ProjectCard({ project, compact }: { project: Project; compact?: boolean }) {
  const { pick, t, colors } = usePrefs();
  return (
    <Card
      onPress={() => router.push(`/project/${project.id}`)}
      style={{ padding: 0, overflow: 'hidden', width: compact ? 260 : undefined, gap: 0 }}
    >
      <Cover uri={project.cover_url} height={compact ? 130 : 170} />
      <View style={{ padding: 14, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <PortfolioStatusBadge status={project.status} />
          {project.is_featured ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="star" size={13} color={colors.warning} />
              <AppText size={12} muted>{t('featured')}</AppText>
            </View>
          ) : null}
          {project.category ? <AppText size={12} muted>• {project.category}</AppText> : null}
        </View>
        <AppText weight="bold" size={16} numberOfLines={1}>{pick(project.title, project.title_en)}</AppText>
        {pick(project.summary, project.summary_en) ? (
          <AppText muted size={13} numberOfLines={2}>{pick(project.summary, project.summary_en)}</AppText>
        ) : null}
      </View>
    </Card>
  );
}
