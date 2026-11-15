import { View } from 'react-native';
import { formatDate } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import type { Quota } from '../lib/types';
import { AppText, Card } from './ui';

export function QuotaCard({ quota }: { quota: Quota }) {
  const { t, colors, lang } = usePrefs();
  const total = quota.monthly_limit + quota.extra;
  const ratio = total > 0 ? Math.min(quota.used / total, 1) : 1;
  return (
    <Card>
      <AppText weight="bold">{t('quotaRemaining', { n: quota.remaining, total })}</AppText>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
        <View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: quota.remaining > 0 ? colors.accent : colors.danger }} />
      </View>
      <AppText muted size={12}>{t('quotaResets', { date: formatDate(quota.resets_at, lang) })}</AppText>
    </Card>
  );
}
