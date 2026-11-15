import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Alert, View } from 'react-native';
import { AppText, Card, Divider, ErrorView, ListRow, LoadingView, Screen, ToggleRow, type IconName } from '../../components/ui';
import { errorKey } from '../../lib/errors';
import { formatBytes } from '../../lib/format';
import { usePrefs } from '../../lib/prefs';
import { fetchSettings } from '../../lib/queries';
import { supabase } from '../../lib/supabase';
import type { StringKey } from '../../lib/strings';
import { must, useAsync } from '../../lib/useAsync';

type Stats = Record<string, number>;

function Stat({ label, value, icon, tone }: { label: string; value: string | number; icon: IconName; tone?: string }) {
  const { colors } = usePrefs();
  return (
    <Card style={{ width: '48%', flexGrow: 1, gap: 4 }}>
      <Ionicons name={icon} size={20} color={tone ?? colors.accent} />
      <AppText weight="bold" size={24} style={{ lineHeight: 32 }}>{value}</AppText>
      <AppText muted size={12}>{label}</AppText>
    </Card>
  );
}

const MENU: { icon: IconName; label: StringKey; href: Href }[] = [
  { icon: 'rocket-outline', label: 'manageRequests', href: '/admin/requests' },
  { icon: 'chatbubbles-outline', label: 'manageConsultations', href: '/admin/consultations' },
  { icon: 'people-outline', label: 'users', href: '/admin/users' },
  { icon: 'grid-outline', label: 'manageProjects', href: '/admin/projects' },
  { icon: 'trophy-outline', label: 'manageAchievements', href: '/admin/achievements' },
  { icon: 'megaphone-outline', label: 'manageUpdates', href: '/admin/updates' },
  { icon: 'person-circle-outline', label: 'editOwnerProfile', href: '/admin/profile' },
  { icon: 'notifications-outline', label: 'sendNotification', href: '/admin/broadcast' },
  { icon: 'options-outline', label: 'usageControl', href: '/admin/settings' },
  { icon: 'folder-open-outline', label: 'manageAttachments', href: '/admin/attachments' },
  { icon: 'list-outline', label: 'activityLog', href: '/admin/activity' },
];

export default function Dashboard() {
  const { t, colors } = usePrefs();
  const q = useAsync(async () => {
    const [stats, settings] = await Promise.all([supabase.rpc('admin_dashboard_stats'), fetchSettings()]);
    return { stats: must(stats) as Stats, settings };
  });
  if (q.loading) return <LoadingView />;
  if (q.error || !q.data) return <ErrorView error={q.error} onRetry={q.reload} />;
  const { stats: s, settings } = q.data;

  const toggleRequests = async (v: boolean) => {
    q.setData((d) => ({ ...d!, settings: { ...d!.settings, requests_enabled: v } }));
    const { error } = await supabase.from('admin_settings').update({ requests_enabled: v }).eq('id', 1);
    if (error) Alert.alert(t('error'), t(errorKey(error)));
    q.silentReload();
  };

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Stat icon="people" label={t('stat_users')} value={s.users_total} />
        <Stat icon="person-add" label={t('stat_usersMonth')} value={s.users_this_month} />
        <Stat icon="file-tray-full" label={t('stat_requests')} value={s.requests_total} />
        <Stat icon="sparkles" label={t('stat_requestsNew')} value={s.requests_new} tone={colors.info} />
        <Stat icon="hammer" label={t('stat_inProgress')} value={s.requests_in_progress} />
        <Stat icon="hourglass" label={t('stat_pending')} value={s.requests_pending} tone={colors.warning} />
        <Stat icon="chatbubbles" label={t('stat_consultOpen')} value={s.consultations_open} tone={colors.warning} />
        <Stat icon="mail" label={t('stat_messages')} value={s.messages_total} />
        <Stat icon="grid" label={t('stat_projects')} value={s.projects_total} />
        <Stat icon="folder" label={t('stat_storage')} value={`${s.attachments_total} • ${formatBytes(s.attachments_bytes)}`} />
      </View>

      <Card>
        <ToggleRow
          label={t('acceptingRequests')}
          value={settings.requests_enabled}
          onChange={toggleRequests}
          hint={settings.requests_enabled ? undefined : t('requestsPaused')}
        />
      </Card>

      <Card style={{ paddingVertical: 4 }}>
        {MENU.map((m, i) => (
          <View key={m.label}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              icon={m.icon}
              label={t(m.label)}
              badge={m.label === 'manageRequests' ? s.requests_new : m.label === 'manageConsultations' ? s.consultations_open : undefined}
              onPress={() => router.push(m.href)}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
