import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoMark } from '../../components/Logo';
import { ProjectCard } from '../../components/ProjectCard';
import {
  AppText, Banner, Card, EmptyView, ErrorView, FadeIn, LoadingView, Screen, SectionHeader, Tags, type IconName,
} from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { formatDate } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { fetchAchievements, fetchOwnerProfile, fetchPublishedProjects, fetchSettings, fetchUpdates } from '../../lib/queries';
import { isConfigured } from '../../lib/supabase';
import { radius } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

function ActionTile({ icon, title, sub, onPress, accent }: { icon: IconName; title: string; sub: string; onPress: () => void; accent?: boolean }) {
  const { colors } = usePrefs();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, padding: 16, gap: 10, borderRadius: radius.lg,
        backgroundColor: accent ? colors.accent : colors.surface,
        borderWidth: accent ? 0 : 1, borderColor: colors.border,
        opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: accent ? '#ffffff26' : colors.accentSoft }}>
        <Ionicons name={icon} size={22} color={accent ? '#fff' : colors.accent} />
      </View>
      <AppText weight="bold" size={15} style={{ color: accent ? '#fff' : colors.text }}>{title}</AppText>
      <AppText size={12} style={{ color: accent ? '#E3EAFE' : colors.textMuted, lineHeight: 18 }}>{sub}</AppText>
    </Pressable>
  );
}

export default function Home() {
  const { t, pick, colors, lang } = usePrefs();
  const { profile, session } = useAuth();
  const insets = useSafeAreaInsets();
  const q = useAsync(async () => {
    const [owner, projects, achievements, updates, settings] = await Promise.all([
      fetchOwnerProfile(), fetchPublishedProjects(6), fetchAchievements(3), fetchUpdates(3), fetchSettings(),
    ]);
    return { owner, projects, achievements, updates, settings };
  });

  const name = profile?.full_name?.split(' ')[0];
  const greeting = session && name ? t('welcomeUser', { name }) : t('welcomeGuest');

  const goProtected = (path: '/request/new' | '/consultation/new') => {
    if (!session) router.push({ pathname: '/auth/sign-in', params: { next: path } });
    else router.push(path);
  };

  return (
    <Screen padded={false} refreshing={q.refreshing} onRefresh={q.refresh}>
      <LinearGradient
        colors={[colors.heroFrom, colors.heroTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: 56, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
      >
        <FadeIn>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <LogoMark size={44} />
              <View>
                <AppText weight="bold" size={18} style={{ color: '#fff', letterSpacing: 2, lineHeight: 24 }}>FAHDAR</AppText>
                <AppText size={12} style={{ color: '#A9C0FB', lineHeight: 18 }}>فَهْدَار</AppText>
              </View>
            </View>
            {session ? (
              <Pressable accessibilityLabel={t('notifications')} onPress={() => router.push('/notifications')} hitSlop={10}>
                <Ionicons name="notifications-outline" size={24} color="#fff" />
              </Pressable>
            ) : null}
          </View>
          <AppText size={15} style={{ color: '#C9D6FF', marginTop: 28 }}>{greeting}</AppText>
          <AppText weight="bold" size={30} style={{ color: '#fff', lineHeight: 44 }}>{t('tagline')}</AppText>
          <AppText size={14} style={{ color: '#C9D6FF', marginTop: 6 }} numberOfLines={3}>
            {q.data ? pick(q.data.owner.headline, q.data.owner.headline_en) || pick(q.data.owner.full_name, q.data.owner.full_name_en) : t('ownerName')}
          </AppText>
        </FadeIn>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, marginTop: -36, gap: 16 }}>
        <FadeIn delay={80} style={{ flexDirection: 'row', gap: 12 }}>
          <ActionTile accent icon="rocket-outline" title={t('requestProject')} sub={t('requestProjectSub')} onPress={() => goProtected('/request/new')} />
          <ActionTile
            icon="chatbubbles-outline"
            title={t('techConsult')}
            sub={t('techConsultSub', { n: q.data?.settings.consultations_per_month ?? 2 })}
            onPress={() => goProtected('/consultation/new')}
          />
        </FadeIn>

        {!isConfigured ? <Banner tone="warning" text={t('notConfigured')} /> : null}
        {q.loading ? <View style={{ height: 240 }}><LoadingView /></View> : null}
        {q.error && !q.data ? <ErrorView error={q.error} onRetry={q.reload} /> : null}

        {q.data ? (
          <>
            {!q.data.settings.requests_enabled ? (
              <Banner tone="warning" text={q.data.settings.requests_paused_message || t('requestsPaused')} />
            ) : null}

            <FadeIn delay={140}>
              <Card onPress={() => router.push('/about')}>
                <AppText weight="bold" size={17}>{pick(q.data.owner.full_name, q.data.owner.full_name_en)}</AppText>
                <AppText muted numberOfLines={4}>{pick(q.data.owner.bio, q.data.owner.bio_en) || t('aboutShortEmpty')}</AppText>
                <AppText weight="semibold" size={13} style={{ color: colors.accent }}>{t('learnMore')}</AppText>
              </Card>
            </FadeIn>

            <SectionHeader title={t('latestProjects')} action={q.data.projects.length ? t('seeAll') : undefined} onAction={() => router.push('/projects')} />
            {q.data.projects.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
                {q.data.projects.map((p) => <ProjectCard key={p.id} project={p} compact />)}
              </ScrollView>
            ) : (
              <EmptyView icon="grid-outline" text={t('noProjectsYet')} />
            )}

            <SectionHeader title={t('highlights')} action={q.data.achievements.length ? t('seeAll') : undefined} onAction={() => router.push('/about')} />
            {q.data.achievements.length ? (
              q.data.achievements.map((a) => (
                <Card key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Ionicons name="trophy-outline" size={24} color={colors.warning} />
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold">{pick(a.title, a.title_en)}</AppText>
                    {a.achieved_on ? <AppText muted size={12}>{formatDate(a.achieved_on, lang)}</AppText> : null}
                  </View>
                </Card>
              ))
            ) : (
              <EmptyView icon="trophy-outline" text={t('noAchievementsYet')} />
            )}

            <SectionHeader title={t('skillsInterests')} />
            {q.data.owner.skills.length || q.data.owner.interests.length ? (
              <Tags items={[...q.data.owner.skills, ...q.data.owner.interests]} />
            ) : (
              <EmptyView icon="sparkles-outline" text={t('noSkillsYet')} />
            )}

            <SectionHeader title={t('latestUpdates')} />
            {q.data.updates.length ? (
              q.data.updates.map((u) => (
                <Card key={u.id}>
                  <AppText muted size={12}>{formatDate(u.created_at, lang)}</AppText>
                  <AppText weight="semibold">{pick(u.title, u.title_en)}</AppText>
                  {pick(u.body, u.body_en) ? <AppText muted size={14}>{pick(u.body, u.body_en)}</AppText> : null}
                </Card>
              ))
            ) : (
              <EmptyView icon="megaphone-outline" text={t('noUpdatesYet')} />
            )}
          </>
        ) : null}
      </View>
    </Screen>
  );
}
