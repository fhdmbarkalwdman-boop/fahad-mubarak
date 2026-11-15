import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { View } from 'react-native';
import { LogoMark } from '../../components/Logo';
import { AppText, Card, EmptyView, ErrorView, FadeIn, ListRow, LoadingView, Screen, SectionHeader, Tags, type IconName } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { fetchAchievements, fetchOwnerProfile } from '../../lib/queries';
import { useAsync } from '../../lib/useAsync';

function socialIcon(label: string, url: string): IconName {
  const s = `${label} ${url}`.toLowerCase();
  if (s.includes('github')) return 'logo-github';
  if (s.includes('linkedin')) return 'logo-linkedin';
  if (s.includes('x.com') || s.includes('twitter')) return 'logo-twitter';
  if (s.includes('instagram')) return 'logo-instagram';
  if (s.includes('youtube')) return 'logo-youtube';
  if (s.includes('tiktok')) return 'logo-tiktok';
  if (s.includes('snapchat')) return 'logo-snapchat';
  if (s.includes('whatsapp') || s.includes('wa.me')) return 'logo-whatsapp';
  if (s.includes('t.me') || s.includes('telegram')) return 'paper-plane-outline';
  return 'globe-outline';
}

export default function About() {
  const { t, pick, colors, lang } = usePrefs();
  const q = useAsync(async () => {
    const [owner, achievements] = await Promise.all([fetchOwnerProfile(), fetchAchievements()]);
    return { owner, achievements };
  });
  if (q.loading) return <LoadingView />;
  if (q.error && !q.data) return <ErrorView error={q.error} onRetry={q.reload} />;
  const { owner, achievements } = q.data!;

  const lists: { title: string; items: string[] }[] = [
    { title: t('interests'), items: owner.interests },
    { title: t('skills'), items: owner.skills },
    { title: t('programmingAreas'), items: owner.programming_areas },
  ];

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <FadeIn>
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
          {owner.avatar_url ? (
            <Image source={{ uri: owner.avatar_url }} style={{ width: 108, height: 108, borderRadius: 54, borderWidth: 3, borderColor: colors.accent }} contentFit="cover" />
          ) : (
            <LogoMark size={96} />
          )}
          <AppText weight="bold" size={22}>{pick(owner.full_name, owner.full_name_en)}</AppText>
          {pick(owner.headline, owner.headline_en) ? (
            <AppText muted style={{ textAlign: 'center' }}>{pick(owner.headline, owner.headline_en)}</AppText>
          ) : null}
        </Card>
      </FadeIn>

      <Card>
        <AppText weight="bold" size={16}>{t('aboutTitle')}</AppText>
        <AppText muted={!pick(owner.bio, owner.bio_en)}>{pick(owner.bio, owner.bio_en) || t('aboutShortEmpty')}</AppText>
      </Card>

      {lists.filter((l) => l.items.length).map((l) => (
        <Card key={l.title}>
          <AppText weight="bold" size={16}>{l.title}</AppText>
          <Tags items={l.items} />
        </Card>
      ))}

      <SectionHeader title={t('achievements')} />
      {achievements.length ? (
        achievements.map((a) => (
          <Card key={a.id} onPress={a.link ? () => Linking.openURL(a.link!) : undefined}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Ionicons name="trophy" size={20} color={colors.warning} />
              <AppText weight="semibold" style={{ flex: 1 }}>{pick(a.title, a.title_en)}</AppText>
              {a.link ? <Ionicons name="open-outline" size={16} color={colors.textMuted} /> : null}
            </View>
            {a.achieved_on ? <AppText muted size={12}>{formatDate(a.achieved_on, lang)}</AppText> : null}
            {pick(a.description, a.description_en) ? <AppText muted size={14}>{pick(a.description, a.description_en)}</AppText> : null}
          </Card>
        ))
      ) : (
        <EmptyView icon="trophy-outline" text={t('noAchievementsYet')} />
      )}

      {owner.social_links.length || owner.contact_email ? (
        <>
          <SectionHeader title={t('social')} />
          <Card style={{ paddingVertical: 4 }}>
            {owner.contact_email ? (
              <ListRow icon="mail-outline" label={owner.contact_email} onPress={() => Linking.openURL(`mailto:${owner.contact_email}`)} />
            ) : null}
            {owner.social_links.map((s) => (
              <ListRow key={s.url} icon={socialIcon(s.label, s.url)} label={s.label || s.url} onPress={() => Linking.openURL(s.url)} />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
